"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Phone, PhoneIncoming, PhoneOutgoing } from "lucide-react";
import { CallDialog } from "@/components/app/call-dialog";
import { DataTable, EmptyState, Page, PageBody, PageHeader, Segmented } from "@/components/app/page";
import { RowsSkeleton } from "@/components/app/skeletons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api, type ApiResult } from "@/lib/api";
import { cn } from "@/lib/utils";

type CallRow = ApiResult<"calling", "calls">[number];
const COLS = "sm:grid-cols-[7rem_minmax(0,1fr)_9rem_8rem_8rem]";

function tone(status: string) {
  if (status === "answered" || status === "completed") return "live" as const;
  if (status === "failed" || status === "busy" || status === "no_answer") return "warn" as const;
  if (status === "ringing" || status === "queued") return "draft" as const;
  return "mute" as const;
}

function Row({ call }: { call: CallRow }) {
  const Icon = call.direction === "inbound" ? PhoneIncoming : PhoneOutgoing;
  return (
    <li className={cn("grid items-center gap-3 px-4 py-3 sm:px-6", COLS)}>
      <p className={cn("flex items-center gap-2 text-sm", call.direction === "inbound" ? "text-fg" : "text-muted")}>
        <Icon className="size-3.5" />
        {call.direction === "inbound" ? "In" : "Out"}
      </p>
      <div className="min-w-0">
        <p className="truncate font-mono text-sm tabular-nums">{call.direction === "inbound" ? call.fromE164 : call.toE164}</p>
        <p className="truncate text-xs text-subtle">{call.summary || call.disposition}</p>
      </div>
      <p className="truncate text-sm">{call.agentName}</p>
      <Badge tone={tone(call.status)}>{call.status.replace("_", " ")}</Badge>
      <p className="text-xs text-subtle">
        {formatDistanceToNow(new Date(call.startedAt), { addSuffix: true })}
        {call.live ? " · live" : ""}
      </p>
    </li>
  );
}

export default function CallsPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | "inbound" | "outbound">("all");
  const [callMode, setCallMode] = useState<"in" | "out" | null>(null);
  const calls = useQuery({ queryKey: ["calls"], queryFn: () => api.calling.calls({}) });
  const agents = useQuery({ queryKey: ["agents"], queryFn: () => api.agents.list() });
  const phones = useQuery({ queryKey: ["phones"], queryFn: () => api.agents.phones() });
  const contacts = useQuery({ queryKey: ["contacts"], queryFn: () => api.contacts.list() });
  const rows = useMemo(() => (calls.data ?? []).filter((c) => filter === "all" || c.direction === filter), [calls.data, filter]);

  const place = useMutation({
    mutationFn: (input: { agentId: string; to: string; phoneId?: string }) => api.calling.place(input),
    onSuccess: async (out) => {
      await qc.invalidateQueries({ queryKey: ["calls"] });
      toast.success(out.live ? `Live call to ${out.to}` : out.summary);
      setCallMode(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const ringIn = useMutation({
    mutationFn: (input: { agentId: string; phoneId?: string; from: string }) => api.calling.ringIn(input),
    onSuccess: async (out) => {
      await qc.invalidateQueries({ queryKey: ["calls"] });
      await qc.invalidateQueries({ queryKey: ["conversations"] });
      toast.success(`Inbound from ${out.from}`);
      setCallMode(null);
      router.push(`/app/agents/${out.agentId}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Page>
      <PageHeader
        title="Call history"
        description="Every call has a story. Find yours here."
        actions={
          <>
            <Button variant="secondary" onClick={() => setCallMode("in")}>
              Ring in
            </Button>
            <Button variant="secondary" className="hidden sm:inline-flex" asChild>
              <Link href="/app/campaigns">Campaigns</Link>
            </Button>
            <Button onClick={() => setCallMode("out")}>Call someone</Button>
          </>
        }
      />
      <div className="flex items-center gap-3 border-b border-border px-4 py-2 sm:px-6">
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { id: "all", label: "All" },
            { id: "inbound", label: "Inbound" },
            { id: "outbound", label: "Outbound" },
          ]}
        />
      </div>
      <PageBody>
        {calls.isPending ? (
          <>
            <div className={cn("hidden gap-4 border-b border-border px-4 py-2 text-xs tracking-wide text-subtle uppercase sm:grid sm:px-6", COLS)}>
              <span>Dir</span>
              <span>Numbers</span>
              <span>Agent</span>
              <span>Status</span>
              <span>When</span>
            </div>
            <RowsSkeleton rows={6} colsClass={COLS} />
          </>
        ) : rows.length ? (
          <DataTable columns={["Dir", "Numbers", "Agent", "Status", "When"]} colsClass={COLS}>
            {rows.map((c) => (
              <Row call={c} key={c.id} />
            ))}
          </DataTable>
        ) : (
          <EmptyState
            icon={Phone}
            title="No calls yet"
            description="Assign a number, then ring one in or dial out. Live carriers place a real call when connected."
            action={
              <div className="flex justify-center gap-2">
                <Button variant="secondary" onClick={() => setCallMode("in")}>
                  Ring in
                </Button>
                <Button onClick={() => setCallMode("out")}>Call someone</Button>
              </div>
            }
          />
        )}
      </PageBody>
      {callMode ? (
        <CallDialog
          open
          mode={callMode === "in" ? "inbound" : "outbound"}
          agents={agents.data ?? []}
          phones={phones.data ?? []}
          contacts={contacts.data ?? []}
          pending={place.isPending || ringIn.isPending}
          onOpenChange={(o) => !o && setCallMode(null)}
          onPlace={(input) => place.mutate(input)}
          onInbound={(input) => ringIn.mutate(input)}
        />
      ) : null}
    </Page>
  );
}
