import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium tabular-nums", {
  variants: {
    tone: {
      mute: "bg-raised text-muted",
      live: "bg-live/15 text-live",
      warn: "bg-warn/15 text-warn",
      draft: "bg-raised text-subtle",
    },
  },
  defaultVariants: { tone: "mute" },
});

export function Badge({
  className,
  tone,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
