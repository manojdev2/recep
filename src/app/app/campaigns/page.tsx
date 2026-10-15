"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Megaphone } from "lucide-react";
import { EmptyState, Page, PageBody, PageHeader } from "@/components/app/page";
import { TableSkeleton } from "@/components/app/skeletons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";

type NewCampaign = { name: string; agentId: string; phoneId: string | null; contacts: string; contactIds: string[] };

function NewCampaignDialog({
  open,
  agents,
  phones,
  contacts,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  agents: { id: string; name: string }[];
  phones: { id: string; e164: string }[];
  contacts: { id: string; name: string; e164: string }[];
  onOpenChange: (o: boolean) => void;
  onCreate: (input: NewCampaign) => Promise<void>;
}) {
  const [name, setName] = useState("Outbound list");
  const [agentId, setAgentId] = useState("");
  const [phoneId, setPhoneId] = useState(phones[0]?.id ?? "");
  const [paste, setPaste] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogTitle>New campaign</DialogTitle>
        <DialogDescription>Pick an agent, a from-number, and people from the book.</DialogDescription>
        <div className="mt-4 grid gap-3">
          <label className="grid gap-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="grid gap-1.5">
            <Label>Agent</Label>
            <Select value={agentId} onValueChange={setAgentId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {agents.map((a) => (
                  <SelectItem value={a.id} key={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="grid gap-1.5">
            <Label>From</Label>
            <Select value={phoneId || phones[0]?.id} onValueChange={setPhoneId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {phones.map((p) => (
                  <SelectItem value={p.id} key={p.id}>
                    {p.e164}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          {contacts.length ? (
            <div>
              <p className="text-sm font-medium">From the book</p>
              <ul className="mt-2 max-h-40 overflow-y-auto rounded-xl bg-raised">
                {contacts.map((c) => (
                  <li key={c.id}>
                    <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-bg">
                      <input type="checkbox" checked={picked.includes(c.id)} onChange={() => toggle(c.id)} />
                      <span className="min-w-0 flex-1 truncate">{c.name || c.e164}</span>
                      <span className="font-mono text-xs text-muted">{c.e164}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <label className="grid gap-1.5">
            <Label>Or paste numbers</Label>
            <Textarea className="min-h-20 font-mono text-xs" placeholder="+14155550114, Alex Rivera" value={paste} onChange={(e) => setPaste(e.target.value)} />
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              disabled={busy || !agentId}
              onClick={async () => {
                setBusy(true);
                try {
                  await onCreate({ name, agentId: agentId || agents[0]?.id, phoneId: phoneId || phones[0]?.id || null, contacts: paste, contactIds: picked });
                } catch (e) {
                  toast.error((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Creating…" : "Create"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function CampaignsPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const campaigns = useQuery({ queryKey: ["campaigns"], queryFn: () => api.calling.campaigns() });
  const agents = useQuery({ queryKey: ["agents"], queryFn: () => api.agents.list() });
  const phones = useQuery({ queryKey: ["phones"], queryFn: () => api.agents.phones() });
  const contacts = useQuery({ queryKey: ["contacts"], queryFn: () => api.contacts.list() });

  if (campaigns.isPending) {
    return <TableSkeleton title="Reach out" description="A thoughtful follow-up can make someone’s day." columns={["Campaign", "Agent", "Progress"]} rows={4} />;
  }

  return (
    <Page>
      <PageHeader
        title="Reach out"
        description="Choose your people, pick a receptionist, and plan your next conversation."
        actions={<Button onClick={() => setCreating(true)}>New campaign</Button>}
      />
      <PageBody>
        {(campaigns.data ?? []).length ? (
          <ul className="grid gap-3 p-4 sm:grid-cols-2 sm:p-6 xl:grid-cols-3">
            {(campaigns.data ?? []).map((c) => (
              <li key={c.id}>
                <Link
                  href={`/app/campaigns/${c.id}`}
                  className="block h-full rounded-2xl bg-bg p-5 shadow-[var(--shadow-border)] hover:shadow-[var(--shadow-border-hover)]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-lg font-medium tracking-tight">{c.name}</p>
                    <Badge tone={c.status === "running" ? "live" : c.status === "done" ? "mute" : "draft"}>{c.status}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted">{c.agentName}</p>
                  <p className="mt-4 text-xs text-subtle">
                    {c.completed}/{c.total || 0} reached · {c.pending} waiting
                    {c.fromE164 ? ` · ${c.fromE164}` : ""}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={Megaphone}
            title="No campaigns yet"
            description="Choose contacts and a receptionist, then set a good time to get in touch."
            action={<Button onClick={() => setCreating(true)}>New campaign</Button>}
          />
        )}
      </PageBody>
      {creating ? (
        <NewCampaignDialog
          open
          agents={agents.data ?? []}
          phones={phones.data ?? []}
          contacts={contacts.data ?? []}
          onOpenChange={setCreating}
          onCreate={async (input) => {
            const out = await api.calling.createCampaign(input);
            await qc.invalidateQueries({ queryKey: ["campaigns"] });
            setCreating(false);
            router.push(`/app/campaigns/${out.id}`);
          }}
        />
      ) : null}
    </Page>
  );
}
