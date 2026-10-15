"use client";

import type { ReactNode } from "react";
import { Button } from "./button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./dialog";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger,
  pending,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  title: ReactNode;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  pending?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(calc(100vw-1.5rem),26rem)]">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription className="mt-2 leading-relaxed">{description}</DialogDescription>
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
          <Button type="button" variant={danger ? "danger" : "primary"} disabled={pending} onClick={onConfirm}>
            {pending ? "Working…" : confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
