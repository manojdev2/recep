"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Calendar } from "lucide-react";
import { DataTable, EmptyState, Page, PageBody } from "@/components/app/page";
import { ToolHeader } from "@/components/app/tool-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";

const COLS = "sm:grid-cols-[minmax(0,1.2fr)_10rem_minmax(0,1fr)_8rem]";
const when = (iso: string) => new Date(iso).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export default function AppointmentsPage() {
  const qc = useQueryClient();
  const slots = useQuery({ queryKey: ["all-slots"], queryFn: () => api.tools.allSlots() });
  const agents = useQuery({ queryKey: ["agents"], queryFn: () => api.agents.list() });
  const [agentId, setAgentId] = useState("");
  const [at, setAt] = useState("");
  const refresh = async () => {
    for (const key of ["all-slots", "slots", "booked-slots"]) await qc.invalidateQueries({ queryKey: [key] });
  };
  const open = useMutation({
    mutationFn: () => api.tools.openSlot({ agentId, startsAt: new Date(at).toISOString() }),
    onSuccess: async () => {
      await refresh();
      setAt("");
      toast.success("Slot opened");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const rows = slots.data ?? [];

  return (
    <Page>
      <ToolHeader title="Appointments" description="Open times and bookings from the line." />
      <PageBody className="p-4 sm:p-6">
        <div className="grid max-w-5xl gap-6">
          <div className="grid gap-3 rounded-2xl bg-raised p-4 sm:flex sm:flex-wrap sm:items-end">
            <label className="grid min-w-0 flex-1 gap-1.5">
              <Label>Agent</Label>
              <Select value={agentId} onValueChange={setAgentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose" />
                </SelectTrigger>
                <SelectContent>
                  {(agents.data ?? []).map((a) => (
                    <SelectItem value={a.id} key={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="grid min-w-0 flex-1 gap-1.5">
              <Label>When</Label>
              <Input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} />
            </label>
            <Button className="w-full sm:w-auto" disabled={open.isPending || !agentId || !at} onClick={() => open.mutate()}>
              Open slot
            </Button>
          </div>
          {rows.length ? (
            <DataTable columns={["When", "Agent", "Who", "Status"]} colsClass={COLS}>
              {rows.map((s) => (
                <li className={`grid items-center gap-2 px-4 py-3 sm:px-6 ${COLS}`} key={s.id}>
                  <span className="text-sm">{when(String(s.starts_at))}</span>
                  <span className="truncate text-sm text-muted">{s.agent_name}</span>
                  <span className="truncate text-sm">{(s.status === "booked" && (s.booked_name || s.booked_contact)) || "—"}</span>
                  <span className="flex items-center gap-2">
                    <Badge tone={s.status === "booked" ? "live" : s.status === "cancelled" ? "warn" : "draft"}>{s.status}</Badge>
                    {s.status === "cancelled" ? null : (
                      <button
                        type="button"
                        className="text-xs text-muted hover:text-fg"
                        onClick={async () => {
                          await api.tools.setSlotStatus({ id: s.id, status: "cancelled" });
                          await refresh();
                        }}
                      >
                        Cancel
                      </button>
                    )}
                  </span>
                </li>
              ))}
            </DataTable>
          ) : (
            <EmptyState icon={Calendar} title="No times yet" description="Open a slot, or talk to a booking agent — confirmed visits land here." />
          )}
        </div>
      </PageBody>
    </Page>
  );
}
