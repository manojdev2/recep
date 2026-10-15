import "server-only";
import crypto from "node:crypto";
import WebSocket from "ws";
import { recordProviderEvent } from "../ai";
import { getSetting } from "../settings";
import { beginInbound, callSession, hasMinutes, lineFor, relayFinish, relayTool } from "./voice";

/**
 * OpenAI SIP: a SIP trunk points at sip:<project>@sip.api.openai.com. OpenAI sends a
 * `realtime.call.incoming` webhook here; we accept the call with the receptionist's prompt,
 * voice and tools, then follow it on a sideband WebSocket to run tools and keep the transcript.
 */

/** Standard Webhooks signature: base64(HMAC-SHA256(secret, `${id}.${timestamp}.${body}`)). */
export function openaiWebhookValid(headers: Headers, body: string) {
  const secret = getSetting("OPENAI_WEBHOOK_SECRET");
  const id = headers.get("webhook-id");
  const ts = headers.get("webhook-timestamp");
  const sigs = headers.get("webhook-signature");
  if (!secret || !id || !ts || !sigs) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = crypto.createHmac("sha256", key).update(`${id}.${ts}.${body}`).digest("base64");
  return sigs.split(" ").some((s) => {
    const v = s.split(",")[1] ?? "";
    return v.length === expected.length && crypto.timingSafeEqual(Buffer.from(v), Buffer.from(expected));
  });
}

const header = (list: { name: string; value: string }[] | undefined, name: string) =>
  list?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";

/** "<sip:+15551234567@host>;tag=…" → "+15551234567" */
const numberFrom = (sipHeader: string) => {
  const m = /sip:(\+?[\d]{6,15})@/i.exec(sipHeader) ?? /(\+?\d{7,15})/.exec(sipHeader);
  return m ? m[1] : "";
};

async function openai(path: string, body: unknown) {
  const started = Date.now();
  const res = await fetch(`https://api.openai.com/v1/realtime/calls/${path}`, {
    method: "POST",
    headers: { authorization: `Bearer ${getSetting("OPENAI_API_KEY")}`, "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  recordProviderEvent("openai", `sip.${path.split("/").pop()}`, res.ok, Date.now() - started, res.ok ? null : `${res.status} ${(await res.text()).slice(0, 200)}`);
  return res.ok;
}

export async function handleIncoming(event: { data?: { call_id?: string; sip_headers?: { name: string; value: string }[] } }) {
  const callId = event.data?.call_id;
  if (!callId) return;
  const to = numberFrom(header(event.data?.sip_headers, "To"));
  const from = numberFrom(header(event.data?.sip_headers, "From"));
  const { phone, agent } = lineFor(to);
  if (!phone || !agent || agent.status !== "live" || !hasMinutes(agent.userId)) {
    await openai(`${callId}/reject`, { status_code: 486 });
    return;
  }
  const call = beginInbound({ phone, agent, from, to, providerSid: callId });
  const session = callSession(call.id);
  if (!session) {
    await openai(`${callId}/reject`, { status_code: 500 });
    return;
  }
  const accepted = await openai(`${callId}/accept`, {
    type: "realtime",
    model: session.model,
    instructions: session.instructions,
    audio: { input: { transcription: { model: "gpt-4o-mini-transcribe" } }, output: { voice: session.voice } },
    tools: session.tools,
    tool_choice: "auto",
  });
  if (!accepted) return;
  follow(callId, call.id, session.greeting, session.maxSeconds);
}

/** Sideband connection for the length of the call: greeting, tools, transcript. */
function follow(openaiCallId: string, callId: string, greeting: string, maxSeconds: number) {
  const ws = new WebSocket(`wss://api.openai.com/v1/realtime?call_id=${encodeURIComponent(openaiCallId)}`, {
    headers: { authorization: `Bearer ${getSetting("OPENAI_API_KEY")}` },
  });
  const transcript: { role: "user" | "assistant"; content: string }[] = [];
  const started = Date.now();
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    clearTimeout(limit);
    try {
      ws.close();
    } catch {}
    relayFinish(callId, transcript, (Date.now() - started) / 1000);
  };
  const limit = setTimeout(() => {
    void openai(`${openaiCallId}/hangup`, {}).finally(finish);
  }, maxSeconds * 1000);
  const send = (m: unknown) => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify(m));

  ws.on("open", () => {
    send({
      type: "response.create",
      response: {
        instructions: greeting ? `Greet the caller by saying exactly: "${greeting.replace(/"/g, "'")}"` : "Greet the caller briefly and ask how you can help.",
      },
    });
  });
  ws.on("message", async (raw) => {
    let ev: { type: string; transcript?: string; name?: string; arguments?: string; call_id?: string };
    try {
      ev = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (ev.type === "conversation.item.input_audio_transcription.completed" && ev.transcript) transcript.push({ role: "user", content: ev.transcript });
    else if (ev.type === "response.output_audio_transcript.done" && ev.transcript) transcript.push({ role: "assistant", content: ev.transcript });
    else if (ev.type === "response.function_call_arguments.done" && ev.name) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(ev.arguments || "{}");
      } catch {}
      const output = await relayTool(callId, ev.name, args);
      send({ type: "conversation.item.create", item: { type: "function_call_output", call_id: ev.call_id, output: JSON.stringify(output) } });
      send({ type: "response.create" });
    }
  });
  ws.on("close", finish);
  ws.on("error", (err) => {
    console.error("[sip] sideband", err.message);
    finish();
  });
}
