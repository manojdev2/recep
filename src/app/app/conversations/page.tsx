"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { ArrowLeft, Globe, Mail, MessageCircle, MessageSquare, Phone, Search } from "lucide-react";
import { EmptyState, Page, PageHeader, Segmented } from "@/components/app/page";
import { AppRouteSkeleton } from "@/components/app/skeletons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api, type ApiResult } from "@/lib/api";
import { cn } from "@/lib/utils";

type Conv = ApiResult<"agents", "conversations">[number];
type Msg = ApiResult<"agents", "messages">[number];
type Filter = "all" | "open" | "booked" | "human" | "resolved";

const CHANNELS: Record<string, { label: string; icon: typeof Globe }> = {
  web: { label: "Web", icon: Globe },
  phone: { label: "Phone", icon: Phone },
  whatsapp: { label: "WhatsApp", icon: MessageCircle },
  sms: { label: "SMS", icon: Mail },
};
const channel = (c: string) => CHANNELS[c] ?? { label: c, icon: MessageSquare };
const duration = (s: number) => (s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${(s % 60).toString().padStart(2, "0")}s`);

function badgeText(c: Conv) {
  const k = c.outcome?.kind;
  return k === "appointment" ? "booked" : k === "lead" ? "lead" : k === "ticket" ? "ticket" : c.resolved ? "resolved" : "open";
}

function outcomeLine(c: Conv) {
  const o = c.outcome;
  if (o) {
    if (o.kind === "appointment") return o.summary || `Booked ${o.title}.`;
    if (o.kind === "lead") return o.summary ? `Lead · ${o.title}. ${o.summary}` : `Lead captured · ${o.title}.`;
    if (o.kind === "ticket") return `Ticket opened · ${o.title}.`;
    if (o.kind === "transfer") return o.summary || "Handed to a human.";
  }
  if (c.resolved && c.sentiment === "positive") return "They left satisfied. Nothing waiting.";
  if (c.resolved) return "Closed without a handoff.";
  if (c.sentiment === "negative") return "Still open — they were unhappy. A human should look.";
  return "Still open. Jump in, or wait for the next turn.";
}

function outcomeTitle(c: Conv) {
  const k = c.outcome?.kind;
  if (k === "appointment") return c.outcome!.title;
  if (k === "lead") return "Lead captured";
  if (k === "ticket") return "Ticket opened";
  if (k === "transfer") return "Handed off";
  return c.resolved ? "Resolved" : "Waiting on you";
}

export default function ConversationsPage() {
  const list = useQuery({ queryKey: ["conversations"], queryFn: () => api.agents.conversations() });
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [showDetail, setShowDetail] = useState(false);

  const rows = useMemo(() => {
    const all = list.data ?? [];
    const q = search.trim().toLowerCase();
    return all.filter((c) => {
      if (filter === "open" && c.resolved) return false;
      if (filter === "resolved" && !c.resolved) return false;
      if (filter === "booked" && c.outcome?.kind !== "appointment") return false;
      if (filter === "human" && c.outcome?.kind !== "transfer" && c.sentiment !== "negative") return false;
      return (
        !q ||
        c.agentName.toLowerCase().includes(q) ||
        c.preview.toLowerCase().includes(q) ||
        c.channel.toLowerCase().includes(q) ||
        (c.outcome?.title ?? "").toLowerCase().includes(q) ||
        (c.outcome?.kind ?? "").toLowerCase().includes(q)
      );
    });
  }, [list.data, search, filter]);

  useEffect(() => {
    if (!selected && rows[0]) setSelected(rows[0].id);
  }, [rows, selected]);

  const current = rows.find((c) => c.id === selected) ?? list.data?.find((c) => c.id === selected);
  const messages = useQuery({
    queryKey: ["conv-msgs", selected],
    queryFn: () => api.agents.messages(selected as string),
    enabled: !!selected,
  });

  if (list.isPending) return <AppRouteSkeleton pathname="/app/conversations" />;

  return (
    <Page>
      <PageHeader
        title="Conversations"
        description={
          list.data
            ? `${list.data.length} in the last two weeks${list.data.some((c) => c.isSample) ? " · including sample traffic" : ""}`
            : "Catch up on every hello."
        }
        actions={
          <>
            <Segmented
              value={filter}
              onChange={setFilter}
              options={[
                { id: "all", label: "All" },
                { id: "open", label: "Open" },
                { id: "booked", label: "Booked" },
                { id: "human", label: "Needs you" },
                { id: "resolved", label: "Done" },
              ]}
            />
            <label className="relative hidden sm:block">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-subtle" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" className="h-9 w-48 pl-8" aria-label="Search conversations" />
            </label>
          </>
        }
      />
      <div className="mx-4 mb-4 flex min-h-0 flex-1 overflow-hidden rounded-2xl border border-border bg-surface sm:mx-7">
        <section className={cn("flex min-h-0 min-w-0 flex-1 flex-col border-border lg:border-r", showDetail && "hidden lg:flex")}>
          <div className="border-b border-border px-4 py-2 sm:hidden">
            <label className="relative block">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-subtle" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" className="h-9 pl-8" aria-label="Search conversations" />
            </label>
          </div>
          {list.data && list.data.length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              title="No conversations yet"
              description="Try a conversation with your receptionist. Phone calls and website chats will appear here, too."
            />
          ) : rows.length === 0 ? (
            <EmptyState icon={Search} title="No matches" description="Try a different filter or search." />
          ) : (
            <ul className="min-h-0 flex-1 overflow-y-auto">
              {rows.map((c) => (
                <Row
                  conv={c}
                  active={c.id === selected}
                  onSelect={() => {
                    setSelected(c.id);
                    setShowDetail(true);
                  }}
                  key={c.id}
                />
              ))}
            </ul>
          )}
        </section>
        <aside
          className={cn(
            "flex min-h-0 w-full flex-col lg:w-[26rem] lg:shrink-0",
            !showDetail && "hidden lg:flex",
            (!list.data || list.data.length === 0) && "lg:hidden",
          )}
        >
          {current ? (
            <Detail conv={current} messages={messages.data} loading={messages.isPending} onBack={() => setShowDetail(false)} />
          ) : (
            <EmptyState icon={MessageSquare} title="Select a conversation" description="Pick a thread to read the full transcript." />
          )}
        </aside>
      </div>
    </Page>
  );
}

function Row({ conv, active, onSelect }: { conv: Conv; active: boolean; onSelect: () => void }) {
  const ch = channel(conv.channel);
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "flex w-full items-start gap-3 border-l-2 px-4 py-3 text-left transition-colors duration-150",
          active ? "border-accent bg-raised" : "border-transparent hover:bg-raised/70",
        )}
      >
        <ch.icon className="mt-0.5 size-4 shrink-0 text-subtle" />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">{conv.agentName}</span>
            <Badge tone={conv.outcome || conv.resolved ? "live" : "warn"}>{badgeText(conv)}</Badge>
            {conv.isSample && <Badge>sample</Badge>}
          </span>
          <span className="mt-0.5 block truncate text-sm text-muted">{conv.preview || "No preview"}</span>
        </span>
        <span className="shrink-0 text-right text-xs text-subtle tabular-nums">
          {formatDistanceToNow(new Date(conv.startedAt), { addSuffix: true })}
          <span className="mt-0.5 block">
            {ch.label} · {duration(conv.durationSec)}
          </span>
        </span>
      </button>
    </li>
  );
}

function FixThisTurn({ conv, messages }: { conv: Conv; messages?: Msg[] }) {
  const qc = useQueryClient();
  const said = [...(messages ?? [])].reverse().find((m) => m.role === "user")?.content ?? conv.preview;
  const replied = [...(messages ?? [])].reverse().find((m) => m.role === "assistant")?.content ?? "";
  const save = useMutation({
    mutationFn: () =>
      api.agents.addNote({
        agentId: conv.agentId,
        title: "From a live call",
        content: `When a caller says something like:\n${said}\n\nReply with the policy we meant, not:\n${replied}`,
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["agent", conv.agentId] });
      toast.success("Saved as knowledge — the next call will see it.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return said ? (
    <Button size="sm" variant="secondary" disabled={save.isPending} onClick={() => save.mutate()}>
      {save.isPending ? "Saving…" : "Fix this turn"}
    </Button>
  ) : null;
}

function Detail({ conv, messages, loading, onBack }: { conv: Conv; messages?: Msg[]; loading: boolean; onBack: () => void }) {
  const ch = channel(conv.channel);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-start gap-3 border-b border-border px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="grid size-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-raised hover:text-fg lg:hidden"
          aria-label="Back to list"
        >
          <ArrowLeft className="size-4" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-medium">{conv.agentName}</p>
            <Badge tone={conv.outcome || conv.resolved ? "live" : "warn"}>{badgeText(conv)}</Badge>
          </div>
          <p className="mt-1 text-xs text-subtle">{formatDistanceToNow(new Date(conv.startedAt), { addSuffix: true })}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button asChild size="sm" variant="secondary">
            <Link href={`/app/agents/${conv.agentId}`}>Open agent</Link>
          </Button>
          <FixThisTurn conv={conv} messages={messages} />
        </div>
      </div>
      <div className="shrink-0 border-b border-border px-4 py-4">
        <p className="text-[11px] tracking-[0.16em] text-subtle uppercase">Outcome</p>
        <p className="mt-2 text-base font-medium tracking-tight">{outcomeTitle(conv)}</p>
        <p className="mt-1 text-sm leading-relaxed text-muted">{outcomeLine(conv)}</p>
        <dl className="mt-4 grid grid-cols-3 gap-3 text-xs">
          <div>
            <dt className="text-subtle">Channel</dt>
            <dd className="mt-0.5 inline-flex items-center gap-1 text-fg">
              <ch.icon className="size-3" />
              {ch.label}
            </dd>
          </div>
          <div>
            <dt className="text-subtle">Duration</dt>
            <dd className="mt-0.5 tabular-nums text-fg">{duration(conv.durationSec)}</dd>
          </div>
          <div>
            <dt className="text-subtle">Tone</dt>
            <dd className="mt-0.5 capitalize text-fg">{conv.sentiment || "neutral"}</dd>
          </div>
        </dl>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {loading && (
          <div className="space-y-3">
            <Skeleton className="h-16 w-[78%] rounded-xl" />
            <Skeleton className="ml-auto h-12 w-[70%] rounded-xl" />
            <Skeleton className="h-20 w-[82%] rounded-xl" />
          </div>
        )}
        {messages?.map((m) => (
          <div
            className={cn(
              "max-w-[92%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed",
              m.role === "user" ? "ml-auto bg-accent text-accent-fg" : m.role === "tool" ? "bg-raised font-mono text-xs text-muted" : "bg-raised text-fg",
            )}
            key={m.id}
          >
            {m.content}
          </div>
        ))}
        {messages && messages.length === 0 && !loading && <p className="text-sm text-muted">No messages stored for this thread.</p>}
      </div>
    </div>
  );
}
