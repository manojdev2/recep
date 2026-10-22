"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { ArrowLeft, Check, Play, Sparkles, Trash2 } from "lucide-react";
import { AppMark } from "@/components/brand-marks";
import { CallDialog } from "@/components/app/call-dialog";
import { ConnectorDialog, type ConnectInput } from "@/components/app/connector-dialog";
import { GoLiveSteps } from "@/components/app/first-run";
import { StudioSkeleton } from "@/components/app/skeletons";
import { blankWorkflow, isEmptyWorkflow, WorkflowEditor } from "@/components/app/workflow-editor";
import { AgentGlyph } from "@/components/orb/orb";
import { TalkPanel } from "@/components/talk-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { VoicePortrait } from "@/components/voice-portrait";
import { api, type ApiResult } from "@/lib/api";
import { CHANNELS, CONNECTORS, findConnector, JOBS, LANGUAGES, MODELS, TOOL_CATALOG, VOICES } from "@/lib/catalog";
import { KNOWLEDGE_ACCEPT, uploadKnowledgeFiles } from "@/lib/knowledge-upload";
import { cn } from "@/lib/utils";
import type { Agent, CallConfig } from "@/server/types";

// ---- Boundaries ------------------------------------------------------------------------

const RULES = [
  {
    key: "no_medical",
    label: "Never give medical advice",
    rule: "Never diagnose, interpret symptoms, advise on medication, or say whether something is serious. Book an appointment or offer to put them through to a clinician.",
    trades: ["clinic", "dental", "after_hours"],
  },
  {
    key: "no_legal",
    label: "Never give legal or financial advice",
    rule: "Never advise on a legal position, a tax question, or what someone should do about a case. Book a consultation with a qualified person instead.",
    trades: ["legal", "collect"],
  },
  {
    key: "no_quote",
    label: "Never quote a price for unseen work",
    rule: "Never estimate the cost of a job you have not been given full details for. Give published prices only, and book a survey or callback for anything else.",
    trades: ["home_services", "auto", "salon"],
  },
  {
    key: "no_discount",
    label: "Never offer a discount",
    rule: "Never offer, agree to, or hint at a discount, a free upgrade, or a price match. If pressed, say pricing is fixed and offer to pass the request to the team.",
    trades: ["sales_call", "present", "real_estate", "tuition"],
  },
  {
    key: "no_payment_details",
    label: "Never take card or bank details",
    rule: "Never ask for or accept a card number, CVV, bank details, or a one-time passcode, even if the caller offers them. Send a secure payment link or transfer to a person.",
    trades: ["collect", "restaurant", "hotel", "gym"],
  },
  {
    key: "no_guarantee",
    label: "Never promise an outcome",
    rule: "Never promise a result, a timescale you have not been given, or that someone will call back by a specific time. Say what you can confirm and what you cannot.",
    trades: ["legal", "recruiting", "real_estate", "auto"],
  },
  {
    key: "no_personal_data",
    label: "Never read back personal details",
    rule: "Never read out an address, date of birth, medical note, or account balance to confirm identity. Ask the caller to state it instead.",
    trades: ["clinic", "dental", "collect", "legal"],
  },
  {
    key: "emergency_escalate",
    label: "Escalate emergencies immediately",
    rule: "If the caller describes an emergency, injury, fire, flood, gas, or anyone at risk, stop the script, tell them to call emergency services, and transfer or take a callback number at once.",
    trades: ["clinic", "dental", "home_services", "after_hours", "auto"],
  },
  {
    key: "no_hiring_promises",
    label: "Never discuss an offer or salary decision",
    rule: "Never confirm that someone has the job, discuss a final salary, or comment on another candidate. Collect what is asked for and book the interview.",
    trades: ["recruiting"],
  },
];

function rulesFor(trade: string | null) {
  if (!trade) return RULES;
  return [...RULES.filter((r) => r.trades.includes(trade)), ...RULES.filter((r) => !r.trades.includes(trade))];
}

function compose(keys: string[], own: string) {
  const lines = RULES.filter((r) => keys.includes(r.key)).map((r) => r.rule);
  if (own.trim()) lines.push(own.trim());
  return lines.join("\n");
}

const chosen = (text: string) => RULES.filter((r) => text.includes(r.rule)).map((r) => r.key);

function ownRules(text: string) {
  let rest = text;
  for (const r of RULES) rest = rest.replace(r.rule, "");
  return rest
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n");
}

function Boundaries({ value, templateKey, onChange }: { value: string; templateKey: string | null; onChange: (v: string) => void }) {
  const picked = chosen(value);
  const own = ownRules(value);
  const toggle = (key: string) => onChange(compose(picked.includes(key) ? picked.filter((k) => k !== key) : [...picked, key], own));
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        {rulesFor(templateKey).map((r) => {
          const on = picked.includes(r.key);
          return (
            <button
              type="button"
              onClick={() => toggle(r.key)}
              aria-pressed={on}
              title={r.rule}
              className={cn("flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-colors", on ? "bg-fg text-bg" : "bg-raised text-muted hover:text-fg")}
              key={r.key}
            >
              {on ? <Check className="size-3" /> : null}
              {r.label}
            </button>
          );
        })}
      </div>
      <Textarea
        value={own}
        onChange={(e) => onChange(compose(picked, e.target.value))}
        className="min-h-20"
        placeholder={"Your own rules, one per line.\nNever quote for a job we have not surveyed."}
      />
      <p className="text-xs text-subtle">
        {picked.length
          ? `${picked.length} rule${picked.length === 1 ? "" : "s"} chosen${own ? ", plus your own" : ""}. The agent refuses these and offers a person instead.`
          : "Nothing is off limits yet. Pick what this line must never do."}
      </p>
    </div>
  );
}

// ---- Rehearse --------------------------------------------------------------------------

function Rehearse({ agentId, open, onOpenChange }: { agentId: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const run = useMutation({
    mutationFn: () => api.agents.rehearse({ agentId }),
    onSuccess: async (out) => {
      if (!out.ok) {
        toast.error(out.error);
        return;
      }
      await qc.invalidateQueries({ queryKey: ["agents"] });
      await qc.invalidateQueries({ queryKey: ["agent", agentId] });
      toast.success(`${out.passed} of ${out.total} scenes passed`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const data = run.data && run.data.ok ? run.data : null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto">
        <DialogTitle>Rehearse</DialogTitle>
        <DialogDescription>Four callers. We score greeting, tools, and whether it invents a fact. Nothing is saved to the inbox.</DialogDescription>
        <Button className="mt-4" disabled={run.isPending} onClick={() => run.mutate()}>
          {run.isPending ? "Calling through the scenes…" : "Run scenes"}
        </Button>
        {data ? <p className="mt-4 text-sm">{data.passed === data.total ? "Ready to publish." : `${data.passed} of ${data.total} passed.`}</p> : null}
        {data?.scenes.length ? (
          <ul className="mt-3 grid gap-2">
            {data.scenes.map((s) => (
              <li className="rounded-xl bg-raised px-4 py-3" key={s.id}>
                <p className="text-sm font-medium">
                  <span className={s.passed ? "text-live" : "text-danger"}>{s.passed ? "Pass" : "Fail"}</span> · {s.name}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted">{s.detail}</p>
              </li>
            ))}
          </ul>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

// ---- Diary -----------------------------------------------------------------------------

type SlotRow = ApiResult<"outcomes", "slots">[number];

// ---- Menu (take_order) -------------------------------------------------------------------

type MenuRow = { name: string; price: string };

function MenuEditor({ agentId }: { agentId: string }) {
  const qc = useQueryClient();
  const menu = useQuery({ queryKey: ["menu", agentId], queryFn: () => api.orders.menu(agentId) });
  const [draft, setDraft] = useState<{ currency: string; rows: MenuRow[] } | null>(null);
  const loaded = menu.data && { currency: menu.data.currency.toUpperCase(), rows: menu.data.items.map((i) => ({ name: i.name, price: (i.priceCents / 100).toFixed(2) })) };
  const value = draft ?? loaded;
  const save = useMutation({
    mutationFn: () => api.orders.saveMenu({ agentId, currency: value!.currency, items: value!.rows.map((r) => ({ name: r.name, price: r.price })) }),
    onSuccess: async (out) => {
      await qc.invalidateQueries({ queryKey: ["menu", agentId] });
      setDraft(null);
      toast.success(`Menu saved · ${out.items} item${out.items === 1 ? "" : "s"}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  if (!value) return <Skeleton className="h-24 rounded-xl" />;
  const edit = (next: { currency: string; rows: MenuRow[] }) => setDraft(next);
  const setRow = (i: number, patch: Partial<MenuRow>) => edit({ ...value, rows: value.rows.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  return (
    <div className="grid gap-3 rounded-xl bg-raised px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <span>
          <span className="block text-sm font-medium">Menu</span>
          <span className="block text-xs text-muted">The line only takes orders for these, at these prices.</span>
        </span>
        <Input aria-label="Currency" value={value.currency} maxLength={3} onChange={(e) => edit({ ...value, currency: e.target.value.toUpperCase() })} className="h-8 w-16 text-center" />
      </div>
      <ul className="grid gap-1.5">
        {value.rows.map((r, i) => (
          <li className="flex items-center gap-2" key={i}>
            <Input aria-label="Item name" placeholder="Flat white" value={r.name} onChange={(e) => setRow(i, { name: e.target.value })} className="h-8 flex-1" />
            <Input aria-label="Price" inputMode="decimal" placeholder="4.50" value={r.price} onChange={(e) => setRow(i, { price: e.target.value })} className="h-8 w-20 text-right tabular-nums" />
            <Button type="button" size="sm" variant="ghost" className="h-8 px-2" aria-label="Remove item" onClick={() => edit({ ...value, rows: value.rows.filter((_, j) => j !== i) })}>
              <Trash2 className="size-3.5" />
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={() => edit({ ...value, rows: [...value.rows, { name: "", price: "" }] })}>
          Add item
        </Button>
        <Button type="button" size="sm" variant="secondary" disabled={!draft || save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? "Saving…" : "Save menu"}
        </Button>
      </div>
      <p className="text-xs text-subtle">
        To take card payments, connect your Stripe account in the Apps tab. Customers get a secure Stripe link; card details never pass through the line.
      </p>
    </div>
  );
}

function Diary({ slots, loading, generating, onGenerate }: { slots?: SlotRow[]; loading: boolean; generating: boolean; onGenerate: () => void }) {
  // A time with several seats (tables) shows once, with who has booked and what is left.
  const days: { day: string; items: { startsAt: string; booked: SlotRow[]; open: number }[] }[] = [];
  for (const s of slots ?? []) {
    const day = new Date(s.startsAt).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
    let last = days.at(-1);
    if (!last || last.day !== day) days.push((last = { day, items: [] }));
    let time = last.items.find((t) => t.startsAt === s.startsAt);
    if (!time) last.items.push((time = { startsAt: s.startsAt, booked: [], open: 0 }));
    if (s.status === "booked") time.booked.push(s);
    else if (s.status === "open") time.open++;
  }
  const booked = (slots ?? []).filter((s) => s.status === "booked").length;
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="min-w-0 flex-1 text-sm leading-relaxed text-muted">
          Open times the line can offer. Booked names appear here after a caller confirms.{booked ? ` ${booked} booked.` : ""}
        </p>
        <Button type="button" variant="secondary" size="sm" className="shrink-0 whitespace-nowrap" disabled={generating} onClick={onGenerate}>
          {generating ? "Generating…" : "Generate week"}
        </Button>
      </div>
      {loading ? (
        <div className="grid gap-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-12 rounded-xl" />
          <Skeleton className="h-12 rounded-xl" />
        </div>
      ) : days.length === 0 ? (
        <p className="rounded-xl bg-raised px-4 py-5 text-sm text-muted">
          No open times yet. Set your{" "}
          <Link href="/app/settings/hours" className="text-accent underline underline-offset-2">
            opening hours
          </Link>{" "}
          once, then generate the diary here and talk to the line to book a time.
        </p>
      ) : (
        <div className="grid gap-5">
          {days.map((d) => (
            <div key={d.day}>
              <p className="mb-2 text-xs tracking-[0.16em] text-subtle uppercase">{d.day}</p>
              <ul className="grid gap-1.5">
                {d.items.map((t) => (
                  <li className="flex items-center justify-between gap-3 rounded-xl bg-raised px-4 py-3" key={t.startsAt}>
                    <span className="text-sm font-medium tabular-nums">
                      {new Date(t.startsAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                    </span>
                    <span className="min-w-0 text-right">
                      {t.booked.map((s) => (
                        <span className="block truncate text-sm" key={s.id}>
                          {s.bookedName || "Booked"}
                          {s.bookedContact ? <span className="text-xs text-subtle"> · {s.bookedContact}</span> : null}
                        </span>
                      ))}
                      {t.open > 0 ? (
                        <span className="block text-xs text-subtle">{t.booked.length || t.open > 1 ? `${t.open} open` : "Open"}</span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Page ------------------------------------------------------------------------------

const TABS = [
  { id: "line", label: "Personality" },
  { id: "call", label: "Phone setup" },
  { id: "flow", label: "Call flow" },
  { id: "knowledge", label: "Knowledge" },
  { id: "hours", label: "Hours" },
  { id: "apps", label: "Apps" },
  { id: "share", label: "Share" },
] as const;
type Tab = (typeof TABS)[number]["id"];

const SCENARIOS = [
  { key: "refund", name: "Refund request" },
  { key: "book", name: "New booking" },
  { key: "handoff", name: "Angry handoff" },
];

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <Label>{label}</Label>
      {children}
    </label>
  );
}

function Stats({ rows }: { rows: { resolved: boolean; durationSec: number }[] }) {
  const s = useMemo(() => {
    const total = rows.length;
    return {
      total,
      resolved: rows.filter((r) => r.resolved).length,
      avg: total === 0 ? 0 : Math.round(rows.reduce((sum, r) => sum + r.durationSec, 0) / total),
    };
  }, [rows]);
  return (
    <div className="grid grid-cols-3 gap-3">
      {[
        { label: "Talks", value: String(s.total) },
        { label: "Resolved", value: String(s.resolved) },
        { label: "Avg", value: s.avg ? `${Math.round(s.avg / 60)}m` : "—" },
      ].map((x) => (
        <div className="rounded-xl bg-raised px-3 py-3" key={x.label}>
          <p className="text-xs tracking-wide text-subtle uppercase">{x.label}</p>
          <p className="mt-1 text-lg font-medium tabular-nums">{x.value}</p>
        </div>
      ))}
    </div>
  );
}

function payload(a: Agent) {
  return {
    id: a.id,
    name: a.name,
    tagline: a.tagline,
    description: a.description,
    voiceId: a.voiceId,
    language: a.language,
    systemPrompt: a.systemPrompt,
    greeting: a.greeting,
    temperature: a.temperature,
    status: a.status,
    firstMessageMode: a.firstMessageMode,
    channels: a.channels,
    guardrails: a.guardrails,
    job: a.job,
    modelId: a.modelId,
    interrupt: a.interrupt,
    knowCaller: a.knowCaller,
    direction: a.direction,
    brain: a.brain,
    callConfig: a.callConfig,
    workflow: a.workflow,
    widgetConfig: a.widgetConfig,
  };
}

export default function StudioPage() {
  const { agentId } = useParams<{ agentId: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const agentQuery = useQuery({ queryKey: ["agent", agentId], queryFn: () => api.agents.get(agentId) });
  const slotsQuery = useQuery({ queryKey: ["slots", agentId], queryFn: () => api.outcomes.slots(agentId) });
  const agentApps = useQuery({ queryKey: ["agent-connectors", agentId], queryFn: () => api.connectors.forAgent(agentId) });
  const appsQuery = useQuery({ queryKey: ["apps"], queryFn: () => api.connectors.list() });
  const phonesQuery = useQuery({ queryKey: ["phones"], queryFn: () => api.agents.phones() });
  const convQuery = useQuery({ queryKey: ["conversations"], queryFn: () => api.agents.conversations() });
  const [agent, setAgent] = useState<Agent | null>(null);
  const [tab, setTab] = useState<Tab>("line");
  const [connectKey, setConnectKey] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [callMode, setCallMode] = useState<"in" | "out" | null>(null);
  const [practice, setPractice] = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [url, setUrl] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const [scenario, setScenario] = useState("refund");
  const [sim, setSim] = useState<{ transcript: { role: string; content: string }[]; passed: boolean; goal: string } | null>(null);

  // Take each freshly loaded agent into the editable copy (adjusting state during render).
  const loadedAgent = agentQuery.data?.agent;
  const [syncedAgent, setSyncedAgent] = useState<Agent | undefined>();
  if (loadedAgent && loadedAgent !== syncedAgent) {
    setSyncedAgent(loadedAgent);
    setAgent(loadedAgent);
  }

  const refreshAgent = async () => {
    await qc.invalidateQueries({ queryKey: ["agent", agentId] });
    await qc.invalidateQueries({ queryKey: ["agents"] });
  };

  const publish = useMutation({
    mutationFn: () => {
      if (!agent) throw new Error("Nothing to save");
      return api.agents.update(payload(agent));
    },
    onSuccess: async () => {
      await refreshAgent();
      await qc.invalidateQueries({ queryKey: ["slots", agentId] });
      toast.success("Published");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: () => api.agents.remove(agentId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["agents"] });
      router.push("/app");
    },
  });
  const generate = useMutation({
    mutationFn: () => api.outcomes.generate(agentId),
    onSuccess: async (n) => {
      await qc.invalidateQueries({ queryKey: ["slots", agentId] });
      if (n.created === 0 && n.removed === 0) {
        toast.message("Set your opening hours first", {
          description: "The diary is built from the hours you keep. Set them once and come back.",
          action: { label: "Opening hours", onClick: () => router.push("/app/settings/hours") },
        });
        return;
      }
      toast.success(
        n.orphanedBookings
          ? `${n.created} open times. ${n.orphanedBookings} booking(s) now fall outside your hours.`
          : `${n.created} open times added to the diary`,
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const goLive = useMutation({
    mutationFn: async () => {
      if (agent) await api.agents.update({ ...payload(agent), status: "live" });
      else await api.agents.update({ id: agentId, status: "live" });
    },
    onSuccess: async () => {
      setAgent((a) => a && { ...a, status: "live" });
      await refreshAgent();
      toast.success("Live — anyone with the link can talk");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const pause = useMutation({
    mutationFn: () => api.agents.update({ id: agentId, status: "paused" }),
    onSuccess: async () => {
      setAgent((a) => a && { ...a, status: "paused" });
      await refreshAgent();
      toast.success("Paused — the public widget is off");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const simulate = useMutation({
    mutationFn: () => api.agents.simulate({ agentId, scenario }),
    onSuccess: (out) => {
      if (!out.ok) {
        toast.error(out.error);
        return;
      }
      setSim({ transcript: out.transcript, passed: out.passed, goal: out.goal });
    },
  });
  const rewrite = useMutation({
    mutationFn: () => {
      if (!agent) throw new Error("Nothing to improve");
      return api.design.rewrite({ name: agent.name, instructions: agent.systemPrompt, job: agent.job });
    },
    onSuccess: (out) => {
      if (!out.ok) {
        toast.error(out.error);
        return;
      }
      setAgent((a) => a && { ...a, systemPrompt: out.text });
      toast.success("Instructions rewritten");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const assignPhone = useMutation({
    mutationFn: async () => {
      const free = (phonesQuery.data ?? []).find((p) => !p.agentId) ?? phonesQuery.data?.[0];
      if (free) {
        await api.agents.assignNumber({ id: free.id, agentId });
        return free.e164;
      }
      const fresh = await api.agents.addTestNumber({ label: "Inbound line" });
      await api.agents.assignNumber({ id: fresh.id, agentId });
      return fresh.e164;
    },
    onSuccess: async (e164) => {
      await qc.invalidateQueries({ queryKey: ["phones"] });
      toast.success(`Assigned ${e164}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const connect = useMutation({
    mutationFn: (input: ConnectInput) => api.connectors.connectForAgent({ agentId, ...input }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["apps"] });
      await qc.invalidateQueries({ queryKey: ["agent-connectors", agentId] });
      toast.success("Connected — live API verified");
      setConnectKey(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const placeCall = useMutation({
    mutationFn: (input: { agentId: string; to: string; phoneId?: string }) => api.calling.place(input),
    onSuccess: async (out) => {
      await qc.invalidateQueries({ queryKey: ["calls"] });
      toast.success(out.live ? `Live call to ${out.to}` : out.summary);
      setCallMode(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const ringIn = useMutation({
    mutationFn: (input: { agentId: string; phoneId?: string; from: string }) => api.calling.ringIn(input),
    onSuccess: async (out) => {
      await qc.invalidateQueries({ queryKey: ["calls"] });
      await qc.invalidateQueries({ queryKey: ["conversations"] });
      toast.success(`Inbound from ${out.from}`);
      setCallMode(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (agentQuery.isPending) return <StudioSkeleton />;
  if (!agentQuery.data || !agent) {
    return (
      <div className="p-8">
        <p className="text-muted">This agent is gone.</p>
        <Button asChild className="mt-4" variant="secondary">
          <Link href="/app">Back</Link>
        </Button>
      </div>
    );
  }

  const set = (patch: Partial<Agent>) => setAgent({ ...agent, ...patch });
  const setCall = (patch: Partial<CallConfig>) => setAgent({ ...agent, callConfig: { ...agent.callConfig, ...patch } });
  const docs = agentQuery.data.docs;
  const tools = agentQuery.data.tools;
  const talks = (convQuery.data ?? []).filter((c) => c.agentId === agentId);
  const phone = (phonesQuery.data ?? []).find((p) => p.agentId === agentId);
  const talked = talks.some((c) => !c.isSample);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const attached = new Set((agentApps.data ?? []).map((c) => c.appKey));
  const connections = new Map((appsQuery.data ?? []).map((c) => [c.appKey, c]));
  const voice = VOICES.find((v) => v.id === agent.voiceId);
  const embed = `<iframe src="${origin}/w/${agentId}" style="border:0;width:380px;height:640px" allow="microphone"></iframe>`;
  const statusTone = agent.status === "live" ? "live" : agent.status === "paused" ? "warn" : "draft";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="shrink-0 border-b border-border bg-surface px-4 py-5 sm:px-6">
        <div className="flex items-start gap-2">
          <Link href="/app" className="inline-flex h-11 shrink-0 items-center gap-1 rounded-lg px-2 text-sm text-muted hover:bg-raised hover:text-fg">
            <ArrowLeft className="size-4" />
            Back
          </Link>
          <AgentGlyph size={40} className="mt-0.5 shrink-0" />
          <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={agent.name}
                  onChange={(e) => set({ name: e.target.value })}
                  className="max-w-full min-w-0 bg-transparent text-2xl font-semibold tracking-tight outline-none"
                  aria-label="Receptionist name"
                />
                <Badge tone={statusTone}>{agent.status === "live" ? "Live" : agent.status}</Badge>
              </div>
              <p className="truncate text-xs text-subtle">Last published {formatDistanceToNow(new Date(agent.updatedAt), { addSuffix: true })}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="size-4" />
                <span className="hidden sm:inline">Delete</span>
              </Button>
              <Button variant="secondary" onClick={() => setPractice(true)}>
                Practice
              </Button>
              <Button variant="secondary" asChild>
                <a href={`/w/${agentId}`} target="_blank" rel="noreferrer">
                  <Sparkles className="size-4" />
                  <span className="hidden sm:inline">Try it live</span>
                  <span className="sm:hidden">Try</span>
                </a>
              </Button>
              {agent.status === "live" ? (
                <Button onClick={() => publish.mutate()} disabled={publish.isPending}>
                  {publish.isPending ? "Publishing…" : "Publish"}
                </Button>
              ) : (
                <Button disabled={goLive.isPending} onClick={() => goLive.mutate()}>
                  {goLive.isPending ? "Publishing…" : "Publish"}
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>
      <div
        className={cn(
          "grid min-h-0 flex-1",
          tab === "flow" ? "lg:grid-cols-[9.5rem_minmax(0,1fr)]" : "lg:grid-cols-[10rem_minmax(0,1fr)] xl:grid-cols-[10rem_minmax(0,1fr)_minmax(20rem,24rem)]",
        )}
      >
        <nav className="flex gap-1 overflow-x-auto border-b border-border px-3 py-2 lg:flex-col lg:overflow-visible lg:border-r lg:border-b-0 lg:px-3 lg:py-4">
          {TABS.map((t) => (
            <button
              type="button"
              onClick={() => {
                if (t.id === "flow" && isEmptyWorkflow(agent.workflow)) set({ workflow: blankWorkflow(), brain: "workflow" });
                setTab(t.id);
              }}
              className={cn("h-10 shrink-0 rounded-lg px-3 text-left text-sm", tab === t.id ? "bg-raised text-fg" : "text-muted hover:bg-raised hover:text-fg")}
              key={t.id}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <div className={cn("min-h-0", tab === "flow" ? "flex min-h-96 flex-col overflow-hidden sm:min-h-0" : "overflow-y-auto px-4 py-6 sm:px-6")}>
          {tab === "line" && (
            <div className="mx-auto grid max-w-xl gap-5">
              {talked ? null : <GoLiveSteps talked={talked} e164={phone?.e164 ?? null} provider={phone?.provider ?? null} widgetUrl={`${origin}/w/${agentId}`} />}
              <Field label="Tagline">
                <Input value={agent.tagline} onChange={(e) => set({ tagline: e.target.value })} placeholder="One line the caller hears as who this is" />
              </Field>
              <Field label="Voice">
                <div className="flex items-center justify-between gap-3 rounded-xl bg-raised px-4 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <VoicePortrait id={agent.voiceId} size={40} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{voice?.name ?? agent.voiceId}</p>
                      <p className="text-xs text-muted">{voice?.tone}</p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={async () => {
                      const out = await api.chat.speak({ voiceId: agent.voiceId, language: agent.language, text: agent.greeting });
                      if (!out.ok) {
                        toast.error(out.error);
                        return;
                      }
                      await new Audio(`data:audio/mpeg;base64,${out.audioBase64}`).play();
                    }}
                  >
                    <Play className="size-4" />
                    Hear
                  </Button>
                </div>
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm font-medium text-accent">Choose a different voice</summary>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {VOICES.map((v) => (
                      <button
                        type="button"
                        onClick={() => set({ voiceId: v.id })}
                        className={cn(
                          "flex items-center gap-3 rounded-xl px-3 py-3 text-left shadow-[var(--shadow-border)]",
                          agent.voiceId === v.id ? "bg-raised" : "bg-surface hover:bg-raised",
                        )}
                        key={v.id}
                      >
                        <VoicePortrait id={v.id} size={40} />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium">{v.name}</span>
                          <span className="mt-0.5 block text-xs text-muted">
                            {v.gender} · {v.tone}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                </details>
              </Field>
              <Field label="Language">
                <Select value={agent.language} onValueChange={(v) => set({ language: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((l) => (
                      <SelectItem value={l.id} key={l.id}>
                        {l.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="How can it help?">
                <Select value={agent.job} onValueChange={(v) => set({ job: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {JOBS.map((j) => (
                      <SelectItem value={j.id} key={j.id}>
                        {j.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted">{JOBS.find((j) => j.id === agent.job)?.description}</p>
              </Field>
              <details className="rounded-2xl border border-border bg-surface p-4">
                <summary className="cursor-pointer text-sm font-medium">Advanced · AI model</summary>
                <div className="mt-4">
                  <Field label="Model">
                    <Select value={agent.modelId} onValueChange={(v) => set({ modelId: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MODELS.map((m) => (
                          <SelectItem value={m.id} key={m.id}>
                            {m.name} · {m.short}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted">{MODELS.find((m) => m.id === agent.modelId)?.description}</p>
                  </Field>
                </div>
              </details>
              <div className="grid gap-1.5">
                <div className="flex items-center justify-between gap-3">
                  <Label>How your receptionist should help</Label>
                  <button
                    type="button"
                    onClick={() => rewrite.mutate()}
                    disabled={rewrite.isPending}
                    className="text-sm text-muted hover:text-fg disabled:opacity-40"
                  >
                    {rewrite.isPending ? "Rewriting…" : "Rewrite"}
                  </button>
                </div>
                <Textarea value={agent.systemPrompt} onChange={(e) => set({ systemPrompt: e.target.value })} className="min-h-36" />
              </div>
              <label className="flex items-center justify-between gap-3 rounded-xl bg-raised px-3 py-3">
                <span className="text-sm">Speak first</span>
                <Switch checked={agent.firstMessageMode === "speak"} onCheckedChange={(v) => set({ firstMessageMode: v ? "speak" : "wait" })} />
              </label>
              <Field label="Greeting">
                <Textarea value={agent.greeting} onChange={(e) => set({ greeting: e.target.value })} className="min-h-20" />
              </Field>
              <Field label="Your boundaries">
                <Boundaries value={agent.guardrails ?? ""} templateKey={agent.templateKey} onChange={(v) => set({ guardrails: v })} />
              </Field>
              <details className="rounded-2xl border border-border bg-surface p-4">
                <summary className="cursor-pointer text-sm font-medium">Advanced · Response variety</summary>
                <div className="mt-4">
                  <Field label="Temperature">
                    <Input type="number" min={0} max={1} step={0.1} value={agent.temperature} onChange={(e) => set({ temperature: e.target.value })} />
                  </Field>
                </div>
              </details>
              <div className="grid gap-2">
                <p className="text-sm font-medium">Tools</p>
                {TOOL_CATALOG.map((t) => {
                  const on = tools.some((x) => x.toolKey === t.key && x.enabled);
                  return (
                    <label className="flex items-start justify-between gap-3 rounded-xl bg-raised px-4 py-3" key={t.key}>
                      <span>
                        <span className="block text-sm">{t.name}</span>
                        <span className="mt-0.5 block text-xs text-muted">{t.description}</span>
                      </span>
                      <Switch
                        checked={on}
                        onCheckedChange={async (enabled) => {
                          await api.agents.setTool({ agentId, toolKey: t.key, enabled });
                          await qc.invalidateQueries({ queryKey: ["agent", agentId] });
                          await qc.invalidateQueries({ queryKey: ["slots", agentId] });
                        }}
                      />
                    </label>
                  );
                })}
                {tools.some((x) => x.toolKey === "take_order" && x.enabled) ? <MenuEditor agentId={agentId} /> : null}
              </div>
            </div>
          )}
          {tab === "call" && (
            <div className="mx-auto grid max-w-xl gap-5">
              <p className="text-sm text-muted">
                Inbound answers the assigned number. Outbound dials from it. Both can share the same prompt or the same flow.
              </p>
              <div>
                <p className="mb-2 text-sm font-medium">Direction</p>
                <div className="grid gap-2">
                  {(
                    [
                      ["both", "Inbound and outbound"],
                      ["inbound", "Inbound only"],
                      ["outbound", "Outbound only"],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      type="button"
                      onClick={() => set({ direction: id })}
                      className={cn("rounded-xl px-4 py-3 text-left text-sm shadow-[var(--shadow-border)]", agent.direction === id ? "bg-raised" : "hover:bg-raised")}
                      key={id}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-sm font-medium">How it thinks</p>
                <div className="grid gap-2">
                  <button
                    type="button"
                    onClick={() => set({ brain: "prompt" })}
                    className={cn("rounded-xl px-4 py-3 text-left shadow-[var(--shadow-border)]", agent.brain === "prompt" ? "bg-raised" : "hover:bg-raised")}
                  >
                    <span className="block text-sm">Prompt</span>
                    <span className="mt-0.5 block text-xs text-muted">One system prompt. Best for open conversation.</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => set({ brain: "workflow", workflow: isEmptyWorkflow(agent.workflow) ? blankWorkflow() : agent.workflow })}
                    className={cn("rounded-xl px-4 py-3 text-left shadow-[var(--shadow-border)]", agent.brain === "workflow" ? "bg-raised" : "hover:bg-raised")}
                  >
                    <span className="block text-sm">Workflow</span>
                    <span className="mt-0.5 block text-xs text-muted">A blank canvas. Connect steps — the call walks those lines.</span>
                  </button>
                </div>
              </div>
              {agent.direction === "outbound" ? null : (
                <div className="grid gap-3 rounded-xl px-4 py-4 shadow-[var(--shadow-border)]">
                  <p className="text-sm font-medium">Inbound</p>
                  <p className="text-sm text-muted">{phone ? `Answers ${phone.e164}` : "Assign a number on Share, or set one up here."}</p>
                  <Field label="After hours">
                    <Select value={agent.callConfig.afterHours} onValueChange={(v) => setCall({ afterHours: v as CallConfig["afterHours"] })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="voicemail">Take a voicemail</SelectItem>
                        <SelectItem value="message">Play a message and hang up</SelectItem>
                        <SelectItem value="hangup">Hang up</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="After-hours message">
                    <Textarea className="min-h-20" value={agent.callConfig.afterHoursMessage} onChange={(e) => setCall({ afterHoursMessage: e.target.value })} />
                  </Field>
                  <Field label="Transfer number">
                    <Input placeholder="+1…" value={agent.callConfig.transferNumber} onChange={(e) => setCall({ transferNumber: e.target.value })} />
                  </Field>
                  <label className="flex items-center justify-between rounded-xl bg-raised px-4 py-3">
                    <span className="text-sm">Record the call</span>
                    <Switch checked={agent.callConfig.record} onCheckedChange={(v) => setCall({ record: v })} />
                  </label>
                </div>
              )}
              {agent.direction === "inbound" ? null : (
                <div className="grid gap-3 rounded-xl px-4 py-4 shadow-[var(--shadow-border)]">
                  <p className="text-sm font-medium">Outbound</p>
                  <Field label="First line (if empty, uses the greeting)">
                    <Textarea className="min-h-20" value={agent.callConfig.outboundFirstMessage} onChange={(e) => setCall({ outboundFirstMessage: e.target.value })} />
                  </Field>
                  <Field label="Caller ID override">
                    <Input
                      placeholder={phone?.e164 || "Uses the assigned number"}
                      value={agent.callConfig.outboundCallerId}
                      onChange={(e) => setCall({ outboundCallerId: e.target.value })}
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Window start">
                      <Input value={agent.callConfig.callingWindowStart} onChange={(e) => setCall({ callingWindowStart: e.target.value })} />
                    </Field>
                    <Field label="Window end">
                      <Input value={agent.callConfig.callingWindowEnd} onChange={(e) => setCall({ callingWindowEnd: e.target.value })} />
                    </Field>
                  </div>
                  <Field label="Max attempts">
                    <Input
                      type="number"
                      min={1}
                      max={5}
                      value={agent.callConfig.maxAttempts}
                      onChange={(e) => setCall({ maxAttempts: Number(e.target.value) || 1 })}
                    />
                  </Field>
                  <Field label="If a machine answers">
                    <Select value={agent.callConfig.outboundVoicemail} onValueChange={(v) => setCall({ outboundVoicemail: v === "hangup" ? "hangup" : "message" })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="message">Leave the script</SelectItem>
                        <SelectItem value="hangup">Hang up</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <label className="flex items-center justify-between rounded-xl bg-raised px-4 py-3">
                    <span className="text-sm">Detect answering machines</span>
                    <Switch checked={agent.callConfig.amd} onCheckedChange={(v) => setCall({ amd: v })} />
                  </label>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" onClick={() => setCallMode("in")}>
                  Ring in
                </Button>
                <Button type="button" onClick={() => setCallMode("out")}>
                  Call someone
                </Button>
              </div>
            </div>
          )}
          {tab === "flow" && (
            <WorkflowEditor
              value={isEmptyWorkflow(agent.workflow) ? blankWorkflow() : agent.workflow}
              job={agent.job}
              greeting={agent.greeting}
              onChange={(workflow) => set({ workflow, brain: "workflow" })}
            />
          )}
          {tab === "knowledge" && (
            <div className="mx-auto grid max-w-xl gap-4">
              <p className="text-sm text-muted">Share a website, document, or note so your receptionist can give callers helpful answers.</p>
              {docs.length === 0 ? (
                <p className="rounded-xl bg-raised px-4 py-6 text-sm text-muted">No documents yet. Add one below, or attach from Knowledge.</p>
              ) : (
                <ul className="grid gap-2">
                  {docs.map((d) => (
                    <li className="rounded-xl bg-raised p-4" key={d.id}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{d.title}</p>
                          <p className="mt-0.5 text-xs text-subtle">{d.source === "url" ? d.sourceUrl : d.source === "file" ? d.filename : "Note"}</p>
                        </div>
                        <button
                          type="button"
                          className="text-xs text-muted hover:text-danger"
                          onClick={async () => {
                            await api.agents.removeDoc(d.id);
                            await qc.invalidateQueries({ queryKey: ["agent", agentId] });
                          }}
                        >
                          Remove
                        </button>
                      </div>
                      <p className="mt-2 line-clamp-4 text-sm text-muted">{d.content}</p>
                    </li>
                  ))}
                </ul>
              )}
              <div className="grid gap-3 rounded-xl bg-raised p-4">
                <p className="text-sm font-medium">From a URL</p>
                <Input placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!url.trim()}
                  onClick={async () => {
                    try {
                      await api.knowledge.add({ url, agentId, source: "url" });
                      setUrl("");
                      await qc.invalidateQueries({ queryKey: ["agent", agentId] });
                      await qc.invalidateQueries({ queryKey: ["knowledge-lib"] });
                      toast.success("Page stored");
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Could not fetch");
                    }
                  }}
                >
                  Fetch page
                </Button>
              </div>
              <div className="grid gap-3 rounded-xl bg-raised p-4">
                <p className="text-sm font-medium">Dump files</p>
                <p className="text-xs text-muted">.pdf .docx .txt .md .csv .json .html</p>
                <input
                  ref={fileInput}
                  type="file"
                  multiple
                  accept={KNOWLEDGE_ACCEPT}
                  className="hidden"
                  onChange={async (e) => {
                    const files = e.target.files;
                    if (!files?.length) return;
                    const { added, errors } = await uploadKnowledgeFiles(files, { agentId });
                    for (const err of errors) toast.error(err);
                    if (added) {
                      await qc.invalidateQueries({ queryKey: ["agent", agentId] });
                      await qc.invalidateQueries({ queryKey: ["knowledge-lib"] });
                      toast.success(`${added} file${added === 1 ? "" : "s"} stored`);
                    }
                    e.target.value = "";
                  }}
                />
                <Button type="button" variant="secondary" onClick={() => fileInput.current?.click()}>
                  Choose files
                </Button>
              </div>
              <form
                className="grid gap-3"
                onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    await api.agents.addNote({ agentId, title: noteTitle, content: noteBody });
                    setNoteTitle("");
                    setNoteBody("");
                    await qc.invalidateQueries({ queryKey: ["agent", agentId] });
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Could not add");
                  }
                }}
              >
                <Field label="Title">
                  <Input value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} required />
                </Field>
                <Field label="Note">
                  <Textarea value={noteBody} onChange={(e) => setNoteBody(e.target.value)} className="min-h-28" required />
                </Field>
                <Button type="submit">Add note</Button>
              </form>
            </div>
          )}
          {tab === "hours" && (
            <div className="mx-auto max-w-xl">
              <Diary slots={slotsQuery.data} loading={slotsQuery.isPending} generating={generate.isPending} onGenerate={() => generate.mutate()} />
            </div>
          )}
          {tab === "apps" && (
            <div className="mx-auto grid max-w-xl gap-4">
              <p className="text-sm text-muted">Attach a live connection. The line calls the provider’s API — it will not invent records.</p>
              {(agentApps.data ?? []).length > 0 ? (
                <ul className="grid gap-2">
                  {(agentApps.data ?? []).map((c) => (
                    <li className="flex items-center gap-3 rounded-xl bg-raised px-4 py-3" key={c.id}>
                      <AppMark appKey={c.appKey} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">{findConnector(c.appKey)?.name ?? c.appKey}</span>
                        <span className="block truncate text-xs text-muted">
                          {c.accountLabel}
                          {c.hasCredentials ? " · live" : " · missing token"}
                        </span>
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          await api.connectors.detach({ agentId, connectionId: c.connectionId });
                          await qc.invalidateQueries({ queryKey: ["agent-connectors", agentId] });
                          await qc.invalidateQueries({ queryKey: ["apps"] });
                        }}
                      >
                        Remove
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-xl bg-raised px-4 py-6 text-sm text-muted">Nothing attached. Connect from Apps, or add one below.</p>
              )}
              <ul className="grid gap-2">
                {CONNECTORS.filter((c) => c.kind === "tool").map((c) => {
                  const on = attached.has(c.key);
                  const existing = connections.get(c.key);
                  return (
                    <li key={c.key}>
                      <button
                        type="button"
                        disabled={on}
                        onClick={async () => {
                          if (existing) {
                            await api.connectors.attach({ agentId, connectionId: existing.id });
                            await qc.invalidateQueries({ queryKey: ["agent-connectors", agentId] });
                            await qc.invalidateQueries({ queryKey: ["apps"] });
                            return;
                          }
                          setConnectKey(c.key);
                        }}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left shadow-[var(--shadow-border)] hover:bg-raised disabled:opacity-40"
                      >
                        <AppMark appKey={c.key} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium">{c.name}</span>
                          <span className="block text-xs text-muted">{c.description}</span>
                        </span>
                        <span className="text-xs text-subtle">{on ? "On this line" : existing ? "Attach" : "Connect"}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <Button variant="secondary" asChild>
                <Link href="/app/apps">Open Apps</Link>
              </Button>
            </div>
          )}
          {tab === "share" && (
            <div className="mx-auto grid max-w-xl gap-5">
              <div className="rounded-xl px-4 py-4 shadow-[var(--shadow-border)]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Public line</p>
                    <p className="mt-1 text-sm text-muted">
                      {agent.status === "live" ? "Anyone with the link can talk. No sign-in." : "This agent is not public. You can still preview it."}
                    </p>
                  </div>
                  <Badge tone={statusTone}>{agent.status}</Badge>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {agent.status === "live" ? (
                    <Button type="button" variant="secondary" disabled={pause.isPending} onClick={() => pause.mutate()}>
                      {pause.isPending ? "Pausing…" : "Pause"}
                    </Button>
                  ) : (
                    <Button type="button" disabled={goLive.isPending} onClick={() => goLive.mutate()}>
                      {goLive.isPending ? "Going live…" : "Set live"}
                    </Button>
                  )}
                  <Button asChild variant="secondary">
                    <a href={`/w/${agentId}`} target="_blank" rel="noreferrer">
                      Open line
                    </a>
                  </Button>
                </div>
              </div>
              <div className="rounded-xl px-4 py-4 shadow-[var(--shadow-border)]">
                <p className="text-sm font-medium">Phone</p>
                <p className="mt-1 text-sm text-muted">{phone ? `Inbound and outbound on ${phone.e164}` : "Assign a number for inbound and outbound calls."}</p>
                <Button type="button" size="sm" variant={phone ? "secondary" : "primary"} className="mt-3" onClick={() => assignPhone.mutate()}>
                  {phone ? "Reassign" : "Set up"}
                </Button>
              </div>
              <div className="grid gap-2">
                <p className="text-sm font-medium">Channels</p>
                {CHANNELS.map((ch) => {
                  const on = agent.channels.includes(ch.id);
                  return (
                    <label className="flex items-center justify-between rounded-xl bg-raised px-4 py-3" key={ch.id}>
                      <span className="text-sm">{ch.label}</span>
                      <Switch
                        checked={on}
                        onCheckedChange={(v) => {
                          const next = v ? [...new Set([...agent.channels, ch.id])] : agent.channels.filter((x) => x !== ch.id);
                          set({ channels: next.length ? next : ["web"] });
                        }}
                      />
                    </label>
                  );
                })}
              </div>
              <Field label="Embed">
                <Textarea readOnly className="min-h-24 font-mono text-xs" value={embed} />
              </Field>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  navigator.clipboard.writeText(embed);
                  toast.success("Copied embed");
                }}
              >
                Copy embed
              </Button>
              <div className="grid gap-3 rounded-xl px-4 py-4 shadow-[var(--shadow-border)]">
                <p className="text-sm font-medium">Looks like them</p>
                <p className="text-sm text-muted">Logo, color, and a line that isn’t Azentoo’s.</p>
                <Field label="Headline">
                  <Input
                    value={agent.widgetConfig.headline}
                    onChange={(e) => set({ widgetConfig: { ...agent.widgetConfig, headline: e.target.value } })}
                    placeholder={agent.name}
                  />
                </Field>
                <Field label="Logo URL">
                  <Input
                    value={agent.widgetConfig.logoUrl}
                    onChange={(e) => set({ widgetConfig: { ...agent.widgetConfig, logoUrl: e.target.value } })}
                    placeholder="https://…"
                  />
                </Field>
                <Field label="Accent">
                  <Input
                    value={agent.widgetConfig.color}
                    onChange={(e) => set({ widgetConfig: { ...agent.widgetConfig, color: e.target.value } })}
                    placeholder="#2c2416"
                  />
                </Field>
                <Field label="Allowed sites (comma-separated, empty = anywhere)">
                  <Input
                    value={agent.widgetConfig.allowedDomains.join(", ")}
                    onChange={(e) =>
                      set({
                        widgetConfig: {
                          ...agent.widgetConfig,
                          allowedDomains: e.target.value
                            .split(",")
                            .map((d) => d.trim())
                            .filter(Boolean),
                        },
                      })
                    }
                    placeholder="example.com, shop.example.com"
                  />
                </Field>
                <label className="flex items-center justify-between text-sm">
                  Hide “Powered by Azentoo”
                  <Switch checked={agent.widgetConfig.hideBrand} onCheckedChange={(v) => set({ widgetConfig: { ...agent.widgetConfig, hideBrand: v } })} />
                </label>
              </div>
              <Stats rows={talks} />
              <p className="text-sm text-muted">Run a scripted caller against this agent. Save first if you just edited the prompt.</p>
              <Field label="Scenario">
                <Select value={scenario} onValueChange={setScenario}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCENARIOS.map((s) => (
                      <SelectItem value={s.key} key={s.key}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Button
                type="button"
                variant="secondary"
                disabled={simulate.isPending}
                onClick={() => {
                  setSim(null);
                  simulate.mutate();
                }}
              >
                {simulate.isPending ? "Running…" : "Run simulation"}
              </Button>
              {sim && (
                <div className="rounded-xl bg-raised p-4">
                  <p className="text-sm font-medium">
                    {sim.passed ? "Passed" : "Needs work"} — {sim.goal}
                  </p>
                  <ul className="mt-3 space-y-2 text-sm">
                    {sim.transcript.map((t, i) => (
                      <li key={i}>
                        <span className="text-xs tracking-wide text-subtle uppercase">{t.role}</span>
                        <p className="mt-0.5 leading-relaxed">{t.content}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
        {tab === "flow" ? null : (
          <div className="hidden min-h-0 border-l border-border xl:flex xl:flex-col">
            <div className="flex h-10 shrink-0 items-center border-b border-border px-4">
              <p className="text-xs tracking-[0.16em] text-subtle uppercase">Talk</p>
            </div>
            <TalkPanel agentId={agentId} greeting={agent.greeting} agentName={agent.name} mode="auth" variant="studio" language={agent.language} />
          </div>
        )}
      </div>
      <div className="shrink-0 border-t border-border p-3 xl:hidden">
        <details className="rounded-xl bg-surface shadow-[var(--shadow-border)]">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium">Test conversation</summary>
          <div className="h-96">
            <TalkPanel agentId={agentId} greeting={agent.greeting} agentName={agent.name} mode="auth" variant="widget" language={agent.language} />
          </div>
        </details>
      </div>
      <Rehearse agentId={agentId} open={practice} onOpenChange={setPractice} />
      <ConnectorDialog
        appKey={connectKey}
        pending={connect.isPending}
        error={connect.error ? connect.error.message : null}
        onOpenChange={(o) => {
          if (!o) {
            setConnectKey(null);
            connect.reset();
          }
        }}
        onSubmit={(input) => connect.mutate(input)}
      />
      {callMode ? (
        <CallDialog
          open
          mode={callMode === "in" ? "inbound" : "outbound"}
          agents={[agent]}
          phones={phonesQuery.data ?? []}
          defaultAgentId={agent.id}
          defaultPhoneId={phone?.id}
          pending={placeCall.isPending || ringIn.isPending}
          onOpenChange={(o) => !o && setCallMode(null)}
          onPlace={(input) => placeCall.mutate(input)}
          onInbound={(input) => ringIn.mutate(input)}
        />
      ) : null}
      <ConfirmDialog
        open={confirmDelete}
        title="Delete this line?"
        description="The agent, its conversations, and the bookings on it go with it. This cannot be undone."
        confirmLabel="Delete"
        danger
        pending={remove.isPending}
        onOpenChange={setConfirmDelete}
        onConfirm={() => remove.mutate()}
      />
    </div>
  );
}
