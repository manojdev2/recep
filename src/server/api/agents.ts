import "server-only";
import { newId } from "@/lib/utils";
import { createAgent } from "../agent-factory";
import { db, nowIso, save } from "../db";
import type { Draft } from "../design";
import { runTurn } from "../engine";
import { mutation, query, RpcError } from "../rpc";
import { importNumber, pointNumber, publicPhone, removeNumber, testNumber } from "../telephony/numbers";
import type { Agent } from "../types";
import { assertLiveSlot } from "../usage";

export function agentRow(agent: Agent) {
  const phone = db().phoneNumbers.find((n) => n.agentId === agent.id);
  return { ...agent, phoneE164: phone?.e164 ?? null };
}

export function ownAgent(userId: string, id: string) {
  const agent = db().agents.find((a) => a.id === id && a.userId === userId);
  if (!agent) throw new RpcError("This receptionist is gone.", 404);
  return agent;
}

const EDITABLE = [
  "name",
  "tagline",
  "description",
  "voiceId",
  "language",
  "systemPrompt",
  "greeting",
  "temperature",
  "status",
  "firstMessageMode",
  "channels",
  "guardrails",
  "job",
  "modelId",
  "interrupt",
  "knowCaller",
  "direction",
  "brain",
  "callConfig",
  "workflow",
  "widgetConfig",
] as const;

const SCENARIOS = [
  {
    key: "refund",
    name: "Refund request",
    goal: "Look up the order and offer a refund or re-route without inventing policy.",
    turns: [
      "Hi — I ordered something four days ago and it still isn't here.",
      "It's order 4821. Can I just get a refund?",
      "Fine. Do the refund and email me when it's posted.",
    ],
  },
  {
    key: "book",
    name: "New booking",
    goal: "Collect name and time, then confirm a slot out loud.",
    turns: ["I need an appointment this week.", "Thursday morning if you have it. Name is Priya Shah.", "Yes, book that."],
  },
  {
    key: "handoff",
    name: "Angry handoff",
    goal: "Acknowledge once, then transfer with a brief — do not argue.",
    turns: ["This is the third time I've called. I want a person. Now.", "Don't read me a policy. Transfer me."],
  },
];

async function playScenario(agent: Agent, turns: string[]) {
  const transcript: { role: "user" | "assistant"; content: string }[] = [];
  if (agent.greeting) transcript.push({ role: "assistant", content: agent.greeting });
  const traces: string[] = [];
  for (const turn of turns) {
    transcript.push({ role: "user", content: turn });
    const out = await runTurn({ agent, messages: transcript, channel: "studio", speak: false, persist: false });
    if (!out.ok) return { ok: false as const, error: out.error };
    transcript.push({ role: "assistant", content: out.text });
    traces.push(...out.traces.map((t) => t.name));
  }
  return { ok: true as const, transcript, traces };
}

export const agents = {
  list: query((_: void, { user }) =>
    db()
      .agents.filter((a) => a.userId === user.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(agentRow),
  ),

  workspace: query((_: void, { user }) => {
    const data = db();
    return {
      agents: data.agents.filter((a) => a.userId === user.id).length,
      talks: data.conversations.filter((c) => c.userId === user.id).length,
    };
  }),

  get: query((id: string, { user }) => {
    const agent = ownAgent(user.id, id);
    const data = db();
    return {
      agent,
      docs: data.knowledge.filter((k) => k.agentIds.includes(agent.id)),
      tools: data.agentTools.filter((t) => t.agentId === agent.id),
    };
  }),

  create: mutation((input: { templateKey?: string; draft?: Draft }, { user }) => {
    const agent = createAgent(user.id, input);
    return { id: agent.id };
  }),

  update: mutation((input: Partial<Agent> & { id: string }, { user }) => {
    const agent = ownAgent(user.id, input.id);
    if (input.status === "live" && agent.status !== "live") assertLiveSlot(user.id, agent.id);
    for (const key of EDITABLE) {
      if (input[key] !== undefined) (agent as Record<string, unknown>)[key] = input[key];
    }
    if (!agent.name.trim()) agent.name = "Untitled receptionist";
    agent.updatedAt = nowIso();
    save();
    return agentRow(agent);
  }),

  remove: mutation((id: string, { user }) => {
    const agent = ownAgent(user.id, id);
    const data = db();
    const convIds = new Set(data.conversations.filter((c) => c.agentId === agent.id).map((c) => c.id));
    data.agents = data.agents.filter((a) => a.id !== agent.id);
    data.agentTools = data.agentTools.filter((t) => t.agentId !== agent.id);
    data.conversations = data.conversations.filter((c) => c.agentId !== agent.id);
    data.messages = data.messages.filter((m) => !convIds.has(m.conversationId));
    data.slots = data.slots.filter((s) => s.agentId !== agent.id);
    data.hours = data.hours.filter((h) => h.agentId !== agent.id);
    data.agentConnections = data.agentConnections.filter((l) => l.agentId !== agent.id);
    for (const k of data.knowledge) k.agentIds = k.agentIds.filter((a) => a !== agent.id);
    for (const n of data.phoneNumbers) if (n.agentId === agent.id) n.agentId = null;
    save();
    return { ok: true };
  }),

  // ---- Phone numbers -----------------------------------------------------------------
  phones: query((_: void, { user }) =>
    db()
      .phoneNumbers.filter((n) => n.userId === user.id)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map(publicPhone),
  ),

  addTestNumber: mutation((input: { label?: string }, { user }) => publicPhone(testNumber(user.id, input.label ?? "Inbound line"))),

  assignNumber: mutation((input: { id: string; agentId: string | null }, { user }) => {
    const n = db().phoneNumbers.find((p) => p.id === input.id && p.userId === user.id);
    if (!n) throw new RpcError("That number is gone.", 404);
    if (input.agentId) ownAgent(user.id, input.agentId);
    n.agentId = input.agentId;
    save();
    return publicPhone(n);
  }),

  importNumber: mutation(
    (
      input: {
        provider: string;
        e164?: string;
        dial: string;
        label?: string;
        smsEnabled: boolean;
        autoConfigure: boolean;
        config: Record<string, string>;
      },
      { user },
    ) => importNumber(user.id, input),
  ),

  pointNumber: mutation((id: string, { user }) => pointNumber(user.id, id)),

  removeNumber: mutation((id: string, { user }) => removeNumber(user.id, id)),

  // ---- Conversations -----------------------------------------------------------------
  conversations: query((_: void, { user }) => {
    const data = db();
    const since = Date.now() - 14 * 864e5;
    return data.conversations
      .filter((c) => c.userId === user.id && (new Date(c.lastAt).getTime() >= since || data.conversations.length < 50))
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .map((c) => {
        const first = data.messages.find((m) => m.conversationId === c.id && m.role === "user");
        return {
          id: c.id,
          agentId: c.agentId,
          agentName: data.agents.find((a) => a.id === c.agentId)?.name ?? "Receptionist",
          channel: c.channel,
          language: c.language,
          resolved: c.resolved,
          sentiment: c.sentiment,
          durationSec: c.durationSec,
          isSample: c.isSample,
          startedAt: c.startedAt,
          preview: first?.content ?? "",
          outcome: c.outcome,
        };
      });
  }),

  messages: query((conversationId: string, { user }) => {
    const data = db();
    const c = data.conversations.find((x) => x.id === conversationId && x.userId === user.id);
    if (!c) return [];
    return data.messages
      .filter((m) => m.conversationId === c.id)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map(({ id, role, content, created_at }) => ({ id, role, content, created_at }));
  }),

  analytics: query((input: { days: number; agentId?: string }, { user }) => {
    const data = db();
    const days = Math.min(365, Math.max(1, input.days || 14));
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    start.setUTCDate(start.getUTCDate() - (days - 1));
    const rows = data.conversations.filter(
      (c) => c.userId === user.id && (!input.agentId || c.agentId === input.agentId) && new Date(c.startedAt) >= start,
    );
    const series = Array.from({ length: days }, (_, i) => {
      const d = new Date(start.getTime() + i * 864e5).toISOString().slice(0, 10);
      const today = rows.filter((c) => c.startedAt.slice(0, 10) === d);
      return { day: d, conversations: today.length, resolved: today.filter((c) => c.resolved).length };
    });
    const count = (key: "channel" | "language") => {
      const m = new Map<string, number>();
      for (const c of rows) m.set(c[key], (m.get(c[key]) ?? 0) + 1);
      return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    };
    const resolved = rows.filter((c) => c.resolved).length;
    const inRange = (at: string | null) => !!at && new Date(at) >= start;
    return {
      total: rows.length,
      resolved,
      resolutionRate: rows.length ? Math.round((resolved / rows.length) * 100) : 0,
      avgDuration: rows.length ? Math.round(rows.reduce((s, c) => s + c.durationSec, 0) / rows.length) : 0,
      csat: rows.length ? Math.round((rows.filter((c) => c.sentiment === "positive").length / rows.length) * 100) : 0,
      bookings: data.slots.filter(
        (s) => s.userId === user.id && s.status === "booked" && inRange(s.bookedAt) && (!input.agentId || s.agentId === input.agentId),
      ).length,
      leads: data.leads.filter((l) => l.userId === user.id && inRange(l.createdAt) && (!input.agentId || l.agentId === input.agentId)).length,
      series,
      channels: count("channel"),
      languages: count("language"),
    };
  }),

  // ---- Knowledge on one line ---------------------------------------------------------
  addNote: mutation((input: { agentId: string; title: string; content: string }, { user }) => {
    const agent = ownAgent(user.id, input.agentId);
    if (!input.title.trim() || !input.content.trim()) throw new RpcError("Add a title and a note.");
    const now = nowIso();
    const doc = {
      id: newId("doc"),
      userId: user.id,
      title: input.title.trim().slice(0, 200),
      source: "note" as const,
      sourceUrl: null,
      filename: null,
      mime: null,
      content: input.content.trim().slice(0, 200_000),
      agentIds: [agent.id],
      isSample: false,
      fetchedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    db().knowledge.push(doc);
    save();
    return { id: doc.id, title: doc.title };
  }),

  removeDoc: mutation((docId: string, { user }) => {
    const data = db();
    data.knowledge = data.knowledge.filter((k) => !(k.id === docId && k.userId === user.id));
    save();
    return { ok: true };
  }),

  setTool: mutation((input: { agentId: string; toolKey: string; enabled: boolean }, { user }) => {
    const agent = ownAgent(user.id, input.agentId);
    const data = db();
    const existing = data.agentTools.find((t) => t.agentId === agent.id && t.toolKey === input.toolKey);
    if (existing) existing.enabled = input.enabled;
    else data.agentTools.push({ id: newId("tool"), agentId: agent.id, toolKey: input.toolKey, enabled: input.enabled, config: {}, createdAt: nowIso() });
    save();
    return { ok: true };
  }),

  // ---- Practice ----------------------------------------------------------------------
  simulate: mutation(async (input: { agentId: string; scenario: string }, { user }) => {
    const agent = ownAgent(user.id, input.agentId);
    const scenario = SCENARIOS.find((s) => s.key === input.scenario) ?? SCENARIOS[0];
    const out = await playScenario(agent, scenario.turns);
    if (!out.ok) return { ok: false as const, error: out.error };
    const passed =
      scenario.key === "book"
        ? out.traces.includes("book_appointment") || /book|confirm|time/i.test(out.transcript.at(-1)?.content ?? "")
        : scenario.key === "handoff"
          ? out.traces.some((t) => t.startsWith("transfer")) || /(put you through|transfer|someone will)/i.test(out.transcript.at(-1)?.content ?? "")
          : !/refund (is|has been) (processed|issued|done)/i.test(out.transcript.map((t) => t.content).join(" "));
    return { ok: true as const, transcript: out.transcript, passed, goal: scenario.goal };
  }),

  rehearse: mutation(async (input: { agentId: string }, { user }) => {
    const agent = ownAgent(user.id, input.agentId);
    const scenes = [
      { id: "greet", name: "Greets and asks how to help", turns: ["Hello?"] },
      { id: "fact", name: "Does not invent a price", turns: ["How much is a full service with the senior specialist on a Sunday?"] },
      { id: "book", name: "Moves a booking forward", turns: ["Can I come in this week? My name is Sam Lee."] },
      { id: "human", name: "Hands over when asked", turns: ["I'd like to speak to a person please."] },
    ];
    const results: { id: string; name: string; passed: boolean; detail: string }[] = [];
    for (const scene of scenes) {
      const out = await playScenario(agent, scene.turns);
      if (!out.ok) return { ok: false as const, error: out.error };
      const reply = out.transcript.at(-1)?.content ?? "";
      let passed = reply.length > 0;
      let detail = reply;
      if (scene.id === "fact") {
        passed = !/[$£€₹]\s?\d/.test(reply);
        detail = passed ? `Stayed with the facts: “${reply}”` : `Quoted a price it was never given: “${reply}”`;
      } else if (scene.id === "book") {
        passed = out.traces.some((t) => t === "list_slots" || t === "book_appointment") || /(time|day|when|book)/i.test(reply);
      } else if (scene.id === "human") {
        passed = out.traces.some((t) => t.startsWith("transfer")) || /(put you through|transfer|connect you|someone|colleague|team)/i.test(reply);
      }
      results.push({ id: scene.id, name: scene.name, passed, detail });
    }
    const passedCount = results.filter((r) => r.passed).length;
    agent.rehearsal = { passed: passedCount, total: results.length, at: nowIso() };
    save();
    return { ok: true as const, scenes: results, passed: passedCount, total: results.length };
  }),
};

export const SIM_SCENARIOS = SCENARIOS.map(({ key, name, goal }) => ({ key, name, goal }));
