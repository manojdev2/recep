"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ClipboardList } from "lucide-react";
import { EmptyState, Page, PageBody } from "@/components/app/page";
import { ToolHeader } from "@/components/app/tool-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

export default function FormsPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const forms = useQuery({ queryKey: ["forms"], queryFn: () => api.tools.forms() });
  const create = useMutation({
    mutationFn: () =>
      api.tools.saveForm({
        name: "New form",
        description: "",
        fields: [
          { id: "name", label: "Name", type: "text", required: true, options: "" },
          { id: "phone", label: "Phone", type: "phone", required: true, options: "" },
        ],
      }),
    onSuccess: async (f) => {
      await qc.invalidateQueries({ queryKey: ["forms"] });
      router.push(`/app/tools/forms/${f.id}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Page>
      <ToolHeader title="Forms" description="Collect from contacts and leads. Submissions land here.">
        <Button onClick={() => create.mutate()} disabled={create.isPending}>
          New form
        </Button>
      </ToolHeader>
      <PageBody>
        {(forms.data ?? []).length ? (
          <ul className="grid gap-3 p-4 sm:grid-cols-2 sm:p-6 xl:grid-cols-3">
            {(forms.data ?? []).map((f) => (
              <li key={f.id}>
                <Link
                  href={`/app/tools/forms/${f.id}`}
                  className="block h-full rounded-2xl bg-bg p-5 shadow-[var(--shadow-border)] hover:shadow-[var(--shadow-border-hover)]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-lg font-medium tracking-tight">{f.name}</p>
                    <Badge tone={f.status === "live" ? "live" : "draft"}>{f.status}</Badge>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-muted">{f.description || "No description"}</p>
                  <p className="mt-4 text-xs text-subtle">
                    {f.fields.length} fields · {f.submissions} submission{f.submissions === 1 ? "" : "s"}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={ClipboardList}
            title="No forms yet"
            description="Build a short intake. Share the link, or let an agent send it."
            action={<Button onClick={() => create.mutate()}>New form</Button>}
          />
        )}
      </PageBody>
    </Page>
  );
}
