"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Phone } from "lucide-react";
import { ProviderMark } from "@/components/brand-marks";
import { CallDialog, carrier } from "@/components/app/call-dialog";
import { DataTable, EmptyState, Page, PageBody, PageHeader } from "@/components/app/page";
import { RowsSkeleton } from "@/components/app/skeletons";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api";
import { COUNTRIES, NUMBER_PROVIDERS } from "@/lib/catalog";
import { cn } from "@/lib/utils";

type ImportInput = {
  provider: string;
  e164?: string;
  dial: string;
  label?: string;
  smsEnabled: boolean;
  autoConfigure: boolean;
  config: Record<string, string>;
};

function Secret({ label, value, onChange, placeholder, secret }: { label: string; value: string; onChange: (v: string) => void; placeholder: string; secret?: boolean }) {
  return (
    <label className="grid gap-1.5">
      <Label>{label}</Label>
      <Input type={secret ? "password" : "text"} autoComplete="off" spellCheck={false} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </label>
  );
}

function AddNumberDialog({
  open,
  pending,
  error,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  pending: boolean;
  error: string | null;
  onOpenChange: (o: boolean) => void;
  onSubmit: (input: ImportInput) => void;
}) {
  const [provider, setProvider] = useState("aether");
  const [country, setCountry] = useState("US");
  const [number, setNumber] = useState("");
  const [label, setLabel] = useState("");
  const [sms, setSms] = useState(true);
  const [point, setPoint] = useState(true);
  const [cfg, setCfg] = useState<Record<string, string>>({});
  const def = NUMBER_PROVIDERS.find((p) => p.id === provider) ?? NUMBER_PROVIDERS[0];
  const dial = COUNTRIES.find((c) => c.iso === country) ?? COUNTRIES[0];
  const needsNumber = ["twilio", "plivo", "vonage", "telnyx", "sip"].includes(provider);
  const ready = useMemo(() => {
    if (needsNumber && !number.trim()) return false;
    if (provider === "twilio") return !!(cfg.sid?.trim() && cfg.token?.trim());
    if (provider === "plivo") return !!(cfg.authId?.trim() && cfg.authToken?.trim());
    if (provider === "vonage") return !!(cfg.apiKey?.trim() && cfg.apiSecret?.trim());
    if (provider === "telnyx") return !!cfg.token?.trim();
    if (provider === "sip") return !!(cfg.sipUri?.trim() && cfg.username?.trim() && cfg.password?.trim());
    return true;
  }, [provider, number, cfg, needsNumber]);
  const reset = () => {
    setNumber("");
    setLabel("");
    setSms(true);
    setCfg({});
  };
  const set = (k: string) => (v: string) => setCfg((c) => ({ ...c, [k]: v }));

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="w-[min(calc(100vw-1.5rem),46rem)] overflow-hidden p-0">
        <div className="grid min-h-[28rem] sm:grid-cols-[13.75rem_minmax(0,1fr)]">
          <aside className="border-b border-border p-3 sm:border-r sm:border-b-0">
            <p className="px-2 py-2 text-[11px] tracking-[0.16em] text-subtle uppercase">Phone number options</p>
            <ul className="grid gap-0.5">
              {NUMBER_PROVIDERS.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setProvider(p.id);
                      reset();
                    }}
                    className={cn("w-full rounded-lg px-3 py-2 text-left text-sm", provider === p.id ? "bg-raised text-fg" : "text-muted hover:bg-raised hover:text-fg")}
                  >
                    {p.name}
                  </button>
                </li>
              ))}
            </ul>
          </aside>
          <form
            className="flex min-w-0 flex-col p-5 sm:p-6"
            onSubmit={(e) => {
              e.preventDefault();
              if (ready)
                onSubmit({ provider, e164: number.trim() || undefined, dial: dial.dial, label: label.trim() || undefined, smsEnabled: sms, autoConfigure: point, config: cfg });
            }}
          >
            <DialogTitle className="pr-8 text-lg">{def.name}</DialogTitle>
            <DialogDescription className="mt-1">{def.description}</DialogDescription>
            <p className="mt-3 rounded-lg bg-raised px-3 py-2 text-xs leading-relaxed text-muted">
              <span className="font-medium text-fg">What works: </span>
              {carrier(provider).note}
            </p>
            <div className="mt-5 grid min-h-0 flex-1 gap-3">
              {needsNumber ? (
                <label className="grid gap-1.5">
                  <Label>{provider === "twilio" ? "Twilio phone number" : "Phone number"}</Label>
                  <div className="flex gap-2">
                    <select
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="h-11 shrink-0 rounded-lg bg-raised px-2 text-sm shadow-[var(--shadow-border)] outline-none"
                      aria-label="Country"
                    >
                      {COUNTRIES.map((c) => (
                        <option value={c.iso} key={c.iso}>
                          {c.flag} {c.dial}
                        </option>
                      ))}
                    </select>
                    <Input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="4156021922" inputMode="tel" autoComplete="tel" />
                  </div>
                </label>
              ) : null}
              {provider === "twilio" ? (
                <>
                  <Secret label="Twilio Account SID" value={cfg.sid ?? ""} onChange={set("sid")} placeholder="ACxxxxxxxx" secret />
                  <Secret label="Twilio Auth Token" value={cfg.token ?? ""} onChange={set("token")} placeholder="Auth Token" secret />
                </>
              ) : null}
              {provider === "plivo" ? (
                <>
                  <Secret label="Plivo Auth ID" value={cfg.authId ?? ""} onChange={set("authId")} placeholder="MAxxxxxxxxxxxxxxxxxx" secret />
                  <Secret label="Plivo Auth Token" value={cfg.authToken ?? ""} onChange={set("authToken")} placeholder="Auth Token" secret />
                </>
              ) : null}
              {provider === "vonage" ? (
                <>
                  <Secret label="API key" value={cfg.apiKey ?? ""} onChange={set("apiKey")} placeholder="Vonage API key" secret />
                  <Secret label="API secret" value={cfg.apiSecret ?? ""} onChange={set("apiSecret")} placeholder="Vonage API secret" secret />
                </>
              ) : null}
              {provider === "telnyx" ? <Secret label="API key" value={cfg.token ?? ""} onChange={set("token")} placeholder="KEY…" secret /> : null}
              {provider === "sip" ? (
                <>
                  <Secret label="SIP URI" value={cfg.sipUri ?? ""} onChange={set("sipUri")} placeholder="sip:user@sip.your-carrier.com" />
                  <Secret label="Username" value={cfg.username ?? ""} onChange={set("username")} placeholder="SIP username" />
                  <Secret label="Password" value={cfg.password ?? ""} onChange={set("password")} placeholder="SIP password" secret />
                </>
              ) : null}
              <Secret label="Label" value={label} onChange={setLabel} placeholder="Label for this number" />
              {provider === "aether-sip" ? null : (
                <label className="flex items-center justify-between gap-4 rounded-xl bg-raised px-4 py-3">
                  <span>
                    <span className="block text-sm font-medium">SMS enabled</span>
                    <span className="mt-0.5 block text-xs text-muted">Let the agent send texts from this number.</span>
                  </span>
                  <Switch checked={sms} onCheckedChange={setSms} />
                </label>
              )}
              {provider === "twilio" ? (
                <label className="flex items-center justify-between gap-4 rounded-xl bg-raised px-4 py-3">
                  <span>
                    <span className="block text-sm font-medium">Point this number at Azentoo</span>
                    <span className="mt-0.5 block text-xs text-muted">
                      Sets the Voice webhook in your Twilio account so calls reach this app. Without it the number will not ring here.
                    </span>
                  </span>
                  <Switch checked={point} onCheckedChange={setPoint} />
                </label>
              ) : null}
              {error ? <p className="text-sm text-danger">{error}</p> : null}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending || !ready}>
                {pending ? "Checking…" : def.action}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const providerName = (id: string) => NUMBER_PROVIDERS.find((p) => p.id === id)?.name ?? id;
const COLS = "sm:grid-cols-[13rem_minmax(0,1fr)_4rem_13rem_13rem]";

export default function PhonePage() {
  const qc = useQueryClient();
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [callMode, setCallMode] = useState<"in" | "out" | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const phones = useQuery({ queryKey: ["phones"], queryFn: () => api.agents.phones() });
  const agents = useQuery({ queryKey: ["agents"], queryFn: () => api.agents.list() });

  const add = useMutation({
    mutationFn: (input: ImportInput) => api.agents.importNumber(input),
    onSuccess: async (n) => {
      await qc.invalidateQueries({ queryKey: ["phones"] });
      setAdding(false);
      add.reset();
      if (n.webhook?.configured) toast.success(`Added ${n.e164} — Twilio now sends calls here.`);
      else if (n.webhook && "error" in n.webhook && n.webhook.error)
        toast.warning(`Added ${n.e164}, but Twilio was not updated: ${n.webhook.error} Set the Voice webhook by hand in the Twilio console.`, { duration: 12000 });
      else toast.success(n.sipUri && n.e164.startsWith("+1000") ? `SIP ${n.sipUri}` : `Added ${n.e164}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const point = useMutation({
    mutationFn: (id: string) => api.agents.pointNumber(id),
    onSuccess: (out) => toast.success(`Twilio now sends calls to ${out.voiceUrl}`),
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.agents.removeNumber(id),
    onSuccess: async (out) => {
      await qc.invalidateQueries({ queryKey: ["phones"] });
      setRemoving(null);
      toast.success(`${out.e164} removed. ${out.note}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
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
      toast.success(`Inbound from ${out.from}`);
      setCallMode(null);
      router.push(`/app/agents/${out.agentId}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Page>
      <PageHeader
        title="Phone numbers"
        description="Connect the number your customers know and give every call a warm welcome."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" className="hidden sm:inline-flex" asChild>
              <Link href="/app/calls">Call log</Link>
            </Button>
            <Button variant="secondary" onClick={() => setCallMode("in")}>
              Ring in
            </Button>
            <Button variant="secondary" onClick={() => setCallMode("out")}>
              Call someone
            </Button>
            <Button onClick={() => setAdding(true)} disabled={add.isPending}>
              Add number
            </Button>
          </div>
        }
      />
      <PageBody>
        {phones.isPending ? (
          <>
            <div className={cn("hidden gap-3 border-b border-border px-4 py-2 text-xs tracking-wide text-subtle uppercase sm:grid sm:px-6", COLS)}>
              <span>Number</span>
              <span>Provider</span>
              <span>SMS</span>
              <span>Assigned agent</span>
              <span />
            </div>
            <RowsSkeleton rows={4} colsClass={COLS} />
          </>
        ) : phones.data && phones.data.length > 0 ? (
          <DataTable columns={["Number", "Provider", "SMS", "Assigned agent", ""]} colsClass={COLS}>
            {phones.data.map((n) => (
              <li className={cn("grid items-center gap-3 px-4 py-3 sm:px-6", COLS)} key={n.id}>
                <div className="min-w-0">
                  <p className="font-mono text-sm tabular-nums">{n.e164}</p>
                  <p className="truncate text-xs text-subtle">{n.label}</p>
                  {n.sipUri ? <p className="truncate font-mono text-[11px] text-subtle">{n.sipUri}</p> : null}
                </div>
                <div className="flex items-center gap-2">
                  <ProviderMark provider={n.provider} />
                  <span className="text-sm">{providerName(n.provider)}</span>
                </div>
                <p className="text-sm text-muted">{n.smsEnabled ? "On" : "Off"}</p>
                <Select
                  value={n.agentId ?? "none"}
                  onValueChange={async (v) => {
                    await api.agents.assignNumber({ id: n.id, agentId: v === "none" ? null : v });
                    await qc.invalidateQueries({ queryKey: ["phones"] });
                  }}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {(agents.data ?? []).map((a) => (
                      <SelectItem value={a.id} key={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center justify-end gap-1">
                  {n.provider === "twilio" || n.provider === "plivo" ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={point.isPending}
                      onClick={() => point.mutate(n.id)}
                      title={`Point this number's voice webhook at Azentoo in ${providerName(n.provider)}`}
                    >
                      {point.isPending ? "Pointing…" : "Point at Azentoo"}
                    </Button>
                  ) : null}
                  <Button size="sm" variant="ghost" className="text-muted hover:text-danger" onClick={() => setRemoving(n.id)}>
                    Remove
                  </Button>
                </div>
              </li>
            ))}
          </DataTable>
        ) : (
          <EmptyState
            icon={Phone}
            title="No numbers yet"
            description="Try a practice line, or connect your existing phone provider to start answering real calls."
            action={<Button onClick={() => setAdding(true)}>Add number</Button>}
          />
        )}
      </PageBody>
      {callMode ? (
        <CallDialog
          open
          mode={callMode === "in" ? "inbound" : "outbound"}
          agents={agents.data ?? []}
          phones={phones.data ?? []}
          pending={place.isPending || ringIn.isPending}
          onOpenChange={(o) => !o && setCallMode(null)}
          onPlace={(input) => place.mutate(input)}
          onInbound={(input) => ringIn.mutate(input)}
        />
      ) : null}
      <ConfirmDialog
        open={!!removing}
        title="Remove this number?"
        description="It disappears from this workspace and stops answering. Call history is kept, and the number stays yours on the carrier — nothing is released or cancelled."
        confirmLabel="Remove"
        danger
        pending={remove.isPending}
        onOpenChange={(o) => !o && setRemoving(null)}
        onConfirm={() => removing && remove.mutate(removing)}
      />
      <AddNumberDialog
        open={adding}
        pending={add.isPending}
        error={add.error ? add.error.message : null}
        onOpenChange={(o) => {
          setAdding(o);
          if (!o) add.reset();
        }}
        onSubmit={(input) => add.mutate(input)}
      />
    </Page>
  );
}
