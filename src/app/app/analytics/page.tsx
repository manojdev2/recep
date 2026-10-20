"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Page, PageBody, PageHeader } from "@/components/app/page";
import { AnalyticsSkeleton } from "@/components/app/skeletons";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

const RANGES = [
  { days: 7, label: "7 days" },
  { days: 14, label: "14 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
];

const tick = { fill: "var(--color-muted)", fontSize: 12 };

function Breakdown({ title, data }: { title: string; data: { name: string; value: number }[] }) {
  return (
    <div className="rounded-xl p-5 shadow-[var(--shadow-border)]">
      <p className="text-sm font-medium">{title}</p>
      <div className="mt-4 h-52">
        {data.length === 0 ? (
          <p className="text-sm text-muted">No data yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ left: 4, right: 8 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" width={72} tick={tick} axisLine={false} tickLine={false} />
              <Bar dataKey="value" fill="var(--color-accent)" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [days, setDays] = useState(14);
  const [agentId, setAgentId] = useState("");
  const agents = useQuery({ queryKey: ["agents"], queryFn: () => api.agents.list() });
  const stats = useQuery({ queryKey: ["analytics", days, agentId], queryFn: () => api.agents.analytics({ days, agentId: agentId || undefined }) });
  if (stats.isPending) return <AnalyticsSkeleton />;
  const d = stats.data;
  if (!d) return null;

  function exportCsv() {
    if (!d) return;
    const rows = d.series.map((s) => `${s.day},${s.conversations},${s.resolved}`).join("\n");
    const url = URL.createObjectURL(new Blob([`day,conversations,resolved\n${rows}\n`], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `azentoo-analytics-${days}d.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported");
  }

  const tiles = [
    { k: "Conversations", v: d.total.toLocaleString() },
    { k: "Bookings", v: d.bookings.toLocaleString() },
    { k: "Leads", v: d.leads.toLocaleString() },
    { k: "Resolution", v: `${d.resolutionRate}%` },
    { k: "Avg duration", v: `${d.avgDuration}s` },
    { k: "Positive", v: `${d.csat}%` },
  ];

  return (
    <Page>
      <PageHeader title="Your business, at a glance" description="See the conversations, connections, and little wins that add up." />
      <PageBody className="p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-full border border-border bg-surface p-1">
            {RANGES.map((r) => (
              <button
                type="button"
                onClick={() => setDays(r.days)}
                aria-pressed={days === r.days}
                className={"rounded-full px-4 py-2 text-xs transition-colors " + (days === r.days ? "bg-accent/10 font-medium text-accent" : "text-muted hover:text-fg")}
                key={r.days}
              >
                {r.label}
              </button>
            ))}
          </div>
          <select
            aria-label="Filter insights by receptionist"
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            className="h-9 rounded-lg bg-raised px-3 text-xs text-fg outline-none"
          >
            <option value="">All receptionists</option>
            {(agents.data ?? []).map((a) => (
              <option value={a.id} key={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <Button size="sm" variant="ghost" className="ml-auto" onClick={exportCsv}>
            Export CSV
          </Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {tiles.map((t) => (
            <div className="rounded-2xl border border-border bg-surface px-5 py-5" key={t.k}>
              <p className="text-xs font-medium text-muted">{t.k}</p>
              <p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums">{t.v}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 rounded-2xl border border-border bg-surface p-6">
          <p className="text-base font-semibold">Your conversations over time</p>
          <p className="mt-1 text-xs text-muted">Conversations and resolutions across the selected period.</p>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={d.series}>
                <CartesianGrid stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="day" tickFormatter={(v: string) => v.slice(5)} tick={tick} axisLine={false} tickLine={false} />
                <YAxis width={28} tick={tick} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-surface)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 12,
                    color: "var(--color-fg)",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="conversations"
                  stroke="var(--color-accent)"
                  fill="color-mix(in oklab, var(--color-accent) 18%, transparent)"
                  strokeWidth={1.5}
                />
                <Area type="monotone" dataKey="resolved" stroke="var(--color-live)" fill="color-mix(in oklab, var(--color-live) 16%, transparent)" strokeWidth={1.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Breakdown title="Channels" data={d.channels} />
          <Breakdown title="Languages" data={d.languages} />
        </div>
      </PageBody>
    </Page>
  );
}
