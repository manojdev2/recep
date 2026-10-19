"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type RefObject } from "react";
import { AudioLines } from "lucide-react";
import { useTheme } from "@/components/theme";
import { cn } from "@/lib/utils";
import { MODES, PAINTERS, configFor, type Opts, type OrbState } from "./engine";

function themeFromDom(el: Element | null): boolean | null {
  let node = el;
  while (node) {
    const t = node.getAttribute("data-theme");
    if (t === "dark") return true;
    if (t === "light") return false;
    if (node.classList.contains("dark")) return true;
    if (node.classList.contains("light")) return false;
    node = node.parentElement;
  }
  return null;
}

function prefersDark() {
  return typeof matchMedia === "undefined" || matchMedia("(prefers-color-scheme: dark)").matches;
}

/** Follows the page's theme (class / data-theme on an ancestor) and the OS colour scheme. */
function useDark(theme: "auto" | "dark" | "light", ref: RefObject<HTMLCanvasElement | null>) {
  const subscribe = useCallback((onChange: () => void) => {
    const mq = typeof matchMedia !== "undefined" ? matchMedia("(prefers-color-scheme: dark)") : null;
    mq?.addEventListener("change", onChange);
    const obs = typeof MutationObserver !== "undefined" ? new MutationObserver(onChange) : null;
    obs?.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"], subtree: true });
    return () => {
      mq?.removeEventListener("change", onChange);
      obs?.disconnect();
    };
  }, []);
  const autoDark = useSyncExternalStore(
    subscribe,
    () => themeFromDom(ref.current) ?? prefersDark(),
    () => true,
  );
  return theme === "auto" ? autoDark : theme === "dark";
}

function subscribeReducedMotion(onChange: () => void) {
  if (typeof matchMedia === "undefined") return () => {};
  const mq = matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function useReducedMotion() {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

const STATE_LABEL: Record<OrbState, string> = {
  working: "Working…",
  searching: "Searching…",
  solving: "Solving…",
  listening: "Listening…",
  connecting: "Connecting…",
  weaving: "Weaving…",
  composing: "Composing…",
  breathing: "Thinking…",
  shaping: "Shaping…",
};

/** A small canvas loader in one of nine states. Tuned for 64 px and 20 px. */
export function StateOrb({
  state = "working",
  size = 64,
  theme = "auto",
  speed = 1,
  paused = false,
  style,
  className,
  "aria-label": ariaLabel,
}: {
  state?: OrbState;
  size?: 64 | 20;
  theme?: "auto" | "dark" | "light";
  speed?: number;
  paused?: boolean;
  style?: CSSProperties;
  className?: string;
  "aria-label"?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const dark = useDark(theme, ref);
  const reduced = useReducedMotion();

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = Math.min(2, (typeof devicePixelRatio !== "undefined" && devicePixelRatio) || 1);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { mode, speed: base, opts } = configFor(state, size);
    const painter = PAINTERS[mode];
    const rate = base * speed;
    const draw = (t: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);
      painter(ctx, size, t, dark, opts);
    };
    if (reduced) {
      draw(0.6);
      return;
    }
    let raf = 0;
    let running = false;
    const tick = () => {
      draw((performance.now() / 1000) * rate);
      if (running) raf = requestAnimationFrame(tick);
    };
    const start = () => {
      if (running || paused) return;
      running = true;
      raf = requestAnimationFrame(tick);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };
    draw((performance.now() / 1000) * rate);
    let visible = true;
    const io =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(([entry]) => {
            visible = entry.isIntersecting;
            if (visible && document.visibilityState !== "hidden") start();
            else stop();
          })
        : null;
    io?.observe(canvas);
    const onVis = () => {
      if (document.visibilityState === "hidden") stop();
      else if (visible) start();
    };
    document.addEventListener("visibilitychange", onVis);
    if (!io) start();
    return () => {
      stop();
      io?.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [state, size, dark, speed, paused, reduced]);

  return (
    <canvas
      ref={ref}
      role="img"
      aria-label={ariaLabel ?? STATE_LABEL[state]}
      className={className}
      style={{ width: size, height: size, display: "block", ...style }}
    />
  );
}

export function StatusOrb({
  state = "working",
  size = 20,
  className,
  label,
}: {
  state?: OrbState;
  size?: 64 | 20;
  className?: string;
  label?: string;
}) {
  const { resolved } = useTheme();
  return <StateOrb state={state} size={size} theme={resolved} className={cn("shrink-0", className)} aria-label={label} />;
}

export type VoiceState = "idle" | "listening" | "thinking" | "speaking";

const VOICE_STATE: Record<VoiceState, OrbState> = {
  idle: "searching",
  listening: "listening",
  thinking: "connecting",
  speaking: "composing",
};

const VOICE_OPTS: Record<OrbState, Opts> = {
  searching: { latRings: 24, lonDensity: 60, rBase: 0.5, rDepth: 1.75, rBoost: 0.6, scanMul: 1.2, dimBase: 0.72 },
  listening: { rings: 24, lonDensity: 62, rBase: 0.55, rDepth: 1.75 },
  connecting: { nodeN: 80, thr: 0.6, signals: 10, nodeR: 1.4, nodeRDepth: 1.9, lineW: 0.8 },
  composing: { segs: 120, ghostN: 140, lanes: 3, rBase: 0.85, rDepth: 1.55 },
  weaving: { strandN: 96, ghostN: 320, turns: 3, rBase: 0.85, rDepth: 1.9 },
  working: { orbitN: 24, particles: 5 },
  solving: { latRings: 24, lonDensity: 60 },
  breathing: { segs: 120 },
  shaping: {},
};

const VOICE_SPEED: Record<OrbState, number> = {
  searching: 0.32,
  listening: 0.2,
  connecting: 0.3,
  composing: 0.36,
  weaving: 0.42,
  working: 0.4,
  solving: 0.4,
  breathing: 0.4,
  shaping: 0.4,
};

/** The large tinted orb used to start and show a voice conversation. */
export function VoiceOrb({
  state,
  level = 0,
  size = 300,
  onClick,
  label = "Start a voice conversation",
  disabled = false,
  active,
  className,
}: {
  state: VoiceState;
  level?: number;
  size?: number;
  onClick?: () => void;
  label?: string;
  disabled?: boolean;
  active?: boolean;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const live = useRef({ state, level });
  const { resolved } = useTheme();

  useEffect(() => {
    live.current = { state, level };
  }, [state, level]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const dark = resolved === "dark";
    const ink = (v: number, a: number) =>
      dark ? `rgba(220,255,140,${(0.08 + v ** 1.6 * 0.92) * a})` : `rgba(26,26,28,${(0.06 + v ** 1.6 * 0.94) * a})`;
    let visible = true;
    let raf = 0;
    let clock = 4;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const { state: s, level: lv } = live.current;
      const orbState = VOICE_STATE[s];
      const cfg = configFor(orbState, 64);
      if (!reduced.matches) clock += dt * cfg.speed * VOICE_SPEED[orbState];
      const out = MODES[cfg.mode](size, clock, { ...cfg.opts, ...VOICE_OPTS[orbState] });
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);
      ctx.save();
      ctx.translate(size / 2, size / 2);
      const k = 0.94 + (reduced.matches ? 0 : Math.min(1, lv) * 0.045);
      ctx.scale(k, k);
      ctx.translate(-size / 2, -size / 2);
      for (const l of out.lines) {
        const v = Math.max(0, Math.min(1, 1 - l.white));
        ctx.strokeStyle = ink(v, l.a ?? 1);
        ctx.lineWidth = l.w;
        ctx.beginPath();
        ctx.moveTo(l.x1, l.y1);
        ctx.lineTo(l.x2, l.y2);
        ctx.stroke();
      }
      for (const d of out.dots) {
        const v = Math.max(0, Math.min(1, 1 - d.white));
        ctx.fillStyle = ink(v, d.a ?? 1);
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    };
    const loop = (now: number) => {
      frame(now);
      raf = requestAnimationFrame(loop);
    };
    const restart = () => {
      cancelAnimationFrame(raf);
      last = performance.now();
      frame(last);
      if (visible && !document.hidden && !reduced.matches) raf = requestAnimationFrame(loop);
    };
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      restart();
    });
    io.observe(canvas);
    document.addEventListener("visibilitychange", restart);
    reduced.addEventListener("change", restart);
    restart();
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      document.removeEventListener("visibilitychange", restart);
      reduced.removeEventListener("change", restart);
    };
  }, [size, resolved]);

  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const style = {
    width: size,
    maxWidth: "100%",
    aspectRatio: "1",
    "--orb-level": Math.min(1, Math.max(0, level)),
    "--orb-tilt-x": `${tilt.x}deg`,
    "--orb-tilt-y": `${tilt.y}deg`,
  } as CSSProperties;

  const scene = (
    <span className="aurora-orb-scene" aria-hidden="true">
      <span className="aurora-orb-halo" />
      <canvas ref={canvasRef} className="relative h-full w-full" />
      <span className="aurora-orb-shadow" />
    </span>
  );

  if (!onClick) {
    return (
      <div className={cn("aurora-orb", className)} data-state={state} style={style}>
        {scene}
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse") return;
        const r = e.currentTarget.getBoundingClientRect();
        setTilt({ x: -((e.clientY - r.top) / r.height - 0.5) * 16, y: ((e.clientX - r.left) / r.width - 0.5) * 16 });
      }}
      onPointerLeave={() => setTilt({ x: 0, y: 0 })}
      className={cn("aurora-orb", className)}
      data-state={state}
      aria-label={label}
      aria-pressed={active ?? state === "listening"}
      style={style}
    >
      {scene}
    </button>
  );
}

/** Seven bars that bounce while audio plays. */
export function WaveBars({ active }: { active: boolean }) {
  return (
    <span className="flex h-4 items-end gap-0.5" aria-hidden="true">
      {Array.from({ length: 7 }).map((_, i) => (
        <span
          className="w-0.5 origin-bottom rounded-full bg-current"
          style={{
            height: "100%",
            animation: active ? `pulse-wave ${0.65 + (i % 4) * 0.1}s ease-in-out infinite` : "none",
            animationDelay: `${i * 60}ms`,
            transform: active ? undefined : `scaleY(${0.28 + (i % 3) * 0.14})`,
          }}
          key={i}
        />
      ))}
    </span>
  );
}

export function AgentGlyph({ size = 48, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cn("inline-grid shrink-0 place-items-center rounded-2xl bg-accent/10 text-accent", className)}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <AudioLines style={{ width: size * 0.48, height: size * 0.48 }} strokeWidth={1.7} />
    </span>
  );
}
