import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("app-page flex min-h-0 flex-1 flex-col bg-bg/60", className)}>{children}</div>;
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="app-page-header flex shrink-0 flex-col gap-4 px-5 py-6 sm:flex-row sm:flex-wrap sm:items-center sm:px-7 sm:py-7">
      <div className="min-w-0 flex-1">
        <h1 className="text-[1.75rem] font-semibold tracking-[-.04em]">{title}</h1>
        {description ? <p className="mt-2 text-sm leading-relaxed text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex max-w-full min-w-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function PageBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("app-page-body min-h-0 flex-1 overflow-y-auto pb-6", className)}>{children}</div>;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  title: ReactNode;
  description: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state grid h-full min-h-72 place-items-center px-6 py-16 text-center">
      <div className="max-w-sm">
        <span className="mx-auto grid size-16 place-items-center rounded-2xl border border-accent/10 bg-accent/7 text-accent shadow-[0_0_0_10px_var(--aether-surface)]">
          <Icon className="size-5" strokeWidth={1.6} />
        </span>
        <p className="mt-4 text-[1.75rem] font-semibold tracking-[-.04em]">{title}</p>
        <p className="mt-3 text-sm leading-relaxed text-muted">{description}</p>
        {action ? <div className="mt-5">{action}</div> : null}
      </div>
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { id: T; label: ReactNode }[];
}) {
  return (
    <div className="flex max-w-full overflow-x-auto rounded-full border border-border bg-surface p-1">
      {options.map((option) => {
        const active = value === option.id;
        return (
          <button
            type="button"
            onClick={() => onChange(option.id)}
            aria-pressed={active}
            className={cn(
              "h-8 shrink-0 rounded-full px-4 text-sm whitespace-nowrap transition-colors duration-150",
              active ? "bg-accent/10 font-medium text-accent" : "text-muted hover:text-fg",
            )}
            key={option.id}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function DataTable({
  columns,
  colsClass,
  children,
}: {
  columns: string[];
  colsClass?: string;
  children: ReactNode;
}) {
  return (
    <div className="app-data-table min-w-0 overflow-hidden rounded-2xl border border-border bg-surface">
      <div
        className={cn(
          "hidden gap-3 border-b border-border bg-bg/80 px-4 py-3.5 text-[11px] font-semibold text-muted sm:grid sm:px-6",
          colsClass,
        )}
      >
        {columns.map((column) => (
          <span key={column}>{column}</span>
        ))}
      </div>
      <ul className="divide-y divide-border">{children}</ul>
    </div>
  );
}
