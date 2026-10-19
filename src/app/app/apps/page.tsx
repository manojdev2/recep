"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppMark } from "@/components/brand-marks";
import { ConnectorDialog, type ConnectInput } from "@/components/app/connector-dialog";
import { Page, PageBody, PageHeader } from "@/components/app/page";
import { PLATFORM_TOOLS, PlatformTools } from "@/components/app/platform-tools";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { CONNECTOR_KINDS, CONNECTORS, isConnectorSupported, type Connector } from "@/lib/catalog";

const OAUTH_START: Record<string, string> = {
  gmail: "/api/connect/google/start?app=gmail",
  gcal: "/api/connect/google/start?app=gcal",
  gsheets: "/api/connect/google/start?app=gsheets",
  outlook: "/api/connect/microsoft/start",
  salesforce: "/api/connect/salesforce/start",
};
const NAMES = Object.fromEntries(CONNECTORS.map((c) => [c.key, c.name]));

function inKind(c: Connector, kind: string) {
  return c.kind === kind || (kind === "transcriber" && (c.key === "deepgram" || c.key === "elevenlabs" || c.key === "azure-speech"));
}

export default function AppsPage() {
  const qc = useQueryClient();
  const apps = useQuery({ queryKey: ["apps"], queryFn: () => api.connectors.list() });
  const oauth = useQuery({ queryKey: ["connector-oauth"], queryFn: () => api.connectors.oauthStatus() });
  const overview = useQuery({ queryKey: ["tools-overview"], queryFn: () => api.tools.overview() });
  const [search, setSearch] = useState("");
  const [connecting, setConnecting] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [showPlanned, setShowPlanned] = useState(false);
  const usesOauth = (key: string) => !!(OAUTH_START[key] && (oauth.data as Record<string, boolean> | undefined)?.[key]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get("connected");
    if (!result) return;
    const name = NAMES[params.get("app") ?? ""] ?? "Google";
    if (result === "error") {
      const reason = params.get("reason") ?? "unknown";
      toast.error(reason === "not-configured" ? `${name} sign-in is not configured on this deployment yet.` : `Could not connect ${name} (${reason}).`);
    } else if (result === "cancelled") toast(`${name} connection cancelled.`);
    else {
      toast.success("Connected. Tokens refresh automatically from now on.");
      qc.invalidateQueries({ queryKey: ["apps"] });
    }
    window.history.replaceState({}, "", window.location.pathname);
  }, [qc]);

  const start = (key: string) => {
    if (usesOauth(key)) {
      window.location.assign(OAUTH_START[key]);
      return;
    }
    setConnecting(key);
  };

  const byKey = useMemo(() => new Map((apps.data ?? []).map((c) => [c.appKey, c])), [apps.data]);
  const connect = useMutation({
    mutationFn: (input: ConnectInput) => api.connectors.connect(input),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["apps"] });
      await qc.invalidateQueries({ queryKey: ["agent-connectors"] });
      toast.success("Connected — live API verified");
      setConnecting(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const disconnect = useMutation({
    mutationFn: (id: string) => api.connectors.disconnect(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["apps"] });
      await qc.invalidateQueries({ queryKey: ["agent-connectors"] });
      toast.success("Disconnected");
      setDisconnecting(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const q = search.trim().toLowerCase();
  const matchesQuery = (c: Connector) => !q || c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q) || c.kind.includes(q);
  const groups = CONNECTOR_KINDS.map((k) => ({
    ...k,
    apps: CONNECTORS.filter((c) => inKind(c, k.id))
      .filter(matchesQuery)
      .filter((c) => showPlanned || isConnectorSupported(c.key)),
  })).filter((g) => g.apps.length > 0);
  const planned = CONNECTORS.filter((c) => !isConnectorSupported(c.key)).length;
  const toolsMatch = !q || PLATFORM_TOOLS.some((t) => t.title.toLowerCase().includes(q) || t.hint.toLowerCase().includes(q));
  const o = overview.data;

  return (
    <Page>
      <PageHeader title="Connected apps" description="Bring your calendar, customer tools, and website together." />
      <PageBody className="px-4 py-6 sm:px-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-subtle">
            {showPlanned ? `Showing all integrations. ${planned} are planned and not yet wired.` : "Showing integrations that are live today."}
          </p>
          <button type="button" onClick={() => setShowPlanned((v) => !v)} className="text-xs text-muted underline underline-offset-4 hover:text-fg">
            {showPlanned ? "Hide planned" : `Show ${planned} planned`}
          </button>
        </div>
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tools and integrations…" className="mb-8 h-10 w-full max-w-md" />
        <div className="grid gap-10">
          {toolsMatch ? (
            <section>
              <h2 className="text-sm font-medium tracking-tight">Tools</h2>
              <p className="mt-1 text-sm text-muted">Built in. No third-party key unless you connect one.</p>
              <div className="mt-3">
                <PlatformTools
                  query={search}
                  stats={
                    o
                      ? {
                          forms: `${o.forms} form${o.forms === 1 ? "" : "s"}`,
                          appointments: `${o.booked} booked`,
                          webhooks: `${o.webhooks} endpoint${o.webhooks === 1 ? "" : "s"}`,
                          widget: `${o.agents} agent${o.agents === 1 ? "" : "s"}`,
                          crm: `${o.leads} lead${o.leads === 1 ? "" : "s"}`,
                          incoming: `${o.phones} number${o.phones === 1 ? "" : "s"}`,
                          messaging: o.messaging ? "Connected" : "Not connected",
                          sheets: o.sheets ? "Connected" : "Not connected",
                        }
                      : undefined
                  }
                />
              </div>
            </section>
          ) : null}
          {apps.isPending
            ? Array.from({ length: 2 }).map((_, i) => (
                <section key={i}>
                  <div className="h-4 w-32 animate-pulse rounded bg-raised" />
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                    {Array.from({ length: 5 }).map((__, j) => (
                      <div className="h-36 animate-pulse rounded-2xl bg-raised" key={j} />
                    ))}
                  </div>
                </section>
              ))
            : groups.map((g) => (
                <section key={g.id}>
                  <h2 className="text-sm font-medium tracking-tight">{g.label}</h2>
                  <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                    {g.apps.map((c) => {
                      const conn = byKey.get(c.key);
                      return (
                        <li key={`${g.id}-${c.key}`}>
                          <article className="flex h-full flex-col rounded-2xl bg-bg p-4 shadow-[var(--shadow-border)]">
                            <div className="flex items-start justify-between gap-2">
                              <AppMark appKey={c.key} />
                              {conn ? (
                                <span className="rounded-full bg-live/15 px-2 py-0.5 text-[11px] text-live">Live</span>
                              ) : c.deprecated ? (
                                <span className="rounded-full bg-warn/15 px-2 py-0.5 text-[11px] text-warn">Deprecated</span>
                              ) : (
                                <span className="text-[11px] tracking-[0.14em] text-subtle uppercase">{g.id}</span>
                              )}
                            </div>
                            <p className="mt-3 text-sm font-medium tracking-tight">{c.name}</p>
                            <p className="mt-1 line-clamp-2 min-h-10 flex-1 text-xs leading-relaxed text-muted">{c.description}</p>
                            {conn ? <p className="mt-2 truncate text-[11px] text-subtle">{conn.accountLabel}</p> : null}
                            <div className="mt-3 flex flex-wrap gap-2">
                              {conn ? (
                                <>
                                  <Button size="sm" variant="secondary" onClick={() => setDisconnecting(conn.id)} disabled={disconnect.isPending}>
                                    Disconnect
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={() => start(c.key)}>
                                    {usesOauth(c.key) ? "Reconnect" : "Update"}
                                  </Button>
                                </>
                              ) : isConnectorSupported(c.key) ? (
                                <>
                                  <Button size="sm" onClick={() => start(c.key)}>
                                    Connect
                                  </Button>
                                  {c.kind === "phone" ? (
                                    <Button size="sm" variant="ghost" asChild>
                                      <Link href="/app/phone">Numbers</Link>
                                    </Button>
                                  ) : null}
                                </>
                              ) : (
                                <span className="text-[11px] text-subtle">Planned — connecting this does not change the agent yet</span>
                              )}
                            </div>
                          </article>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
        </div>
      </PageBody>
      <ConnectorDialog
        appKey={connecting}
        pending={connect.isPending}
        error={connect.error ? connect.error.message : null}
        onOpenChange={(open) => {
          if (!open) {
            setConnecting(null);
            connect.reset();
          }
        }}
        onSubmit={(input) => connect.mutate(input)}
      />
      <ConfirmDialog
        open={!!disconnecting}
        title="Disconnect this integration?"
        description="Agents using it will lose live access until you connect again."
        confirmLabel="Disconnect"
        danger
        pending={disconnect.isPending}
        onOpenChange={(open) => !open && setDisconnecting(null)}
        onConfirm={() => disconnecting && disconnect.mutate(disconnecting)}
      />
    </Page>
  );
}
