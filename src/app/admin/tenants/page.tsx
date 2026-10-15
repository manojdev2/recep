"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search } from "lucide-react";
import { TenantsSkeleton } from "@/components/admin/skeletons";
import { Input } from "@/components/ui/input";
import { api, type ApiResult } from "@/lib/api";

type Tenant = ApiResult<"admin", "tenants">[number];

function seen(at: string | null) {
  if (!at) return "never";
  const days = Math.floor((Date.now() - new Date(at).getTime()) / 864e5);
  return days === 0 ? "today" : days === 1 ? "yesterday" : days < 30 ? `${days}d ago` : `${Math.floor(days / 30)}mo ago`;
}

function PlanPicker({ tenant }: { tenant: Tenant }) {
  const qc = useQueryClient();
  const plans = useQuery({ queryKey: ["admin", "plans"], queryFn: () => api.admin.plans() });
  const move = useMutation({
    mutationFn: (plan: string) => api.admin.setTenantPlan({ userId: tenant.userId, plan }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin"] });
      toast.success(`${tenant.email} moved`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <select
      value={tenant.plan}
      disabled={move.isPending}
      onChange={(e) => move.mutate(e.target.value)}
      className="h-7 rounded-lg bg-surface px-2 text-xs shadow-[var(--shadow-border)]"
    >
      {(plans.data ?? [{ id: tenant.plan, name: tenant.plan }]).map((p) => (
        <option value={p.id} key={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  );
}

export default function TenantsPage() {
  const tenants = useQuery({ queryKey: ["admin", "tenants"], queryFn: () => api.admin.tenants() });
  const [q, setQ] = useState("");
  const rows = useMemo(() => {
    const all = tenants.data ?? [];
    const s = q.trim().toLowerCase();
    return s ? all.filter((t) => t.email.toLowerCase().includes(s) || t.name.toLowerCase().includes(s)) : all;
  }, [tenants.data, q]);
  if (tenants.isPending) return <TenantsSkeleton />;
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-xl font-medium tracking-tight">Accounts</h1>
          <p className="mt-1 text-sm text-muted">
            {`${tenants.data?.length ?? 0} total`}
            {tenants.data?.length === 500 ? " (showing the newest 500)" : ""}
          </p>
        </div>
        <div className="relative ml-auto w-full max-w-xs">
          <Search className="absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-subtle" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search email or name" className="pl-8" />
        </div>
      </div>
      <div className="mt-5 overflow-x-auto rounded-2xl bg-raised shadow-[var(--shadow-border)]">
        <table className="w-full min-w-[52rem] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-subtle">
              <th className="px-4 py-2.5 font-medium">Account</th>
              <th className="px-4 py-2.5 font-medium">Plan</th>
              <th className="px-4 py-2.5 text-right font-medium">Agents</th>
              <th className="px-4 py-2.5 text-right font-medium">Numbers</th>
              <th className="px-4 py-2.5 text-right font-medium">Calls 30d</th>
              <th className="px-4 py-2.5 text-right font-medium">Minutes</th>
              <th className="px-4 py-2.5 text-right font-medium">Last call</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr className="border-b border-border last:border-b-0" key={t.userId}>
                <td className="px-4 py-2.5">
                  <div className="font-medium">{t.email}</div>
                  {t.name ? <div className="text-xs text-muted">{t.name}</div> : null}
                </td>
                <td className="px-4 py-2.5">
                  <PlanPicker tenant={t} />
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {t.liveAgents}
                  <span className="text-subtle"> / {t.agents}</span>
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">{t.numbers}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{t.calls30d}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{t.minutesUsed}</td>
                <td className="px-4 py-2.5 text-right text-xs text-muted">{seen(t.lastSeen)}</td>
              </tr>
            ))}
            {!rows.length && !tenants.isPending ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-sm text-muted">
                  {q ? `No account matches "${q}".` : "No accounts yet."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
