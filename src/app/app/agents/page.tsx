"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Lock, Plus } from "lucide-react";
import { FirstRun } from "@/components/app/first-run";
import { Page, PageBody, PageHeader } from "@/components/app/page";
import { AgentsSkeleton } from "@/components/app/skeletons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VoicePortrait } from "@/components/voice-portrait";
import { api, type ApiResult } from "@/lib/api";
import { JOBS, VOICES } from "@/lib/catalog";
import { toastError } from "@/lib/plan-limit";

type AgentRow = ApiResult<"agents", "list">[number];

const tone = (s: string) => (s === "live" ? "live" : s === "paused" ? "warn" : "draft") as "live" | "warn" | "draft";
const voiceName = (id: string) => VOICES.find((v) => v.id === id)?.name ?? id;

export default function AgentsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const agentsQuery = useQuery({ queryKey: ["agents"], queryFn: () => api.agents.list() });
  const accountQuery = useQuery({ queryKey: ["account"], queryFn: () => api.account.get() });
  const seePlans = () => router.push("/app/settings/billing");
  const create = useMutation({
    mutationFn: (templateKey: string) => api.agents.create({ templateKey }),
    onSuccess: async (agent) => {
      await qc.invalidateQueries({ queryKey: ["agents"] });
      await qc.invalidateQueries({ queryKey: ["workspace"] });
      await qc.invalidateQueries({ queryKey: ["account"] });
      router.push(`/app/agents/${agent.id}`);
    },
    onError: (e: Error) => toastError(e, seePlans),
  });

  if (agentsQuery.isPending) return <AgentsSkeleton />;
  if (agentsQuery.isError) {
    return (
      <Page>
        <PageHeader
          title="My receptionists"
          description="A familiar voice for every part of your business."
          actions={
            <Button asChild>
              <Link href="/app/new">
                <Plus className="size-4" />
                Add receptionist
              </Link>
            </Button>
          }
        />
        <PageBody className="p-4 sm:p-6">
          <p className="text-sm text-muted">Couldn’t load receptionists. Refresh the page.</p>
        </PageBody>
      </Page>
    );
  }

  const agents = agentsQuery.data ?? [];
  const empty = agents.length === 0;
  const plan = accountQuery.data?.usage.plan;
  const atLimit = !!(plan && plan.agents < 1e6 && agents.length >= plan.agents);

  return (
    <Page>
      <PageHeader
        title={empty ? "Meet your first receptionist" : "My receptionists"}
        description={empty ? "Tell us what you need a hand with. We’ll help you get started." : "A familiar voice for every part of your business."}
        actions={
          empty ? null : atLimit && plan ? (
            <Button asChild variant="secondary" title={`${plan.name} includes ${plan.agents} receptionist${plan.agents === 1 ? "" : "s"}`}>
              <Link href="/app/settings/billing">
                <Lock className="size-4" />
                Upgrade to add another
              </Link>
            </Button>
          ) : (
            <Button asChild>
              <Link href="/app/new">
                <Plus className="size-4" />
                Add receptionist
              </Link>
            </Button>
          )
        }
      />
      <PageBody className="p-4 sm:p-6">
        {empty ? (
          <FirstRun onPick={(key) => create.mutate(key)} pending={create.isPending} />
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {agents.map((a) => (
              <li key={a.id}>
                <AgentCard agent={a} />
              </li>
            ))}
          </ul>
        )}
      </PageBody>
    </Page>
  );
}

function AgentCard({ agent }: { agent: AgentRow }) {
  async function share() {
    await navigator.clipboard.writeText(`${window.location.origin}/w/${agent.id}`);
    toast.success(agent.status === "live" ? "Link copied" : "Preview link copied");
  }
  return (
    <article className="receptionist-card flex h-full flex-col rounded-2xl border border-border bg-surface p-6 transition-[box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <VoicePortrait id={agent.voiceId} size={64} />
        <Badge tone={tone(agent.status)}>{agent.status === "live" ? "Ready" : agent.status === "draft" ? "Getting ready" : "On a break"}</Badge>
      </div>
      <h2 className="mt-5 truncate text-xl font-semibold tracking-tight">{agent.name}</h2>
      <p className="mt-1 line-clamp-2 min-h-10 text-sm leading-relaxed text-muted">
        {agent.tagline || agent.description || "Ready for a personal touch."}
      </p>
      <p className="mt-4 text-xs text-subtle">
        {JOBS.find((j) => j.id === agent.job)?.label ?? agent.job} · {voiceName(agent.voiceId)} · {agent.language.toUpperCase()}
        {agent.phoneE164 ? ` · ${agent.phoneE164}` : ""}
        {agent.rehearsal ? ` · practice ${agent.rehearsal.passed}/${agent.rehearsal.total}` : ""}
      </p>
      <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-5">
        <Button asChild size="sm">
          <Link href={`/app/agents/${agent.id}`}>Meet & manage</Link>
        </Button>
        <Button size="sm" variant="secondary" onClick={() => void share()}>
          Share
        </Button>
      </div>
    </article>
  );
}
