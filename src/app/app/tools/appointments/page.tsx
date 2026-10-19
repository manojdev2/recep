"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Calendar } from "lucide-react";
import { DataTable, EmptyState, Page, PageBody } from "@/components/app/page";
import { ToolHeader } from "@/components/app/tool-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";

const COLS = "sm:grid-cols-[minmax(0,1.2fr)_10rem_minmax(0,1fr)_8rem]";

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
    mutationFn: () => api.tools.openSlot({ agentId, startsAt: at }),
    onSuccess: async () => {
      await refresh();
      setAt("");
      toast.success("Slot opened");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const [cancelling, setCancelling] = useState<{ id: string; booked_name: string; label: string } | null>(null);
  const cancel = useMutation({
    mutationFn: (id: string) => api.tools.setSlotStatus({ id, status: "cancelled" }),
    onSuccess: async () => {
      await refresh();
      setCancelling(null);
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
                  <span className="text-sm">{s.label}</span>
                  <span className="truncate text-sm text-muted">{s.agent_name}</span>
                  <span className="truncate text-sm">{(s.status === "booked" && (s.booked_name || s.booked_contact)) || "—"}</span>
                  <span className="flex items-center gap-2">
                    <Badge tone={s.status === "booked" ? "live" : s.status === "cancelled" ? "warn" : "draft"}>{s.status}</Badge>
                    {s.status === "cancelled" ? null : (
                      <button
                        type="button"
                        className="text-xs text-muted hover:text-fg"
                        onClick={() => (s.status === "booked" ? setCancelling(s) : cancel.mutate(s.id))}
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
        <ConfirmDialog
          open={!!cancelling}
          title="Cancel this booking?"
          description={`${cancelling?.booked_name || "The caller"} is booked for ${cancelling?.label}. The time opens up for new bookings. The caller is not told automatically.`}
          confirmLabel="Cancel booking"
          cancelLabel="Keep"
          danger
          pending={cancel.isPending}
          onOpenChange={(o) => !o && setCancelling(null)}
          onConfirm={() => cancelling && cancel.mutate(cancelling.id)}
        />
      </PageBody>
    </Page>
  );
}
