"use client";

import { useState, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ThemePicker } from "@/components/theme";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { signOut, useCurrentUser } from "@/lib/auth-client";

function Section({ label, title, children }: { label: string; title?: string; children: ReactNode }) {
  return (
    <section className="rounded-xl bg-raised/60 p-5">
      <p className="text-xs tracking-wide text-subtle uppercase">{label}</p>
      {title ? <p className="mt-1 text-sm text-muted">{title}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Usage() {
  const account = useQuery({ queryKey: ["account"], queryFn: () => api.account.get() });
  if (account.isPending) {
    return (
      <Section label="Usage">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-2 h-1.5 w-full rounded-full" />
        <Skeleton className="mt-4 h-4 w-56" />
      </Section>
    );
  }
  if (!account.data) return null;
  const { usage, queue, backgroundWork } = account.data;
  const pct = Math.round(usage.fraction * 100);
  const unlimited = usage.minutesIncluded === null || usage.plan.minutes > 1e6;
  return (
    <Section label="Usage" title={`${usage.plan.name} · ${usage.plan.priceLabel}`}>
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="font-mono text-2xl tabular-nums">{usage.minutesUsed}</span>
        <span className="text-sm text-muted">of {unlimited ? "unlimited" : usage.minutesIncluded} minutes this month</span>
      </div>
      {unlimited ? null : (
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded bg-bg">
          <div className={usage.overLimit ? "h-full bg-danger" : "h-full bg-accent"} style={{ width: `${Math.max(2, pct)}%` }} />
        </div>
      )}
      {usage.overLimit ? (
        <p className="mt-3 text-sm text-danger">Included minutes are used up. Agents will stop answering until next month or an upgrade.</p>
      ) : null}
      <dl className="mt-5 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs text-subtle uppercase">Live agents</dt>
          <dd className="tabular-nums">
            {usage.agents}
            {usage.plan.agents > 1e6 ? "" : ` / ${usage.plan.agents}`}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-subtle uppercase">Numbers</dt>
          <dd className="tabular-nums">{usage.numbers}</dd>
        </div>
        <div>
          <dt className="text-xs text-subtle uppercase">Queued jobs</dt>
          <dd className="tabular-nums">{queue.queued ?? 0}</dd>
        </div>
        <div>
          <dt className="text-xs text-subtle uppercase">Background work</dt>
          <dd className={backgroundWork === "running" ? "" : "text-danger"}>{backgroundWork}</dd>
        </div>
      </dl>
      {backgroundWork === "running" ? null : (
        <p className="mt-4 text-xs leading-relaxed text-muted">
          No scheduler is configured, so campaigns and webhook retries will not advance on their own. Queued work is stored safely and runs as soon as one
          is connected.
        </p>
      )}
    </Section>
  );
}

function Password() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const change = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Could not change password");
      return body;
    },
    onSuccess: () => {
      setCurrent("");
      setNext("");
      toast.success("Password changed. Other sessions were signed out.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Section label="Password" title="Changing it signs out every other session.">
      <div className="grid gap-2 sm:max-w-sm">
        <Input type="password" placeholder="Current password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
        <Input
          type="password"
          placeholder="New password (at least 8 characters)"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          autoComplete="new-password"
        />
        <Button className="mt-1 justify-self-start" variant="secondary" disabled={change.isPending || next.length < 8 || !current} onClick={() => change.mutate()}>
          {change.isPending ? "Changing…" : "Change password"}
        </Button>
      </div>
    </Section>
  );
}

function Export() {
  const run = useMutation({
    mutationFn: () => api.account.export(),
    onSuccess: (data) => {
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `azentoo-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export downloaded.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Section label="Your data" title="Everything this workspace holds, as JSON. Connector credentials are excluded on purpose.">
      <Button variant="secondary" disabled={run.isPending} onClick={() => run.mutate()}>
        {run.isPending ? "Preparing…" : "Download export"}
      </Button>
    </Section>
  );
}

function DeleteWorkspace({ email }: { email: string }) {
  const [typed, setTyped] = useState("");
  const [open, setOpen] = useState(false);
  const run = useMutation({
    mutationFn: () => api.account.deleteWorkspace({ confirmEmail: typed }),
    onSuccess: async () => {
      toast.success("Workspace deleted.");
      await signOut("/");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <section className="rounded-xl p-5 shadow-[0_0_0_1px_var(--color-danger)]">
      <p className="text-xs tracking-wide text-danger uppercase">Delete workspace</p>
      <p className="mt-1 text-sm text-muted">
        Removes every agent, conversation, contact, recording and number. This cannot be undone, and support cannot recover it.
      </p>
      {open ? (
        <div className="mt-4 grid gap-2 sm:max-w-sm">
          <p className="text-sm text-muted">
            Type <span className="font-mono text-fg">{email}</span> to confirm.
          </p>
          <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={email} autoComplete="off" />
          <div className="flex gap-2">
            <Button variant="secondary" disabled={run.isPending || typed.trim().toLowerCase() !== email.toLowerCase()} onClick={() => run.mutate()}>
              {run.isPending ? "Deleting…" : "Delete permanently"}
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button className="mt-4" variant="secondary" onClick={() => setOpen(true)}>
          Delete workspace…
        </Button>
      )}
    </section>
  );
}

export default function AccountSettingsPage() {
  const user = useCurrentUser();
  const email = user?.primaryEmail ?? "";
  return (
    <div className="grid max-w-2xl gap-4">
      <Usage />
      <Section label="Signed in as">
        <p className="text-lg">{user?.displayName ?? "—"}</p>
        <p className="text-sm text-muted">{email}</p>
        <Button className="mt-5" variant="secondary" onClick={() => void signOut("/")}>
          Sign out
        </Button>
      </Section>
      {email ? <Password /> : null}
      <Section label="Appearance" title="Light, dark, or follow the device.">
        <ThemePicker />
      </Section>
      <Export />
      {email ? <DeleteWorkspace email={email} /> : null}
    </div>
  );
}
