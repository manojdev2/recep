"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, Trash2, UserPlus } from "lucide-react";
import { AuditSkeleton } from "@/components/admin/skeletons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";

const when = (at: string) => new Date(at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

export default function AuditPage() {
  const qc = useQueryClient();
  const admins = useQuery({ queryKey: ["admin", "admins"], queryFn: () => api.admin.admins() });
  const [action, setAction] = useState("");
  const [actor, setActor] = useState("");
  const [days, setDays] = useState(90);
  const actions = useQuery({ queryKey: ["admin", "audit-actions"], queryFn: () => api.admin.auditActions() });
  const log = useQuery({ queryKey: ["admin", "audit", action, actor, days], queryFn: () => api.admin.audit({ limit: 500, action, actor, days }) });
  const [email, setEmail] = useState("");
  const [level, setLevel] = useState<"support" | "super">("support");
  const grant = useMutation({
    mutationFn: () => api.admin.grant({ email, level }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin"] });
      setEmail("");
      toast.success("Admin granted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const revoke = useMutation({
    mutationFn: (userId: string) => api.admin.revoke({ userId }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin"] });
      toast.success("Admin revoked");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (admins.isPending && log.isPending) return <AuditSkeleton />;

  return (
    <>
      <h1 className="text-xl font-medium tracking-tight">Admins and audit</h1>
      <p className="mt-1 text-sm text-muted">Super-admins can change settings and plans. Support can only look.</p>
      <section className="mt-5">
        <h2 className="mb-2 text-sm font-medium">Who has access</h2>
        <ul className="overflow-hidden rounded-2xl bg-raised shadow-[var(--shadow-border)]">
          {admins.data?.map((a) => (
            <li className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3 last:border-b-0" key={a.userId}>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{a.email}</p>
                {a.name ? <p className="truncate text-xs text-muted">{a.name}</p> : null}
              </div>
              <span
                className={
                  a.level === "super"
                    ? "rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-accent"
                    : "rounded-full bg-surface px-2 py-0.5 text-[11px] font-medium text-muted"
                }
              >
                {a.level}
              </span>
              <Button size="sm" variant="ghost" className="ml-auto" disabled={revoke.isPending} onClick={() => revoke.mutate(a.userId)} title="Revoke">
                <Trash2 className="size-3.5" />
              </Button>
            </li>
          ))}
          {!admins.data?.length && !admins.isPending ? <li className="px-4 py-3 text-sm text-muted">No admins.</li> : null}
        </ul>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="their@email.com" className="max-w-xs flex-1" />
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value as "support" | "super")}
            className="h-9 rounded-lg bg-surface px-3 text-sm shadow-[var(--shadow-border)]"
          >
            <option value="support">support</option>
            <option value="super">super</option>
          </select>
          <Button size="sm" onClick={() => grant.mutate()} disabled={!email.trim() || grant.isPending}>
            <UserPlus className="size-3.5" />
            Grant
          </Button>
          <p className="w-full text-xs text-subtle">They must have signed in at least once.</p>
        </div>
      </section>
      <section className="mt-8">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-medium">Everything admins have done</h2>
          <select value={action} onChange={(e) => setAction(e.target.value)} className="h-8 rounded-lg bg-surface px-2 text-xs shadow-[var(--shadow-border)]">
            <option value="">Every action</option>
            {actions.data?.map((a) => (
              <option value={a} key={a}>
                {a}
              </option>
            ))}
          </select>
          <Input value={actor} onChange={(e) => setActor(e.target.value)} placeholder="Filter by who" className="h-8 w-44" />
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="h-8 rounded-lg bg-surface px-2 text-xs shadow-[var(--shadow-border)]">
            {[7, 30, 90, 365, 3650].map((d) => (
              <option value={d} key={d}>
                {d === 3650 ? "All time" : `Last ${d} days`}
              </option>
            ))}
          </select>
          <span className="text-xs text-subtle">{log.data ? `${log.data.length} entries` : ""}</span>
          <Button
            size="sm"
            variant="secondary"
            className="ml-auto"
            onClick={async () => {
              const csv = await api.admin.auditCsv({ action, actor, days });
              const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
              const a = document.createElement("a");
              a.href = url;
              a.download = `audit-${new Date().toISOString().slice(0, 10)}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            <Download className="size-3.5" />
            Export CSV
          </Button>
        </div>
        <div className="overflow-x-auto rounded-2xl bg-raised shadow-[var(--shadow-border)]">
          <table className="w-full min-w-[44rem] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-subtle">
                <th className="px-4 py-2.5 font-medium">When</th>
                <th className="px-4 py-2.5 font-medium">Who</th>
                <th className="px-4 py-2.5 font-medium">Did what</th>
                <th className="px-4 py-2.5 font-medium">To</th>
                <th className="px-4 py-2.5 font-medium">Detail</th>
              </tr>
            </thead>
            <tbody>
              {log.data?.map((a) => (
                <tr className="border-b border-border last:border-b-0" key={a.id}>
                  <td className="px-4 py-2.5 text-xs whitespace-nowrap text-muted">{when(a.at)}</td>
                  <td className="px-4 py-2.5 text-xs">{a.actor}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-accent">{a.action}</td>
                  <td className="px-4 py-2.5 text-xs">{a.target}</td>
                  <td className="px-4 py-2.5 text-xs text-muted">{a.detail}</td>
                </tr>
              ))}
              {!log.data?.length && !log.isPending ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-muted">
                    Nothing recorded yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
