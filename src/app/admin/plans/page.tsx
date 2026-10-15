"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { EyeOff, Plus, Trash2 } from "lucide-react";
import { PlansSkeleton } from "@/components/admin/skeletons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, type ApiResult } from "@/lib/api";

type PlanRow = ApiResult<"admin", "plans">[number];

const BLANK: PlanRow = {
  id: "",
  name: "",
  priceLabel: "",
  position: 9,
  minutes: 1000,
  agents: 5,
  numbers: 5,
  features: "",
  public: true,
  stripePriceId: "",
  accounts: 0,
};

function Limit({ label, value, onChange }: { label: string; value: number | null; onChange: (v: number | null) => void }) {
  return (
    <label className="text-xs text-muted">
      <span className="mb-1 block">{label}</span>
      <Input
        type="number"
        min={0}
        value={value === null ? "" : value}
        placeholder="unlimited"
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        className="h-8 w-28"
      />
    </label>
  );
}

function Editor({ plan, onDone }: { plan: PlanRow; onDone: () => void }) {
  const qc = useQueryClient();
  const [p, setP] = useState(plan);
  const isNew = !plan.id;
  const save = useMutation({
    mutationFn: () =>
      api.admin.savePlan({
        id: p.id,
        name: p.name,
        priceLabel: p.priceLabel,
        position: p.position,
        minutes: p.minutes,
        agents: p.agents,
        numbers: p.numbers,
        features: p.features,
        public: p.public,
        stripePriceId: p.stripePriceId,
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin"] });
      toast.success(isNew ? "Plan created" : "Plan saved");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="border-b border-border px-4 py-4 last:border-b-0">
      <div className="flex flex-wrap gap-3">
        <label className="text-xs text-muted">
          <span className="mb-1 block">Id</span>
          <Input value={p.id} disabled={!isNew} placeholder="growth" onChange={(e) => setP({ ...p, id: e.target.value })} className="h-8 w-32 font-mono" />
        </label>
        <label className="text-xs text-muted">
          <span className="mb-1 block">Name</span>
          <Input value={p.name} placeholder="Growth" onChange={(e) => setP({ ...p, name: e.target.value })} className="h-8 w-36" />
        </label>
        <label className="text-xs text-muted">
          <span className="mb-1 block">Price shown</span>
          <Input value={p.priceLabel} placeholder="$29 / month" onChange={(e) => setP({ ...p, priceLabel: e.target.value })} className="h-8 w-40" />
        </label>
        <Limit label="Minutes" value={p.minutes} onChange={(v) => setP({ ...p, minutes: v })} />
        <Limit label="Agents" value={p.agents} onChange={(v) => setP({ ...p, agents: v })} />
        <Limit label="Numbers" value={p.numbers} onChange={(v) => setP({ ...p, numbers: v })} />
        <label className="text-xs text-muted">
          <span className="mb-1 block">Stripe price id</span>
          <Input
            value={p.stripePriceId}
            placeholder="price_1Abc… (blank = no self-serve checkout)"
            onChange={(e) => setP({ ...p, stripePriceId: e.target.value })}
            className="h-8 w-64 font-mono text-xs"
          />
        </label>
        <label className="text-xs text-muted">
          <span className="mb-1 block">Order</span>
          <Input type="number" value={p.position} onChange={(e) => setP({ ...p, position: Number(e.target.value) })} className="h-8 w-20" />
        </label>
      </div>
      <label className="mt-3 block text-xs text-muted">
        <span className="mb-1 block">What it includes — one per line, shown on the pricing page</span>
        <textarea
          value={p.features}
          rows={3}
          onChange={(e) => setP({ ...p, features: e.target.value })}
          className="w-full max-w-lg rounded-lg bg-surface px-3 py-2 text-sm shadow-[var(--shadow-border)]"
          placeholder={"Phone, SMS, WhatsApp\nConnects to your calendar"}
        />
      </label>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-muted">
          <input type="checkbox" checked={p.public} onChange={(e) => setP({ ...p, public: e.target.checked })} />
          Show on the pricing page
        </label>
        {p.public ? null : (
          <span className="flex items-center gap-1 text-xs text-subtle">
            <EyeOff className="size-3" />
            Accounts already on it keep working
          </span>
        )}
        <Button size="sm" className="ml-auto" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? "Saving…" : isNew ? "Create plan" : "Save"}
        </Button>
        <Button size="sm" variant="secondary" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

export default function PlansPage() {
  const qc = useQueryClient();
  const plans = useQuery({ queryKey: ["admin", "plans"], queryFn: () => api.admin.plans() });
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const remove = useMutation({
    mutationFn: (id: string) => api.admin.deletePlan({ id }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin"] });
      toast.success("Plan removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  if (plans.isPending) return <PlansSkeleton />;
  const fmt = (v: number | null) => (v === null ? "unlimited" : v.toLocaleString());
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-xl font-medium tracking-tight">Plans</h1>
          <p className="mt-1 text-sm text-muted">What each tier costs and allows. The pricing page and the limits enforced on every call both read this.</p>
        </div>
        <Button size="sm" className="ml-auto" onClick={() => setAdding(true)}>
          <Plus className="size-3.5" />
          New plan
        </Button>
      </div>
      <div className="mt-5 overflow-hidden rounded-2xl bg-raised shadow-[var(--shadow-border)]">
        {adding ? <Editor plan={BLANK} onDone={() => setAdding(false)} /> : null}
        {plans.data?.map((p) =>
          editing === p.id ? (
            <Editor plan={p} onDone={() => setEditing(null)} key={p.id} />
          ) : (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border px-4 py-3 last:border-b-0" key={p.id}>
              <div className="min-w-40">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{p.name}</span>
                  {p.public ? null : (
                    <span className="flex items-center gap-1 rounded-full bg-surface px-2 py-0.5 text-[11px] text-subtle">
                      <EyeOff className="size-2.5" />
                      hidden
                    </span>
                  )}
                </div>
                <code className="font-mono text-xs text-subtle">{p.id}</code>
              </div>
              <span className="text-sm text-muted">{p.priceLabel || "—"}</span>
              <span className="text-xs text-muted">
                {fmt(p.minutes)} min · {fmt(p.agents)} agents · {fmt(p.numbers)} numbers
              </span>
              <span className="text-xs text-subtle">
                {p.accounts} account{p.accounts === 1 ? "" : "s"}
              </span>
              <div className="ml-auto flex gap-1">
                <Button size="sm" variant="secondary" onClick={() => setEditing(p.id)}>
                  Edit
                </Button>
                <Button size="sm" variant="ghost" disabled={remove.isPending} onClick={() => remove.mutate(p.id)} title={p.accounts ? "Accounts are on this plan" : "Delete"}>
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          ),
        )}
        {!plans.data?.length && !plans.isPending ? <p className="px-4 py-6 text-center text-sm text-muted">No plans configured.</p> : null}
      </div>
    </>
  );
}
