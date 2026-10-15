import "server-only";
import crypto from "node:crypto";
import { LANGUAGES, realtimeVoiceId } from "@/lib/catalog";
import { newId } from "@/lib/utils";
import { runTool, toolSpecs } from "../agent-tools";
import { unseal } from "../crypto";
import { db, nowIso, save } from "../db";
import { searchPassages } from "../extract";
import { appUrl, getSetting } from "../settings";
import { systemPrompt } from "../engine";
import type { Agent, Call, Conversation, PhoneNumber } from "../types";
import { meter, minutesUsed, planFor } from "../usage";
import { applyCallStatus, normalizeE164 } from "./calls";

/* ---------- XML ---------- */

export const xmlEscape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

export function xml(body: string, status = 200) {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<Response>${body}</Response>`, {
    status,
    headers: { "content-type": "text/xml; charset=utf-8" },
  });
}

/* ---------- signatures ---------- */

/** The URL the carrier signed: our public origin plus the path and query it called. */
export function signedUrl(req: Request) {
  const u = new URL(req.url);
  return `${appUrl()}${u.pathname}${u.search}`;
}

/** Twilio: base64(HMAC-SHA1(url + sorted key/value pairs)). */
export function twilioValid(req: Request, params: Record<string, string>, authToken: string | null | undefined) {
  if (!authToken) return false;
  const header = req.headers.get("x-twilio-signature");
  if (!header) return false;
  const base = signedUrl(req) + Object.keys(params).sort().map((k) => k + params[k]).join("");
  const expected = crypto.createHmac("sha1", authToken).update(base).digest("base64");
  return safeEqual(expected, header);
}

/** Plivo V3: base64(HMAC-SHA256(url[+sorted params] + "." + nonce)). */
export function plivoValid(req: Request, params: Record<string, string>, authToken: string | null | undefined) {
  if (!authToken) return false;
  const header = req.headers.get("x-plivo-signature-v3");
  const nonce = req.headers.get("x-plivo-signature-v3-nonce");
  if (!header || !nonce) return false;
  const url = new URL(signedUrl(req));
  const query = [...url.searchParams.keys()].sort().map((k) => `${k}=${url.searchParams.get(k)}`).join("&");
  const bare = `${url.origin}${url.pathname}`;
  const body = Object.keys(params).sort().map((k) => k + params[k]).join("");
  const base = `${bare}${query ? `?${query}` : ""}${req.method === "POST" ? (query ? "." : "") + body : ""}`;
  const expected = crypto.createHmac("sha256", authToken).update(`${base}.${nonce}`).digest("base64");
  return header.split(",").some((s) => safeEqual(expected, s.trim()));
}

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/** Skip carrier signature checks only when explicitly told to (local tunnels during development). */
export const signaturesRequired = () => getSetting("VOICE_SKIP_SIGNATURES") !== "true";

export async function formParams(req: Request) {
  const out: Record<string, string> = {};
  if (req.method === "POST") {
    const text = await req.text();
    for (const [k, v] of new URLSearchParams(text)) out[k] = v;
  }
  return out;
}

/* ---------- lines and calls ---------- */

export function lineFor(to: string, provider?: string) {
  const e164 = normalizeE164(to);
  const data = db();
  const phone = data.phoneNumbers.find((p) => normalizeE164(p.e164) === e164 && (!provider || p.provider === provider));
  const agent = phone?.agentId ? data.agents.find((a) => a.id === phone.agentId) : undefined;
  return { phone, agent };
}

export function phoneCreds(phone: PhoneNumber | undefined) {
  return unseal<{ sid?: string; token?: string; authId?: string; authToken?: string }>(phone?.secret ?? null);
}

function openConversation(agent: Agent, caller: string): Conversation {
  const now = nowIso();
  const c: Conversation = {
    id: newId("cnv"),
    userId: agent.userId,
    agentId: agent.id,
    channel: "phone",
    language: agent.language,
    resolved: false,
    sentiment: "neutral",
    durationSec: 0,
    isSample: false,
    startedAt: now,
    lastAt: now,
    callerName: null,
    callerContact: caller || null,
    callId: null,
    outcome: null,
  };
  db().conversations.push(c);
  return c;
}

/** Record a ringing inbound call and its conversation. */
export function beginInbound(input: { phone: PhoneNumber; agent: Agent; from: string; to: string; providerSid: string | null }): Call {
  const conversation = openConversation(input.agent, normalizeE164(input.from));
  const call: Call = {
    id: newId("call"),
    userId: input.agent.userId,
    agentId: input.agent.id,
    campaignId: null,
    phoneId: input.phone.id,
    direction: "inbound",
    fromE164: normalizeE164(input.from),
    toE164: normalizeE164(input.to),
    status: "answered",
    durationSec: 0,
    summary: "",
    disposition: "",
    live: true,
    providerSid: input.providerSid,
    conversationId: conversation.id,
    startedAt: nowIso(),
    endedAt: null,
  };
  conversation.callId = call.id;
  db().calls.push(call);
  save();
  return call;
}

/** An outbound call was answered: give it a conversation. */
export function answerOutbound(call: Call) {
  const agent = db().agents.find((a) => a.id === call.agentId);
  if (!agent) return null;
  if (!call.conversationId) {
    const c = openConversation(agent, call.toE164);
    c.callId = call.id;
    call.conversationId = c.id;
  }
  call.status = "answered";
  save();
  return agent;
}

/** Whether a minute budget remains for the workspace (calls are refused politely when not). */
export function hasMinutes(userId: string) {
  const plan = planFor(userId);
  return plan.minutes === null || minutesUsed(userId) < plan.minutes;
}

/* ---------- relay (wss) ---------- */

const relaySecret = () => process.env.VOICE_RELAY_SECRET ?? "";

/** True when this process runs the WebSocket relay (server.mjs) and can reach OpenAI Realtime. */
export function relayAvailable() {
  return Boolean(relaySecret()) && Boolean(getSetting("OPENAI_API_KEY")) && !/localhost|127\.0\.0\.1/.test(appUrl());
}

export function callToken(callId: string) {
  return crypto.createHmac("sha256", relaySecret()).update(callId).digest("base64url").slice(0, 32);
}

export function streamUrl(call: Call, provider: "twilio" | "plivo") {
  const ws = appUrl().replace(/^http/, "ws");
  return `${ws}/api/voice/stream?call=${call.id}&token=${callToken(call.id)}&provider=${provider}`;
}

export function relayAuthorized(req: Request) {
  const s = relaySecret();
  return Boolean(s) && req.headers.get("x-relay-secret") === s;
}

/** Everything the relay needs to open an OpenAI Realtime session for this call. */
export function relaySession(callId: string, token: string) {
  if (!relaySecret() || token !== callToken(callId)) return null;
  return callSession(callId);
}

/** Prompt, voice, and tools for a live call (shared by the μ-law relay and OpenAI SIP). */
export function callSession(callId: string) {
  const call = db().calls.find((c) => c.id === callId);
  const agent = call && db().agents.find((a) => a.id === call.agentId);
  if (!call || !agent) return null;
  const docs = db().knowledge.filter((k) => k.agentIds.includes(agent.id));
  const passages = searchPassages(docs, `${agent.name} ${agent.tagline} hours opening prices services booking`, 6);
  const lang = LANGUAGES.find((l) => l.id === agent.language)?.label ?? "English";
  const instructions = `${systemPrompt(agent, passages)}

You are on a live phone call. Speak ${lang}. Keep each reply to one or two short sentences. ${
    call.direction === "outbound" ? "You placed this call; say who you are and why you are calling." : ""
  }`;
  return {
    apiKey: getSetting("OPENAI_API_KEY"),
    model: getSetting("REALTIME_MODEL") || "gpt-realtime",
    voice: realtimeVoiceId(agent.voiceId),
    instructions,
    greeting: agent.greeting,
    maxSeconds: Math.max(60, agent.callConfig.maxDurationSec || 900),
    tools: toolSpecs(agent.id).map((t) => ({ type: "function", name: t.function.name, description: t.function.description, parameters: t.function.parameters })),
  };
}

export async function relayTool(callId: string, name: string, args: Record<string, unknown>) {
  const call = db().calls.find((c) => c.id === callId);
  const agent = call && db().agents.find((a) => a.id === call.agentId);
  const conversation = call && db().conversations.find((c) => c.id === call.conversationId);
  if (!agent || !conversation) return { error: "This call is no longer active." };
  try {
    return await runTool(name, args, { agent, conversation });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "That tool failed." };
  }
}

/** The relay hung up: store the transcript, close the conversation, and bill. */
export function relayFinish(callId: string, transcript: { role: "user" | "assistant"; content: string }[], durationSec: number) {
  const data = db();
  const call = data.calls.find((c) => c.id === callId);
  if (!call) return;
  const conversation = data.conversations.find((c) => c.id === call.conversationId);
  const start = Date.parse(call.startedAt) || Date.now();
  transcript
    .filter((t) => t.content.trim())
    .forEach((t, i) => {
      if (!conversation) return;
      data.messages.push({
        id: newId("msg"),
        conversationId: conversation.id,
        role: t.role,
        content: t.content.trim(),
        created_at: new Date(start + i * 1000).toISOString(),
      });
    });
  if (conversation) {
    conversation.durationSec = Math.round(durationSec);
    conversation.lastAt = nowIso();
    if (!conversation.outcome && transcript.some((t) => t.role === "user")) conversation.resolved = true;
  }
  call.durationSec = Math.max(call.durationSec, Math.round(durationSec));
  save();
  const phone = data.phoneNumbers.find((p) => p.id === call.phoneId);
  if (phone?.provider === "twilio" && call.providerSid) {
    // Twilio's status callback bills the call; only fall back when it never arrives.
    return;
  }
  const minutes = Math.max(1, Math.ceil(call.durationSec / 60));
  meter(call.userId, null, [{ provider: "openai", operation: "realtime", units: minutes }]);
  applyCallStatus(call, "completed", call.durationSec);
}
