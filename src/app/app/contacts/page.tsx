"use client";

import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, FileUp, Users } from "lucide-react";
import { DataTable, EmptyState, Page, PageBody, PageHeader } from "@/components/app/page";
import { TableSkeleton } from "@/components/app/skeletons";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";

const COLUMNS = ["Name", "Phone", "Email", "Company", "Notes"];

type Editing = { id?: string; name?: string; e164?: string; email?: string; company?: string; notes?: string; tags?: string };

function template() {
  return [
    COLUMNS.join(","),
    "Alex Rivera,+14155550114,alex@northclinic.example,North Clinic,Prefers mornings",
    "Priya Shah,+919876543210,priya@example.com,Shah Dental,",
    "",
  ].join("\n");
}

function download(name: string, body: string, type: string) {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ContactsPage() {
  const qc = useQueryClient();
  const contacts = useQuery({ queryKey: ["contacts"], queryFn: () => api.contacts.list() });
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Editing | null>(null);
  const [importing, setImporting] = useState(false);
  const [paste, setPaste] = useState("");
  const [removing, setRemoving] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["contacts"] });
    await qc.invalidateQueries({ queryKey: ["campaign"] });
  };

  function reportImport(r: { added: number; skipped: number; missingCountryCode: number }) {
    toast.success(`${r.added} contact${r.added === 1 ? "" : "s"} imported`);
    if (r.missingCountryCode) {
      toast.error(
        `${r.missingCountryCode} row${r.missingCountryCode === 1 ? "" : "s"} skipped — no country code. Write numbers as +91… or +1…`,
        { duration: 8000 },
      );
    } else if (r.skipped) {
      toast.error(`${r.skipped} row${r.skipped === 1 ? "" : "s"} skipped — no usable phone number`);
    }
  }

  async function uploadFile(file?: File) {
    if (!file) return;
    try {
      if (/\.xlsx$/i.test(file.name)) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        let s = "";
        for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode(...bytes.subarray(i, i + 8192));
        reportImport(await api.contacts.import({ xlsxBase64: btoa(s) }));
      } else {
        reportImport(await api.contacts.import({ text: await file.text() }));
      }
      setImporting(false);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not read that file");
    }
    if (fileInput.current) fileInput.current.value = "";
  }

  const rows = useMemo(() => {
    const all = contacts.data ?? [];
    const q = search.trim().toLowerCase();
    return q ? all.filter((c) => [c.name, c.e164, c.email, c.company, c.notes, c.tags].join(" ").toLowerCase().includes(q)) : all;
  }, [contacts.data, search]);

  const save = useMutation({
    mutationFn: (c: Editing) =>
      api.contacts.save({ id: c.id, name: c.name ?? "", e164: c.e164 ?? "", email: c.email, company: c.company, notes: c.notes, tags: c.tags }),
    onSuccess: async () => {
      await refresh();
      setEditing(null);
      toast.success("Saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const importPaste = useMutation({
    mutationFn: () => api.contacts.import({ text: paste }),
    onSuccess: async (r) => {
      await refresh();
      setImporting(false);
      setPaste("");
      reportImport(r);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.contacts.remove(id),
    onSuccess: async () => {
      await refresh();
      setRemoving(null);
      setEditing(null);
      toast.success("Removed");
    },
  });

  function exportCsv() {
    const lines = [
      "Name,Phone,Email,Company,Notes,Tags",
      ...(contacts.data ?? []).map((c) => [c.name, c.e164, c.email, c.company, c.notes, c.tags].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")),
    ];
    download("azentoo-contacts.csv", lines.join("\n"), "text/csv;charset=utf-8");
  }

  if (contacts.isPending) {
    return (
      <TableSkeleton title="Your people" description="A familiar face behind every conversation." columns={["Name", "Phone", "Company", "Email"]} rows={6} />
    );
  }

  return (
    <Page>
      <PageHeader
        title="Your people"
        description="Keep your customers close. Add someone new or bring your contact list along."
        actions={
          <>
            <Button variant="secondary" onClick={() => setImporting(true)}>
              Import
            </Button>
            <Button variant="secondary" onClick={exportCsv} disabled={!contacts.data?.length}>
              <Download className="size-4" />
              Export
            </Button>
            <Button onClick={() => setEditing({ name: "", e164: "", email: "", company: "", notes: "", tags: "" })}>Add contact</Button>
          </>
        }
      />
      <div className="border-b border-border px-4 py-3 sm:px-6">
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, number, company" className="max-w-md" />
      </div>
      <PageBody>
        {rows.length ? (
          <DataTable columns={["Name", "Phone", "Company", "Email"]} colsClass="sm:grid-cols-[minmax(0,14rem)_11rem_minmax(0,1fr)_minmax(0,14rem)]">
            {rows.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className="grid w-full items-center gap-1 px-4 py-3.5 text-left hover:bg-raised sm:grid-cols-[minmax(0,14rem)_11rem_minmax(0,1fr)_minmax(0,14rem)] sm:gap-3 sm:px-6"
                  onClick={() => setEditing(c)}
                >
                  <span>
                    <span className="block truncate text-sm font-medium">{c.name || "—"}</span>
                    {c.tags ? <span className="block truncate text-xs text-subtle">{c.tags}</span> : null}
                  </span>
                  <span className="font-mono text-sm tabular-nums">{c.e164}</span>
                  <span className="hidden truncate text-sm text-muted sm:block">{c.company || "—"}</span>
                  <span className="hidden truncate text-sm text-muted sm:block">{c.email || "—"}</span>
                </button>
              </li>
            ))}
          </DataTable>
        ) : (
          <EmptyState
            icon={Users}
            title="No contacts yet"
            description="Start with one person or import your existing list. Your contacts will be ready when you reach out."
            action={<Button onClick={() => setEditing({ name: "", e164: "" })}>Add contact</Button>}
          />
        )}
      </PageBody>
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogTitle>{editing?.id ? "Edit contact" : "New contact"}</DialogTitle>
          <DialogDescription>Stored in your workspace. Campaigns can dial them.</DialogDescription>
          {editing ? (
            <form
              className="mt-4 grid gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                save.mutate(editing);
              }}
            >
              <label className="grid gap-1.5">
                <Label>Name</Label>
                <Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </label>
              <label className="grid gap-1.5">
                <Label>Phone</Label>
                <Input value={editing.e164 ?? ""} onChange={(e) => setEditing({ ...editing, e164: e.target.value })} required placeholder="+1…" />
              </label>
              <label className="grid gap-1.5">
                <Label>Email</Label>
                <Input value={editing.email ?? ""} onChange={(e) => setEditing({ ...editing, email: e.target.value })} />
              </label>
              <label className="grid gap-1.5">
                <Label>Company</Label>
                <Input value={editing.company ?? ""} onChange={(e) => setEditing({ ...editing, company: e.target.value })} />
              </label>
              <label className="grid gap-1.5">
                <Label>Notes</Label>
                <Textarea className="min-h-20" value={editing.notes ?? ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
              </label>
              <div className="flex justify-between gap-2">
                {editing.id ? (
                  <Button type="button" variant="ghost" onClick={() => setRemoving(editing.id ?? null)}>
                    Delete
                  </Button>
                ) : (
                  <span />
                )}
                <div className="flex gap-2">
                  <Button type="button" variant="secondary" onClick={() => setEditing(null)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={save.isPending}>
                    {save.isPending ? "Saving…" : "Save"}
                  </Button>
                </div>
              </div>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
      <Dialog open={importing} onOpenChange={setImporting}>
        <DialogContent className="max-w-md">
          <DialogTitle>Import contacts</DialogTitle>
          <DialogDescription>Upload a spreadsheet, or paste one person per line.</DialogDescription>
          <div className="mt-4 grid gap-2 rounded-xl bg-raised p-3">
            <p className="text-sm font-medium">Start from the template</p>
            <p className="text-xs text-muted">{COLUMNS.join(" · ")}. Opens in Excel, Numbers or Sheets.</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => download("azentoo-contacts-template.csv", "﻿" + template(), "text/csv;charset=utf-8")}>
                <Download className="size-3.5" />
                Download template
              </Button>
              <Button size="sm" variant="secondary" onClick={() => fileInput.current?.click()}>
                <FileUp className="size-3.5" />
                Upload filled file
              </Button>
            </div>
            <input ref={fileInput} type="file" accept=".csv,.xlsx,.tsv,.txt,text/csv" className="hidden" onChange={(e) => void uploadFile(e.target.files?.[0])} />
          </div>
          <p className="mt-4 text-xs text-subtle">Or paste it</p>
          <Textarea
            className="mt-1 min-h-28 font-mono text-xs"
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            placeholder="Alex Rivera, +14155550114, alex@clinic.example, North Clinic"
          />
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setImporting(false)}>
              Cancel
            </Button>
            <Button disabled={importPaste.isPending || !paste.trim()} onClick={() => importPaste.mutate()}>
              {importPaste.isPending ? "Importing…" : "Import"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={!!removing}
        title="Remove this contact?"
        description="Campaigns that already include them keep the number."
        confirmLabel="Remove"
        danger
        pending={remove.isPending}
        onOpenChange={(o) => !o && setRemoving(null)}
        onConfirm={() => removing && remove.mutate(removing)}
      />
    </Page>
  );
}
