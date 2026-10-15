"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { AudioLines, CalendarCheck, Check, Headset } from "lucide-react";
import { StatusOrb } from "@/components/orb/orb";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STARTERS = [
  { key: "clinic", title: "Help with appointments", copy: "Book, change, or check a visit. Never diagnose.", icon: CalendarCheck },
  { key: "support", title: "A hand with customer questions", copy: "Orders, returns, and a ticket when it needs a human.", icon: Headset },
  { key: "sales_call", title: "A welcome for new customers", copy: "Meet new customers, take their details, and book a chat.", icon: AudioLines },
];

const STAGES = [
  { at: 0, label: "Preparing a warm welcome" },
  { at: 900, label: "Adding helpful answers" },
  { at: 1900, label: "Getting your calendar ready" },
  { at: 3000, label: "Setting up a practice conversation" },
  { at: 4400, label: "Almost there" },
];

function Building({ label }: { label: string }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => setElapsed(Date.now() - start), 200);
    return () => clearInterval(id);
  }, []);
  const reached = STAGES.filter((s) => elapsed >= s.at);
  const current = Math.max(0, reached.length - 1);
  return (
    <div className="mt-8 rounded-2xl bg-raised/60 p-5" role="status" aria-live="polite" aria-label={`Building ${label}`}>
      <div className="flex items-center gap-3">
        <StatusOrb state="working" size={20} label="Working" />
        <p className="text-sm font-medium">Building {label}…</p>
      </div>
      <ol className="mt-4 grid gap-2">
        {STAGES.map((s, i) => {
          const done = i < current;
          const now = i === current;
          return (
            <li
              className={cn(
                "flex items-center gap-2.5 text-sm transition-colors duration-300",
                done && "text-muted",
                now && "text-fg",
                !done && !now && "text-subtle",
              )}
              key={s.label}
            >
              <span className="grid size-4 shrink-0 place-items-center" aria-hidden="true">
                {done ? (
                  <Check className="size-3.5 text-accent" strokeWidth={2.4} />
                ) : now ? (
                  <span className="size-1.5 animate-pulse rounded-full bg-accent" />
                ) : (
                  <span className="size-1.5 rounded-full bg-border" />
                )}
              </span>
              {s.label}
            </li>
          );
        })}
      </ol>
      <p className="mt-4 text-xs leading-relaxed text-subtle">
        This takes a few seconds the first time. You’ll meet your receptionist and can talk to it straight away.
      </p>
    </div>
  );
}

export function FirstRun({ onPick, pending }: { onPick: (key: string) => void; pending: boolean }) {
  const [picked, setPicked] = useState<string | null>(null);
  const label = STARTERS.find((s) => s.key === picked)?.title.toLowerCase() ?? "your receptionist";
  return (
    <div className="mx-auto max-w-2xl rounded-3xl border border-border bg-surface p-6 sm:p-10">
      <p className="text-xs tracking-[0.18em] text-subtle uppercase">Your first receptionist</p>
      <h2 className="mt-2 text-3xl font-medium tracking-tight">What could you use a hand with?</h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">
        Choose a starting point. We’ll prepare a friendly greeting and a practice space so you can try a conversation.
      </p>
      <ul className="mt-8 grid gap-3">
        {STARTERS.map((s) => (
          <li key={s.key}>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setPicked(s.key);
                onPick(s.key);
              }}
              className={cn(
                "flex w-full items-start gap-4 rounded-2xl bg-bg p-5 text-left shadow-[var(--shadow-border)] transition-opacity",
                !pending && "hover:shadow-[var(--shadow-border-hover)]",
                pending && picked !== s.key && "opacity-30",
                pending && picked === s.key && "shadow-[var(--shadow-border-hover)]",
              )}
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-raised text-muted">
                <s.icon className="size-5" strokeWidth={1.6} />
              </span>
              <span className="min-w-0">
                <span className="block text-lg font-medium tracking-tight">{s.title}</span>
                <span className="mt-1 block text-sm text-muted">{s.copy}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {pending ? (
        <Building label={label} />
      ) : (
        <p className="mt-6 text-sm text-muted">
          Or{" "}
          <Link href="/app/new" className="text-fg underline-offset-4 hover:underline">
            describe it in your own words
          </Link>
          .
        </p>
      )}
    </div>
  );
}

const isTestProvider = (p: string | null | undefined) => p === "aether" || p === "aether-sip";

function CopyLink({ url }: { url: string }) {
  return (
    <Button
      size="sm"
      variant="secondary"
      className="mt-2"
      onClick={() => {
        navigator.clipboard.writeText(url).then(
          () => toast.success("Link copied"),
          () => toast.error("Could not copy"),
        );
      }}
    >
      Copy link
    </Button>
  );
}

/** The "get this on a line" checklist shown beside a new receptionist. */
export function GoLiveSteps({
  talked,
  e164,
  provider,
  widgetUrl,
}: {
  talked: boolean;
  e164: string | null;
  provider: string | null;
  widgetUrl: string;
}) {
  const test = isTestProvider(provider);
  const connected = !!e164 && !test;
  const shareable = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])/i.test(widgetUrl) ? null : widgetUrl;
  const steps: { done: boolean; title: string; body: ReactNode }[] = [
    { done: talked, title: "Talk to it", body: <span className="mt-0.5 block text-muted">Use the orb. Try booking a time.</span> },
    {
      done: connected,
      title: connected ? "A number is connected" : "Connect a phone number",
      body: connected ? (
        <span className="mt-0.5 block font-mono text-muted">{e164}</span>
      ) : (
        <span className="mt-0.5 block text-muted">
          {test ? (
            <>
              <span className="font-mono">{e164}</span> is a test number for the studio — nobody can dial it.{" "}
              <Link href="/app/phone" className="underline">
                Connect a real one
              </Link>{" "}
              to take calls.
            </>
          ) : (
            <Link href="/app/phone" className="underline">
              Add a number
            </Link>
          )}
        </span>
      ),
    },
    {
      done: false,
      title: "Share the widget",
      body: shareable ? (
        <>
          <span className="mt-1 block truncate font-mono text-xs text-muted">{shareable}</span>
          <CopyLink url={shareable} />
        </>
      ) : (
        <span className="mt-0.5 block text-muted">
          Available once this is deployed — a link on localhost only opens on this computer.
        </span>
      ),
    },
  ];
  return (
    <section className="rounded-2xl bg-raised p-4">
      <p className="text-sm font-medium">Get this on a line</p>
      <ol className="mt-3 grid gap-3 text-sm">
        {steps.map((s, i) => (
          <li className="flex gap-3" key={s.title}>
            <span className={cn("flex w-8 shrink-0 items-center gap-1 tabular-nums", s.done ? "text-live" : "text-subtle")}>
              {i + 1}
              {s.done ? <Check className="size-3" /> : null}
            </span>
            <span className="min-w-0 flex-1">
              <span className="font-medium">{s.title}</span>
              {s.body}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
