import "server-only";
import crypto from "node:crypto";
import { speak } from "../ai";
import { appUrl, getSetting } from "../settings";
import type { Agent, Call } from "../types";
import { callToken, relayAvailable, streamUrl, xml, xmlEscape } from "./voice";

/* ---------- short-lived spoken clips for <Play> (GET /api/voice/audio/:id) ---------- */

type Clip = { audio: Buffer; expires: number };
const g = globalThis as unknown as { __voiceClips?: Map<string, Clip> };
const clips = () => (g.__voiceClips ??= new Map());

export function takeClip(id: string) {
  const now = Date.now();
  for (const [k, c] of clips()) if (c.expires < now) clips().delete(k);
  return clips().get(id)?.audio ?? null;
}

/**
 * Speak in the receptionist's own voice when OpenAI text-to-speech is available and Twilio can
 * reach this app; otherwise fall back to Twilio's built-in <Say>.
 */
export async function say(agent: Agent, text: string) {
  const base = appUrl();
  if (getSetting("OPENAI_API_KEY") && !/localhost|127\.0\.0\.1/.test(base)) {
    const out = await speak(text, agent.voiceId);
    if (out.ok) {
      const id = crypto.randomBytes(16).toString("base64url");
      clips().set(id, { audio: Buffer.from(out.audioBase64, "base64"), expires: Date.now() + 10 * 60_000 });
      return `<Play>${xmlEscape(`${base}/api/voice/audio/${id}`)}</Play>`;
    }
  }
  return `<Say language="${xmlEscape(agent.language || "en")}">${xmlEscape(text)}</Say>`;
}

/** Gather one spoken turn, then post it to /api/voice/turn. */
export async function gather(agent: Agent, call: Call, prompt: string) {
  const action = `/api/voice/turn?call=${call.id}`;
  return `<Gather input="speech" action="${action}" method="POST" speechTimeout="auto" language="${xmlEscape(agent.language || "en")}">${
    prompt ? await say(agent, prompt) : ""
  }</Gather><Redirect method="POST">${action}&amp;silent=1</Redirect>`;
}

/** Connect the call: the realtime relay when it runs, otherwise the turn-based fallback. */
export async function connectCall(agent: Agent, call: Call, opening: string) {
  if (relayAvailable()) {
    // Twilio drops query strings on stream URLs, so the binding travels as <Parameter>s.
    const base = streamUrl(call, "twilio").split("?")[0];
    return xml(
      `<Connect><Stream url="${xmlEscape(base)}"><Parameter name="call" value="${call.id}"/><Parameter name="token" value="${callToken(call.id)}"/><Parameter name="provider" value="twilio"/></Stream></Connect>`,
    );
  }
  return xml(await gather(agent, call, opening));
}

export function sayAndHangUp(text: string) {
  return xml(`${text ? `<Say>${xmlEscape(text)}</Say>` : ""}<Hangup/>`);
}
