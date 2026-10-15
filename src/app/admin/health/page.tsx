"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { HealthSkeleton } from "@/components/admin/skeletons";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

const RANGES = [
  { hours: 1, label: "1 hour" },
  { hours: 24, label: "24 hours" },
  { hours: 168, label: "7 days" },
];
const TONE = {
  healthy: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  degraded: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  failing: "bg-red-500/15 text-red-600 dark:text-red-400",
  idle: "bg-raised text-subtle",
};
const LABEL = { healthy: "Working", degraded: "Some failures", failing: "Failing", idle: "Not used" };
const when = (at: string) => new Date(at).toLocaleString(undefined, { dateStyle: "short", timeStyle: "medium" });

export default function HealthPage() {
  const [hours, setHours] = useState(24);
  const health = useQuery({ queryKey: ["admin", "health", hours], queryFn: () => api.admin.health({ hours }), refetchInterval: 30_000 });
  if (health.isPending) return <HealthSkeleton />;
  const providers = health.data?.providers ?? [];
  const bad = providers.filter((p) => p.status === "failing" || p.status === "degraded");
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-xl font-medium tracking-tight">Service health</h1>
          <p className="mt-1 text-sm text-muted">Every outbound call this platform makes, and whether it worked.</p>
        </div>
        <div className="ml-auto flex gap-1">
          {RANGES.map((r) => (
            <button
              type="button"
              onClick={() => setHours(r.hours)}
              className={cn("rounded-lg px-2.5 py-1.5 text-xs transition-colors", hours === r.hours ? "bg-raised font-medium" : "text-muted hover:bg-raised")}
              key={r.hours}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
      {bad.length > 0 ? (
        <div className="mt-5 rounded-2xl bg-red-500/10 p-4">
          <p className="text-sm font-medium">
            {bad.length} service{bad.length === 1 ? "" : "s"} not working properly
          </p>
          <ul className="mt-1.5 space-y-0.5">
            {bad.map((p) => (
              <li className="text-xs text-muted" key={`${p.provider}:${p.operation}`}>
                <span className="font-medium text-fg">
                  {p.provider} {p.operation}
                </span>{" "}
                — {p.failures} of {p.calls} calls failed ({p.errorRate}%)
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="mt-5 overflow-x-auto rounded-2xl bg-raised shadow-[var(--shadow-border)]">
        <table className="w-full min-w-[46rem] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-subtle">
              <th className="px-4 py-2.5 font-medium">Service</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 text-right font-medium">Calls</th>
              <th className="px-4 py-2.5 text-right font-medium">Failed</th>
              <th className="px-4 py-2.5 text-right font-medium">Average</th>
              <th className="px-4 py-2.5 text-right font-medium">Slowest</th>
              <th className="px-4 py-2.5 text-right font-medium">Last failure</th>
            </tr>
          </thead>
          <tbody>
            {providers.map((p) => (
              <tr className="border-b border-border last:border-b-0" key={`${p.provider}:${p.operation}`}>
                <td className="px-4 py-2.5">
                  <div className="font-medium">{p.provider}</div>
                  <div className="text-xs text-muted">{p.operation}</div>
                </td>
                <td className="px-4 py-2.5">
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", TONE[p.status])}>{LABEL[p.status]}</span>
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">{p.calls}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{p.failures ? `${p.failures} (${p.errorRate}%)` : "—"}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{p.avgMs}ms</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-muted">{p.maxMs}ms</td>
                <td className="px-4 py-2.5 text-right text-xs text-muted">{p.lastFailureAt ? when(p.lastFailureAt) : "—"}</td>
              </tr>
            ))}
            {providers.length ? null : (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-sm text-muted">
                  Nothing recorded in this window. Calls are logged as they happen.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <section className="mt-8">
        <h2 className="mb-2 text-sm font-medium">What went wrong</h2>
        <div className="overflow-x-auto rounded-2xl bg-raised shadow-[var(--shadow-border)]">
          <table className="w-full min-w-[46rem] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-subtle">
                <th className="px-4 py-2.5 font-medium">When</th>
                <th className="px-4 py-2.5 font-medium">Service</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Message</th>
              </tr>
            </thead>
            <tbody>
              {health.data?.failures.map((f) => (
                <tr className="border-b border-border last:border-b-0" key={f.id}>
                  <td className="px-4 py-2.5 text-xs whitespace-nowrap text-muted">{when(f.at)}</td>
                  <td className="px-4 py-2.5 text-xs">
                    {f.provider} <span className="text-muted">{f.operation}</span>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs">{f.status || "no response"}</td>
                  <td className="max-w-md truncate px-4 py-2.5 text-xs text-muted" title={f.detail}>
                    {f.detail || "—"}
                  </td>
                </tr>
              ))}
              {health.data?.failures.length ? null : (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-sm text-muted">
                    No failures recorded. That is the good outcome.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
