// Custom server: serves the Next.js app and the live-call relay on one port.
//
// Carriers stream μ-law audio to wss://APP_URL/api/voice/stream. Each call is relayed, unchanged,
// to OpenAI Realtime (audio/pcmu both ways — no transcoding). Everything the relay needs (prompt,
// voice, tools) and everything it produces (tool calls, transcript) goes through internal routes
// under /api/voice/*, authorised by a per-process secret.
import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { WebSocket, WebSocketServer } from "ws";

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "0.0.0.0";
const dev = !(process.argv.includes("--prod") || process.env.NODE_ENV === "production");
if (!dev) process.env.NODE_ENV = "production";
const { default: next } = await import("next");
process.env.VOICE_RELAY_SECRET ||= randomBytes(24).toString("base64url");
const SECRET = process.env.VOICE_RELAY_SECRET;
const SELF = `http://127.0.0.1:${port}`;

const app = next({ dev, hostname: host, port });
const handle = app.getRequestHandler();

async function internal(path, body) {
  const res = await fetch(`${SELF}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-relay-secret": SECRET },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} answered ${res.status}`);
  return res.status === 204 ? null : res.json();
}

function relay(carrier, url) {
  const provider = url.searchParams.get("provider") === "plivo" ? "plivo" : "twilio";
  let callId = url.searchParams.get("call");
  let token = url.searchParams.get("token");
  let streamId = null;
  let openai = null;
  let started = 0;
  let ended = false;
  let limit = null;
  const transcript = [];
  const pending = [];

  const toCarrier = (payload) => {
    if (carrier.readyState !== WebSocket.OPEN || !streamId) return;
    carrier.send(
      JSON.stringify(
        provider === "plivo"
          ? { event: "playAudio", media: { contentType: "audio/x-mulaw", sampleRate: 8000, payload } }
          : { event: "media", streamSid: streamId, media: { payload } },
      ),
    );
  };
  const clearCarrier = () => {
    if (carrier.readyState !== WebSocket.OPEN || !streamId) return;
    carrier.send(JSON.stringify(provider === "plivo" ? { event: "clearAudio", streamId } : { event: "clear", streamSid: streamId }));
  };
  const toModel = (msg) => {
    if (openai?.readyState === WebSocket.OPEN) openai.send(JSON.stringify(msg));
    else pending.push(msg);
  };

  async function finish() {
    if (ended) return;
    ended = true;
    clearTimeout(limit);
    try {
      openai?.close();
    } catch {}
    try {
      carrier.close();
    } catch {}
    if (!callId) return;
    const durationSec = started ? (Date.now() - started) / 1000 : 0;
    await internal("/api/voice/finish", { call: callId, transcript, durationSec }).catch((e) => console.error("[relay] finish", e.message));
  }

  async function connectModel() {
    let session;
    try {
      session = await internal("/api/voice/session", { call: callId, token });
    } catch (e) {
      console.error("[relay] session", e.message);
      return finish();
    }
    started = Date.now();
    limit = setTimeout(() => finish(), session.maxSeconds * 1000);
    openai = new WebSocket(`wss://api.openai.com/v1/realtime?model=${encodeURIComponent(session.model)}`, {
      headers: { authorization: `Bearer ${session.apiKey}` },
    });
    openai.on("open", () => {
      openai.send(
        JSON.stringify({
          type: "session.update",
          session: {
            type: "realtime",
            instructions: session.instructions,
            audio: {
              input: {
                format: { type: "audio/pcmu" },
                transcription: { model: "gpt-4o-mini-transcribe" },
                turn_detection: { type: "server_vad", silence_duration_ms: 500 },
              },
              output: { format: { type: "audio/pcmu" }, voice: session.voice },
            },
            tools: session.tools,
            tool_choice: "auto",
          },
        }),
      );
      for (const m of pending.splice(0)) openai.send(JSON.stringify(m));
      openai.send(
        JSON.stringify({
          type: "response.create",
          response: {
            instructions: session.greeting
              ? `Greet the caller by saying exactly: "${session.greeting.replace(/"/g, "'")}"`
              : "Greet the caller briefly and ask how you can help.",
          },
        }),
      );
    });
    openai.on("message", async (raw) => {
      let ev;
      try {
        ev = JSON.parse(raw.toString());
      } catch {
        return;
      }
      switch (ev.type) {
        case "response.output_audio.delta":
          toCarrier(ev.delta);
          break;
        case "input_audio_buffer.speech_started":
          // Barge-in: stop what is playing and let the caller talk.
          clearCarrier();
          toModel({ type: "response.cancel" });
          break;
        case "conversation.item.input_audio_transcription.completed":
          if (ev.transcript) transcript.push({ role: "user", content: ev.transcript });
          break;
        case "response.output_audio_transcript.done":
          if (ev.transcript) transcript.push({ role: "assistant", content: ev.transcript });
          break;
        case "response.function_call_arguments.done": {
          let args = {};
          try {
            args = JSON.parse(ev.arguments || "{}");
          } catch {}
          const said = transcript.filter((t) => t.role === "user").map((t) => t.content);
          const output = await internal("/api/voice/tool", { call: callId, name: ev.name, args, said }).catch((e) => ({ error: e.message }));
          toModel({ type: "conversation.item.create", item: { type: "function_call_output", call_id: ev.call_id, output: JSON.stringify(output) } });
          toModel({ type: "response.create" });
          if (["end_call", "transfer_human", "transfer_call"].includes(ev.name) && output?.hangup) setTimeout(() => finish(), 4000);
          break;
        }
        case "error":
          if (!/no active response|already has an active response|buffer.*empty/i.test(ev.error?.message ?? "")) {
            console.error("[relay] openai", ev.error?.message);
          }
          break;
      }
    });
    openai.on("close", () => finish());
    openai.on("error", (e) => {
      console.error("[relay] openai socket", e.message);
      finish();
    });
  }

  carrier.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    switch (msg.event) {
      case "start": {
        const s = msg.start ?? {};
        streamId = s.streamSid ?? s.streamId ?? msg.streamSid ?? msg.streamId ?? null;
        const params = s.customParameters ?? {};
        callId = params.call ?? callId;
        token = params.token ?? token;
        if (!callId || !token) return finish();
        connectModel();
        break;
      }
      case "media":
        if (msg.media?.payload) toModel({ type: "input_audio_buffer.append", audio: msg.media.payload });
        break;
      case "stop":
        finish();
        break;
    }
  });
  carrier.on("close", () => finish());
  carrier.on("error", () => finish());
}

app.prepare().then(() => {
  const server = createServer((req, res) => handle(req, res));
  const wss = new WebSocketServer({ noServer: true });
  const nextUpgrade = typeof app.getUpgradeHandler === "function" ? app.getUpgradeHandler() : null;

  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url ?? "/", "http://local");
    if (url.pathname === "/api/voice/stream") {
      wss.handleUpgrade(req, socket, head, (ws) => relay(ws, url));
      return;
    }
    if (nextUpgrade) nextUpgrade(req, socket, head);
    else socket.destroy();
  });

  server.listen(port, host, () => {
    console.log(`> Azentoo on http://localhost:${port} (${dev ? "development" : "production"}) — voice relay on /api/voice/stream`);
  });
});
