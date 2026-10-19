"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { DataTable, Page, PageBody } from "@/components/app/page";
import { ToolHeader } from "@/components/app/tool-header";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { newId } from "@/lib/utils";
import type { FormField } from "@/server/types";

export default function FormEditorPage() {
  const { formId } = useParams<{ formId: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const form = useQuery({ queryKey: ["form", formId], queryFn: () => api.tools.form(formId) });
  const agents = useQuery({ queryKey: ["agents"], queryFn: () => api.agents.list() });
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [agentId, setAgentId] = useState("");
  const [fields, setFields] = useState<FormField[]>([]);
  const [confirm, setConfirm] = useState(false);

  const [loaded, setLoaded] = useState<typeof form.data>();
  if (form.data && form.data !== loaded) {
    setLoaded(form.data);
    setName(form.data.form.name);
    setDescription(form.data.form.description);
    setAgentId(form.data.form.agentId);
    setFields(form.data.form.fields);
  }

  const save = useMutation({
    mutationFn: () => api.tools.saveForm({ id: formId, name, description, agentId, fields, status: "live" }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["form", formId] });
      await qc.invalidateQueries({ queryKey: ["forms"] });
      toast.success("Saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const patch = (i: number, p: Partial<FormField>) => setFields((list) => list.map((f, j) => (j === i ? { ...f, ...p } : f)));

  if (form.isPending) {
    return (
      <Page>
        <div className="p-8 text-sm text-muted">Loading form…</div>
      </Page>
    );
  }
  if (!form.data) {
    return (
      <Page>
        <div className="p-8 text-sm text-muted">This form is gone.</div>
      </Page>
    );
  }
  const link = typeof window !== "undefined" ? `${window.location.origin}/f/${formId}` : `/f/${formId}`;

  return (
    <Page>
      <ToolHeader title={name || "Form"} description={`${form.data.submissions.length} submissions`} back={{ href: "/app/tools/forms", label: "Forms" }}>
        <Button variant="ghost" onClick={() => setConfirm(true)}>
          <Trash2 className="size-4" />
        </Button>
        <Button disabled={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? "Saving…" : "Save"}
        </Button>
      </ToolHeader>
      <PageBody className="p-4 sm:p-6">
        <div className="grid max-w-5xl gap-8 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <div className="grid h-fit gap-4">
            <label className="grid gap-1.5">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="grid gap-1.5">
              <Label>Description</Label>
              <Textarea className="min-h-20" value={description} onChange={(e) => setDescription(e.target.value)} />
            </label>
            <label className="grid gap-1.5">
              <Label>Agent</Label>
              <Select value={agentId || "none"} onValueChange={(v) => setAgentId(v === "none" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {(agents.data ?? []).map((a) => (
                    <SelectItem value={a.id} key={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <div className="rounded-xl bg-raised p-3">
              <p className="text-xs tracking-wide text-subtle uppercase">Share</p>
              <p className="mt-2 font-mono text-xs break-all">{link}</p>
              <div className="mt-2 flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    navigator.clipboard.writeText(link);
                    toast.success("Link copied");
                  }}
                >
                  Copy link
                </Button>
                <Button size="sm" variant="secondary" asChild>
                  <a href={link} target="_blank" rel="noreferrer">
                    Open
                  </a>
                </Button>
              </div>
            </div>
          </div>
          <div className="grid gap-6">
            <div>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Fields</p>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setFields((list) => [...list, { id: newId("fld").slice(0, 10), label: "New field", type: "text", required: false, options: "" }])}
                >
                  Add field
                </Button>
              </div>
              <ul className="mt-3 grid gap-2">
                {fields.map((f, i) => (
                  <li className="grid gap-2 rounded-xl bg-raised p-3 sm:grid-cols-[minmax(0,1fr)_8rem_auto]" key={f.id}>
                    <Input value={f.label} onChange={(e) => patch(i, { label: e.target.value })} />
                    <Select value={f.type} onValueChange={(v) => patch(i, { type: v as FormField["type"] })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="text">Text</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="phone">Phone</SelectItem>
                        <SelectItem value="textarea">Long text</SelectItem>
                        <SelectItem value="select">Choice</SelectItem>
                      </SelectContent>
                    </Select>
                    <button type="button" className="text-sm text-muted hover:text-fg" onClick={() => setFields((list) => list.filter((_, j) => j !== i))}>
                      ×
                    </button>
                    {f.type === "select" ? (
                      <Input className="sm:col-span-3" placeholder="Option A, Option B" value={f.options} onChange={(e) => patch(i, { options: e.target.value })} />
                    ) : null}
                    <label className="flex items-center gap-2 text-xs text-muted sm:col-span-3">
                      <input type="checkbox" checked={f.required} onChange={(e) => patch(i, { required: e.target.checked })} />
                      Required
                    </label>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-sm font-medium">Submissions</p>
              {form.data.submissions.length ? (
                <DataTable columns={["When", "Name", "Contact"]} colsClass="sm:grid-cols-[10rem_minmax(0,1fr)_10rem]">
                  {form.data.submissions.map((s) => (
                    <li className="grid items-center gap-2 px-4 py-3 sm:grid-cols-[10rem_minmax(0,1fr)_10rem] sm:px-6" key={s.id}>
                      <span className="text-xs text-subtle">{new Date(s.createdAt).toLocaleString()}</span>
                      <span className="truncate text-sm">{s.name || "—"}</span>
                      <span className="truncate font-mono text-xs">{s.contact || "—"}</span>
                    </li>
                  ))}
                </DataTable>
              ) : (
                <p className="mt-3 text-sm text-muted">None yet. Open the share link to try it.</p>
              )}
            </div>
          </div>
        </div>
      </PageBody>
      <ConfirmDialog
        open={confirm}
        title="Delete this form?"
        description="Submissions go with it."
        confirmLabel="Delete"
        danger
        onOpenChange={setConfirm}
        onConfirm={async () => {
          await api.tools.removeForm(formId);
          await qc.invalidateQueries({ queryKey: ["forms"] });
          router.push("/app/tools/forms");
        }}
      />
    </Page>
  );
}
