import "server-only";
import { LANGUAGES, TOOL_CATALOG } from "@/lib/catalog";
import { newId } from "@/lib/utils";
import { chatComplete, speak, type ChatMessage, type ToolCall } from "./ai";
import { runTool, toolSpecs } from "./agent-tools";
import { db, nowIso, save } from "./db";
import { searchPassages } from "./extract";
import { spokenTime, workspaceZone } from "./slots";
import type { Agent, Conversation, Workflow } from "./types";
import { assertMinutes, meter } from "./usage";

export type TurnInput = {
  agent: Agent;
  conversationId?: string;
  messages: { role: "user" | "assistant"; content: string }[];
  channel: "web" | "phone" | "whatsapp" | "sms" | "studio";
  speak: boolean;
  /** Count this as a real conversation in the inbox (false for rehearsals). */
  persist?: boolean;
  callerContact?: string | null;
  /** Knowledge that is not in the library (the public demo receptionist). */
  knowledge?: { id: string; title: string; content: string }[];
};

export type TurnResult =
  | {
      ok: true;
      conversationId: string;
      text: string;
      citations: { title: string }[];
      traces: { name: string; result: string }[];
      audioBase64?: string;
    }
  | { ok: false; error: string };

function describeWorkflow(w: Workflow) {
  if (!w.nodes.length || (w.nodes.length === 1 && !w.edges.length)) return "";
  const label = (id: string) => w.nodes.find((n) => n.id === id)?.data.label ?? id;
  const lines = w.nodes.map((n) => {
    const outs = w.edges
      .filter((e) => e.from === n.id)
      .map((e) =>
        e.condition?.match === "else"
          ? `otherwise → ${label(e.to)}`
          : e.condition?.phrases
            ? `if they mean "${e.condition.phrases}" → ${label(e.to)}`
            : `then → ${label(e.to)}`,
      );
    const what =
      n.type === "start"
        ? `Entry (${n.data.trigger ?? "any"} call)`
        : n.type === "tool"
          ? `Use the ${n.data.toolKey} tool`
          : n.type === "transfer"
            ? `Say "${n.data.text ?? ""}" and transfer${n.data.destination ? ` to ${n.data.destination}` : ""}`
            : n.type === "end"
              ? `End the conversation (${n.data.endReason ?? "completed"})`
              : n.type === "sms"
                ? `Send a text: "${n.data.text ?? ""}"`
                : `Say: "${n.data.text ?? ""}" then listen`;
    return `- [${n.data.label}] ${what}${outs.length ? `; ${outs.join("; ")}` : ""}`;
  });
  return `\nFollow this call flow step by step. Do not skip steps:\n${lines.join("\n")}`;
}

export function systemPrompt(agent: Agent, passages: { title: string; text: string }[]) {
  const zone = workspaceZone(agent.userId) || "UTC";
  const now = new Date().toLocaleString("en-US", { timeZone: zone, dateStyle: "full", timeStyle: "short" });
  // Models are unreliable at turning "Thursday" into a date; spell out the next two weeks (the booking horizon).
  const [y, m, d] = new Date().toLocaleDateString("en-CA", { timeZone: zone }).split("-").map(Number);
  const week = Array.from({ length: 14 }, (_, i) => {
    const day = new Date(Date.UTC(y, m - 1, d + i, 12));
    const name = day.toLocaleDateString("en-US", { timeZone: "UTC", weekday: "long" });
    return `${name}${i === 0 ? " (today)" : i === 1 ? " (tomorrow)" : ""} = ${day.toISOString().slice(0, 10)}`;
  }).join(", ");
  const lang = LANGUAGES.find((l) => l.id === agent.language)?.label ?? "English";
  const tools = db()
    .agentTools.filter((t) => t.agentId === agent.id && t.enabled)
    .map((t) => TOOL_CATALOG.find((d) => d.key === t.toolKey)?.name)
    .filter(Boolean);
  return [
    agent.systemPrompt || `You are the receptionist for ${agent.name}. Be warm, brief and helpful.`,
    "",
    `It is ${now} (${zone}). Upcoming dates: ${week}. Reply in ${lang} unless the caller uses another language.`,
    "Keep replies short and spoken-sounding: one to three sentences, one question at a time. No lists or markdown.",
    "Only state facts about the business that appear in these instructions or the knowledge below. If you do not know, say so and offer to take a message.",
    "Never claim to have booked, saved, or sent anything unless a tool result confirms it.",
    agent.guardrails ? `\nThings you must never do:\n${agent.guardrails}` : "",
    tools.length ? `\nYou can use these tools: ${tools.join(", ")}.` : "",
    // Without this, models answer "that time is taken" or "we're closed" from memory.
    db().agentTools.some((t) => t.agentId === agent.id && t.enabled && t.toolKey === "list_slots")
      ? "Whenever a caller asks about or picks a day or time, call list_slots for it in that same turn before answering. Never say a time is open, taken or closed without a list_slots result from this turn."
      : "",
    agent.brain === "workflow" ? describeWorkflow(agent.workflow) : "",
    passages.length
      ? `\nBusiness knowledge (answer from this):\n${passages.map((p) => `### ${p.title}\n${p.text}`).join("\n\n")}`
      : "\nThere is no business knowledge uploaded yet; do not invent prices, hours or policies.",
  ]
    .filter((l) => l !== "")
    .join("\n");
}

function sentimentOf(text: string): Conversation["sentiment"] {
  const t = text.toLowerCase();
  if (/(angry|ridiculous|terrible|awful|useless|complain|furious|third time|not happy|unacceptable)/.test(t)) return "negative";
  if (/(thank|great|perfect|lovely|brilliant|awesome|appreciate|wonderful)/.test(t)) return "positive";
  return "neutral";
}

/** Offline reply when no model key is configured: answer from knowledge, honestly. */
function offlineReply(agent: Agent, question: string, passages: { title: string; text: string }[]) {
  if (passages.length) {
    const first = passages[0].text.split(/(?<=[.!?])\s+/).slice(0, 2).join(" ");
    return `${first} (Offline preview — add an xAI or OpenAI key in platform settings for full conversations.)`;
  }
  if (!question.trim()) return agent.greeting || "Hello — how can I help?";
  return "I'm running in offline preview, so I can't hold a full conversation yet. An administrator can add an xAI or OpenAI API key in platform settings.";
}

/** Rehearsals read the real diary and knowledge but never write bookings, leads or tickets. */
async function practiceTool(name: string, args: Record<string, unknown>, agent: Agent, conversation: Conversation, callerText: string) {
  switch (name) {
    case "list_slots":
    case "search_catalog":
    case "lookup_order":
      return runTool(name, args, { agent, conversation, callerText });
    case "book_appointment":
      return { booked: true, practice: true, name: args.name ?? "", when: "the time you offered", confirmation: "PRACTICE" };
    case "capture_lead":
      return { captured: true, practice: true, name: args.name ?? "" };
    case "create_ticket":
      return { ticket: "T-PRACTICE", practice: true };
    case "transfer_human":
    case "transfer_call":
      return { transferred: true, practice: true };
    default:
      return { ok: true, practice: true };
  }
}

export async function runTurn(input: TurnInput): Promise<TurnResult> {
  const { agent } = input;
  const data = db();
  const isDemo = agent.userId === "__demo__";
  try {
    if (!isDemo) assertMinutes(agent.userId);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message.replace(/^Plan limit: /, "") : "Minutes are used up." };
  }

  const persist = input.persist !== false;
  // Only spoken text: stored tool rows (phone fallback history) have no tool_call_id and would be rejected.
  const history = input.messages.filter((m) => (m.role === "user" || m.role === "assistant") && m.content?.trim()).slice(-24);
  const last = [...history].reverse().find((m) => m.role === "user");
  if (!last) return { ok: false, error: "Say something first." };

  let conversation = input.conversationId
    ? data.conversations.find((c) => c.id === input.conversationId && c.agentId === agent.id)
    : undefined;
  if (!conversation) {
    const now = nowIso();
    conversation = {
      id: newId("cnv"),
      userId: agent.userId,
      agentId: agent.id,
      channel: input.channel === "studio" ? "web" : input.channel,
      language: agent.language,
      resolved: false,
      sentiment: "neutral",
      durationSec: 0,
      isSample: !persist,
      startedAt: now,
      lastAt: now,
      callerName: null,
      callerContact: input.callerContact ?? null,
      callId: null,
      outcome: null,
    };
    if (persist) {
      data.conversations.push(conversation);
      if (agent.greeting && history[0]?.role === "assistant") {
        data.messages.push({ id: newId("msg"), conversationId: conversation.id, role: "assistant", content: agent.greeting, created_at: now });
      }
    }
  }
  if (persist) data.messages.push({ id: newId("msg"), conversationId: conversation.id, role: "user", content: last.content, created_at: nowIso() });

  const docs = [...data.knowledge.filter((k) => k.agentIds.includes(agent.id)), ...(input.knowledge ?? [])];
  const recentUser = history
    .filter((m) => m.role === "user")
    .slice(-3)
    .map((m) => m.content)
    .join(" ");
  const passages = searchPassages(docs, recentUser, 4);
  const booking = data.slots.find(
    (s) => s.agentId === agent.id && s.conversationId === conversation.id && s.status === "booked" && new Date(s.startsAt).getTime() > Date.now(),
  );

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt(agent, passages) },
    // Earlier tool results aren't in the history, so remind the model which ids it offered.
    ...(conversation.offeredSlots?.length
      ? [
          {
            role: "system" as const,
            content: `Times offered earlier in this conversation (use these ids with book_appointment): ${conversation.offeredSlots
              .map((o) => `${o.id} = ${o.when}`)
              .join("; ")}`,
          },
        ]
      : []),
    // Nor is the booking itself: without this the model re-books on every "yes".
    ...(booking
      ? [
          {
            role: "system" as const,
            content: `This caller is already booked for ${spokenTime(booking.startsAt, workspaceZone(agent.userId))} (confirmation ${booking.confirmation}). Don't book again. Only if they ask to change it: call list_slots with after set to the new date and time, then book_appointment with that id and reschedule: true.`,
          },
        ]
      : []),
    ...history.map((m) => ({ role: m.role, content: m.content }) as ChatMessage),
  ];
  const tools = toolSpecs(agent.id);
  const traces: { name: string; result: string }[] = [];
  let text = "";
  let tokens = 0;
  let provider: string | null = null;

  try {
    for (let round = 0; round < 4; round++) {
      const out = await chatComplete({ messages, tools, temperature: Number(agent.temperature) || 0.6, modelId: agent.modelId });
      if (!out) {
        text = offlineReply(agent, last.content, passages);
        break;
      }
      provider = out.provider;
      tokens += out.tokens;
      if (!out.toolCalls.length) {
        text = out.content.trim();
        break;
      }
      messages.push({ role: "assistant", content: out.content || null, tool_calls: out.toolCalls });
      for (const call of out.toolCalls as ToolCall[]) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(call.function.arguments || "{}");
        } catch {}
        const result = persist
          ? await runTool(call.function.name, args, { agent, conversation, callerText: last.content })
          : await practiceTool(call.function.name, args, agent, conversation, last.content);
        const json = JSON.stringify(result);
        traces.push({ name: call.function.name, result: json });
        messages.push({ role: "tool", tool_call_id: call.id, content: json });
        if (persist) {
          data.messages.push({
            id: newId("msg"),
            conversationId: conversation.id,
            role: "tool",
            content: `${call.function.name}(${JSON.stringify(args)}) → ${json}`,
            created_at: nowIso(),
          });
        }
      }
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "The receptionist could not answer." };
  }
  if (!text) text = "Sorry — could you say that again?";

  const now = nowIso();
  if (persist) {
    data.messages.push({ id: newId("msg"), conversationId: conversation.id, role: "assistant", content: text, created_at: now });
    conversation.durationSec = Math.round((Date.parse(now) - Date.parse(conversation.startedAt)) / 1000);
    conversation.lastAt = now;
    const mood = sentimentOf(last.content);
    if (mood !== "neutral" || conversation.sentiment === "neutral") conversation.sentiment = mood;
  }

  let audioBase64: string | undefined;
  let ttsChars = 0;
  if (input.speak) {
    const audio = await speak(text, agent.voiceId);
    if (audio.ok) {
      audioBase64 = audio.audioBase64;
      ttsChars = audio.chars;
    }
  }

  meter(
    isDemo ? null : agent.userId,
    isDemo ? null : { kind: "text" },
    [
      ...(provider ? [{ provider, operation: "chat", units: tokens / 1000 }] : []),
      ...(ttsChars ? [{ provider: "openai", operation: "speech", units: ttsChars / 1000 }] : []),
    ],
  );
  save();

  const cited = new Map<string, string>();
  for (const p of passages) if (!cited.has(p.docId)) cited.set(p.docId, p.title);
  return {
    ok: true,
    conversationId: conversation.id,
    text,
    citations: passages.length && provider ? [...cited.values()].slice(0, 3).map((title) => ({ title })) : [],
    traces,
    audioBase64,
  };
}
