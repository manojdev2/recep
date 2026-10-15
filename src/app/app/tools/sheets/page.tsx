"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppMark } from "@/components/brand-marks";
import { ConnectorDialog } from "@/components/app/connector-dialog";
import { Page, PageBody } from "@/components/app/page";
import { ToolHeader } from "@/components/app/tool-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api";

export default function SheetsPage() {
  const qc = useQueryClient();
  const dest = useQuery({ queryKey: ["sheets-dest"], queryFn: () => api.tools.sheet() });
  const apps = useQuery({ queryKey: ["apps"], queryFn: () => api.connectors.list() });
  const [connecting, setConnecting] = useState(false);
  const [spreadsheetId, setSpreadsheetId] = useState("");
  const [sheetName, setSheetName] = useState("Reception AI");
  const [appointments, setAppointments] = useState(true);
  const [forms, setForms] = useState(true);
  const [leads, setLeads] = useState(true);
  const conn = (apps.data ?? []).find((c) => c.appKey === "gsheets");

  useEffect(() => {
    if (!dest.data) return;
    setSpreadsheetId(dest.data.spreadsheet_id);
    setSheetName(dest.data.sheet_name || "Reception AI");
    setAppointments(!!dest.data.push_appointments);
    setForms(!!dest.data.push_forms);
    setLeads(!!dest.data.push_leads);
  }, [dest.data]);

  const save = useMutation({
    mutationFn: () =>
      api.tools.saveSheet({
        connectionId: conn?.id ?? dest.data?.connection_id ?? "",
        spreadsheetId,
        sheetName,
        pushAppointments: appointments,
        pushForms: forms,
        pushLeads: leads,
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["sheets-dest"] });
      toast.success("Sheets destination saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Page>
      <ToolHeader title="Google Sheets" description="Append a row when something books, submits, or qualifies." />
      <PageBody className="p-4 sm:p-6">
        <div className="grid max-w-xl gap-5">
          <div className="flex items-center gap-4 rounded-2xl bg-bg p-5 shadow-[var(--shadow-border)]">
            <AppMark appKey="gsheets" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Google Sheets</p>
              <p className="text-sm text-muted">{conn ? conn.accountLabel : "Not connected"}</p>
            </div>
            <Badge tone={conn ? "live" : "draft"}>{conn ? "Connected" : "Off"}</Badge>
            <Button size="sm" variant={conn ? "secondary" : "primary"} onClick={() => setConnecting(true)}>
              {conn ? "Reconnect" : "Connect"}
            </Button>
          </div>
          <label className="grid gap-1.5">
            <Label>Spreadsheet ID</Label>
            <Input placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms" value={spreadsheetId} onChange={(e) => setSpreadsheetId(e.target.value)} />
          </label>
          <label className="grid gap-1.5">
            <Label>Sheet name</Label>
            <Input value={sheetName} onChange={(e) => setSheetName(e.target.value)} />
          </label>
          <label className="flex items-center justify-between rounded-xl bg-raised px-4 py-3">
            <span className="text-sm">Appointments</span>
            <Switch checked={appointments} onCheckedChange={setAppointments} />
          </label>
          <label className="flex items-center justify-between rounded-xl bg-raised px-4 py-3">
            <span className="text-sm">Form submissions</span>
            <Switch checked={forms} onCheckedChange={setForms} />
          </label>
          <label className="flex items-center justify-between rounded-xl bg-raised px-4 py-3">
            <span className="text-sm">Leads</span>
            <Switch checked={leads} onCheckedChange={setLeads} />
          </label>
          <Button disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </PageBody>
      <ConnectorDialog
        appKey={connecting ? "gsheets" : null}
        pending={false}
        onOpenChange={setConnecting}
        onSubmit={async (input) => {
          try {
            await api.connectors.connect(input);
            await qc.invalidateQueries({ queryKey: ["apps"] });
            setConnecting(false);
            toast.success("Connected");
          } catch (e) {
            toast.error((e as Error).message);
          }
        }}
      />
    </Page>
  );
}
