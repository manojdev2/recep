"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AudioLines, Mic, Send, Square, Volume2, VolumeX } from "lucide-react";
import { StatusOrb, VoiceOrb, WaveBars, type VoiceState } from "@/components/orb/orb";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

type Line = { id: string; role: "user" | "assistant"; content: string; citations?: { title: string }[] };

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

function speechRecognition(): (new () => SpeechRecognitionLike) | null {
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const s = String(reader.result ?? "");
      const i = s.indexOf(",");
      resolve(i >= 0 ? s.slice(i + 1) : s);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function concat(chunks: Float32Array[]) {
  let total = 0;
  for (const c of chunks) total += c.length;
  const out = new Float32Array(total);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

function downsample(samples: Float32Array, from: number, to: number) {
  if (to >= from) return samples;
  const ratio = from / to;
  const length = Math.max(1, Math.round(samples.length / ratio));
  const out = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    const pos = i * ratio;
    const a = Math.floor(pos);
    const b = Math.min(a + 1, samples.length - 1);
    const t = pos - a;
    out[i] = samples[a] * (1 - t) + samples[b] * t;
  }
  return out;
}

function toWav(samples: Float32Array, rate: number) {
  const bytes = samples.length * 2;
  const buf = new ArrayBuffer(44 + bytes);
  const v = new DataView(buf);
  const str = (o: number, s: string) => {
    for (let i = 0; i < s.length; i += 1) v.setUint8(o + i, s.charCodeAt(i));
  };
  str(0, "RIFF");
  v.setUint32(4, 36 + bytes, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, bytes, true);
  let o = 44;
  for (let i = 0; i < samples.length; i += 1) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(o, s < 0 ? s * 32768 : s * 32767, true);
    o += 2;
  }
  return new Blob([buf], { type: "audio/wav" });
}

function peak(samples: Float32Array) {
  let m = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const a = Math.abs(samples[i]);
    if (a > m) m = a;
  }
  return m;
}

/** A short note when a tool did something worth seeing. */
function traceNote(traces: { name: string; result: string }[] | undefined) {
  if (!traces?.length) return null;
  for (const t of traces) {
    try {
      const r = JSON.parse(t.result);
      if (t.name === "book_appointment" && r.booked) return `Booked · ${String(r.when ?? "")}${r.name ? ` · ${String(r.name)}` : ""}`.trim();
      if (t.name === "capture_lead" && r.captured) return `Lead saved · ${String(r.name ?? "")}`.trim();
      if (t.name === "create_ticket" && r.ticket) return `Ticket ${String(r.ticket)}`;
    } catch {}
  }
  return null;
}

type Analyser = { ctx: AudioContext; processor: ScriptProcessorNode | null; raf: number };

export function TalkPanel({
  agentId,
  greeting,
  agentName,
  mode = "auth",
  variant = "studio",
  language = "en",
}: {
  agentId: string;
  greeting?: string;
  agentName?: string;
  mode?: "auth" | "public";
  variant?: "studio" | "widget" | "hero";
  language?: string;
}) {
  const [lines, setLines] = useState<Line[]>(() => (greeting ? [{ id: "greet", role: "assistant", content: greeting }] : []));
  const [draft, setDraft] = useState("");
  const [busy, setBusyState] = useState(false);
  const busyRef = useRef(false);
  const [conversationId, setConversationId] = useState<string>();
  const [recording, setRecording] = useState(false);
  const recordingRef = useRef(false);
  const [speakReplies, setSpeakReplies] = useState(true);
  const [state, setState] = useState<VoiceState>("idle");
  const [level, setLevel] = useState(0);
  const [interim, setInterim] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stopTimer = useRef<number | undefined>(undefined);
  const tickTimer = useRef<number | undefined>(undefined);
  const startedAt = useRef(0);
  const chunks = useRef<Float32Array[]>([]);
  const sampleRate = useRef(16000);
  const recognizer = useRef<SpeechRecognitionLike | null>(null);
  const finalText = useRef("");
  const partialText = useRef("");
  const stream = useRef<MediaStream | null>(null);
  const analyser = useRef<Analyser | null>(null);
  const qc = useQueryClient();

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [lines, busy, interim]);

  useEffect(
    () => () => {
      audioRef.current?.pause();
      teardown();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  function setBusy(v: boolean) {
    busyRef.current = v;
    setBusyState(v);
  }

  function stopMeter() {
    const a = analyser.current;
    if (!a) return;
    cancelAnimationFrame(a.raf);
    try {
      a.processor?.disconnect();
    } catch {}
    void a.ctx.close();
    analyser.current = null;
    setLevel(0);
  }

  function teardown() {
    if (stopTimer.current) window.clearTimeout(stopTimer.current);
    if (tickTimer.current) window.clearInterval(tickTimer.current);
    try {
      recognizer.current?.abort();
    } catch {}
    recognizer.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    recordingRef.current = false;
    setRecording(false);
    stopMeter();
  }

  function meterPlayback(el: HTMLAudioElement) {
    stopMeter();
    try {
      const ctx = new AudioContext();
      const src = ctx.createMediaElementSource(el);
      const node = ctx.createAnalyser();
      node.fftSize = 256;
      src.connect(node);
      node.connect(ctx.destination);
      const data = new Uint8Array(node.frequencyBinCount);
      const loop = () => {
        node.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i += 1) sum += data[i];
        setLevel(sum / data.length / 180);
        if (analyser.current) analyser.current.raf = requestAnimationFrame(loop);
      };
      analyser.current = { ctx, processor: null, raf: requestAnimationFrame(loop) };
    } catch {
      analyser.current = null;
    }
  }

  async function play(audioBase64: string) {
    const el = new Audio(`data:audio/mpeg;base64,${audioBase64}`);
    audioRef.current = el;
    meterPlayback(el);
    setState("speaking");
    await new Promise<void>((resolve) => {
      el.onended = () => resolve();
      el.onerror = () => resolve();
      el.onpause = () => resolve();
      el.play().catch(() => resolve());
    });
    stopMeter();
    setState("idle");
  }

  async function send(text: string) {
    const content = text.trim();
    if (!content || busyRef.current || recordingRef.current) return;
    const next: Line[] = [...lines, { id: crypto.randomUUID(), role: "user", content }];
    setLines(next);
    setDraft("");
    setInterim("");
    setBusy(true);
    setState("thinking");
    try {
      const payload = {
        agentId,
        conversationId,
        speak: speakReplies,
        messages: next.map((l) => ({ role: l.role, content: l.content })),
      };
      const res = mode === "public" ? await api.demo.reply(payload) : await api.chat.reply(payload);
      if (!res.ok) {
        toast.error(res.error);
        setState("idle");
        return;
      }
      setConversationId(res.conversationId);
      setLines((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", content: res.text, citations: res.citations }]);
      const done = traceNote(res.traces);
      if (done) {
        setNote(done);
        for (const key of ["slots", "booked-slots", "leads", "tickets", "analytics"]) qc.invalidateQueries({ queryKey: [key] });
      }
      for (const key of ["conversations", "workspace", "setup"]) qc.invalidateQueries({ queryKey: [key] });
      if (res.audioBase64) await play(res.audioBase64);
      else setState("idle");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send");
      setState("idle");
    } finally {
      setBusy(false);
    }
  }

  async function startRecording() {
    if (recordingRef.current || busyRef.current) return;
    chunks.current = [];
    finalText.current = "";
    partialText.current = "";
    setInterim("");
    setElapsed(0);
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
      });
      stream.current = media;
      const ctx = new AudioContext();
      await ctx.resume().catch(() => undefined);
      sampleRate.current = ctx.sampleRate;
      const source = ctx.createMediaStreamSource(media);
      const node = ctx.createAnalyser();
      node.fftSize = 2048;
      source.connect(node);
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      const mute = ctx.createGain();
      mute.gain.value = 0;
      source.connect(processor);
      processor.connect(mute);
      mute.connect(ctx.destination);
      processor.onaudioprocess = (e) => {
        chunks.current.push(new Float32Array(e.inputBuffer.getChannelData(0)));
      };
      const data = new Uint8Array(node.frequencyBinCount);
      const loop = () => {
        node.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i += 1) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        setLevel(Math.min(1, Math.sqrt(sum / data.length) * 4));
        if (analyser.current) analyser.current.raf = requestAnimationFrame(loop);
      };
      analyser.current = { ctx, processor, raf: requestAnimationFrame(loop) };

      const SR = speechRecognition();
      if (SR) {
        const rec = new SR();
        rec.lang = language === "en" ? "en-US" : language;
        rec.continuous = true;
        rec.interimResults = true;
        rec.maxAlternatives = 1;
        rec.onresult = (e) => {
          let finalSoFar = finalText.current;
          let partial = "";
          for (let i = e.resultIndex; i < e.results.length; i += 1) {
            const r = e.results[i];
            const t = r[0]?.transcript ?? "";
            if (r.isFinal) finalSoFar = `${finalSoFar} ${t}`.trim();
            else partial += t;
          }
          finalText.current = finalSoFar;
          partialText.current = partial.trim();
          setInterim((finalSoFar + (partial ? ` ${partial}` : "")).trim());
        };
        rec.onerror = () => {};
        recognizer.current = rec;
        try {
          rec.start();
        } catch {
          recognizer.current = null;
        }
      }
      startedAt.current = Date.now();
      recordingRef.current = true;
      setRecording(true);
      setState("listening");
      tickTimer.current = window.setInterval(() => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)), 200);
      stopTimer.current = window.setTimeout(() => void finishRecording(), 20_000);
    } catch {
      teardown();
      toast.error("Allow the microphone to talk — or type a message below.");
    }
  }

  async function finishRecording() {
    if (!recordingRef.current) return;
    const held = Date.now() - startedAt.current;
    if (held < 500) await new Promise((r) => window.setTimeout(r, 500 - held));
    if (stopTimer.current) window.clearTimeout(stopTimer.current);
    if (tickTimer.current) window.clearInterval(tickTimer.current);
    const rec = recognizer.current;
    recognizer.current = null;
    if (rec) {
      try {
        rec.stop();
      } catch {}
      await new Promise((r) => window.setTimeout(r, 280));
    }
    const samples = concat(chunks.current);
    const rate = sampleRate.current || 48000;
    const spoken = (finalText.current || partialText.current || interim).trim();
    const loudest = peak(samples);
    const seconds = samples.length / rate;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    recordingRef.current = false;
    setRecording(false);
    stopMeter();
    if (spoken.length >= 2) {
      await send(spoken);
      return;
    }
    if (seconds < 0.6) {
      toast.error("Click the orb, speak, then click again to send.");
      setState("idle");
      setInterim("");
      return;
    }
    if (loudest < 0.02) {
      toast.error("The mic is silent. Check the browser permission, or type instead.");
      setState("idle");
      setInterim("");
      return;
    }
    setBusy(true);
    setState("thinking");
    try {
      const payload = { audioBase64: await blobToBase64(toWav(downsample(samples, rate, 16000), 16000)), mimeType: "audio/wav", language };
      const res = mode === "public" ? await api.demo.transcribe(payload) : await api.chat.transcribe(payload);
      if (!res.ok) {
        toast.error(res.error);
        setBusy(false);
        setState("idle");
        return;
      }
      setBusy(false);
      await send(res.text);
    } catch {
      toast.error("Could not transcribe that clip.");
      setBusy(false);
      setState("idle");
    }
  }

  function toggleMic() {
    if (recordingRef.current) void finishRecording();
    else void startRecording();
  }

  const hero = variant === "hero";
  const widget = variant === "widget";
  const mm = String(Math.floor(elapsed / 60));
  const ss = String(elapsed % 60).padStart(2, "0");
  const status =
    state === "listening"
      ? `Listening · ${mm}:${ss}`
      : state === "thinking"
        ? "Finding the right words…"
        : state === "speaking"
          ? "A little answer, just for you."
          : "Go on. Say hello.";

  return (
    <div className={cn("flex h-full min-h-0 flex-col", (hero || widget) && "mx-auto w-full items-stretch", hero && "hero-talk-panel", widget && "max-w-xl")}>
      <div className={cn("flex shrink-0 flex-col items-center", hero ? "px-4 pt-3" : "px-5 pt-6 pb-2")}>
        {hero ? (
          <>
            <VoiceOrb
              state={state}
              level={level}
              size={320}
              onClick={toggleMic}
              disabled={busy}
              label={recording ? "Finish speaking" : "Start a voice conversation"}
            />
            <p className="hero-voice-status text-center text-base font-semibold" role="status">
              {status}
            </p>
            <p className="mt-1.5 text-center text-xs text-muted">
              {recording ? "Tap again when you’re done." : busy ? "Your conversation is in progress." : "Tap the orb to talk. Or start with a message."}
            </p>
          </>
        ) : (
          <>
            <p className="mb-3 text-sm font-medium">{agentName ?? "Test conversation"}</p>
            <button
              type="button"
              onClick={toggleMic}
              disabled={busy}
              aria-label={recording ? "Finish speaking" : "Start a voice conversation"}
              className="flex min-h-12 items-center gap-3 rounded-full bg-accent/10 px-5 py-3 text-sm font-medium text-accent disabled:opacity-60"
            >
              {recording ? <Square className="size-4" /> : <Mic className="size-4" />}
              {recording ? `Listening · ${mm}:${ss}` : busy ? status : "Let’s talk"}
              <WaveBars active={state === "listening" || state === "speaking"} />
            </button>
          </>
        )}
        {state === "listening" && interim ? <p className="mt-2 max-w-sm text-center text-sm text-fg">{interim}</p> : null}
        {!hero && (
          <label className="mt-3 flex items-center gap-2 text-xs text-subtle">
            <input type="checkbox" checked={speakReplies} onChange={(e) => setSpeakReplies(e.target.checked)} className="accent-accent" />
            Speak replies
          </label>
        )}
      </div>
      {hero && lines.length <= 1 && (
        <div className="mt-5 flex shrink-0 flex-wrap justify-center gap-2 px-4">
          {["Check order 4821", "Book a callback"].map((s) => (
            <button
              type="button"
              disabled={busy || recording}
              className="rounded-full border border-accent/15 bg-surface/70 px-3 py-2 text-xs text-muted transition-colors hover:border-accent/40 hover:text-accent disabled:opacity-50"
              onClick={() => {
                setDraft(s);
                inputRef.current?.focus();
              }}
              key={s}
            >
              {s}
              <span className="ml-2" aria-hidden="true">
                ↗
              </span>
            </button>
          ))}
        </div>
      )}
      <div
        ref={logRef}
        role="log"
        aria-label="Conversation"
        aria-live="polite"
        className={cn("min-h-0 flex-1 space-y-3 overflow-y-auto", hero ? "mt-4 w-full px-5" : "px-4 py-4")}
      >
        {lines.map((l) => (
          <div className={cn("max-w-[min(100%,28rem)]", l.role === "user" ? "ml-auto" : "")} key={l.id}>
            <div
              className={cn(
                "rounded-xl px-3.5 py-2.5 text-sm leading-relaxed",
                l.role === "user" ? "bg-accent text-accent-fg" : hero ? "bg-surface/75 text-fg" : "bg-raised text-fg",
              )}
            >
              {l.content}
            </div>
            {l.role === "assistant" && l.citations && l.citations.length > 0 ? (
              <p className="mt-1 px-1 text-[11px] text-subtle">From {l.citations.map((c) => c.title).join(" · ")}</p>
            ) : null}
          </div>
        ))}
        {busy && state === "thinking" && (
          <p className="flex items-center gap-2 rounded-md px-1 text-sm text-subtle">
            <StatusOrb state="composing" size={20} label="Composing a reply" />
            Composing a reply…
          </p>
        )}
      </div>
      {note ? <p className="mx-3 mb-1 rounded-lg bg-raised px-3 py-2 text-xs text-muted">{note}</p> : null}
      {hero && (
        <div className="flex shrink-0 items-center justify-between px-5 pt-3 text-[11px] text-muted">
          <span className="flex items-center gap-1.5">
            <AudioLines className="size-3.5" /> Try a real conversation
          </span>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-lg px-2 py-1 hover:bg-surface"
            aria-pressed={speakReplies}
            aria-label={speakReplies ? "Mute spoken replies" : "Enable spoken replies"}
            onClick={() => {
              setSpeakReplies(!speakReplies);
              if (speakReplies) audioRef.current?.pause();
            }}
          >
            {speakReplies ? <Volume2 className="size-3.5" /> : <VolumeX className="size-3.5" />}
            {speakReplies ? "Sound on" : "Sound off"}
          </button>
        </div>
      )}
      <form
        className={cn(
          "flex shrink-0 items-end gap-2 p-3",
          hero && "mx-3 mb-3 !w-auto rounded-2xl border border-accent/10 bg-surface/85 shadow-sm",
          (hero || widget) && "w-full",
          !hero && "border-t border-border",
        )}
        onSubmit={(e) => {
          e.preventDefault();
          void send(draft);
        }}
      >
        <button
          type="button"
          onClick={toggleMic}
          disabled={busy}
          className={cn("grid size-11 shrink-0 place-items-center rounded-lg", recording ? "bg-danger text-fg" : "bg-raised text-muted hover:text-fg")}
          aria-label={recording ? "Stop recording" : "Record"}
        >
          {recording ? <Square className="size-4" /> : <Mic className="size-4" />}
        </button>
        <textarea
          ref={inputRef}
          aria-label="Your message"
          disabled={recording}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(draft);
            }
          }}
          rows={1}
          placeholder="Or type a message…"
          className={cn(
            "max-h-32 min-h-11 min-w-0 flex-1 resize-none rounded-lg px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
            hero ? "bg-transparent" : "bg-raised shadow-[var(--shadow-border)]",
          )}
        />
        <Button type="submit" size="icon" disabled={busy || recording || !draft.trim()} aria-label="Send">
          <Send className="size-4" />
        </Button>
      </form>
    </div>
  );
}
