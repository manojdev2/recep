"use client";

import { useMemo, useState } from "react";
import { AppMark } from "@/components/brand-marks";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { findConnector } from "@/lib/catalog";

export type ConnectInput = { appKey: string; accountLabel: string; config: Record<string, string> };

export function ConnectorDialog({
  appKey,
  pending,
  error,
  onOpenChange,
  onSubmit,
}: {
  appKey: string | null;
  pending: boolean;
  error?: string | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: ConnectInput) => void;
}) {
  const def = appKey ? findConnector(appKey) : undefined;
  const [label, setLabel] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const complete = useMemo(() => (def ? def.fields.filter((f) => f.required).every((f) => (values[f.key] ?? "").trim()) : false), [def, values]);

  return (
    <Dialog
      open={!!appKey}
      onOpenChange={(open) => {
        if (!open) {
          setLabel("");
          setValues({});
        }
        onOpenChange(open);
      }}
    >
      <DialogContent>
        {def ? (
          <>
            <div className="flex items-center gap-3 pr-8">
              <AppMark appKey={def.key} />
              <div className="min-w-0">
                <DialogTitle className="text-lg">Connect {def.name}</DialogTitle>
                <DialogDescription className="mt-1">{def.help}</DialogDescription>
              </div>
            </div>
            <form
              className="mt-5 grid gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (def && complete) onSubmit({ appKey: def.key, accountLabel: label.trim(), config: values });
              }}
            >
              <label className="grid gap-1.5">
                <span className="text-sm text-muted">{def.key === "mcp" ? "Name" : "Account label"}</span>
                <Input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder={def.key === "mcp" ? "Internal tools" : def.key === "stripe" ? "Live account" : "you@company.com"}
                />
              </label>
              {def.fields.map((f) => (
                <label className="grid gap-1.5" key={f.key}>
                  <span className="text-sm text-muted">{f.label}</span>
                  <Input
                    type={f.secret ? "password" : "text"}
                    autoComplete="off"
                    spellCheck={false}
                    value={values[f.key] ?? ""}
                    onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    required={f.required}
                  />
                </label>
              ))}
              <Button type="submit" disabled={pending || !complete} className="mt-1">
                {pending ? "Checking…" : "Connect"}
              </Button>
              {error ? <p className="text-sm text-danger">{error}</p> : null}
              <p className="text-xs leading-relaxed text-subtle">
                Tokens stay on this workspace and are used only when this agent calls the provider. Azentoo verifies the credential against the live
                API before saving.
              </p>
            </form>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
