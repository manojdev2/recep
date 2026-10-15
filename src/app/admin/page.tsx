"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Building2, Hash, PhoneCall, Radio, TriangleAlert } from "lucide-react";
import { OverviewSkeleton } from "@/components/admin/skeletons";
import { api } from "@/lib/api";

function ago(at: string) {
  const mins = Math.round((Date.now() - new Date(at).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  return hrs < 24 ? `${hrs}h ago` : `${Math.round(hrs / 24)}d ago`;
}

export default function AdminOverviewPage() {
  const overview = useQuery({ queryKey: ["admin", "overview"], queryFn: () => api.admin.overview() });
  const audit = useQuery({ queryKey: ["admin", "audit", 8], queryFn: () => api.admin.audit({ limit: 8 }) });
  if (overview.isPending) return <OverviewSkeleton />;
  const o = overview.data;
  const tiles = [
    { label: "Accounts", value: o?.tenants, icon: Building2 },
    { label: "Active (30d)", value: o?.activeTenants, icon: Radio },
    { label: "Live agents", value: o?.liveAgents, icon: Radio },
    { label: "Phone numbers", value: o?.numbers, icon: Hash },
    { label: "Calls (30d)", value: o?.calls30d, icon: PhoneCall },
  ];
  return (
    <>
      <h1 className="text-xl font-medium tracking-tight">Overview</h1>
      <p className="mt-1 text-sm text-muted">Everything running on this deployment.</p>
      {o?.missing?.length ? (
        <div className="mt-5 rounded-2xl bg-raised p-4 shadow-[var(--shadow-border)]">
          <div className="flex items-start gap-3">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-500" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">
                {o.missing.length} setting{o.missing.length === 1 ? " is" : "s are"} not configured
              </p>
              <ul className="mt-2 space-y-1.5">
                {o.missing.map((m) => (
                  <li className="text-xs text-muted" key={m.key}>
                    <span className="font-medium text-fg">{m.label}</span> — {m.help}
                  </li>
                ))}
              </ul>
              <Link href="/admin/settings" className="mt-3 inline-block text-xs text-accent hover:underline">
                Configure now
              </Link>
            </div>
          </div>
        </div>
      ) : null}
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {tiles.map((t) => (
          <div className="rounded-2xl bg-raised p-4 shadow-[var(--shadow-border)]" key={t.label}>
            <div className="flex items-center gap-2 text-xs text-subtle">
              <t.icon className="size-3.5" />
              {t.label}
            </div>
            <p className="mt-2 text-2xl font-medium tabular-nums">{t.value ?? 0}</p>
          </div>
        ))}
      </div>
      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium">Recent admin activity</h2>
          <Link href="/admin/audit" className="text-xs text-subtle transition-colors hover:text-fg">
            Full log
          </Link>
        </div>
        <ul className="overflow-hidden rounded-2xl bg-raised shadow-[var(--shadow-border)]">
          {audit.data?.length ? (
            audit.data.map((a) => (
              <li className="flex flex-wrap items-baseline gap-x-2 gap-y-1 border-b border-border px-4 py-3 last:border-b-0" key={a.id}>
                <span className="font-mono text-xs text-accent">{a.action}</span>
                <span className="text-sm">{a.target}</span>
                {a.detail ? <span className="text-xs text-muted">— {a.detail}</span> : null}
                <span className="ml-auto text-xs text-subtle">
                  {a.actor} · {ago(a.at)}
                </span>
              </li>
            ))
          ) : (
            <li className="px-4 py-3 text-sm text-muted">Nothing yet.</li>
          )}
        </ul>
      </section>
    </>
  );
}
