"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Mark } from "@/components/mark";
import { FormSkeleton } from "@/components/app/skeletons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";

export default function PublicFormPage() {
  const { formId } = useParams<{ formId: string }>();
  const form = useQuery({ queryKey: ["public-form", formId], queryFn: () => api.tools.publicForm(formId) });
  const [values, setValues] = useState<Record<string, string>>({});
  const [sent, setSent] = useState(false);
  const submit = useMutation({
    mutationFn: () => api.tools.submitForm({ formId, values }),
    onSuccess: () => setSent(true),
  });

  if (form.isPending) return <FormSkeleton lines={4} />;
  const f = form.data;
  if (!f) {
    return (
      <div className="grid min-h-dvh place-items-center bg-bg px-6 text-center">
        <div className="max-w-sm">
          <Mark className="mx-auto size-10" />
          <p className="mt-6 text-xl font-medium tracking-tight">This form is closed</p>
          <Button asChild className="mt-6">
            <Link href="/">Back</Link>
          </Button>
        </div>
      </div>
    );
  }

  const set = (id: string, v: string) => setValues({ ...values, [id]: v });
  return (
    <div className="min-h-dvh bg-bg px-4 py-16">
      <div className="mx-auto max-w-md">
        <Mark className="size-8" />
        <h1 className="mt-6 text-2xl font-medium tracking-tight">{f.name}</h1>
        {f.description ? <p className="mt-2 text-sm leading-relaxed text-muted">{f.description}</p> : null}
        {sent ? (
          <p className="mt-8 rounded-2xl bg-raised px-4 py-6 text-sm">Received. Someone will follow up if needed.</p>
        ) : (
          <form
            className="mt-8 grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              submit.mutate();
            }}
          >
            {f.fields.map((field) => (
              <label className="grid gap-1.5" key={field.id}>
                <Label>
                  {field.label}
                  {field.required ? "" : " (optional)"}
                </Label>
                {field.type === "textarea" ? (
                  <Textarea required={field.required} value={values[field.id] ?? ""} onChange={(e) => set(field.id, e.target.value)} />
                ) : field.type === "select" ? (
                  <select
                    required={field.required}
                    className="h-11 rounded-lg border-0 bg-raised px-3 text-sm"
                    value={values[field.id] ?? ""}
                    onChange={(e) => set(field.id, e.target.value)}
                  >
                    <option value="">Choose</option>
                    {field.options.split(",").map((o) => (
                      <option value={o.trim()} key={o.trim()}>
                        {o.trim()}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    type={field.type === "email" ? "email" : field.type === "phone" ? "tel" : "text"}
                    required={field.required}
                    value={values[field.id] ?? ""}
                    onChange={(e) => set(field.id, e.target.value)}
                  />
                )}
              </label>
            ))}
            {submit.error ? <p className="text-sm text-muted">{submit.error.message}</p> : null}
            <Button type="submit" disabled={submit.isPending}>
              {submit.isPending ? "Sending…" : "Submit"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
