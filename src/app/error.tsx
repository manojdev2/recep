"use client";

import Link from "next/link";
import { TriangleAlert } from "lucide-react";

/** Messages we wrote ourselves and are happy to show as-is. */
const KNOWN = [
  "Unauthorized",
  "Agent not found",
  "Webhook not found",
  "Campaign not found",
  "Number not found",
  "This form is closed",
  "Connect the app first",
  "That is not a URL",
  "Enter a valid phone number",
  "Start the campaign first",
  "This workspace is at its number limit",
  "Studio includes three",
  "AI is not available",
  "Keep messages under",
];

/** Show an error's own text only when it reads like a sentence for people — never a stack, path, or database detail. */
function safeToShow(message: string) {
  if (!message || message.length > 160) return false;
  if (KNOWN.some((k) => message.startsWith(k))) return true;
  return !/postgres|pg_|ECONNREFUSED|ENOTFOUND|at Object\.|node:|\/Users\/|https?:\/\//i.test(message) && /^[A-Z][^{}<>]*[.!?]?$/.test(message);
}

export default function ErrorPage({ error }: { error: Error & { digest?: string }; reset: () => void }) {
  const message = error?.message ?? "";
  let reference = error?.digest ?? "";
  if (!reference && typeof window !== "undefined") {
    try {
      reference = window.sessionStorage.getItem("aether.lastErrorId") ?? "";
    } catch {}
  }
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-bg px-6 text-center text-fg">
      <span className="text-danger" aria-hidden="true">
        <TriangleAlert className="size-10" strokeWidth={1.5} />
      </span>
      <h1 className="text-2xl font-medium tracking-tight">Something went wrong</h1>
      <p className="max-w-md text-sm break-words text-muted">
        {safeToShow(message) ? message : "We hit an unexpected problem. Nothing you entered was lost — try again."}
      </p>
      {reference ? (
        <p className="font-mono text-xs text-subtle">
          Reference <span className="text-muted">{reference}</span>
        </p>
      ) : null}
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-lg bg-raised px-4 py-2 text-sm text-fg shadow-[var(--shadow-border)] hover:opacity-90"
        >
          Try again
        </button>
        <Link href="/app" className="rounded-lg px-4 py-2 text-sm text-muted hover:text-fg">
          Back to the studio
        </Link>
      </div>
    </main>
  );
}
