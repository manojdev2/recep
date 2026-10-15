"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, ArrowUp } from "lucide-react";
import { Page, PageBody } from "@/components/app/page";
import { AgentGlyph } from "@/components/orb/orb";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { api, type ApiResult } from "@/lib/api";
import { JOBS, TEMPLATES, VOICES } from "@/lib/catalog";
import { toastError } from "@/lib/plan-limit";
import { cn } from "@/lib/utils";

type Draft = NonNullable<ApiResult<"design", "turn">["draft"]>;
type Template = (typeof TEMPLATES)[number];

const OPENING =
  "Let’s find you an extra pair of hands. What does your business do, and what would you like help with? Tell me a little, or choose a starting point below.";
const STARTERS = [
  { label: "Clinic desk", send: "A hospital or clinic front desk that books appointments. Never diagnose." },
  { label: "Sales call", send: "An inbound sales line that qualifies fit and captures the lead." },
  { label: "Presentation", send: "A short pitch that walks a buyer through the offer and books a working session." },
  { label: "Support", send: "A customer support line for questions, orders, and returns." },
];

const voiceName = (id: string) => VOICES.find((v) => v.id === id)?.name ?? id;

function Describe({ onCreate, pendingCreate }: { onCreate: (d: Draft) => void; pendingCreate: boolean }) {
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([{ role: "assistant", content: OPENING }]);
  const [chips, setChips] = useState(STARTERS);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [ready, setReady] = useState(false);
  const [input, setInput] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const turn = useMutation({
    mutationFn: (msgs: { role: "user" | "assistant"; content: string }[]) => api.design.turn({ messages: msgs }),
    onSuccess: (out) => {
      setMessages((m) => [...m, { role: "assistant", content: out.message }]);
      setChips(out.chips);
      setReady(out.ready);
      setDraft(out.draft);
    },
    onError: (e: Error) => toast.error(e.message || "Could not continue"),
  });

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages, draft, turn.isPending]);

  function say(text: string) {
    const t = text.trim();
    if (!t || turn.isPending || pendingCreate) return;
    const next = [...messages, { role: "user" as const, content: t }];
    setMessages(next);
    setInput("");
    setChips([]);
    setReady(false);
    turn.mutate(next);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8">
        <div className="mx-auto flex max-w-2xl flex-col gap-5">
          {messages.map((m, i) =>
            m.role === "assistant" ? (
              <p className="text-base leading-relaxed text-fg" key={i}>
                {m.content}
              </p>
            ) : (
              <p className="ml-auto max-w-[85%] rounded-2xl bg-raised px-4 py-2.5 text-sm leading-relaxed" key={i}>
                {m.content}
              </p>
            ),
          )}
          {turn.isPending ? (
            <p className="text-sm text-subtle">
              <span className="inline-flex gap-1">
                <span className="size-1.5 animate-pulse rounded-full bg-subtle" />
                <span className="size-1.5 animate-pulse rounded-full bg-subtle [animation-delay:120ms]" />
                <span className="size-1.5 animate-pulse rounded-full bg-subtle [animation-delay:240ms]" />
              </span>
            </p>
          ) : null}
          {ready && draft ? (
            <div className="rounded-2xl bg-bg p-5 shadow-[var(--shadow-border)]">
              <div className="flex items-start gap-3">
                <AgentGlyph size={44} />
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-medium tracking-tight">{draft.name}</p>
                  <p className="mt-1 text-sm text-muted">{draft.tagline || draft.description}</p>
                  <p className="mt-2 text-xs text-subtle">
                    {voiceName(draft.voiceId)} · {draft.language.toUpperCase()}
                    {draft.job ? ` · ${draft.job}` : ""}
                    {draft.tools.length ? ` · ${draft.tools.length} tools` : ""}
                  </p>
                </div>
              </div>
              <p className="mt-4 rounded-xl bg-raised px-4 py-3 text-sm leading-relaxed">“{draft.greeting}”</p>
              <Button className="mt-5" disabled={pendingCreate} onClick={() => onCreate(draft)}>
                {pendingCreate ? "Creating…" : "Create this line"}
              </Button>
            </div>
          ) : null}
        </div>
      </div>
      <div className="shrink-0 border-t border-border px-4 py-3 sm:px-8">
        <div className="mx-auto max-w-2xl">
          {chips.length > 0 && !turn.isPending ? (
            <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
              {chips.map((c) => (
                <button
                  type="button"
                  onClick={() => say(c.send)}
                  className={cn("h-10 shrink-0 rounded-full px-3.5 text-sm shadow-[var(--shadow-border)]", "text-fg hover:shadow-[var(--shadow-border-hover)]")}
                  key={c.label}
                >
                  {c.label}
                </button>
              ))}
            </div>
          ) : null}
          <form
            className="flex items-center gap-2 rounded-full bg-raised py-1 pr-1 pl-4 shadow-[var(--shadow-border)]"
            onSubmit={(e) => {
              e.preventDefault();
              say(input);
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Describe your agent's use case…"
              className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-subtle"
              disabled={turn.isPending || pendingCreate}
              aria-label="Describe your agent"
            />
            <button
              type="submit"
              disabled={!input.trim() || turn.isPending || pendingCreate}
              className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-accent-fg disabled:opacity-40"
              aria-label="Send"
            >
              <ArrowUp className="size-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function TemplatePreview({ template, pending, onUse }: { template: Template; pending: boolean; onUse: () => void }) {
  const [playing, setPlaying] = useState(false);
  async function hear() {
    setPlaying(true);
    try {
      const out = await api.chat.speak({ voiceId: template.voiceId, language: template.language, text: template.greeting });
      if (!out.ok) {
        toast.error(out.error);
        return;
      }
      await new Audio(`data:audio/mpeg;base64,${out.audioBase64}`).play();
    } catch {
      toast.error("Could not play that voice.");
    } finally {
      setPlaying(false);
    }
  }
  return (
    <div>
      <div className="flex items-start gap-3">
        <AgentGlyph size={44} />
        <div className="min-w-0">
          <DialogTitle>{template.name}</DialogTitle>
          <DialogDescription>
            {template.category} · {template.tagline}
          </DialogDescription>
        </div>
      </div>
      <p className="mt-4 text-sm leading-relaxed text-muted">{template.description}</p>
      <p className="mt-5 rounded-xl bg-raised px-4 py-3 text-sm leading-relaxed">“{template.greeting}”</p>
      <ul className="mt-4 grid gap-1.5 text-sm text-muted">
        <li>Voice · {voiceName(template.voiceId)}</li>
        <li>Job · {JOBS.find((j) => j.id === template.job)?.label ?? template.job}</li>
        {template.knowledge[0] ? <li>Knows · {template.knowledge[0].title}</li> : null}
        {template.tools.length ? <li>Can · {template.tools.join(", ").replaceAll("_", " ")}</li> : null}
      </ul>
      <div className="mt-6 flex flex-wrap gap-2">
        <Button onClick={onUse} disabled={pending}>
          Use this
        </Button>
        <Button variant="secondary" onClick={() => void hear()} disabled={playing}>
          {playing ? "Playing…" : "Hear greeting"}
        </Button>
      </div>
    </div>
  );
}

function Templates({ onUse, pending }: { onUse: (key: string) => void; pending: boolean }) {
  const [preview, setPreview] = useState<Template | null>(null);
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl px-5 py-4 shadow-[var(--shadow-border)]">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Start from nothing</p>
          <p className="mt-0.5 text-sm text-muted">No script, no tools. Write the greeting and take it from there.</p>
        </div>
        <Button size="sm" variant="secondary" disabled={pending} onClick={() => onUse("blank")}>
          Start blank
        </Button>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {TEMPLATES.map((t) => (
          <li key={t.key}>
            <article className="flex h-full flex-col rounded-2xl bg-bg p-5 shadow-[var(--shadow-border)] transition-[box-shadow] duration-150 hover:shadow-[var(--shadow-border-hover)]">
              <div className="flex items-start justify-between gap-3">
                <AgentGlyph size={48} />
                <span className="text-[11px] tracking-[0.14em] text-subtle uppercase">{t.category}</span>
              </div>
              <h2 className="mt-4 text-lg font-medium tracking-tight">{t.name}</h2>
              <p className="mt-1 flex-1 text-sm leading-relaxed text-muted">{t.tagline}</p>
              <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-subtle">{t.description}</p>
              <p className="mt-4 text-xs text-subtle">
                {JOBS.find((j) => j.id === t.job)?.label ?? t.job} · {voiceName(t.voiceId)} · {t.language.toUpperCase()}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button size="sm" disabled={pending} onClick={() => onUse(t.key)}>
                  Use this
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setPreview(t)}>
                  Preview
                </Button>
              </div>
            </article>
          </li>
        ))}
      </ul>
      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-md">
          {preview ? (
            <TemplatePreview
              template={preview}
              pending={pending}
              onUse={() => {
                onUse(preview.key);
                setPreview(null);
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function NewAgentPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"describe" | "templates">("describe");
  const create = useMutation({
    mutationFn: (input: { templateKey?: string; draft?: Draft }) => api.agents.create(input),
    onSuccess: async (agent) => {
      await qc.invalidateQueries({ queryKey: ["agents"] });
      await qc.invalidateQueries({ queryKey: ["workspace"] });
      router.push(`/app/agents/${agent.id}`);
    },
    onError: (e: Error) => toastError(e, () => router.push("/app/settings/billing")),
  });

  return (
    <Page>
      <header className="shrink-0 border-b border-border px-4 py-6 sm:px-8">
        <div className="flex items-start gap-2">
          <Link
            href="/app"
            className="grid size-11 shrink-0 place-items-center rounded-lg text-muted hover:bg-raised hover:text-fg"
            aria-label="Back"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight">Meet your new receptionist</h1>
              <p className="mt-0.5 text-sm text-muted">Tell us a little about your business. We’ll take it from there.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 rounded-lg bg-raised p-0.5">
                <button
                  type="button"
                  onClick={() => setTab("describe")}
                  className={cn("h-8 rounded-md px-3 text-sm", tab === "describe" ? "bg-surface text-fg shadow-[var(--shadow-border)]" : "text-muted")}
                >
                  Tell us about you
                </button>
                <button
                  type="button"
                  onClick={() => setTab("templates")}
                  className={cn("h-8 rounded-md px-3 text-sm", tab === "templates" ? "bg-surface text-fg shadow-[var(--shadow-border)]" : "text-muted")}
                >
                  Pick a starting point
                </button>
              </div>
              <Button variant="secondary" size="sm" disabled={create.isPending} onClick={() => create.mutate({ templateKey: "blank" })}>
                Skip
              </Button>
            </div>
          </div>
        </div>
      </header>
      {tab === "describe" ? (
        <Describe pendingCreate={create.isPending} onCreate={(draft) => create.mutate({ draft })} />
      ) : (
        <PageBody className="p-4 sm:p-6">
          <div className="max-w-5xl">
            <p className="mb-5 text-sm text-muted">Pick a use case. You can change the voice, the knowledge, and the greeting after it exists.</p>
            <h2 className="mb-3 text-sm font-medium tracking-tight">A starting point for your business</h2>
            <Templates onUse={(key) => create.mutate({ templateKey: key })} pending={create.isPending} />
          </div>
        </PageBody>
      )}
    </Page>
  );
}
