"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { FinanceSkeleton } from "@/components/admin/skeletons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

const MICRO = 1e6;

function money(micros: number, currency = "USD") {
  const n = micros / MICRO;
  const tiny = n !== 0 && Math.abs(n) < 1;
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: tiny ? 4 : 2 }).format(n);
}

const RANGES = [
  { months: 1, label: "This month" },
  { months: 3, label: "3 months" },
  { months: 12, label: "12 months" },
];

function MoneyInput({ value, onChange, className }: { value: number; onChange: (micros: number) => void; className?: string }) {
  return (
    <Input
      type="number"
      step="any"
      min={0}
      value={value === 0 ? "" : value / MICRO}
      onChange={(e) => onChange(Math.round(Number(e.target.value || 0) * MICRO))}
      className={cn("h-8", className)}
      placeholder="0.00"
    />
  );
}

function Tile({ label, value, tone, sub }: { label: string; value: string; tone?: "good" | "bad"; sub?: string }) {
  return (
    <div className="rounded-2xl bg-raised p-4 shadow-[var(--shadow-border)]">
      <p className="text-xs text-subtle">{label}</p>
      <p className={cn("mt-1.5 text-2xl font-medium tabular-nums", tone === "good" && "text-emerald-600 dark:text-emerald-400", tone === "bad" && "text-red-600 dark:text-red-400")}>
        {value}
      </p>
      {sub ? <p className="mt-0.5 text-xs text-muted">{sub}</p> : null}
    </div>
  );
}

export default function FinancePage() {
  const qc = useQueryClient();
  const [months, setMonths] = useState(1);
  const fin = useQuery({ queryKey: ["admin", "finance", months], queryFn: () => api.admin.finance({ months }) });
  const [fixed, setFixed] = useState({ label: "", monthlyMicros: 0, category: "infrastructure" });
  const [payment, setPayment] = useState({ userId: "", amountMicros: 0, period: "", note: "" });
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin"] });

  const addFixed = useMutation({
    mutationFn: () =>
      api.admin.addFixedCost({
        label: fixed.label,
        category: fixed.category,
        monthlyMicros: fixed.monthlyMicros,
        startsOn: new Date().toISOString().slice(0, 10),
        endsOn: null,
        note: "",
      }),
    onSuccess: async () => {
      await refresh();
      setFixed({ label: "", monthlyMicros: 0, category: "infrastructure" });
      toast.success("Cost added");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const removeFixed = useMutation({ mutationFn: (id: string) => api.admin.removeFixedCost({ id }), onSuccess: refresh, onError: (e: Error) => toast.error(e.message) });
  const addPayment = useMutation({
    mutationFn: () =>
      api.admin.addRevenue({
        userId: payment.userId,
        plan: "",
        amountMicros: payment.amountMicros,
        period: payment.period || new Date().toISOString().slice(0, 10),
        note: payment.note,
      }),
    onSuccess: async () => {
      await refresh();
      setPayment({ userId: "", amountMicros: 0, period: "", note: "" });
      toast.success("Payment recorded");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const removePayment = useMutation({ mutationFn: (id: string) => api.admin.removeRevenue({ id }), onSuccess: refresh, onError: (e: Error) => toast.error(e.message) });
  const saveRate = useMutation({
    mutationFn: (r: { provider: string; operation: string; unit: string; costMicros: number; note: string }) => api.admin.saveRate(r),
    onSuccess: async () => {
      await refresh();
      toast.success("Rate saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const removeRate = useMutation({
    mutationFn: (r: { provider: string; operation: string }) => api.admin.removeRate(r),
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });

  if (fin.isPending) return <FinanceSkeleton />;
  const pl = fin.data?.pl;

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-xl font-medium tracking-tight">Finance</h1>
          <p className="mt-1 text-sm text-muted">What came in, what it cost, and what is left.</p>
        </div>
        <div className="ml-auto flex gap-1">
          {RANGES.map((r) => (
            <button
              type="button"
              onClick={() => setMonths(r.months)}
              className={cn("rounded-lg px-2.5 py-1.5 text-xs transition-colors", months === r.months ? "bg-raised font-medium" : "text-muted hover:bg-raised")}
              key={r.months}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Tile label="Revenue received" value={pl ? money(pl.revenueMicros) : "—"} />
        <Tile label="Provider costs" value={pl ? money(pl.apiCostMicros) : "—"} sub="Metered per call" />
        <Tile label="Fixed costs" value={pl ? money(pl.fixedCostMicros) : "—"} sub={pl ? `${pl.months} month${pl.months === 1 ? "" : "s"}` : undefined} />
        <Tile
          label="Net profit"
          value={pl ? money(pl.netMicros) : "—"}
          tone={pl ? (pl.netMicros >= 0 ? "good" : "bad") : undefined}
          sub={pl?.marginPct !== null && pl ? `${pl.marginPct}% margin` : "no revenue yet"}
        />
        <Tile label="MRR on plans" value={pl ? money(pl.mrrMicros) : "—"} sub="Owed, not received" />
      </div>
      {pl && pl.byMonth.length > 1 ? (
        <section className="mt-8">
          <h2 className="mb-2 text-sm font-medium">Month by month</h2>
          <div className="overflow-x-auto rounded-2xl bg-raised shadow-[var(--shadow-border)]">
            <table className="w-full min-w-[32rem] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-subtle">
                  <th className="px-4 py-2.5 font-medium">Month</th>
                  <th className="px-4 py-2.5 text-right font-medium">Revenue</th>
                  <th className="px-4 py-2.5 text-right font-medium">Provider cost</th>
                  <th className="px-4 py-2.5 text-right font-medium">Difference</th>
                </tr>
              </thead>
              <tbody>
                {pl.byMonth.map((m) => (
                  <tr className="border-b border-border last:border-b-0" key={m.month}>
                    <td className="px-4 py-2.5 font-mono text-xs">{m.month}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{money(m.revenueMicros)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{money(m.costMicros)}</td>
                    <td className={cn("px-4 py-2.5 text-right tabular-nums", m.netMicros < 0 && "text-red-600 dark:text-red-400")}>{money(m.netMicros)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-1.5 text-xs text-subtle">Provider cost only — fixed costs are not split across months here.</p>
        </section>
      ) : null}
      <section className="mt-8">
        <h2 className="mb-2 text-sm font-medium">Where the provider money went</h2>
        <div className="overflow-x-auto rounded-2xl bg-raised shadow-[var(--shadow-border)]">
          <table className="w-full min-w-[32rem] text-sm">
            <tbody>
              {pl?.byProvider.length ? (
                pl.byProvider.map((b) => (
                  <tr className="border-b border-border last:border-b-0" key={`${b.provider}:${b.operation}`}>
                    <td className="px-4 py-2.5">
                      {b.provider} <span className="text-muted">{b.operation}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs text-subtle">{b.events.toLocaleString()} times</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{money(b.costMicros)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-4 py-6 text-center text-sm text-muted">Nothing recorded yet. Costs are logged as calls happen.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      <section className="mt-8">
        <h2 className="text-sm font-medium">Which customers pay for themselves</h2>
        <p className="mb-2 text-xs text-muted">Worst first. Fixed costs are not shared out — any split would be an accounting choice, not a measurement.</p>
        <div className="overflow-x-auto rounded-2xl bg-raised shadow-[var(--shadow-border)]">
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-subtle">
                <th className="px-4 py-2.5 font-medium">Account</th>
                <th className="px-4 py-2.5 font-medium">Plan</th>
                <th className="px-4 py-2.5 text-right font-medium">Minutes</th>
                <th className="px-4 py-2.5 text-right font-medium">Paid</th>
                <th className="px-4 py-2.5 text-right font-medium">Cost us</th>
                <th className="px-4 py-2.5 text-right font-medium">Margin</th>
              </tr>
            </thead>
            <tbody>
              {fin.data?.tenants.map((t) => (
                <tr className="border-b border-border last:border-b-0" key={t.userId}>
                  <td className="px-4 py-2.5">{t.email}</td>
                  <td className="px-4 py-2.5 text-xs text-muted">{t.plan}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{t.minutes}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{money(t.revenueMicros)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{money(t.costMicros)}</td>
                  <td className={cn("px-4 py-2.5 text-right tabular-nums", t.netMicros < 0 && "text-red-600 dark:text-red-400")}>{money(t.netMicros)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="mt-8">
        <h2 className="mb-2 text-sm font-medium">What providers charge us</h2>
        <div className="overflow-hidden rounded-2xl bg-raised shadow-[var(--shadow-border)]">
          {fin.data?.rates.map((r) => (
            <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-2.5 last:border-b-0" key={`${r.provider}:${r.operation}`}>
              <span className="min-w-48 text-sm">
                {r.provider} <span className="text-muted">{r.operation}</span>
              </span>
              <MoneyInput value={r.costMicros} className="w-32" onChange={(v) => saveRate.mutate({ ...r, costMicros: v })} />
              <span className="text-xs text-muted">per {r.unit}</span>
              <span className="min-w-0 flex-1 truncate text-xs text-subtle" title={r.note}>
                {r.note}
              </span>
              <Button size="sm" variant="ghost" onClick={() => removeRate.mutate({ provider: r.provider, operation: r.operation })}>
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-subtle">
          These start as published list prices and are estimates. Check them against your own invoices — every profit figure above depends on them.
        </p>
      </section>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-2 text-sm font-medium">Fixed monthly costs</h2>
          <div className="overflow-hidden rounded-2xl bg-raised shadow-[var(--shadow-border)]">
            {fin.data?.fixed.map((f) => (
              <div className="flex items-center gap-3 border-b border-border px-4 py-2.5 last:border-b-0" key={f.id}>
                <span className="min-w-0 flex-1 truncate text-sm">{f.label}</span>
                <span className="text-xs text-muted">{f.category}</span>
                <span className="tabular-nums">{money(f.monthlyMicros)}</span>
                <Button size="sm" variant="ghost" onClick={() => removeFixed.mutate(f.id)}>
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
            {fin.data?.fixed.length ? null : (
              <p className="px-4 py-3 text-sm text-muted">Nothing yet. Hosting, the database, salaries — without these the profit figure flatters itself.</p>
            )}
            <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-3">
              <Input value={fixed.label} placeholder="Vercel" onChange={(e) => setFixed({ ...fixed, label: e.target.value })} className="h-8 w-36" />
              <select
                value={fixed.category}
                onChange={(e) => setFixed({ ...fixed, category: e.target.value })}
                className="h-8 rounded-lg bg-surface px-2 text-xs shadow-[var(--shadow-border)]"
              >
                {["infrastructure", "staff", "tooling", "other"].map((c) => (
                  <option value={c} key={c}>
                    {c}
                  </option>
                ))}
              </select>
              <MoneyInput value={fixed.monthlyMicros} className="w-28" onChange={(v) => setFixed({ ...fixed, monthlyMicros: v })} />
              <Button size="sm" onClick={() => addFixed.mutate()} disabled={!fixed.label.trim() || addFixed.isPending}>
                <Plus className="size-3" />
                Add
              </Button>
            </div>
          </div>
        </section>
        <section>
          <h2 className="mb-2 text-sm font-medium">Payments received</h2>
          <div className="overflow-hidden rounded-2xl bg-raised shadow-[var(--shadow-border)]">
            {fin.data?.revenue.slice(0, 8).map((r) => (
              <div className="flex items-center gap-3 border-b border-border px-4 py-2.5 last:border-b-0" key={r.id}>
                <span className="min-w-0 flex-1 truncate text-sm">{r.email}</span>
                <span className="text-xs text-muted">{r.period.slice(0, 7)}</span>
                <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] text-subtle">{r.source}</span>
                <span className="tabular-nums">{money(r.amountMicros, r.currency)}</span>
                <Button size="sm" variant="ghost" onClick={() => removePayment.mutate(r.id)}>
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
            {fin.data?.revenue.length ? null : (
              <p className="px-4 py-3 text-sm text-muted">Nothing recorded. Stripe payments land here automatically; record anything else by hand.</p>
            )}
            <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-3">
              <select
                value={payment.userId}
                onChange={(e) => setPayment({ ...payment, userId: e.target.value })}
                className="h-8 max-w-40 rounded-lg bg-surface px-2 text-xs shadow-[var(--shadow-border)]"
              >
                <option value="">Which account…</option>
                {fin.data?.tenants.map((t) => (
                  <option value={t.userId} key={t.userId}>
                    {t.email}
                  </option>
                ))}
              </select>
              <MoneyInput value={payment.amountMicros} className="w-28" onChange={(v) => setPayment({ ...payment, amountMicros: v })} />
              <Input type="date" value={payment.period} onChange={(e) => setPayment({ ...payment, period: e.target.value })} className="h-8 w-36" />
              <Button size="sm" onClick={() => addPayment.mutate()} disabled={!payment.userId || !payment.amountMicros || addPayment.isPending}>
                <Plus className="size-3" />
                Record
              </Button>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
