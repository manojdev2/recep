"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AudioLines, Info, Mic, MicOff, PhoneOff, Send } from "lucide-react";
import { StatusOrb, VoiceOrb } from "@/components/orb/orb";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { RealtimeDemo, type DemoLine, type DemoPhase } from "./realtime";

const SUGGESTIONS = ["What can you help my business with?", "Can you book appointments?", "What if I’m with a customer?"];

export function DemoPanel() {
  const status = useQuery({ queryKey: ["demo-voice-status"], queryFn: () => api.demoVoice.status(), staleTime: 30_000 });
  const [phase, setPhase] = useState<DemoPhase>("idle");
  const [level, setLevel] = useState(0);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [lines, setLines] = useState<DemoLine[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const busy = useRef(false);
  const [conversationId, setConversationId] = useState<string>();
  const session = useRef<RealtimeDemo | null>(null);
  const log = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const mounted = useRef(false);
  const live = phase !== "idle";
  const connected = live && phase !== "connecting";

  useEffect(() => {
    mounted.current = true;
    const s = new RealtimeDemo({
      connect: (sdp) => api.demoVoice.connect({ sdp }),
      phase: (p) => mounted.current && setPhase(p),
      level: (l) => mounted.current && setLevel(l),
      error: (m) => mounted.current && setError(m),
      line: (l) => mounted.current && setLines((prev) => [...prev.filter((p) => p.id !== l.id), l]),
    });
    session.current = s;
    const stop = () => s.stop();
    window.addEventListener("pagehide", stop);
    return () => {
      mounted.current = false;
      s.stop();
      session.current = null;
      window.removeEventListener("pagehide", stop);
    };
  }, []);

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight, behavior: "smooth" });
  }, [lines, sending]);

  useEffect(() => {
    if (!connected) return;
    const from = Date.now();
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - from) / 1000)), 1000);
    return () => {
      clearInterval(t);
      setElapsed(0);
    };
  }, [connected]);

  function start() {
    if (busy.current || live) return;
    if (!status.data?.available) {
      setNotice("Live voice isn’t switched on for this preview yet. You can still have the conversation by typing below.");
      input.current?.focus();
      return;
    }
    setError("");
    setNotice("");
    setMuted(false);
    setLines([]);
    setConversationId(undefined);
    session.current?.start();
  }

  async function send(text?: string) {
    const content = (text ?? draft).trim();
    if (!content || busy.current) return;
    if (live) {
      if (session.current?.send(content)) setDraft("");
      return;
    }
    busy.current = true;
    setSending(true);
    setError("");
    setNotice("");
    setDraft("");
    const next: DemoLine[] = [...lines, { id: crypto.randomUUID(), role: "user", content }];
    setLines(next);
    try {
      const res = await api.demo.reply({
        agentId: "demo",
        conversationId,
        speak: false,
        messages: next.map(({ role, content }) => ({ role, content })),
      });
      if (!mounted.current) return;
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setConversationId(res.conversationId);
      setLines((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", content: res.text }]);
    } catch (e) {
      if (mounted.current) setError(e instanceof Error && e.message ? e.message : "That message couldn’t send. Please try again.");
    } finally {
      busy.current = false;
      if (mounted.current) setSending(false);
    }
  }

  const headline =
    phase === "connecting"
      ? "Connecting your conversation…"
      : phase === "speaking"
        ? "Azentoo is speaking"
        : phase === "thinking" || sending
          ? "Just a moment…"
          : live
            ? muted
              ? "Microphone muted"
              : "I’m listening"
            : "Let’s have a real conversation.";
  const clock = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`;
  const showLog = lines.length > 0 || sending || live;

  return (
    <div className="demo-panel flex flex-col items-center">
      <VoiceOrb
        size={320}
        state={phase === "connecting" || sending ? "thinking" : phase}
        level={level}
        onClick={live ? () => session.current?.stop() : start}
        disabled={sending || status.isPending}
        active={live}
        label={live ? "End voice conversation" : "Start voice conversation"}
      />
      <div className="flex min-h-6 items-center justify-center gap-2">
        {connected && (
          <span className="demo-live" aria-hidden="true">
            <span className="demo-live-dot" />
            {clock}
          </span>
        )}
        <p className="text-center text-lg font-semibold tracking-tight" role="status">
          {headline}
        </p>
      </div>
      <p className="mt-1.5 max-w-sm text-center text-sm leading-relaxed text-muted">
        {live ? "Speak naturally. You can interrupt at any time." : "Start once. Talk freely. Azentoo takes care of the pauses."}
      </p>
      <div className="mt-5 flex shrink-0 flex-wrap items-center justify-center gap-2">
        {live ? (
          <>
            <Button
              variant="secondary"
              size="sm"
              disabled={phase === "connecting"}
              aria-pressed={muted}
              onClick={() => {
                session.current?.setMuted(!muted);
                setMuted(!muted);
              }}
            >
              {muted ? <MicOff /> : <Mic />}
              {muted ? "Unmute" : "Mute mic"}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => session.current?.stop()}>
              <PhoneOff />
              {phase === "connecting" ? "Cancel" : "End conversation"}
            </Button>
          </>
        ) : (
          <Button size="lg" onClick={start} disabled={sending || status.isPending}>
            <AudioLines />
            Start talking
          </Button>
        )}
      </div>
      {!showLog && (
        <div className="mt-6 flex w-full flex-wrap justify-center gap-2" aria-label="Suggested questions">
          {SUGGESTIONS.map((s) => (
            <button type="button" className="demo-chip" disabled={sending || status.isPending} onClick={() => void send(s)} key={s}>
              {s}
            </button>
          ))}
        </div>
      )}
      {showLog && (
        <div ref={log} className="demo-log mt-6 w-full space-y-3 overflow-y-auto" role="log" aria-label="Demo conversation" aria-live="polite">
          {lines.length === 0 && live && (
            <p className="px-1 text-center text-sm text-muted">Say hello — your words and Azentoo’s replies will appear here.</p>
          )}
          {lines.map((l) => (
            <div
              className={cn(
                "w-fit max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                l.role === "user"
                  ? "ml-auto rounded-br-md bg-accent text-accent-fg"
                  : "mr-auto rounded-bl-md bg-surface text-fg shadow-sm ring-1 ring-border",
              )}
              key={l.id}
            >
              <span className="sr-only">{l.role === "user" ? "You: " : "Azentoo: "}</span>
              {l.content}
            </div>
          ))}
          {sending && (
            <div className="mr-auto flex w-fit items-center gap-2 rounded-2xl rounded-bl-md bg-surface px-4 py-3 text-sm text-muted shadow-sm ring-1 ring-border">
              <StatusOrb state="composing" size={20} label="Azentoo is composing a reply" />
              Finding the right words…
            </div>
          )}
        </div>
      )}
      {notice && !error && (
        <p className="demo-notice mt-4" role="status">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>{notice}</span>
        </p>
      )}
      {error && (
        <p role="alert" className="mt-4 max-w-md text-center text-xs leading-relaxed text-danger">
          {error}
        </p>
      )}
      <form
        className="demo-composer mt-5 flex w-full shrink-0 items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <input
          ref={input}
          aria-label="Your message"
          value={draft}
          maxLength={2000}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={live ? "Or type a message…" : "Prefer to type? Say hello…"}
          className="min-w-0 flex-1 rounded-full bg-transparent px-4 py-2.5 text-sm outline-none placeholder:text-subtle"
          disabled={phase === "connecting"}
        />
        <Button
          size="icon"
          aria-label="Send message"
          disabled={sending || phase === "connecting" || phase === "thinking" || phase === "speaking" || !draft.trim()}
        >
          <Send className="size-4" />
        </Button>
      </form>
    </div>
  );
}
