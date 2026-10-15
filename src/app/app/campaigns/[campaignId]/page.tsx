"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Trash2 } from "lucide-react";
import { DataTable, Page, PageBody } from "@/components/app/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import type { Campaign } from "@/server/types";

export default function CampaignPage() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["campaign", campaignId],
    queryFn: () => api.calling.campaign(campaignId),
    refetchInterval: (q) => (q.state.data?.campaign.status === "running" ? 4000 : false),
  });
  const phones = useQuery({ queryKey: ["phones"], queryFn: () => api.agents.phones() });
  const contacts = useQuery({ queryKey: ["contacts"], queryFn: () => api.contacts.list() });
  const [paste, setPaste] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [confirm, setConfirm] = useState(false);
  const onList = useMemo(() => new Set((query.data?.contacts ?? []).map((c) => c.e164)), [query.data]);
  const available = (contacts.data ?? []).filter((c) => !onList.has(c.e164));

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["campaign", campaignId] });
    await qc.invalidateQueries({ queryKey: ["campaigns"] });
  };
  const update = useMutation({
    mutationFn: (input: Partial<Campaign> & { id: string }) => api.calling.updateCampaign(input),
    onSuccess: async () => {
      await refresh();
      toast.success("Saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const addPeople = useMutation({
    mutationFn: () => api.calling.addToCampaign({ campaignId, contacts: paste, contactIds: picked }),
    onSuccess: async (out) => {
      await refresh();
      await qc.invalidateQueries({ queryKey: ["contacts"] });
      setPaste("");
      setPicked([]);
      toast.success(`${out.added} added`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const dial = useMutation({
    mutationFn: async () => {
      await api.calling.updateCampaign({ id: campaignId, status: "running" });
      return api.calling.dialNext({ campaignId, limit: 6 });
    },
    onSuccess: async (out) => {
      await refresh();
      await qc.invalidateQueries({ queryKey: ["calls"] });
      if (out.reason === "outside window") toast.error("Outside the calling window.");
      else toast.success(`Dialed ${out.dialed} · ${out.remaining} left`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const pause = useMutation({
    mutationFn: () => api.calling.updateCampaign({ id: campaignId, status: "paused" }),
    onSuccess: async () => {
      await refresh();
      toast.success("Paused");
    },
  });
  const remove = useMutation({
    mutationFn: () => api.calling.removeCampaign(campaignId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["campaigns"] });
      router.push("/app/campaigns");
    },
  });

  if (query.isPending) {
    return (
      <Page>
        <div className="p-8 text-sm text-muted">Loading campaign…</div>
      </Page>
    );
  }
  if (!query.data) {
    return (
      <Page>
        <div className="p-8">
          <p className="text-muted">This campaign is gone.</p>
          <Button asChild className="mt-4" variant="secondary">
            <Link href="/app/campaigns">Back</Link>
          </Button>
        </div>
      </Page>
    );
  }
  const c = query.data.campaign;

  return (
    <Page>
      <header className="shrink-0 border-b border-border px-4 py-3 sm:px-6">
        <div className="flex items-start gap-2">
          <Link href="/app/campaigns" className="inline-flex h-11 shrink-0 items-center gap-1 rounded-lg px-2 text-sm text-muted hover:bg-raised hover:text-fg">
            <ArrowLeft className="size-4" />
            <span className="hidden sm:inline">Campaigns</span>
          </Link>
          <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-medium tracking-tight">{c.name}</h1>
                <Badge tone={c.status === "running" ? "live" : c.status === "done" ? "mute" : "draft"}>{c.status}</Badge>
              </div>
              <p className="text-sm text-muted">
                {c.agentName} · {c.completed}/{c.total} reached · {c.pending} waiting
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" onClick={() => setConfirm(true)}>
                <Trash2 className="size-4" />
              </Button>
              {c.status === "running" ? (
                <Button variant="secondary" disabled={pause.isPending} onClick={() => pause.mutate()}>
                  Pause
                </Button>
              ) : null}
              <Button disabled={dial.isPending || c.pending === 0} onClick={() => dial.mutate()}>
                {dial.isPending ? "Dialing…" : c.status === "running" ? "Dial next" : c.pending === 0 ? "Done" : "Start dialing"}
              </Button>
            </div>
          </div>
        </div>
      </header>
      <PageBody className="p-4 sm:p-6">
        <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {(
            [
              ["Waiting", c.pending],
              ["Ringing", c.ringing],
              ["Booked", c.completed],
              ["No answer", c.noAnswer],
              ["Voicemail", c.voicemail],
              ["Failed", c.failed],
            ] as const
          ).map(([label, value]) => (
            <div className="rounded-2xl bg-raised px-4 py-3" key={label}>
              <p className="text-[11px] tracking-[0.16em] text-subtle uppercase">{label}</p>
              <p className="mt-1 text-xl font-medium tabular-nums">{value}</p>
            </div>
          ))}
        </div>
        <div className="grid max-w-5xl gap-8 lg:grid-cols-[16rem_minmax(0,1fr)]">
          <div className="grid h-fit gap-4">
            <label className="grid gap-1.5">
              <Label>Name</Label>
              <Input
                defaultValue={c.name}
                onBlur={(e) => {
                  if (e.target.value.trim() && e.target.value !== c.name) update.mutate({ id: c.id, name: e.target.value });
                }}
              />
            </label>
            <label className="grid gap-1.5">
              <Label>From</Label>
              <Select value={c.phoneId ?? "none"} onValueChange={(v) => update.mutate({ id: c.id, phoneId: v === "none" ? null : v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {(phones.data ?? []).map((p) => (
                    <SelectItem value={p.id} key={p.id}>
                      {p.e164}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1.5">
                <Label>Window start</Label>
                <Input defaultValue={c.windowStart} onBlur={(e) => update.mutate({ id: c.id, windowStart: e.target.value })} />
              </label>
              <label className="grid gap-1.5">
                <Label>Window end</Label>
                <Input defaultValue={c.windowEnd} onBlur={(e) => update.mutate({ id: c.id, windowEnd: e.target.value })} />
              </label>
            </div>
            <label className="grid gap-1.5">
              <Label>Max attempts</Label>
              <Input type="number" min={1} max={5} defaultValue={c.maxAttempts} onBlur={(e) => update.mutate({ id: c.id, maxAttempts: Number(e.target.value) || 1 })} />
            </label>
            <label className="grid gap-1.5">
              <Label>Voicemail</Label>
              <Select value={c.voicemailMode} onValueChange={(v) => update.mutate({ id: c.id, voicemailMode: v === "hangup" ? "hangup" : "message" })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="message">Leave the script</SelectItem>
                  <SelectItem value="hangup">Hang up</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1.5">
                <Label>Lines at once</Label>
                <Input type="number" min={1} max={8} defaultValue={c.concurrency} onBlur={(e) => update.mutate({ id: c.id, concurrency: Number(e.target.value) || 3 })} />
              </label>
              <label className="grid gap-1.5">
                <Label>Retry (min)</Label>
                <Input
                  type="number"
                  min={5}
                  max={1440}
                  defaultValue={c.retryMinutes}
                  onBlur={(e) => update.mutate({ id: c.id, retryMinutes: Number(e.target.value) || 60 })}
                />
              </label>
            </div>
            <label className="flex items-center justify-between rounded-xl bg-raised px-4 py-3 text-sm">
              Skip DNC
              <input type="checkbox" checked={c.skipDnc} onChange={(e) => update.mutate({ id: c.id, skipDnc: e.target.checked })} />
            </label>
          </div>
          <div>
            <p className="text-sm font-medium">Who to call</p>
            <p className="mt-1 text-sm text-muted">Pick from the book, or paste numbers. New numbers are saved as contacts.</p>
            {available.length ? (
              <ul className="mt-3 max-h-40 overflow-y-auto rounded-xl bg-raised">
                {available.map((p) => (
                  <li key={p.id}>
                    <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-bg">
                      <input
                        type="checkbox"
                        checked={picked.includes(p.id)}
                        onChange={() => setPicked((x) => (x.includes(p.id) ? x.filter((y) => y !== p.id) : [...x, p.id]))}
                      />
                      <span className="min-w-0 flex-1 truncate">{p.name || p.e164}</span>
                      <span className="font-mono text-xs text-muted">{p.e164}</span>
                    </label>
                  </li>
                ))}
              </ul>
            ) : null}
            <Textarea className="mt-3 min-h-24 font-mono text-xs" value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="+14155550114, Jordan Hale" />
            <Button className="mt-2" size="sm" variant="secondary" disabled={addPeople.isPending || (!paste.trim() && picked.length === 0)} onClick={() => addPeople.mutate()}>
              {addPeople.isPending ? "Adding…" : "Add to list"}
            </Button>
            {query.data.contacts.length ? (
              <DataTable columns={["Number", "Name", "Status", "Last"]} colsClass="sm:grid-cols-[9rem_minmax(0,1fr)_7rem_minmax(0,1fr)]">
                {query.data.contacts.map((t) => (
                  <li className="grid items-center gap-3 px-4 py-3 sm:grid-cols-[9rem_minmax(0,1fr)_7rem_minmax(0,1fr)] sm:px-6" key={t.id}>
                    <p className="font-mono text-sm tabular-nums">{t.e164}</p>
                    <p className="truncate text-sm">{t.name || "—"}</p>
                    <p className="text-sm text-muted">{t.status}</p>
                    <p className="truncate text-xs text-subtle">{t.lastOutcome || `${t.attempts} tries`}</p>
                  </li>
                ))}
              </DataTable>
            ) : (
              <p className="mt-6 text-sm text-muted">No numbers on this list yet.</p>
            )}
          </div>
        </div>
      </PageBody>
      <ConfirmDialog
        open={confirm}
        title="Delete this campaign?"
        description="The list goes with it. Past calls stay in the log."
        confirmLabel="Delete"
        danger
        pending={remove.isPending}
        onOpenChange={setConfirm}
        onConfirm={() => remove.mutate()}
      />
    </Page>
  );
}
