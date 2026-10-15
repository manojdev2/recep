"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Link2 } from "lucide-react";
import { EmptyState, Page, PageBody } from "@/components/app/page";
import { ToolHeader } from "@/components/app/tool-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";

export default function IncomingPage() {
  const qc = useQueryClient();
  const phones = useQuery({ queryKey: ["phones"], queryFn: () => api.agents.phones() });
  const agents = useQuery({ queryKey: ["agents"], queryFn: () => api.agents.list() });
  const add = useMutation({
    mutationFn: () => api.agents.addTestNumber({ label: "Inbound line" }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["phones"] });
      toast.success("Number ready");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Page>
      <ToolHeader title="Incoming connections" description="Each number answers with one agent.">
        <Button variant="secondary" onClick={() => add.mutate()} disabled={add.isPending}>
          New number
        </Button>
      </ToolHeader>
      <PageBody className="p-4 sm:p-6">
        {(phones.data ?? []).length ? (
          <ul className="grid max-w-3xl gap-3">
            {(phones.data ?? []).map((n) => (
              <li
                className="flex flex-col gap-3 rounded-2xl bg-bg p-4 shadow-[var(--shadow-border)] sm:flex-row sm:flex-wrap sm:items-center sm:p-5"
                key={n.id}
              >
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-sm tabular-nums">{n.e164}</p>
                  <p className="text-xs text-subtle">{n.label || n.provider}</p>
                </div>
                <Badge tone={n.status === "active" ? "live" : "warn"}>{n.status}</Badge>
                <Select
                  value={n.agentId || "none"}
                  onValueChange={async (v) => {
                    await api.agents.assignNumber({ id: n.id, agentId: v === "none" ? null : v });
                    await qc.invalidateQueries({ queryKey: ["phones"] });
                    toast.success("Routed");
                  }}
                >
                  <SelectTrigger className="w-full min-w-0 sm:w-48">
                    <SelectValue placeholder="Agent" />
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
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={Link2}
            title="No numbers"
            description="Try it with a test number, or import a Twilio or Plivo number from Phone."
            action={<Button onClick={() => add.mutate()}>New number</Button>}
          />
        )}
      </PageBody>
    </Page>
  );
}
