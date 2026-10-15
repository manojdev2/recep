"use client";

import { useEffect, useState, type ComponentType } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Mail, MessageCircle } from "lucide-react";
import { Page, PageBody } from "@/components/app/page";
import { ToolHeader } from "@/components/app/tool-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, type ApiResult } from "@/lib/api";

type Channel = ApiResult<"tools", "messaging">[number];
type Field = { key: string; label: string; placeholder: string; secret?: boolean };

function ChannelCard({
  title,
  hint,
  icon: Icon,
  existing,
  fields,
  toPlaceholder,
  kind,
  onSaved,
}: {
  title: string;
  hint: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  existing?: Channel;
  fields: Field[];
  toPlaceholder: string;
  kind: "whatsapp" | "email";
  onSaved: () => void;
}) {
  const [config, setConfig] = useState<Record<string, string>>(existing?.config ?? {});
  const [to, setTo] = useState("");
  useEffect(() => {
    if (existing?.config) setConfig(existing.config);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing?.id]);
  const save = useMutation({
    mutationFn: () => api.tools.saveMessaging({ id: existing?.id, kind, label: title, config }),
    onSuccess: () => {
      toast.success("Saved");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const test = useMutation({
    mutationFn: () => api.tools.testMessaging({ id: existing?.id ?? "", to, body: "Hello from Reception AI." }),
    onSuccess: () => toast.success("Sent"),
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <section className="grid gap-3 rounded-2xl bg-bg p-5 shadow-[var(--shadow-border)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-raised text-muted">
            <Icon className="size-5" strokeWidth={1.6} />
          </span>
          <div>
            <p className="text-sm font-medium">{title}</p>
            <p className="mt-1 text-sm text-muted">{hint}</p>
          </div>
        </div>
        <Badge tone={existing?.status === "connected" ? "live" : existing?.status === "error" ? "warn" : "draft"}>{existing?.status ?? "off"}</Badge>
      </div>
      {fields.map((f) => (
        <label className="grid gap-1.5" key={f.key}>
          <Label>{f.label}</Label>
          <Input
            type={f.secret ? "password" : "text"}
            placeholder={f.placeholder}
            value={config[f.key] ?? ""}
            onChange={(e) => setConfig({ ...config, [f.key]: e.target.value })}
          />
        </label>
      ))}
      <Button variant="secondary" disabled={save.isPending} onClick={() => save.mutate()}>
        {save.isPending ? "Saving…" : "Save"}
      </Button>
      {existing ? (
        <div className="grid gap-2 border-t border-border pt-3">
          <Label>Send a test</Label>
          <Input placeholder={toPlaceholder} value={to} onChange={(e) => setTo(e.target.value)} />
          <Button disabled={test.isPending || !to.trim()} onClick={() => test.mutate()}>
            {test.isPending ? "Sending…" : "Send"}
          </Button>
          {existing.lastError ? <p className="text-xs text-muted">{existing.lastError}</p> : null}
        </div>
      ) : null}
    </section>
  );
}

export default function MessagingPage() {
  const qc = useQueryClient();
  const channels = useQuery({ queryKey: ["messaging"], queryFn: () => api.tools.messaging() });
  const whatsapp = (channels.data ?? []).find((c) => c.kind === "whatsapp");
  const email = (channels.data ?? []).find((c) => c.kind === "email");
  const refresh = () => qc.invalidateQueries({ queryKey: ["messaging"] });
  return (
    <Page>
      <ToolHeader title="WhatsApp & email" description="Connect a channel, then send from the same agents." />
      <PageBody className="p-4 sm:p-6">
        <div className="grid max-w-3xl gap-6 lg:grid-cols-2">
          <ChannelCard
            title="WhatsApp Business"
            hint="Phone number ID and a permanent access token from Meta."
            icon={MessageCircle}
            existing={whatsapp}
            fields={[
              { key: "phoneNumberId", label: "Phone number ID", placeholder: "1234567890" },
              { key: "token", label: "Access token", placeholder: "EAA…", secret: true },
            ]}
            toPlaceholder="+14155550114"
            kind="whatsapp"
            onSaved={refresh}
          />
          <ChannelCard
            title="Email"
            hint="A Gmail OAuth access token with gmail.send."
            icon={Mail}
            existing={email}
            fields={[
              { key: "from", label: "From", placeholder: "front@clinic.example" },
              { key: "token", label: "Access token", placeholder: "ya29…", secret: true },
            ]}
            toPlaceholder="alex@clinic.example"
            kind="email"
            onSaved={refresh}
          />
        </div>
      </PageBody>
    </Page>
  );
}
