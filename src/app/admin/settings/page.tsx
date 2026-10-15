"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Lock, Pencil, X } from "lucide-react";
import { SettingsSkeleton } from "@/components/admin/skeletons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, type ApiResult } from "@/lib/api";
import { cn } from "@/lib/utils";

type View = ApiResult<"admin", "settings">[number];

const GROUPS = [
  { id: "brand", title: "Branding", blurb: "What this product is called and where support goes." },
  { id: "site", title: "Site and search", blurb: "What search engines and link previews show." },
  { id: "legal", title: "Legal", blurb: "Terms, privacy, and the entity on your invoices." },
  { id: "features", title: "Features", blurb: "Turn parts of the product on and off for everyone." },
  { id: "billing", title: "Billing rates", blurb: "What each kind of usage costs in minutes." },
  { id: "limits", title: "Abuse limits", blurb: "Ceilings on public endpoints. Empty means the default." },
  { id: "ai", title: "AI", blurb: "The models that answer calls and chats." },
  { id: "telephony", title: "Telephony", blurb: "The carrier that connects real phone numbers." },
  { id: "email", title: "Email", blurb: "Transactional mail — confirmations and alerts." },
  { id: "payments", title: "Payments", blurb: "How customers pay for a plan." },
  { id: "platform", title: "Platform", blurb: "Where this deployment lives and how it runs." },
];

const SOURCE = {
  database: { text: "Set here", tone: "bg-accent/15 text-accent" },
  environment: { text: "From environment", tone: "bg-raised text-muted" },
  cleared: { text: "Turned off", tone: "bg-raised text-subtle" },
  unset: { text: "Not set", tone: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
};

function Source({ view }: { view: View }) {
  const s = SOURCE[view.source];
  return <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", s.tone)}>{s.text}</span>;
}

function Row({ view }: { view: View }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const save = useMutation({
    mutationFn: (v: string) => api.admin.saveSetting({ key: view.key, value: v }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin"] });
      setEditing(false);
      setValue("");
      toast.success(`${view.label} saved`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (view.envOnly) {
    return (
      <div className="border-b border-border px-4 py-3 last:border-b-0">
        <div className="flex flex-wrap items-center gap-2">
          <Lock className="size-3.5 shrink-0 text-subtle" />
          <span className="text-sm font-medium">{view.label}</span>
          <Source view={view} />
          <code className="ml-auto font-mono text-xs text-subtle">{view.key}</code>
        </div>
        <p className="mt-1 pl-6 text-xs text-muted">{view.help}</p>
        {view.display ? <p className="mt-1 pl-6 font-mono text-xs text-subtle">{view.display}</p> : null}
      </div>
    );
  }

  return (
    <div className="border-b border-border px-4 py-3 last:border-b-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{view.label}</span>
        <Source view={view} />
        <code className="ml-auto font-mono text-xs text-subtle">{view.key}</code>
      </div>
      <p className="mt-1 text-xs text-muted">{view.help}</p>
      {view.kind === "boolean" ? (
        <div className="mt-2 flex items-center gap-2">
          <input
            id={`sw-${view.key}`}
            type="checkbox"
            checked={view.display === "true"}
            disabled={save.isPending}
            onChange={(e) => save.mutate(e.target.checked ? "true" : "false")}
          />
          <label htmlFor={`sw-${view.key}`} className="text-sm">
            {view.display === "true" ? "On" : "Off"}
          </label>
        </div>
      ) : editing ? (
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {view.options ? (
            <select value={value} onChange={(e) => setValue(e.target.value)} className="h-9 rounded-lg bg-surface px-3 text-sm shadow-[var(--shadow-border)]">
              <option value="">(clear)</option>
              {view.options.map((o) => (
                <option value={o} key={o}>
                  {o}
                </option>
              ))}
            </select>
          ) : (
            <Input
              autoFocus
              type={view.secret ? "password" : view.kind === "number" ? "number" : "text"}
              step={view.kind === "number" ? "any" : undefined}
              value={value}
              placeholder={view.placeholder ?? ""}
              onChange={(e) => setValue(e.target.value)}
              className="max-w-md flex-1"
            />
          )}
          <Button size="sm" onClick={() => save.mutate(value)} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setEditing(false);
              setValue("");
            }}
          >
            Cancel
          </Button>
          <p className="w-full text-xs text-subtle">Saving an empty value turns this off — it will not fall back to the environment.</p>
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <code className="font-mono text-xs text-fg">{view.display || <span className="text-subtle">nothing set</span>}</code>
          <Button
            size="sm"
            variant="secondary"
            className="ml-auto"
            onClick={() => {
              setEditing(true);
              setValue(view.secret ? "" : view.display);
            }}
          >
            <Pencil className="size-3" />
            {view.configured ? "Change" : "Set"}
          </Button>
          {view.configured && view.source === "database" ? (
            <Button size="sm" variant="ghost" onClick={() => save.mutate("")} disabled={save.isPending} title="Turn off">
              <X className="size-3" />
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default function ConfigurationPage() {
  const settings = useQuery({ queryKey: ["admin", "settings"], queryFn: () => api.admin.settings(), retry: false });
  if (settings.isPending) return <SettingsSkeleton />;
  if (settings.isError) {
    return (
      <>
        <h1 className="text-xl font-medium tracking-tight">Configuration</h1>
        <p className="mt-1 text-sm text-muted">{settings.error.message}</p>
      </>
    );
  }
  return (
    <>
      <h1 className="text-xl font-medium tracking-tight">Configuration</h1>
      <p className="mt-1 text-sm text-muted">Changes take effect within a minute. No redeploy.</p>
      {GROUPS.map((g) => {
        const rows = (settings.data ?? []).filter((s) => s.group === g.id);
        return rows.length ? (
          <section className="mt-6" key={g.id}>
            <h2 className="text-sm font-medium">{g.title}</h2>
            <p className="mb-2 text-xs text-muted">{g.blurb}</p>
            <div className="overflow-hidden rounded-2xl bg-raised shadow-[var(--shadow-border)]">
              {rows.map((v) => (
                <Row view={v} key={v.key} />
              ))}
            </div>
          </section>
        ) : null;
      })}
    </>
  );
}
