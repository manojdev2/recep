"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BookOpen, FileUp, Globe, Link2 } from "lucide-react";
import { EmptyState, Page, PageBody, PageHeader } from "@/components/app/page";
import { TableSkeleton } from "@/components/app/skeletons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, type ApiResult } from "@/lib/api";
import { KNOWLEDGE_ACCEPT, KNOWLEDGE_TYPES, uploadKnowledgeFiles } from "@/lib/knowledge-upload";

type Doc = ApiResult<"knowledge", "library">[number];
type AgentOption = { id: string; name: string };

export default function KnowledgePage() {
  const qc = useQueryClient();
  const library = useQuery({ queryKey: ["knowledge-lib"], queryFn: () => api.knowledge.library() });
  const agents = useQuery({ queryKey: ["agents"], queryFn: () => api.agents.list() });
  const fileInput = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [removing, setRemoving] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [hits, setHits] = useState<{ title: string; snippet: string }[] | null>(null);

  const add = useMutation({
    mutationFn: (input: { source: "url"; url: string } | { source: "paste"; title: string; content: string }) => api.knowledge.add(input),
    onSuccess: async (doc) => {
      await qc.invalidateQueries({ queryKey: ["knowledge-lib"] });
      toast.success(`Added ${doc.title}`);
      setUrl("");
      setTitle("");
      setBody("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    const { added, errors } = await uploadKnowledgeFiles(files);
    for (const e of errors) toast.error(e);
    if (added) {
      await qc.invalidateQueries({ queryKey: ["knowledge-lib"] });
      toast.success(`${added} file${added === 1 ? "" : "s"} in the library`);
    }
  }

  if (library.isPending) {
    return (
      <TableSkeleton
        title="Business knowledge"
        description="Everything your receptionist should know about your business."
        columns={["Document", "Source", "Receptionists"]}
        rows={5}
      />
    );
  }

  return (
    <Page>
      <PageHeader title="Business knowledge" description="Share your services, opening hours, and helpful answers. Your receptionist will take it from there." />
      <PageBody className="px-4 py-6 sm:px-6">
        <div className="grid max-w-5xl gap-8 lg:grid-cols-[20rem_minmax(0,1fr)]">
          <div className="grid h-fit gap-5">
            <section className="grid gap-3 rounded-2xl bg-raised p-4">
              <p className="flex items-center gap-2 text-sm font-medium">
                <Globe className="size-4 text-muted" />
                From your website
              </p>
              <Input placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
              <Button disabled={add.isPending || !url.trim()} onClick={() => add.mutate({ url, source: "url" })}>
                {add.isPending ? "Fetching…" : "Add website"}
              </Button>
            </section>
            <section className="grid gap-3 rounded-2xl bg-raised p-4">
              <p className="flex items-center gap-2 text-sm font-medium">
                <FileUp className="size-4 text-muted" />
                Upload documents
              </p>
              <p className="text-xs text-muted">{KNOWLEDGE_TYPES} — as many as you like.</p>
              <input ref={fileInput} type="file" multiple accept={KNOWLEDGE_ACCEPT} className="hidden" onChange={(e) => void upload(e.target.files)} />
              <Button variant="secondary" onClick={() => fileInput.current?.click()}>
                Choose files
              </Button>
            </section>
            <section className="grid gap-3 rounded-2xl bg-raised p-4">
              <p className="text-sm font-medium">A helpful note</p>
              <label className="grid gap-1.5">
                <Label>Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </label>
              <Textarea className="min-h-28" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Policy, FAQ, menu…" />
              <Button
                variant="secondary"
                disabled={add.isPending || !title.trim() || !body.trim()}
                onClick={() => add.mutate({ title, content: body, source: "paste" })}
              >
                Add note
              </Button>
            </section>
            <section className="grid gap-3 rounded-2xl bg-raised p-4">
              <p className="text-sm font-medium">Try a customer question</p>
              <p className="text-xs text-muted">See which information helps answer a question your customers might ask.</p>
              <Textarea className="min-h-20" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="What time do you open on Saturday?" />
              <Button
                variant="secondary"
                disabled={!question.trim() || add.isPending}
                onClick={async () => {
                  try {
                    const out = await api.knowledge.search({ query: question });
                    setHits(out.hits);
                    if (!out.hits.length) toast.error("Nothing in the library matches that.");
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Could not search");
                  }
                }}
              >
                Ask
              </Button>
              {hits?.length ? (
                <ul className="grid gap-2">
                  {hits.map((h) => (
                    <li className="rounded-xl bg-bg px-3 py-2" key={h.title + h.snippet}>
                      <p className="text-xs font-medium">{h.title}</p>
                      <p className="mt-1 text-xs leading-relaxed text-muted">{h.snippet}</p>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          </div>
          <div>
            {(library.data ?? []).length === 0 ? (
              <EmptyState
                icon={BookOpen}
                title="Let’s get to know your business"
                description="Add a website, document, or a simple note. Then choose which receptionists can use it."
              />
            ) : (
              <ul className="grid gap-3">
                {(library.data ?? []).map((d) => (
                  <DocCard
                    doc={d}
                    agents={agents.data ?? []}
                    onAttach={async (agentId, attached) => {
                      await api.knowledge.attach({ docId: d.id, agentId, attached });
                      await qc.invalidateQueries({ queryKey: ["knowledge-lib"] });
                      await qc.invalidateQueries({ queryKey: ["agent"] });
                    }}
                    onDelete={() => setRemoving(d.id)}
                    key={d.id}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
      </PageBody>
      <ConfirmDialog
        open={!!removing}
        title="Delete this document?"
        description="Your receptionists will no longer be able to use this information."
        confirmLabel="Delete"
        danger
        onOpenChange={(o) => !o && setRemoving(null)}
        onConfirm={async () => {
          if (!removing) return;
          await api.knowledge.remove(removing);
          await qc.invalidateQueries({ queryKey: ["knowledge-lib"] });
          await qc.invalidateQueries({ queryKey: ["agent"] });
          setRemoving(null);
        }}
      />
    </Page>
  );
}

function DocCard({
  doc,
  agents,
  onAttach,
  onDelete,
}: {
  doc: Doc;
  agents: AgentOption[];
  onAttach: (agentId: string, attached: boolean) => Promise<void>;
  onDelete: () => void;
}) {
  const on = new Set(doc.agentIds ?? []);
  return (
    <li className="rounded-2xl bg-bg p-5 shadow-[var(--shadow-border)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{doc.title}</p>
          <p className="mt-1 flex items-center gap-2 text-xs text-subtle">
            {doc.source === "url" ? (
              <>
                <Globe className="size-3" />
                <span className="truncate break-all">{doc.sourceUrl}</span>
              </>
            ) : doc.source === "file" ? (
              <>
                <FileUp className="size-3" />
                {doc.filename || "file"}
              </>
            ) : (
              "Note"
            )}
          </p>
        </div>
        <Badge tone={doc.stale ? "warn" : "mute"}>{doc.stale ? "stale" : doc.source}</Badge>
      </div>
      <p className="mt-3 line-clamp-3 text-sm break-words text-muted">{doc.content}</p>
      <div className="mt-4">
        <p className="mb-2 flex items-center gap-1 text-xs tracking-wide text-subtle uppercase">
          <Link2 className="size-3" />
          Receptionists who can use this
        </p>
        <div className="flex flex-wrap gap-1.5">
          {agents.map((a) => {
            const attached = on.has(a.id);
            return (
              <button
                type="button"
                onClick={() => void onAttach(a.id, !attached)}
                className={attached ? "rounded-full bg-raised px-2.5 py-1 text-xs" : "rounded-full px-2.5 py-1 text-xs text-muted hover:bg-raised hover:text-fg"}
                key={a.id}
              >
                {a.name}
              </button>
            );
          })}
          {agents.length === 0 ? <span className="text-xs text-muted">Create an agent first.</span> : null}
        </div>
      </div>
      <button type="button" className="mt-3 text-xs text-muted hover:text-fg" onClick={onDelete}>
        Delete
      </button>
    </li>
  );
}
