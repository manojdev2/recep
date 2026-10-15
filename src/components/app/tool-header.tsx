import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";

export function ToolHeader({
  title,
  description,
  back = { href: "/app/apps", label: "Apps" },
  children,
}: {
  title: ReactNode;
  description: ReactNode;
  back?: { href: string; label: string };
  children?: ReactNode;
}) {
  return (
    <header className="flex min-h-14 shrink-0 flex-wrap items-center gap-3 border-b border-border px-4 py-3 sm:px-6">
      <Link href={back.href} className="inline-flex h-11 items-center gap-1 rounded-lg px-2 text-sm text-muted hover:bg-raised hover:text-fg">
        <ArrowLeft className="size-4" />
        {back.label}
      </Link>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-lg font-medium tracking-tight">{title}</h1>
        <p className="truncate text-sm text-muted">{description}</p>
      </div>
      {children}
    </header>
  );
}
