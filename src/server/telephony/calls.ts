import "server-only";
import { newId } from "@/lib/utils";
import { recordProviderEvent } from "../ai";
import { unseal } from "../crypto";
import { db, nowIso, save } from "../db";
import { emit } from "../events";
import { enqueue } from "../jobs";
import { RpcError } from "../rpc";
import { appUrl, flag } from "../settings";
import type { Agent, Call, CallStatus, PhoneNumber } from "../types";
import { assertMinutes, meter } from "../usage";

export const CARRIERS: Record<string, { inbound: "ai" | "none"; outbound: "ai" | "limited" | "none" }> = {
  twilio: { inbound: "ai", outbound: "ai" },
  plivo: { inbound: "ai", outbound: "none" },
  sip: { inbound: "ai", outbound: "none" },
  vonage: { inbound: "none", outbound: "limited" },
  telnyx: { inbound: "none", outbound: "limited" },
  aether: { inbound: "none", outbound: "none" },
  "aether-sip": { inbound: "none", outbound: "none" },
};

export function outboundRefusal(provider: string) {
  if ((CARRIERS[provider]?.outbound ?? "none") !== "none") return "";
  switch (provider) {
    case "aether":
    case "aether-sip":
      return "This is a test line, so it cannot place real calls. Import a Twilio number under Phone numbers to call out.";
    case "plivo":
      return "Plivo numbers answer inbound calls only; Reception AI cannot place outbound calls through Plivo. Use a Twilio number to call out.";
    case "sip":
      return "SIP trunk numbers answer inbound calls only; Reception AI cannot place outbound calls on a SIP trunk. Use a Twilio number to call out.";
    default:
      return "Reception AI cannot place outbound calls on this kind of line. Use a Twilio number to call out.";
  }
}

export function callRow(c: Call) {
  return {
    id: c.id,
    direction: c.direction,
    fromE164: c.fromE164,
    toE164: c.toE164,
    status: c.status,
    durationSec: c.durationSec,
    summary: c.summary,
    disposition: c.disposition,
    agentId: c.agentId,
    agentName: db().agents.find((a) => a.id === c.agentId)?.name ?? "—",
    campaignId: c.campaignId,
    live: c.live,
    startedAt: c.startedAt,
  };
}

export function normalizeE164(raw: string) {
  const d = raw.replace(/[^\d+]/g, "");
  if (!d) return "";
  return d.startsWith("+") ? d : `+${d}`;
}

function newCall(userId: string, fields: Partial<Call> & Pick<Call, "direction" | "fromE164" | "toE164">): Call {
  const call: Call = {
    id: newId("call"),
    userId,
    agentId: null,
    campaignId: null,
    phoneId: null,
    status: "queued",
    durationSec: 0,
    summary: "",
    disposition: "",
    live: false,
    providerSid: null,
    conversationId: null,
    startedAt: nowIso(),
    endedAt: null,
    ...fields,
  };
  db().calls.push(call);
  save();
  return call;
}

async function twilioCall(phone: PhoneNumber, agent: Agent, to: string, call: Call) {
  const creds = unseal<{ sid: string; token: string }>(phone.secret);
  if (!creds) throw new RpcError("The Twilio credentials for this number are missing.");
  const base = appUrl();
  if (/localhost|127\.0\.0\.1/.test(base)) throw new RpcError("Set a public APP_URL first — Twilio has to reach this app when the call is answered.");
  const params = new URLSearchParams({
    To: to,
    From: agent.callConfig.outboundCallerId || phone.e164,
    Url: `${base}/api/voice/answer?call=${call.id}`,
    StatusCallback: `${base}/api/voice/status?call=${call.id}`,
    StatusCallbackMethod: "POST",
  });
  for (const ev of ["initiated", "ringing", "answered", "completed"]) params.append("StatusCallbackEvent", ev);
  if (agent.callConfig.amd) params.set("MachineDetection", "Enable");
  const started = Date.now();
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${creds.sid}/Calls.json`, {
    method: "POST",
    headers: {
      authorization: `Basic ${Buffer.from(`${creds.sid}:${creds.token}`).toString("base64")}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
    signal: AbortSignal.timeout(15_000),
  });
  recordProviderEvent("twilio", "call.out", res.ok, Date.now() - started, res.ok ? null : String(res.status));
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    call.status = "failed";
    call.summary = body.message ?? `Twilio answered ${res.status}`;
    save();
    throw new RpcError(call.summary);
  }
  const body = await res.json();
  call.providerSid = body.sid;
  call.status = "ringing";
  call.live = true;
  save();
}

async function telnyxCall(phone: PhoneNumber, to: string, call: Call) {
  const creds = unseal<{ token: string; connectionId: string }>(phone.secret);
  if (!creds?.connectionId) throw new RpcError("This Telnyx number has no Call Control connection.");
  const started = Date.now();
  const res = await fetch("https://api.telnyx.com/v2/calls", {
    method: "POST",
    headers: { authorization: `Bearer ${creds.token}`, "content-type": "application/json" },
    body: JSON.stringify({ connection_id: creds.connectionId, to, from: phone.e164 }),
    signal: AbortSignal.timeout(15_000),
  });
  recordProviderEvent("telnyx", "call.out", res.ok, Date.now() - started, res.ok ? null : String(res.status));
  if (!res.ok) {
    call.status = "failed";
    call.summary = `Telnyx answered ${res.status}`;
    save();
    throw new RpcError(call.summary);
  }
  const body = await res.json();
  call.providerSid = body.data?.call_control_id ?? null;
  call.status = "ringing";
  call.live = true;
  call.summary = "Placed on your Call Control connection.";
  save();
  meter(phone.userId, { kind: "voice", minutes: 1 }, [{ provider: "telnyx", operation: "call.out", units: 1 }]);
}

/** Place a real outbound call from a number the workspace owns. */
export async function placeCall(
  userId: string,
  input: { agentId: string; to: string; phoneId?: string; campaignId?: string | null; contactName?: string },
) {
  if (!flag("FEATURE_OUTBOUND", true)) throw new RpcError("Outbound calling is switched off on this platform.");
  const data = db();
  const agent = data.agents.find((a) => a.id === input.agentId && a.userId === userId);
  if (!agent) throw new RpcError("Choose a receptionist.");
  if (agent.direction === "inbound") throw new RpcError(`${agent.name} only answers calls. Set it to outbound or both on Phone setup.`);
  const phone =
    data.phoneNumbers.find((p) => p.id === input.phoneId && p.userId === userId) ??
    data.phoneNumbers.find((p) => p.userId === userId && p.agentId === agent.id);
  if (!phone) throw new RpcError("Add a phone number first. Outbound calls leave from a number you own.");
  const refusal = outboundRefusal(phone.provider);
  if (refusal) throw new RpcError(refusal);
  const to = normalizeE164(input.to);
  if (!/^\+\d{7,15}$/.test(to)) throw new RpcError("Dial a full number with its country code, like +14155550199.");
  assertMinutes(userId);
  const call = newCall(userId, {
    direction: "outbound",
    fromE164: phone.e164,
    toE164: to,
    agentId: agent.id,
    phoneId: phone.id,
    campaignId: input.campaignId ?? null,
  });
  if (phone.provider === "twilio") {
    await twilioCall(phone, agent, to, call);
    enqueue("call.reconcile", { callId: call.id }, 5 * 60_000);
    return { live: true, to, summary: `Calling ${to}`, callId: call.id };
  }
  if (phone.provider === "telnyx") {
    await telnyxCall(phone, to, call);
    return { live: true, to, summary: call.summary, callId: call.id };
  }
  call.status = "failed";
  call.summary = "Vonage outbound needs a Voice application; announce-only calls are not configured.";
  save();
  throw new RpcError(call.summary);
}

/** Pretend someone rang the number: the agent answers with its greeting. */
export function simulateInbound(userId: string, input: { agentId: string; phoneId?: string; from: string }) {
  const data = db();
  const agent = data.agents.find((a) => a.id === input.agentId && a.userId === userId);
  if (!agent) throw new RpcError("Choose a receptionist.");
  const phone = data.phoneNumbers.find((p) => p.id === input.phoneId && p.userId === userId);
  const from = normalizeE164(input.from) || "+14155550187";
  const now = nowIso();
  const conversationId = newId("cnv");
  data.conversations.push({
    id: conversationId,
    userId,
    agentId: agent.id,
    channel: "phone",
    language: agent.language,
    resolved: false,
    sentiment: "neutral",
    durationSec: 0,
    isSample: true,
    startedAt: now,
    lastAt: now,
    callerName: null,
    callerContact: from,
    callId: null,
    outcome: null,
  });
  if (agent.greeting) {
    data.messages.push({ id: newId("msg"), conversationId, role: "assistant", content: agent.greeting, created_at: now });
  }
  const call = newCall(userId, {
    direction: "inbound",
    fromE164: from,
    toE164: phone?.e164 ?? "simulator",
    agentId: agent.id,
    phoneId: phone?.id ?? null,
    status: "answered",
    summary: "Simulated ring-in — continue the conversation in the studio.",
    disposition: "simulated",
    conversationId,
  });
  data.conversations.find((c) => c.id === conversationId)!.callId = call.id;
  save();
  return { from, agentId: agent.id, callId: call.id };
}

const TWILIO_STATUS: Record<string, CallStatus> = {
  queued: "queued",
  initiated: "queued",
  ringing: "ringing",
  "in-progress": "answered",
  completed: "completed",
  busy: "busy",
  "no-answer": "no_answer",
  failed: "failed",
  canceled: "failed",
};

/** Apply a carrier status update (webhook or poll). */
export function applyCallStatus(call: Call, status: string, durationSec?: number, answeredBy?: string) {
  const mapped = TWILIO_STATUS[status] ?? call.status;
  call.status = answeredBy && /machine/.test(answeredBy) && mapped === "completed" ? "voicemail" : mapped;
  if (durationSec != null && !Number.isNaN(durationSec)) call.durationSec = durationSec;
  if (["completed", "busy", "no_answer", "failed", "voicemail"].includes(call.status)) {
    call.live = false;
    call.endedAt = call.endedAt ?? nowIso();
    if (!call.disposition) call.disposition = call.status.replace("_", " ");
  }
  save();
  if (call.status === "completed" || call.status === "voicemail") {
    const minutes = Math.max(1, Math.ceil(call.durationSec / 60));
    if (!call.summary.startsWith("Billed")) {
      meter(call.userId, { kind: "voice", minutes }, [
        { provider: "twilio", operation: call.direction === "inbound" ? "call.in" : "call.out", units: minutes },
      ]);
      call.summary = call.summary || `Billed ${minutes} min`;
    }
    emit(call.userId, "call.completed", { ...callRow(call) });
  }
  if (call.campaignId) {
    const target = db().campaignContacts.find((t) => t.campaignId === call.campaignId && t.e164 === call.toE164);
    if (target && ["completed", "no_answer", "voicemail", "failed", "busy"].includes(call.status)) {
      target.status = call.status === "busy" ? "no_answer" : (call.status as typeof target.status);
      target.lastOutcome = call.disposition || call.status;
      save();
    }
  }
}

/** Ask Twilio how a call ended (status webhooks can be missed). */
export async function reconcileCall(callId: string) {
  const call = db().calls.find((c) => c.id === callId);
  if (!call || !call.providerSid || !call.live) return;
  const phone = db().phoneNumbers.find((p) => p.id === call.phoneId);
  const creds = unseal<{ sid: string; token: string }>(phone?.secret);
  if (!phone || phone.provider !== "twilio" || !creds) return;
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${creds.sid}/Calls/${call.providerSid}.json`, {
    headers: { authorization: `Basic ${Buffer.from(`${creds.sid}:${creds.token}`).toString("base64")}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Twilio answered ${res.status}`);
  const body = await res.json();
  applyCallStatus(call, body.status, Number(body.duration), body.answered_by);
  if (call.live) enqueue("call.reconcile", { callId }, 5 * 60_000);
}
