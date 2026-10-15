"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Webhook } from "lucide-react";
import { EmptyState, Page, PageBody } from "@/components/app/page";
import { ToolHeader } from "@/components/app/tool-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";

const EVENTS = ["appointment.booked", "lead.created", "form.submitted", "call.completed"];

export default function WebhooksPage() {
  const qc = useQueryClient();
  const hooks = useQuery({ queryKey: ["webhooks"], queryFn: () => api.tools.webhooks() });
  const [name, setName] = useState("Events");
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>([...EVENTS]);
  const add = useMutation({
    mutationFn: () => api.tools.addWebhook({ name, url, events }),
    onSuccess: async (out) => {
      await qc.invalidateQueries({ queryKey: ["webhooks"] });
      setUrl("");
      toast.success("Endpoint saved", { description: `Signing secret: ${out.secret}`, duration: 15000 });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const toggle = (e: string) => setEvents((list) => (list.includes(e) ? list.filter((x) => x !== e) : [...list, e]));

  return (
    <Page>
      <ToolHeader title="Webhooks" description="Bookings, leads, forms, and finished calls, posted as they happen." />
      <PageBody className="p-4 sm:p-6">
        <div className="grid max-w-3xl gap-6">
          <div className="grid gap-3 rounded-2xl bg-raised p-4">
            <label className="grid gap-1.5">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="grid gap-1.5">
              <Label>Endpoint</Label>
              <Input placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
            </label>
            <div className="flex flex-wrap gap-2">
              {EVENTS.map((e) => (
                <button
                  type="button"
                  onClick={() => toggle(e)}
                  className={events.includes(e) ? "rounded-full bg-bg px-3 py-1 text-xs" : "rounded-full px-3 py-1 text-xs text-muted hover:bg-bg"}
                  key={e}
                >
                  {e}
                </button>
              ))}
            </div>
            <Button disabled={add.isPending || !url.trim()} onClick={() => add.mutate()}>
              Add endpoint
            </Button>
          </div>
          {(hooks.data ?? []).length ? (
            <ul className="grid gap-3">
              {(hooks.data ?? []).map((h) => (
                <li className="rounded-2xl bg-bg p-5 shadow-[var(--shadow-border)]" key={h.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{h.name}</p>
                      <p className="mt-1 truncate font-mono text-xs text-muted">{h.url}</p>
                      <p className="mt-2 text-xs text-subtle">{h.events.join(" · ") || "all events"}</p>
                    </div>
                    <Badge tone={h.lastStatus.startsWith("2") ? "live" : h.lastStatus ? "warn" : "draft"}>{h.lastStatus || "idle"}</Badge>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={async () => {
                        try {
                          const out = await api.tools.pingWebhook(h.id);
                          await qc.invalidateQueries({ queryKey: ["webhooks"] });
                          toast.success(`Ping ${out.status}`);
                        } catch (e) {
                          toast.error((e as Error).message);
                        }
                      }}
                    >
                      Ping
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        await api.tools.removeWebhook(h.id);
                        await qc.invalidateQueries({ queryKey: ["webhooks"] });
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={Webhook} title="No endpoints" description="Paste an HTTPS URL. We POST JSON when something happens on the line." />
          )}
        </div>
      </PageBody>
    </Page>
  );
}
