import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-xl bg-surface px-3 text-sm text-fg shadow-[var(--shadow-border)] outline-none transition-[box-shadow] duration-150 placeholder:text-subtle focus-visible:shadow-[0_0_0_1px_var(--color-accent)]",
        className,
      )}
      {...props}
    />
  );
}
