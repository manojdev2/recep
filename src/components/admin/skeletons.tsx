import { adminSkeletonKind } from "@/components/app/skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function TableBlock({ columns, rows = 6, minWidth = "44rem" }: { columns: number; rows?: number; minWidth?: string }) {
  return (
    <div className="overflow-x-auto rounded-2xl bg-raised shadow-[var(--shadow-border)]">
      <table className="w-full text-sm" style={{ minWidth }}>
        <thead>
          <tr className="border-b border-border">
            {Array.from({ length: columns }).map((_, i) => (
              <th className="px-4 py-2.5 text-left" key={i}>
                <Skeleton className="h-3 w-16" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr className="border-b border-border last:border-b-0" key={r}>
              {Array.from({ length: columns }).map((__, c) => (
                <td className="px-4 py-2.5" key={c}>
                  <Skeleton className={cn("h-4", c === 0 ? "w-40" : "w-14")} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TitleBlock({ wide = false }: { wide?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div>
        <Skeleton className="h-6 w-40" />
        <Skeleton className={cn("mt-2 h-4", wide ? "w-96" : "w-64")} />
      </div>
      <div className="ml-auto flex gap-1">
        {["w-16", "w-20", "w-16"].map((w, i) => (
          <Skeleton className={cn("h-8 rounded-lg", w)} key={i} />
        ))}
      </div>
    </div>
  );
}

function Tiles({ count }: { count: number }) {
  return (
    <div className={cn("mt-5 grid gap-3 sm:grid-cols-2", count === 5 ? "lg:grid-cols-5" : "lg:grid-cols-4")}>
      {Array.from({ length: count }).map((_, i) => (
        <div className="rounded-2xl bg-raised p-4 shadow-[var(--shadow-border)]" key={i}>
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-2 h-7 w-16" />
          <Skeleton className="mt-1.5 h-3 w-24" />
        </div>
      ))}
    </div>
  );
}

export function OverviewSkeleton() {
  return (
    <>
      <Skeleton className="h-6 w-32" />
      <Skeleton className="mt-2 h-4 w-72" />
      <Tiles count={5} />
      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-3 w-16" />
        </div>
        <ul className="overflow-hidden rounded-2xl bg-raised shadow-[var(--shadow-border)]">
          {Array.from({ length: 6 }).map((_, i) => (
            <li className="flex items-center gap-2 border-b border-border px-4 py-3 last:border-b-0" key={i}>
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="ml-auto h-3 w-28" />
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

export function TenantsSkeleton() {
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <Skeleton className="h-6 w-28" />
          <Skeleton className="mt-2 h-4 w-24" />
        </div>
        <Skeleton className="ml-auto h-9 w-full max-w-xs rounded-lg" />
      </div>
      <div className="mt-5">
        <TableBlock columns={7} rows={8} minWidth="52rem" />
      </div>
    </>
  );
}

export function FinanceSkeleton() {
  return (
    <>
      <TitleBlock wide />
      <Tiles count={5} />
      <section className="mt-8">
        <Skeleton className="mb-2 h-4 w-32" />
        <TableBlock columns={4} rows={4} minWidth="32rem" />
      </section>
      <section className="mt-8">
        <Skeleton className="mb-2 h-4 w-56" />
        <TableBlock columns={3} rows={5} minWidth="32rem" />
      </section>
      <section className="mt-8">
        <Skeleton className="h-4 w-64" />
        <Skeleton className="mt-1.5 mb-2 h-3 w-96" />
        <TableBlock columns={6} rows={5} minWidth="40rem" />
      </section>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {[0, 1].map((k) => (
          <section key={k}>
            <Skeleton className="mb-2 h-4 w-40" />
            <div className="overflow-hidden rounded-2xl bg-raised shadow-[var(--shadow-border)]">
              {Array.from({ length: 3 }).map((_, i) => (
                <div className="flex items-center gap-3 border-b border-border px-4 py-2.5 last:border-b-0" key={i}>
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

export function HealthSkeleton() {
  return (
    <>
      <TitleBlock />
      <div className="mt-5">
        <TableBlock columns={7} rows={6} minWidth="46rem" />
      </div>
      <section className="mt-8">
        <Skeleton className="mb-2 h-4 w-36" />
        <TableBlock columns={4} rows={5} minWidth="46rem" />
      </section>
    </>
  );
}

export function PlansSkeleton() {
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <Skeleton className="h-6 w-20" />
          <Skeleton className="mt-2 h-4 w-80" />
        </div>
        <Skeleton className="ml-auto h-8 w-24 rounded-lg" />
      </div>
      <div className="mt-5 overflow-hidden rounded-2xl bg-raised shadow-[var(--shadow-border)]">
        {Array.from({ length: 3 }).map((_, i) => (
          <div className="flex flex-wrap items-center gap-4 border-b border-border px-4 py-3 last:border-b-0" key={i}>
            <div className="min-w-40">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-1.5 h-3 w-16" />
            </div>
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-56" />
            <Skeleton className="ml-auto h-8 w-16 rounded-lg" />
          </div>
        ))}
      </div>
    </>
  );
}

export function SettingsSkeleton() {
  return (
    <>
      <Skeleton className="h-6 w-40" />
      <Skeleton className="mt-2 h-4 w-72" />
      {[4, 3, 5].map((count, s) => (
        <section className="mt-6" key={s}>
          <Skeleton className="h-4 w-28" />
          <Skeleton className="mt-1.5 mb-2 h-3 w-64" />
          <div className="overflow-hidden rounded-2xl bg-raised shadow-[var(--shadow-border)]">
            {Array.from({ length: count }).map((_, i) => (
              <div className="border-b border-border px-4 py-3 last:border-b-0" key={i}>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-20 rounded-full" />
                  <Skeleton className="ml-auto h-3 w-28" />
                </div>
                <Skeleton className="mt-2 h-3 w-full max-w-lg" />
                <div className="mt-2 flex items-center gap-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="ml-auto h-8 w-20 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

export function AuditSkeleton() {
  return (
    <>
      <Skeleton className="h-6 w-44" />
      <Skeleton className="mt-2 h-4 w-80" />
      <section className="mt-5">
        <Skeleton className="mb-2 h-4 w-28" />
        <div className="overflow-hidden rounded-2xl bg-raised shadow-[var(--shadow-border)]">
          {Array.from({ length: 2 }).map((_, i) => (
            <div className="flex items-center gap-2 border-b border-border px-4 py-3 last:border-b-0" key={i}>
              <Skeleton className="h-4 w-52" />
              <Skeleton className="h-4 w-14 rounded-full" />
              <Skeleton className="ml-auto size-7 rounded-lg" />
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <Skeleton className="h-9 w-full max-w-xs rounded-lg" />
          <Skeleton className="h-9 w-24 rounded-lg" />
          <Skeleton className="h-9 w-20 rounded-lg" />
        </div>
      </section>
      <section className="mt-8">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Skeleton className="h-4 w-52" />
          <Skeleton className="h-8 w-28 rounded-lg" />
          <Skeleton className="h-8 w-44 rounded-lg" />
          <Skeleton className="ml-auto h-8 w-28 rounded-lg" />
        </div>
        <TableBlock columns={5} rows={8} />
      </section>
    </>
  );
}

export function AdminRouteSkeleton({ pathname }: { pathname: string }) {
  switch (adminSkeletonKind(pathname)) {
    case "tenants":
      return <TenantsSkeleton />;
    case "finance":
      return <FinanceSkeleton />;
    case "health":
      return <HealthSkeleton />;
    case "plans":
      return <PlansSkeleton />;
    case "settings":
      return <SettingsSkeleton />;
    case "audit":
      return <AuditSkeleton />;
    default:
      return <OverviewSkeleton />;
  }
}
