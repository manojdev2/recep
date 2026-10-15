"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Columns3 } from "lucide-react";
import { EmptyState, Page, PageBody } from "@/components/app/page";
import { ToolHeader } from "@/components/app/tool-header";
import { Input } from "@/components/ui/input";
import { api, type ApiResult } from "@/lib/api";
import type { LeadStatus } from "@/server/types";

type Lead = ApiResult<"outcomes", "leads">[number];

const STAGES: { id: LeadStatus; label: string }[] = [
  { id: "new", label: "New" },
  { id: "qualified", label: "Qualified" },
  { id: "won", label: "Won" },
  { id: "lost", label: "Lost" },
];

function Card({ lead, onMove }: { lead: Lead; onMove: (s: LeadStatus) => void }) {
  return (
    <li className="rounded-xl bg-bg p-3 shadow-[var(--shadow-border)]">
      <p className="truncate text-sm font-medium">{lead.name || "Untitled"}</p>
      <p className="mt-0.5 truncate text-xs text-muted">{lead.company || lead.contact || lead.agentName}</p>
      {lead.interest ? <p className="mt-2 line-clamp-2 text-xs text-subtle">{lead.interest}</p> : null}
      <div className="mt-2 flex flex-wrap gap-1">
        {STAGES.filter((s) => s.id !== lead.status).map((s) => (
          <button type="button" className="rounded-full px-2 py-0.5 text-xs text-muted hover:bg-raised hover:text-fg" onClick={() => onMove(s.id)} key={s.id}>
            {s.label}
          </button>
        ))}
      </div>
    </li>
  );
}

export default function CrmPage() {
  const qc = useQueryClient();
  const leads = useQuery({ queryKey: ["leads"], queryFn: () => api.outcomes.leads() });
  const [filter, setFilter] = useState("");
  const move = useMutation({
    mutationFn: (input: { id: string; status: LeadStatus }) => api.tools.setLeadStatus(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leads"] }),
  });
  const rows = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const all = leads.data ?? [];
    return q ? all.filter((l) => [l.name, l.contact, l.company, l.interest, l.agentName].join(" ").toLowerCase().includes(q)) : all;
  }, [leads.data, filter]);
  const inStage = (id: LeadStatus) => (id === "new" ? rows.filter((l) => l.status === "new" || !STAGES.some((s) => s.id === l.status)) : rows.filter((l) => l.status === id));

  return (
    <Page>
      <ToolHeader title="Quick CRM" description="Leads the agents captured. Move them across the board.">
        <Input className="max-w-xs" placeholder="Filter" value={filter} onChange={(e) => setFilter(e.target.value)} />
      </ToolHeader>
      <PageBody className="overflow-x-auto p-4 sm:p-6">
        {rows.length === 0 && !leads.isPending ? (
          <EmptyState icon={Columns3} title="No leads yet" description="Talk to a sales or support agent. Captured names land on this board." />
        ) : (
          <div className="grid max-w-6xl grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {STAGES.map((s) => (
              <section className="min-h-64 rounded-2xl bg-raised p-3" key={s.id}>
                <p className="px-1 text-xs tracking-wide text-subtle uppercase">
                  {s.label} · {inStage(s.id).length}
                </p>
                <ul className="mt-3 grid gap-2">
                  {inStage(s.id).map((l) => (
                    <Card lead={l} onMove={(status) => move.mutate({ id: l.id, status })} key={l.id} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </PageBody>
    </Page>
  );
}
