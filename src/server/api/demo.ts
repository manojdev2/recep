import "server-only";
import { recordProviderEvent, transcribe } from "../ai";
import { realtimeVoiceId } from "@/lib/catalog";
import { blankAgent } from "../agent-defaults";
import { db } from "../db";
import { runTurn } from "../engine";
import { allow, clientIp } from "../rate-limit";
import { publicMutation, publicQuery, RpcError, type Ctx } from "../rpc";
import { flag, getSetting, numberSetting, requestOrigin } from "../settings";
import type { Agent } from "../types";

export const DEMO_AGENT = {
  key: "receptionai-demo",
  name: "Reception AI",
  tagline: "A warm welcome for every caller.",
  greeting: "Hi, I’m Reception AI — an AI receptionist, here as a demo. What would you like to know?",
  voiceId: "marin",
  language: "en",
  systemPrompt:
    "You are Reception AI, a friendly AI receptionist in a public product demonstration on Reception AI's website. Introduce yourself as an AI demo. Keep replies brief, warm, and conversational — two or three sentences. Help visitors understand how Reception AI can welcome callers, answer everyday business questions, take messages, and help book appointments once it is connected to their phone, website, and calendar. The product also includes outbound calling campaigns with calling windows and retries, a contact book and lead board, forms, business knowledge from websites and documents, visual conversation workflows, analytics and CSV exports, website widget branding, and configurable business hours and handover rules. Available business integrations include Gmail, Google Calendar, Google Sheets, Outlook email, Slack, HubSpot, Salesforce, Shopify order lookup, Stripe payment-status lookup, Zendesk, Notion search, Calendly event lookup, and custom MCP tools. Connected model providers include OpenAI, Anthropic, Together AI, and OpenRouter; speech providers include ElevenLabs and Cartesia, with Deepgram transcription. Each connection supports specific actions and requires configuration and provider access. Do not suggest that connecting an app enables every feature of that service. This demo has no access to real orders, calendars, accounts, or business data. Never claim to have checked an order, booked anything, saved a message, or performed an action. If a visitor wants to role-play as a customer of their business, clearly call it a pretend example. Do not ask for sensitive personal details. Ask one question at a time and follow the visitor's language.",
  guardrails: "Never claim to have booked, saved, checked, or sent anything.\nNever ask for payment details, passwords, or personal identifiers.",
};

/** What the homepage receptionist knows — plan details are read live from the plans table. */
function demoKnowledge() {
  const plan = (id: string) => db().plans.find((p) => p.id === id);
  const studio = plan("studio");
  const scale = plan("scale");
  const enterprise = plan("enterprise");
  const n = (v: number | null | undefined) => (v == null ? "unlimited" : v.toLocaleString());
  return [
    {
      id: "demo_what",
      title: "What Reception AI does",
      content:
        "Reception AI is an AI receptionist for small businesses. It answers calls and website chats, welcomes people, answers everyday questions from the details the owner shares (services, prices, hours), takes messages, and helps callers book a visit or request a callback. Owners set it up in their own words, choose a voice and greeting, connect their phone number or website, and decide when a person should take over. All conversations are kept in one place. The workspace also has outbound campaigns, a contact book, a lead board, forms, appointment management, visual workflows, website and document knowledge, analytics with CSV export, and a customizable website widget. Connect business apps, supported model and speech providers, or custom MCP tools. Each integration needs configuration and has specific supported actions.",
    },
    {
      id: "demo_plans",
      title: "Plans",
      content: `${studio?.name ?? "Studio"} is free to start: ${n(studio?.minutes)} minutes of talk time, ${n(studio?.agents)} AI receptionist, chat on your website. ${scale?.name ?? "Scale"} is ${scale?.priceLabel ?? "$89 / seat / month"}: ${n(scale?.minutes)} minutes included, phone, SMS and WhatsApp, call insights, practice calls, and calendar connection. ${enterprise?.name ?? "Enterprise"} is custom pricing with single sign-on, a custom voice, hands-on setup, contracts and support.`,
    },
    {
      id: "demo_start",
      title: "Getting started",
      content:
        "Sign up free, describe the business naturally (services, hours, common questions), pick a voice, try a conversation, then connect a phone number or add the chat widget to a website.",
    },
  ];
}

function demoAgent(): Agent {
  const a = blankAgent("demo", "__demo__", new Date().toISOString());
  return {
    ...a,
    name: DEMO_AGENT.name,
    tagline: DEMO_AGENT.tagline,
    greeting: DEMO_AGENT.greeting,
    voiceId: DEMO_AGENT.voiceId,
    systemPrompt: DEMO_AGENT.systemPrompt,
    guardrails: DEMO_AGENT.guardrails,
    status: "live",
  };
}

function refererAllowed(agent: Agent, req: Request) {
  const allowed = agent.widgetConfig.allowedDomains.filter(Boolean);
  if (!allowed.length) return true;
  const ref = req.headers.get("referer") ?? "";
  const host = (() => {
    try {
      return new URL(ref).hostname;
    } catch {
      return "";
    }
  })();
  const self = new URL(requestOrigin(req)).hostname;
  return host === self || allowed.some((d) => host === d || host.endsWith(`.${d.replace(/^\*\./, "")}`));
}

/** A public agent, or the owner previewing their own draft. */
function publicAgent(agentId: string, ctx: Ctx) {
  if (!flag("FEATURE_WIDGET", true)) return null;
  const agent = db().agents.find((a) => a.id === agentId);
  if (!agent) return null;
  const preview = agent.status !== "live";
  if (preview && ctx.user?.id !== agent.userId) return null;
  return { agent, preview };
}

function limitOrThrow(agentId: string, ownerId: string | null, req: Request) {
  const ip = clientIp(req);
  if (!allow(`ip:${ip}`, numberSetting("LIMIT_WIDGET_IP", 12), 60_000)) throw new RpcError("Slow down a little — try again in a minute.", 429);
  if (!allow(`agent:${agentId}`, numberSetting("LIMIT_WIDGET_AGENT", 90), 60_000)) throw new RpcError("This line is busy. Try again shortly.", 429);
  if (ownerId && !allow(`ws:${ownerId}`, numberSetting("LIMIT_WIDGET_WORKSPACE_DAY", 2000), 864e5)) {
    throw new RpcError("This line has reached today's limit.", 429);
  }
}

export const demo = {
  agent: publicQuery((agentId: string, ctx) => {
    const found = publicAgent(agentId, ctx);
    if (!found) return null;
    const { agent, preview } = found;
    if (!refererAllowed(agent, ctx.req)) return null;
    return {
      id: agent.id,
      name: agent.name,
      tagline: agent.tagline,
      greeting: agent.greeting,
      voiceId: agent.voiceId,
      language: agent.language,
      status: agent.status,
      preview,
      widget: agent.widgetConfig,
    };
  }),

  reply: publicMutation(
    async (
      input: { agentId: string; conversationId?: string; speak: boolean; messages: { role: "user" | "assistant"; content: string }[] },
      ctx,
    ) => {
      if (input.agentId === "demo") {
        limitOrThrow("demo", null, ctx.req);
        return runTurn({ agent: demoAgent(), messages: input.messages, channel: "web", speak: input.speak, persist: false, knowledge: demoKnowledge() });
      }
      const found = publicAgent(input.agentId, ctx);
      if (!found) return { ok: false as const, error: "This line isn’t public." };
      if (!refererAllowed(found.agent, ctx.req)) return { ok: false as const, error: "This line can’t be used on this site." };
      limitOrThrow(found.agent.id, found.agent.userId, ctx.req);
      return runTurn({
        agent: found.agent,
        conversationId: input.conversationId,
        messages: input.messages,
        channel: "web",
        speak: input.speak,
        persist: !found.preview,
      });
    },
  ),

  transcribe: publicMutation(async (input: { audioBase64: string; mimeType: string; language: string }, ctx) => {
    if (!allow(`stt:${clientIp(ctx.req)}`, 12, 60_000)) return { ok: false as const, error: "Slow down a little — try again in a minute." };
    const out = await transcribe(input.audioBase64, input.mimeType, input.language);
    return out.ok ? { ok: true as const, text: out.text } : out;
  }),
};

/** The landing page's live voice demo: browser WebRTC, SDP handshake proxied to OpenAI Realtime. */
export const demoVoice = {
  status: publicQuery(() => ({ available: Boolean(getSetting("OPENAI_API_KEY")) && flag("FEATURE_LIVE_DEMO", true) })),

  connect: publicMutation(async (input: { sdp: string }, ctx) => {
    const key = getSetting("OPENAI_API_KEY");
    if (!key || !flag("FEATURE_LIVE_DEMO", true)) return { ok: false as const, error: "Live voice isn’t switched on for this preview yet." };
    if (!input.sdp || input.sdp.length > 20_000) return { ok: false as const, error: "That connection request wasn’t valid." };
    if (!allow(`rtc:${clientIp(ctx.req)}`, numberSetting("LIMIT_DEMO_VOICE_IP", 4), 600_000)) {
      return { ok: false as const, error: "You’ve started a few conversations already. Try again in a few minutes." };
    }
    const session = {
      type: "realtime",
      model: getSetting("REALTIME_MODEL") || "gpt-realtime",
      instructions: `${DEMO_AGENT.systemPrompt}\n\n${DEMO_AGENT.guardrails}\n\nWhat you know:\n${demoKnowledge()
        .map((k) => `### ${k.title}\n${k.content}`)
        .join("\n\n")}`,
      audio: {
        input: { transcription: { model: "gpt-4o-mini-transcribe" }, turn_detection: { type: "semantic_vad" } },
        output: { voice: realtimeVoiceId(DEMO_AGENT.voiceId) },
      },
    };
    const form = new FormData();
    form.set("sdp", input.sdp);
    form.set("session", JSON.stringify(session));
    const started = Date.now();
    try {
      const res = await fetch("https://api.openai.com/v1/realtime/calls", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}` },
        body: form,
      });
      const text = await res.text();
      recordProviderEvent("openai", "realtime.connect", res.ok, Date.now() - started, res.ok ? null : `${res.status} ${text.slice(0, 300)}`);
      if (!res.ok) return { ok: false as const, error: "The voice service couldn’t start a conversation. Please try again." };
      return { ok: true as const, sdp: text };
    } catch (e) {
      recordProviderEvent("openai", "realtime.connect", false, Date.now() - started, e instanceof Error ? e.message : String(e));
      return { ok: false as const, error: "The voice service couldn’t be reached. Please try again." };
    }
  }),
};
