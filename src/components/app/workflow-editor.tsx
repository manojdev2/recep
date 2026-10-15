"use client";

import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import { GitBranch, MessageCircle, Minus, Phone, PhoneForwarded, PhoneOff, Plus, Trash2, Wrench, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TOOL_CATALOG } from "@/lib/catalog";
import { cn } from "@/lib/utils";
import type { EdgeCondition, Workflow, WorkflowEdge, WorkflowNode, WorkflowNodeType } from "@/server/types";

const NODE_W = 224;
const NODE_H = 104;

const INTENT_WORDS: Record<string, string[]> = {
  book: ["book", "appoint", "schedule", "slot", "time", "visit", "reservation", "table"],
  interested: ["yes", "interested", "demo", "price", "plan", "tell me more", "sure"],
  pay: ["pay", "invoice", "bill", "owe", "payment", "card"],
  help: ["help", "order", "return", "refund", "ticket", "broken", "issue"],
  human: ["human", "person", "agent", "operator", "someone", "transfer", "manager"],
};

const splitPhrases = (s: string) =>
  s
    .split(/[,;\n]/)
    .map((x) => x.trim())
    .filter(Boolean);

function conditionFromLabel(label?: string): EdgeCondition {
  const t = (label ?? "").trim();
  const l = t.toLowerCase();
  if (l === "else" || l === "other") return { match: "else", phrases: "" };
  if (!t || l === "next" || l === "if they say…") return { match: "says", phrases: "" };
  return { match: "says", phrases: t };
}

function conditionOf(e: WorkflowEdge): EdgeCondition {
  return e.condition?.match ? { match: e.condition.match, phrases: e.condition.phrases ?? "" } : conditionFromLabel(e.label);
}

function conditionLabel(c: EdgeCondition, fallback = "") {
  if (c.match === "else") return "else";
  const first = splitPhrases(c.phrases)[0] || fallback || "if…";
  return c.match === "contains" ? `has “${first}”` : c.match === "equals" ? `= ${first}` : first;
}

const edgeLabel = (e: WorkflowEdge) => conditionLabel(conditionOf(e), e.label ?? "");
const isElse = (e: WorkflowEdge) => conditionOf(e).match === "else";
const norm = (s: string) => s.toLowerCase().replace(/['’]/g, "'").trim();

function meansLike(phrase: string, said: string) {
  const p = norm(phrase);
  if (!p) return false;
  if (said.includes(p) || (INTENT_WORDS[p] ?? []).some((w) => said.includes(w))) return true;
  return p
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .some((w) => said.includes(w));
}

function matches(c: EdgeCondition, said: string) {
  if (c.match === "else") return false;
  const s = norm(said);
  if (!s) return false;
  const phrases = splitPhrases(c.phrases);
  if (!phrases.length) return false;
  if (c.match === "equals") return phrases.some((p) => norm(p) === s);
  if (c.match === "contains") return phrases.some((p) => s.includes(norm(p)));
  return phrases.some((p) => meansLike(p, s));
}

function route(edges: WorkflowEdge[], said: string) {
  if (!edges.length) return null;
  if (edges.length === 1) return edges[0];
  const fallback = edges.find(isElse) ?? null;
  for (const e of edges.filter((x) => !isElse(x))) if (matches(conditionOf(e), said)) return e;
  return fallback;
}

const META: Record<WorkflowNodeType, { label: string; hint: string }> = {
  start: { label: "Start", hint: "The call enters here" },
  conversation: { label: "Conversation", hint: "Speak, then wait for them" },
  speak: { label: "Speak", hint: "Say a scripted line" },
  listen: { label: "Listen", hint: "Wait and capture" },
  branch: { label: "Condition", hint: "If they mean this, go that way" },
  tool: { label: "Action", hint: "Book, look up, capture" },
  transfer: { label: "Transfer", hint: "Hand to a person" },
  sms: { label: "Text", hint: "Send an SMS" },
  end: { label: "Hang up", hint: "End the call" },
};

const PALETTE: { type: WorkflowNodeType; title: string; hint: string }[] = [
  { type: "conversation", title: "Conversation", hint: "Speak, then wait" },
  { type: "tool", title: "Action", hint: "Book, look up, capture" },
  { type: "branch", title: "Condition", hint: "If / else paths" },
  { type: "transfer", title: "Transfer", hint: "Hand to a person" },
  { type: "sms", title: "Text", hint: "Send an SMS" },
  { type: "end", title: "Hang up", hint: "End the call" },
  { type: "start", title: "Start", hint: "Another entry" },
];

const ICONS: Record<WorkflowNodeType, ComponentType<{ className?: string }>> = {
  start: Phone,
  conversation: MessageCircle,
  speak: MessageCircle,
  listen: MessageCircle,
  branch: GitBranch,
  tool: Wrench,
  transfer: PhoneForwarded,
  sms: MessageCircle,
  end: PhoneOff,
};

export function isEmptyWorkflow(w: Workflow | null | undefined) {
  return !w || w.nodes.length === 0;
}

function isBlank(w: Workflow) {
  return !w || w.nodes.length === 0 || (w.nodes.length === 1 && w.nodes[0].type === "start" && w.edges.length === 0);
}

function defaultData(type: WorkflowNodeType): WorkflowNode["data"] {
  switch (type) {
    case "start":
      return { label: "Call starts", trigger: "any" };
    case "conversation":
      return { label: "Conversation", text: "Hello — how can I help?" };
    case "speak":
      return { label: "Speak", text: "Hello — how can I help?" };
    case "listen":
      return { label: "Listen", variable: "intent" };
    case "branch":
      return { label: "Condition" };
    case "tool":
      return { label: "Action", toolKey: "list_slots" };
    case "transfer":
      return { label: "Transfer", text: "I'll put you through.", destination: "" };
    case "sms":
      return { label: "Text", text: "Thanks for calling." };
    case "end":
      return { label: "Hang up", endReason: "completed" };
  }
}

const hasInput = (t: WorkflowNodeType) => t !== "start";
const hasOutput = (t: WorkflowNodeType) => t !== "end";
const branches = (t: WorkflowNodeType) => t === "conversation" || t === "branch";
const inPort = (n: WorkflowNode) => ({ x: n.x + NODE_W / 2, y: n.y });
function outPort(n: WorkflowNode, index: number, count: number) {
  const c = Math.max(1, count);
  return { x: n.x + (NODE_W * (index + 1)) / (c + 1), y: n.y + NODE_H };
}

const node = (id: string, type: WorkflowNodeType, x: number, y: number, data: WorkflowNode["data"]): WorkflowNode => ({ id, type, x, y, data });

function edge(from: string, to: string, label?: string, condition?: EdgeCondition): WorkflowEdge {
  const c = condition ?? (label ? conditionFromLabel(label) : undefined);
  return { id: `e_${from}_${to}_${label ?? "next"}`, from, to, label, condition: c };
}

export function blankWorkflow(): Workflow {
  return { nodes: [node("start_in", "start", 288, 72, { label: "Call starts", trigger: "any" })], edges: [] };
}

/** A sensible first flow for the receptionist's job. */
export function starterWorkflow(job: string, greeting: string): Workflow {
  const hello = greeting.trim() || "Hello — how can I help?";
  const book = job === "book";
  const sell = job === "sell" || job === "present";
  const collect = job === "collect";
  const toolA = book ? "list_slots" : sell ? "capture_lead" : "lookup_order";
  const toolB = book || sell ? "book_appointment" : "create_ticket";
  const nameA = TOOL_CATALOG.find((t) => t.key === toolA)?.name ?? toolA;
  const nameB = TOOL_CATALOG.find((t) => t.key === toolB)?.name ?? toolB;
  const intent = book ? "book" : sell ? "interested" : collect ? "pay" : "help";
  const phrases = book
    ? "book, appointment, schedule, slot, visit"
    : sell
      ? "yes, interested, demo, price, tell me more"
      : collect
        ? "pay, invoice, bill, payment, card"
        : "help, order, return, refund, ticket";
  const human = "human, person, agent, operator, transfer, someone";
  const confirm = book
    ? "You're booked. I'll say the time once more so you have it."
    : sell
      ? "I've noted that. Someone will follow up if you want a working session."
      : collect
        ? "I've logged that. You'll get a confirmation by text."
        : "I've opened a ticket. Someone will pick it up.";
  return {
    nodes: [
      node("start_in", "start", 80, 40, { label: "Inbound call", trigger: "inbound" }),
      node("start_out", "start", 480, 40, { label: "Outbound call", trigger: "outbound" }),
      node("greet", "conversation", 260, 260, { label: "Greet & listen", text: hello }),
      node("tool_a", "tool", 40, 500, { label: nameA, toolKey: toolA }),
      node("tool_b", "tool", 40, 700, { label: nameB, toolKey: toolB }),
      node("confirm", "conversation", 40, 900, { label: "Confirm", text: confirm }),
      node("end_ok", "end", 40, 1100, { label: "Hang up", endReason: "completed" }),
      node("xfer", "transfer", 300, 500, { label: "Transfer", destination: "", text: "I'll put you through." }),
      node("end_xfer", "end", 300, 700, { label: "Handed off", endReason: "transferred" }),
      node("again", "conversation", 560, 500, {
        label: "Ask again",
        text: "I can book a time, take a message, or put you through to a person. Which do you want?",
      }),
      node("end_miss", "end", 560, 700, { label: "Hang up", endReason: "completed" }),
    ],
    edges: [
      edge("start_in", "greet"),
      edge("start_out", "greet"),
      edge("greet", "tool_a", intent, { match: "says", phrases }),
      edge("greet", "xfer", "human", { match: "says", phrases: human }),
      edge("greet", "again", "else", { match: "else", phrases: "" }),
      edge("tool_a", "tool_b"),
      edge("tool_b", "confirm"),
      edge("confirm", "end_ok"),
      edge("xfer", "end_xfer"),
      edge("again", "tool_a", intent, { match: "says", phrases }),
      edge("again", "xfer", "human", { match: "says", phrases: human }),
      edge("again", "end_miss", "else", { match: "else", phrases: "" }),
    ],
  };
}

const outsOf = (w: Workflow, id: string) => w.edges.filter((e) => e.from === id);
const uid = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function curve(x1: number, y1: number, x2: number, y2: number) {
  const k = Math.max(36, Math.min(90, Math.abs(y2 - y1) * 0.42));
  return `M ${x1} ${y1} C ${x1} ${y1 + k}, ${x2} ${y2 - k}, ${x2} ${y2}`;
}

function summary(n: WorkflowNode, paths: string) {
  if (n.type === "branch" && paths) return paths;
  return n.data.text || n.data.toolKey || (n.type === "start" ? n.data.trigger : "") || n.data.endReason || META[n.type].hint;
}

type Drag =
  | { kind: "pan"; sx: number; sy: number; px: number; py: number }
  | { kind: "node"; id: string; ox: number; oy: number }
  | { kind: "wire"; from: string; x: number; y: number; replace: boolean };

export function WorkflowEditor({
  value,
  onChange,
  job,
  greeting,
}: {
  value: Workflow;
  onChange: (w: Workflow) => void;
  job: string;
  greeting: string;
}) {
  const canvas = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const panRef = useRef({ x: 80, y: 40 });
  const [pan, setPan] = useState({ x: 80, y: 40 });
  const [zoom, setZoom] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  const [wireEnd, setWireEnd] = useState<{ x: number; y: number } | null>(null);
  const [fitted, setFitted] = useState(false);
  const [tryPhrase, setTryPhrase] = useState("");
  const flow = value.nodes.length ? value : blankWorkflow();
  const sel = flow.nodes.find((n) => n.id === selected) ?? null;
  const blank = isBlank(flow);
  panRef.current = pan;

  const toWorld = useCallback(
    (cx: number, cy: number) => {
      const r = canvas.current?.getBoundingClientRect();
      return r ? { x: (cx - r.left - pan.x) / zoom, y: (cy - r.top - pan.y) / zoom } : { x: 0, y: 0 };
    },
    [pan.x, pan.y, zoom],
  );

  const fit = useCallback(() => {
    const el = canvas.current;
    if (!el || flow.nodes.length === 0) return;
    const r = el.getBoundingClientRect();
    const minX = Math.min(...flow.nodes.map((n) => n.x)) - 200;
    const minY = Math.min(...flow.nodes.map((n) => n.y)) - 80;
    const maxX = Math.max(...flow.nodes.map((n) => n.x + NODE_W)) + 80;
    const maxY = Math.max(...flow.nodes.map((n) => n.y + NODE_H)) + 96;
    const w = Math.max(1, maxX - minX);
    const h = Math.max(1, maxY - minY);
    const z = clamp(Math.min(r.width / w, r.height / h), 0.55, 1.05);
    setZoom(z);
    setPan({ x: (r.width - w * z) / 2 - minX * z, y: (r.height - h * z) / 2 - minY * z });
  }, [flow.nodes]);

  useEffect(() => {
    if (fitted) return;
    const id = requestAnimationFrame(fit);
    setFitted(true);
    return () => cancelAnimationFrame(id);
  }, [fit, fitted]);

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const mx = e.clientX - r.left;
      const my = e.clientY - r.top;
      const p = panRef.current;
      setZoom((z) => {
        const wx = (mx - p.x) / z;
        const wy = (my - p.y) / z;
        const nz = clamp(z * (e.deltaY > 0 ? 0.92 : 1.08), 0.4, 1.6);
        setPan({ x: mx - wx * nz, y: my - wy * nz });
        return nz;
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const commit = (w: Workflow) => onChange(w);

  function patchNode(id: string, data: Partial<WorkflowNode["data"]>, pos?: { x: number; y: number }) {
    commit({ ...flow, nodes: flow.nodes.map((n) => (n.id === id ? { ...n, ...pos, data: { ...n.data, ...data } } : n)) });
  }

  function addNode(type: WorkflowNodeType, at?: { x: number; y: number }) {
    const r = canvas.current?.getBoundingClientRect();
    const x = at?.x ?? (r ? (-pan.x + r.width / 2) / zoom - NODE_W / 2 : 280);
    const y = at?.y ?? (r ? (-pan.y + r.height / 2) / zoom - NODE_H / 2 : 220);
    const id = uid(type);
    commit({ ...flow, nodes: [...flow.nodes, { id, type, x: Math.round(x / 8) * 8, y: Math.round(y / 8) * 8, data: defaultData(type) }] });
    setSelected(id);
    setSelectedEdge(null);
  }

  function removeNode(id: string) {
    const n = flow.nodes.find((x) => x.id === id);
    if (!n) return;
    if (n.type === "start" && flow.nodes.filter((x) => x.type === "start").length === 1) return;
    commit({ nodes: flow.nodes.filter((x) => x.id !== id), edges: flow.edges.filter((e) => e.from !== id && e.to !== id) });
    setSelected(null);
  }

  function connect(from: string, to: string, replace: boolean) {
    if (from === to) return;
    const a = flow.nodes.find((n) => n.id === from);
    if (!a || !hasOutput(a.type)) return;
    const b = flow.nodes.find((n) => n.id === to);
    if (!b || !hasInput(b.type)) return;
    let edges = flow.edges;
    if (replace || !branches(a.type)) edges = edges.filter((e) => e.from !== from);
    if (edges.some((e) => e.from === from && e.to === to)) return;
    const existing = edges.filter((e) => e.from === from);
    let condition: EdgeCondition | undefined;
    if (branches(a.type)) {
      const hasElse = existing.some(isElse);
      condition = existing.length === 0 || hasElse ? { match: "says", phrases: "" } : { match: "else", phrases: "" };
    }
    const e: WorkflowEdge = { id: `e_${from}_${to}_${Date.now().toString(36)}`, from, to, label: condition ? conditionLabel(condition) : "", condition };
    commit({ ...flow, edges: [...edges, e] });
    setSelectedEdge(e.id);
  }

  function removeEdge(id: string) {
    commit({ ...flow, edges: flow.edges.filter((e) => e.id !== id) });
    setSelectedEdge(null);
  }

  function hit(p: { x: number; y: number }) {
    for (let i = flow.nodes.length - 1; i >= 0; i--) {
      const n = flow.nodes[i];
      if (p.x >= n.x - 8 && p.x <= n.x + NODE_W + 8 && p.y >= n.y - 16 && p.y <= n.y + NODE_H + 16) return n;
    }
    return null;
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "Backspace" || e.key === "Delete") {
        if (selectedEdge) {
          e.preventDefault();
          removeEdge(selectedEdge);
        } else if (selected) {
          e.preventDefault();
          removeNode(selected);
        }
      }
      if (e.key === "Escape") {
        setSelected(null);
        setSelectedEdge(null);
        drag.current = null;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const outs = sel ? outsOf(flow, sel.id) : [];
  const lit = tryPhrase.trim() && outs.length ? route(outs, tryPhrase) : null;
  const wiring = drag.current?.kind === "wire" ? flow.nodes.find((n) => n.id === (drag.current as { from: string }).from) : null;

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <div
        ref={canvas}
        className="wf-dots relative h-full min-h-0 flex-1 cursor-grab touch-none overflow-hidden active:cursor-grabbing"
        style={{ backgroundPosition: `${pan.x}px ${pan.y}px`, backgroundSize: `calc(var(--wf-dot) * ${zoom}) calc(var(--wf-dot) * ${zoom})` }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          const t = e.target as HTMLElement;
          if (t.closest("[data-wf-ui]")) return;
          const port = t.closest<HTMLElement>("[data-wf-port]");
          if (port) {
            const from = port.dataset.from;
            if (!from) return;
            const p = toWorld(e.clientX, e.clientY);
            drag.current = { kind: "wire", from, x: p.x, y: p.y, replace: port.dataset.replace === "1" };
            setWireEnd(p);
            setSelected(from);
            setSelectedEdge(null);
            e.currentTarget.setPointerCapture(e.pointerId);
            return;
          }
          const card = t.closest<HTMLElement>("[data-wf-node]");
          if (card) {
            const id = card.dataset.id;
            const n = flow.nodes.find((x) => x.id === id);
            if (!id || !n) return;
            const p = toWorld(e.clientX, e.clientY);
            drag.current = { kind: "node", id, ox: p.x - n.x, oy: p.y - n.y };
            setSelected(id);
            setSelectedEdge(null);
            e.currentTarget.setPointerCapture(e.pointerId);
            return;
          }
          drag.current = { kind: "pan", sx: e.clientX, sy: e.clientY, px: pan.x, py: pan.y };
          setSelected(null);
          setSelectedEdge(null);
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          if (d.kind === "pan") setPan({ x: d.px + (e.clientX - d.sx), y: d.py + (e.clientY - d.sy) });
          else if (d.kind === "node") {
            const p = toWorld(e.clientX, e.clientY);
            patchNode(d.id, {}, { x: Math.round((p.x - d.ox) / 8) * 8, y: Math.round((p.y - d.oy) / 8) * 8 });
          } else setWireEnd(toWorld(e.clientX, e.clientY));
        }}
        onPointerUp={(e) => {
          const d = drag.current;
          if (d?.kind === "wire") {
            const target = hit(toWorld(e.clientX, e.clientY));
            if (target && target.id !== d.from) connect(d.from, target.id, d.replace);
          }
          drag.current = null;
          setWireEnd(null);
        }}
      >
        <aside
          data-wf-ui
          className="absolute inset-x-4 bottom-4 z-10 flex gap-1 overflow-x-auto rounded-2xl bg-surface/95 p-2 shadow-[var(--shadow-border)] backdrop-blur-sm sm:inset-x-auto sm:top-4 sm:bottom-auto sm:left-4 sm:w-44 sm:flex-col sm:overflow-visible"
        >
          <p className="hidden px-2 pt-1 pb-1 text-xs tracking-wide text-subtle uppercase sm:block">Steps</p>
          {PALETTE.map((p) => {
            const Icon = ICONS[p.type];
            return (
              <button
                type="button"
                onClick={() => addNode(p.type)}
                className="flex shrink-0 items-center gap-2 rounded-xl px-2 py-2 text-left hover:bg-raised sm:items-start"
                key={p.type}
              >
                <Icon className="size-3.5 text-muted sm:mt-0.5" />
                <span>
                  <span className="block text-sm font-medium whitespace-nowrap">{p.title}</span>
                  <span className="hidden text-xs text-muted sm:block">{p.hint}</span>
                </span>
              </button>
            );
          })}
        </aside>
        <div
          data-wf-ui
          className="absolute top-4 right-4 left-4 z-10 flex items-center justify-end gap-1 rounded-xl bg-surface/95 p-1 shadow-[var(--shadow-border)] sm:left-auto"
        >
          <Button type="button" size="sm" variant="ghost" onClick={() => setZoom((z) => clamp(z * 1.1, 0.4, 1.6))}>
            <ZoomIn className="size-4" />
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setZoom((z) => clamp(z / 1.1, 0.4, 1.6))}>
            <ZoomOut className="size-4" />
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={fit}>
            Fit
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              commit(starterWorkflow(job, greeting));
              setSelected(null);
              setFitted(false);
            }}
          >
            Starter
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              commit(blankWorkflow());
              setSelected(null);
              setFitted(false);
            }}
          >
            <Minus className="size-4" />
            Clear
          </Button>
        </div>
        {blank ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-8 z-10 text-center">
            <p className="text-sm text-muted">A call starts here.</p>
            <p className="mt-1 text-sm text-subtle">Add a step, then drag a line from the dot to the next one.</p>
          </div>
        ) : null}
        <div className="absolute origin-top-left" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
          <svg className="pointer-events-none absolute overflow-visible" width={1} height={1}>
            {flow.edges.map((e) => {
              const a = flow.nodes.find((n) => n.id === e.from);
              const b = flow.nodes.find((n) => n.id === e.to);
              if (!a || !b) return null;
              const siblings = outsOf(flow, a.id);
              const idx = Math.max(0, siblings.findIndex((x) => x.id === e.id));
              const p1 = outPort(a, branches(a.type) ? idx : 0, branches(a.type) ? siblings.length : 1);
              const p2 = inPort(b);
              const d = curve(p1.x, p1.y, p2.x, p2.y);
              const mx = (p1.x + p2.x) / 2;
              const my = (p1.y + p2.y) / 2;
              const on = selectedEdge === e.id || lit?.id === e.id;
              const label = edgeLabel(e);
              return (
                <g className="pointer-events-auto" key={e.id}>
                  <path
                    d={d}
                    fill="none"
                    stroke="transparent"
                    strokeWidth="16"
                    className="cursor-pointer"
                    onPointerDown={(ev) => {
                      ev.stopPropagation();
                      setSelectedEdge(e.id);
                      setSelected(null);
                    }}
                  />
                  <path d={d} fill="none" stroke="currentColor" strokeWidth={on ? 2.2 : 1.6} className={on ? "text-fg" : "text-line"} markerEnd="url(#wf-arrow)" />
                  {label ? (
                    <g
                      className="cursor-pointer"
                      onPointerDown={(ev) => {
                        ev.stopPropagation();
                        setSelectedEdge(e.id);
                        setSelected(e.from);
                      }}
                    >
                      <rect x={mx - 40} y={my - 11} width={80} height={22} rx={11} className="fill-surface stroke-border" strokeWidth="1" />
                      <text x={mx} y={my + 4} textAnchor="middle" className="fill-fg" style={{ fontSize: 11 }}>
                        {label}
                      </text>
                    </g>
                  ) : null}
                </g>
              );
            })}
            {wiring && wireEnd ? (
              <path
                d={curve(outPort(wiring, 0, 1).x, outPort(wiring, 0, 1).y, wireEnd.x, wireEnd.y)}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeDasharray="5 4"
                className="text-fg"
              />
            ) : null}
            <defs>
              <marker id="wf-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
                <path d="M 0 1 L 8 5 L 0 9" fill="none" stroke="currentColor" strokeWidth="1.4" className="text-line" />
              </marker>
            </defs>
          </svg>
          {flow.nodes.map((n) => {
            const Icon = ICONS[n.type];
            const active = selected === n.id;
            const ports = hasOutput(n.type) ? (branches(n.type) ? Math.max(1, outsOf(flow, n.id).length) : 1) : 0;
            return (
              <div
                data-wf-node
                data-id={n.id}
                className={cn("absolute rounded-2xl bg-surface px-3.5 py-3 shadow-[var(--shadow-border)]", active && "shadow-[var(--shadow-border-hover)]")}
                style={{ left: n.x, top: n.y, width: NODE_W, minHeight: NODE_H }}
                key={n.id}
              >
                {hasInput(n.type) ? (
                  <span
                    className="absolute top-0 left-1/2 flex size-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
                    data-wf-port
                    data-kind="in"
                    data-id={n.id}
                  >
                    <span className="wf-port" />
                  </span>
                ) : null}
                <div className="flex items-start gap-2">
                  <Icon className="mt-0.5 size-3.5 text-muted" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs tracking-wide text-subtle uppercase">{META[n.type].label}</p>
                    <p className="mt-0.5 truncate text-sm font-medium">{n.data.label}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted">
                      {summary(
                        n,
                        outsOf(flow, n.id)
                          .map(edgeLabel)
                          .filter(Boolean)
                          .join(" · "),
                      )}
                    </p>
                  </div>
                </div>
                {hasOutput(n.type)
                  ? Array.from({ length: ports }, (_, i) => (
                      <span
                        data-wf-port
                        data-from={n.id}
                        data-replace={branches(n.type) ? "0" : "1"}
                        className="absolute bottom-0 flex size-5 -translate-x-1/2 translate-y-1/2 cursor-crosshair items-center justify-center"
                        style={{ left: `${((i + 1) / (ports + 1)) * 100}%` }}
                        key={i}
                      >
                        <span className="wf-port" />
                      </span>
                    ))
                  : null}
                {branches(n.type) ? (
                  <span
                    data-wf-port
                    data-from={n.id}
                    data-replace="0"
                    className="absolute right-2 -bottom-2 flex size-5 translate-y-1/2 cursor-crosshair items-center justify-center"
                    title="Add another path"
                  >
                    <Plus className="size-3 text-muted" />
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
      {sel ? (
        <aside
          data-wf-ui
          className="absolute top-16 right-4 bottom-24 left-4 z-10 overflow-y-auto rounded-2xl bg-surface/95 p-4 shadow-[var(--shadow-border)] backdrop-blur-sm sm:bottom-4 sm:left-auto sm:w-80"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium">{META[sel.type].label}</p>
              <p className="text-xs text-muted">{META[sel.type].hint}</p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => removeNode(sel.id)}>
              <Trash2 className="size-4" />
            </Button>
          </div>
          <div className="mt-4 grid gap-3">
            <label className="grid gap-1.5">
              <Label>Name</Label>
              <Input value={sel.data.label} onChange={(e) => patchNode(sel.id, { label: e.target.value })} />
            </label>
            {sel.type === "start" ? (
              <label className="grid gap-1.5">
                <Label>When</Label>
                <Select value={sel.data.trigger ?? "any"} onValueChange={(v) => patchNode(sel.id, { trigger: v as "any" | "inbound" | "outbound" })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any call</SelectItem>
                    <SelectItem value="inbound">Inbound</SelectItem>
                    <SelectItem value="outbound">Outbound</SelectItem>
                  </SelectContent>
                </Select>
              </label>
            ) : null}
            {sel.type === "conversation" || sel.type === "speak" || sel.type === "sms" || sel.type === "transfer" ? (
              <label className="grid gap-1.5">
                <Label>{sel.type === "sms" ? "Message" : "What it says"}</Label>
                <Textarea className="min-h-28" value={sel.data.text ?? ""} onChange={(e) => patchNode(sel.id, { text: e.target.value })} />
              </label>
            ) : null}
            {sel.type === "listen" ? (
              <label className="grid gap-1.5">
                <Label>Capture as</Label>
                <Input value={sel.data.variable ?? "intent"} onChange={(e) => patchNode(sel.id, { variable: e.target.value })} />
              </label>
            ) : null}
            {sel.type === "tool" ? (
              <label className="grid gap-1.5">
                <Label>Action</Label>
                <Select
                  value={String(sel.data.toolKey ?? "list_slots")}
                  onValueChange={(v) => patchNode(sel.id, { toolKey: v, label: TOOL_CATALOG.find((t) => t.key === v)?.name ?? v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TOOL_CATALOG.map((t) => (
                      <SelectItem value={t.key} key={t.key}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            ) : null}
            {sel.type === "transfer" ? (
              <label className="grid gap-1.5">
                <Label>Destination</Label>
                <Input placeholder="+1…" value={sel.data.destination ?? ""} onChange={(e) => patchNode(sel.id, { destination: e.target.value })} />
              </label>
            ) : null}
            {sel.type === "end" ? (
              <label className="grid gap-1.5">
                <Label>Reason</Label>
                <Input value={sel.data.endReason ?? "completed"} onChange={(e) => patchNode(sel.id, { endReason: e.target.value })} />
              </label>
            ) : null}
            {hasOutput(sel.type) ? (
              <div>
                <p className="text-xs tracking-wide text-subtle uppercase">{branches(sel.type) ? "If / else" : "Then"}</p>
                <p className="mt-1 text-xs text-muted">
                  {branches(sel.type) ? "Checked in order. First match wins. Else is last." : "Drag the dot under the card onto the next step."}
                </p>
                <ul className="mt-2 grid gap-2">
                  {outs.map((e) => {
                    const c = conditionOf(e);
                    const target = flow.nodes.find((n) => n.id === e.to)?.data.label ?? e.to;
                    const on = lit?.id === e.id;
                    const setCondition = (next: EdgeCondition) =>
                      commit({ ...flow, edges: flow.edges.map((x) => (x.id === e.id ? { ...x, condition: next, label: conditionLabel(next, x.label) } : x)) });
                    return (
                      <li className={cn("grid gap-2 rounded-xl px-2.5 py-2", on ? "bg-raised shadow-[var(--shadow-border-hover)]" : "bg-raised")} key={e.id}>
                        {branches(sel.type) ? (
                          <>
                            <div className="flex items-center gap-2">
                              <Select
                                value={c.match}
                                onValueChange={(v) => {
                                  const match = v as EdgeCondition["match"];
                                  setCondition({ match, phrases: match === "else" ? "" : c.phrases });
                                }}
                              >
                                <SelectTrigger className="h-8 w-28">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="says">They mean</SelectItem>
                                  <SelectItem value="contains">They say</SelectItem>
                                  <SelectItem value="equals">Exactly</SelectItem>
                                  <SelectItem value="else">Else</SelectItem>
                                </SelectContent>
                              </Select>
                              <span className="min-w-0 flex-1 truncate text-xs text-muted">→ {target}</span>
                              <button type="button" className="text-muted hover:text-fg" onClick={() => removeEdge(e.id)}>
                                ×
                              </button>
                            </div>
                            {c.match === "else" ? null : (
                              <Input
                                className="h-8"
                                placeholder="book, appointment, schedule"
                                value={c.phrases}
                                onChange={(ev) => setCondition({ match: c.match, phrases: ev.target.value })}
                              />
                            )}
                          </>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted">next</span>
                            <span className="min-w-0 flex-1 truncate text-xs text-muted">{target}</span>
                            <button type="button" className="text-muted hover:text-fg" onClick={() => removeEdge(e.id)}>
                              ×
                            </button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
                {branches(sel.type) && outs.length > 0 ? (
                  <label className="mt-3 grid gap-1.5">
                    <Label>Try a phrase</Label>
                    <Input placeholder="I need Tuesday at 3" value={tryPhrase} onChange={(e) => setTryPhrase(e.target.value)} />
                    <p className="text-xs text-muted">
                      {tryPhrase.trim()
                        ? lit
                          ? `Goes to ${flow.nodes.find((n) => n.id === lit.to)?.data.label ?? lit.to} (${edgeLabel(lit)})`
                          : "No path matches yet — add an Else."
                        : "Type what a caller might say. The matching line lights up."}
                    </p>
                  </label>
                ) : null}
              </div>
            ) : null}
          </div>
        </aside>
      ) : null}
    </div>
  );
}
