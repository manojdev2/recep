import "server-only";
import fs from "node:fs";
import path from "node:path";
import { realtimeVoiceId } from "@/lib/catalog";
import { newId } from "@/lib/utils";
import { db, nowIso, save } from "./db";
import { getSetting } from "./settings";

export type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };
export type ChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; content: string; tool_call_id: string };
export type ToolSpec = { type: "function"; function: { name: string; description: string; parameters: Record<string, unknown> } };

type Provider = { name: "xai" | "openai"; base: string; key: string; model: string };

/** xAI drives the browser preview and fallback path; OpenAI is the alternative. */
export function chatProvider(modelId?: string): Provider | null {
  const xai = getSetting("XAI_API_KEY");
  if (xai) {
    const model =
      process.env.XAI_CHAT_MODEL ||
      (modelId === "grok-3-mini" ? "grok-3-mini" : modelId === "grok-4" ? "grok-4" : process.env.XAI_DEFAULT_MODEL || "grok-3-mini");
    return { name: "xai", base: "https://api.x.ai/v1", key: xai, model };
  }
  const openai = getSetting("OPENAI_API_KEY");
  if (openai) return { name: "openai", base: "https://api.openai.com/v1", key: openai, model: process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini" };
  return null;
}

export function recordProviderEvent(provider: string, operation: string, ok: boolean, latencyMs: number, error: string | null) {
  const data = db();
  data.providerEvents.push({ id: newId("pev"), provider, operation, ok, latencyMs, error, at: nowIso() });
  if (data.providerEvents.length > 5000) data.providerEvents.splice(0, data.providerEvents.length - 5000);
  save();
}

export class ProviderError extends Error {}

export async function chatComplete(opts: {
  messages: ChatMessage[];
  temperature?: number;
  tools?: ToolSpec[];
  json?: boolean;
  modelId?: string;
}): Promise<{ content: string; toolCalls: ToolCall[]; provider: "xai" | "openai"; tokens: number } | null> {
  const p = chatProvider(opts.modelId);
  if (!p) return null;
  const started = Date.now();
  let res: Response;
  try {
    res = await fetch(`${p.base}/chat/completions`, {
      method: "POST",
      headers: { authorization: `Bearer ${p.key}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: p.model,
        messages: opts.messages,
        temperature: opts.temperature ?? 0.6,
        ...(opts.tools?.length ? { tools: opts.tools, tool_choice: "auto" } : {}),
        ...(opts.json ? { response_format: { type: "json_object" } } : {}),
      }),
      signal: AbortSignal.timeout(45_000),
    });
  } catch (err) {
    recordProviderEvent(p.name, "chat", false, Date.now() - started, err instanceof Error ? err.message : "network");
    throw new ProviderError("The AI provider did not answer. Try again in a moment.");
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    recordProviderEvent(p.name, "chat", false, Date.now() - started, `${res.status} ${text.slice(0, 300)}`);
    throw new ProviderError(
      res.status === 401 || res.status === 403
        ? `The ${p.name === "xai" ? "xAI" : "OpenAI"} key was refused. Check it in platform settings.`
        : `The AI provider answered ${res.status}.`,
    );
  }
  const body = await res.json();
  recordProviderEvent(p.name, "chat", true, Date.now() - started, null);
  const msg = body.choices?.[0]?.message ?? {};
  return { content: msg.content ?? "", toolCalls: msg.tool_calls ?? [], provider: p.name, tokens: body.usage?.total_tokens ?? 0 };
}

function sampleFile(voice: string) {
  const file = path.join(process.cwd(), "public", "voices", "samples", `${voice}.mp3`);
  return fs.existsSync(file) ? file : null;
}

/**
 * Text to speech. Uses OpenAI's speech endpoint (aether voices map onto their closest
 * OpenAI voice). With no text, plays the bundled sample for that voice.
 */
export async function speak(
  text: string | undefined,
  voiceId: string,
): Promise<{ ok: true; audioBase64: string; chars: number } | { ok: false; error: string }> {
  const voice = realtimeVoiceId(voiceId);
  const key = getSetting("OPENAI_API_KEY");
  if (!text || !key) {
    const sample = sampleFile(voice);
    if (sample && !text) return { ok: true, audioBase64: fs.readFileSync(sample).toString("base64"), chars: 0 };
    if (!key) return { ok: false, error: "Spoken replies need an OpenAI API key. Add one in platform settings." };
  }
  const input = (text || "Hello — thanks for calling. How can I help you today?").slice(0, 1500);
  const started = Date.now();
  try {
    const res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ model: process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts", voice, input, response_format: "mp3" }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      recordProviderEvent("openai", "speech", false, Date.now() - started, `${res.status}`);
      return { ok: false, error: "That voice could not be generated right now." };
    }
    recordProviderEvent("openai", "speech", true, Date.now() - started, null);
    const buf = Buffer.from(await res.arrayBuffer());
    return { ok: true, audioBase64: buf.toString("base64"), chars: input.length };
  } catch (err) {
    recordProviderEvent("openai", "speech", false, Date.now() - started, err instanceof Error ? err.message : "network");
    return { ok: false, error: "That voice could not be generated right now." };
  }
}

/** Speech to text for recorded clips (16 kHz WAV from the browser). */
export async function transcribe(
  audioBase64: string,
  mimeType: string,
  language: string,
): Promise<{ ok: true; text: string; seconds: number } | { ok: false; error: string }> {
  const key = getSetting("OPENAI_API_KEY");
  if (!key) return { ok: false, error: "Voice needs an OpenAI API key for transcription. Type a message instead." };
  const buf = Buffer.from(audioBase64, "base64");
  if (buf.length > 12_000_000) return { ok: false, error: "That clip is too long." };
  const form = new FormData();
  form.append("file", new Blob([buf], { type: mimeType || "audio/wav" }), mimeType.includes("webm") ? "clip.webm" : "clip.wav");
  form.append("model", process.env.OPENAI_STT_MODEL || "whisper-1");
  if (language && language.length === 2) form.append("language", language);
  const started = Date.now();
  try {
    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { authorization: `Bearer ${key}` },
      body: form,
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      recordProviderEvent("openai", "transcribe", false, Date.now() - started, `${res.status}`);
      return { ok: false, error: "Could not transcribe that clip." };
    }
    recordProviderEvent("openai", "transcribe", true, Date.now() - started, null);
    const body = await res.json();
    // 16-bit mono WAV at 16 kHz → bytes / 32000 seconds.
    return { ok: true, text: String(body.text ?? "").trim(), seconds: Math.max(1, buf.length / 32000) };
  } catch {
    recordProviderEvent("openai", "transcribe", false, Date.now() - started, "network");
    return { ok: false, error: "Could not transcribe that clip." };
  }
}
