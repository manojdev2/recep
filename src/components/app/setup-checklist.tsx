"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

const OPEN_EVENT = "aether-setup-open";
const OPEN_FLAG = "aether.setup.open";
const DISMISSED = "aether.setup.dismissed";

/** Reopens the checklist on the home page and scrolls to it. */
export function openSetup() {
  localStorage.removeItem(DISMISSED);
  sessionStorage.setItem(OPEN_FLAG, "1");
  window.dispatchEvent(new Event(OPEN_EVENT));
}

export function useSetup() {
  return useQuery({ queryKey: ["setup"], queryFn: () => api.setup.get() });
}

export function SetupChecklist() {
  const setup = useSetup();
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const wantsScroll = useRef(false);

  useEffect(() => {
    const open = () => {
      localStorage.removeItem(DISMISSED);
      setDismissed(false);
      setExpanded(true);
      wantsScroll.current = true;
    };
    if (sessionStorage.getItem(OPEN_FLAG) === "1") {
      sessionStorage.removeItem(OPEN_FLAG);
      open();
    } else {
      setDismissed(localStorage.getItem(DISMISSED) === "1");
    }
    window.addEventListener(OPEN_EVENT, open);
    return () => window.removeEventListener(OPEN_EVENT, open);
  }, []);

  useEffect(() => {
    if (!wantsScroll.current || dismissed || !setup.data || setup.data.complete) return;
    const el = document.getElementById("setup");
    if (el) {
      wantsScroll.current = false;
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [expanded, dismissed, setup.data]);

  if (!setup.data || setup.data.complete || dismissed) return null;
  const { steps, doneCount, liveReady } = setup.data;
  const total = steps.length;
  const next = steps.find((s) => !s.done && !s.optional) ?? steps.find((s) => !s.done);
  if (!next) return null;
  const position = steps.indexOf(next) + 1;

  return (
    <section
      id="setup"
      aria-labelledby="setup-heading"
      className="mb-6 scroll-mt-4 overflow-hidden rounded-2xl border border-border bg-surface"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 p-5">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] tracking-[0.14em] text-subtle uppercase">
            {liveReady ? "Your line is live" : `Step ${position} of ${total}`}
          </p>
          <h2 id="setup-heading" className="mt-1.5 text-base font-medium">
            {next.title}
          </h2>
          <p className="mt-1 max-w-prose text-sm leading-relaxed text-muted">{next.why}</p>
        </div>
        <Button asChild>
          <Link href={next.href}>
            {next.action}
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>
      <div className="flex items-center gap-3 border-t border-border px-5 py-2.5">
        <div className="flex items-center gap-1.5" aria-hidden="true">
          {steps.map((s) => (
            <span
              title={s.title}
              className={cn(
                "h-1.5 w-6 rounded-full transition-colors",
                s.done ? "bg-accent" : s.key === next.key ? "bg-fg" : "bg-border",
              )}
              key={s.key}
            />
          ))}
        </div>
        <span className="text-xs text-subtle">
          {doneCount} of {total} done
        </span>
        <div className="ml-auto flex items-center gap-3">
          <button
            type="button"
            className="text-xs text-subtle transition-colors hover:text-fg"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-controls="setup-all"
          >
            {expanded ? "Hide steps" : "All steps"}
          </button>
          <button
            type="button"
            className="text-xs text-subtle transition-colors hover:text-fg"
            onClick={() => {
              localStorage.setItem(DISMISSED, "1");
              setDismissed(true);
            }}
          >
            Dismiss
          </button>
        </div>
      </div>
      {expanded ? (
        <ol id="setup-all" className="border-t border-border px-3 py-2">
          {steps.map((s, i) => (
            <li key={s.key}>
              <Link
                href={s.href}
                className="group flex items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-raised"
                aria-current={s.key === next.key ? "step" : undefined}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "grid size-5 shrink-0 place-items-center rounded-full text-[11px]",
                    s.done ? "bg-accent text-accent-fg" : s.key === next.key ? "bg-fg text-bg" : "bg-border text-subtle",
                  )}
                >
                  {s.done ? <Check className="size-3" /> : i + 1}
                </span>
                <span className={cn("min-w-0 flex-1 truncate group-hover:text-fg", s.done && "text-subtle")}>{s.title}</span>
                {s.optional && !s.done ? (
                  <span className="text-[10px] tracking-wide text-subtle uppercase">Optional</span>
                ) : null}
                <span className="text-xs text-subtle opacity-0 transition-opacity group-hover:opacity-100">
                  {s.done ? "Open" : s.action}
                </span>
                <ArrowRight className="size-3.5 shrink-0 text-subtle" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
