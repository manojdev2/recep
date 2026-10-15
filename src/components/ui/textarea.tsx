import * as React from "react";
import { cn } from "@/lib/utils";

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "min-h-32 w-full resize-y rounded-xl bg-surface px-3 py-2.5 text-sm leading-relaxed text-fg shadow-[var(--shadow-border)] outline-none transition-[box-shadow] duration-150 placeholder:text-subtle focus-visible:shadow-[0_0_0_1px_var(--color-accent)]",
        className,
      )}
      {...props}
    />
  );
}
