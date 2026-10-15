import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Page, PageBody, PageHeader } from "./page";

const appRoutes: { exact?: string[]; prefix?: string; kind: string }[] = [
  { exact: ["/app", "/app/"], kind: "dashboard" },
  { exact: ["/app/agents", "/app/agents/"], kind: "agents" },
  { exact: ["/app/settings/hours"], kind: "hours" },
  { exact: ["/app/settings/billing"], kind: "billing" },
  { exact: ["/app/conversations"], kind: "inbox" },
  { exact: ["/app/contacts"], kind: "contacts" },
  { exact: ["/app/results"], kind: "results" },
  { exact: ["/app/new"], kind: "newAgent" },
  { exact: ["/app/analytics"], kind: "analytics" },
  { exact: ["/app/voices"], kind: "voices" },
  { exact: ["/app/phone"], kind: "phone" },
  { exact: ["/app/apps"], kind: "apps" },
  { exact: ["/app/knowledge"], kind: "knowledge" },
  { prefix: "/app/agents/", kind: "studio" },
  { prefix: "/app/settings", kind: "settings" },
  { prefix: "/app/campaigns", kind: "campaigns" },
  { prefix: "/app/calls", kind: "calls" },
  { prefix: "/app/tools", kind: "apps" },
];

export function appSkeletonKind(pathname: string) {
  for (const r of appRoutes)
    if (
      r.exact?.includes(pathname) ||
      (r.prefix && pathname.startsWith(r.prefix))
    )
      return r.kind;
  return "agents";
}

const adminRoutes: { exact?: string[]; prefix?: string; kind: string }[] = [
  { exact: ["/admin", "/admin/"], kind: "overview" },
  { prefix: "/admin/tenants", kind: "tenants" },
  { prefix: "/admin/finance", kind: "finance" },
  { prefix: "/admin/health", kind: "health" },
  { prefix: "/admin/plans", kind: "plans" },
  { prefix: "/admin/settings", kind: "settings" },
  { prefix: "/admin/audit", kind: "audit" },
];

export function adminSkeletonKind(pathname: string) {
  for (const r of adminRoutes)
    if (
      r.exact?.includes(pathname) ||
      (r.prefix && pathname.startsWith(r.prefix))
    )
      return r.kind;
  return "overview";
}

function AgentCardSkeleton() {
  return (
    <article className="flex flex-col rounded-2xl bg-bg p-5 shadow-[var(--shadow-border)]">
      <div className="flex items-start justify-between gap-3">
        <Skeleton className="size-14 rounded-full" />
        <Skeleton className="h-5 w-12 rounded-full" />
      </div>
      <Skeleton className="mt-5 h-5 w-40" />
      <Skeleton className="mt-2 h-4 w-full" />
      <Skeleton className="mt-1.5 h-4 w-2/3" />
      <Skeleton className="mt-4 h-3 w-32" />
      <div className="mt-5 flex gap-2">
        <Skeleton className="h-9 w-16 rounded-lg" />
        <Skeleton className="h-9 w-16 rounded-lg" />
      </div>
    </article>
  );
}

export function AgentsSkeleton() {
  return (
    <Page>
      <PageHeader
        title="My receptionists"
        description="Talk first. Share when it sounds like you."
      />
      <PageBody className="p-4 sm:p-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <AgentCardSkeleton />
          <AgentCardSkeleton />
          <AgentCardSkeleton />
        </div>
      </PageBody>
    </Page>
  );
}

function NewAgentSkeleton() {
  return (
    <Page>
      <header className="flex min-h-14 shrink-0 items-center gap-3 border-b border-border px-4 py-3 sm:px-6">
        <Skeleton className="size-11 rounded-lg" />
        <div className="min-w-0 flex-1">
          <p className="text-lg font-medium tracking-tight">
            Build a voice agent
          </p>
          <p className="text-sm text-muted">
            A few questions, or a use case you already know.
          </p>
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="mt-2 h-4 w-5/6" />
          <Skeleton className="mt-2 h-4 w-2/3" />
        </div>
        <div className="border-t border-border px-4 py-3">
          <div className="mx-auto flex max-w-2xl gap-2">
            <Skeleton className="h-10 w-36 rounded-full" />
            <Skeleton className="h-10 w-24 rounded-full" />
            <Skeleton className="h-10 w-32 rounded-full" />
          </div>
          <Skeleton className="mx-auto mt-3 h-12 max-w-2xl rounded-full" />
        </div>
      </div>
    </Page>
  );
}

function InboxRowSkeleton({ active }: { active?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 border-l-2 px-4 py-3",
        active ? "border-accent bg-raised" : "border-transparent",
      )}
    >
      <Skeleton className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="mt-2 h-4 w-full max-w-sm" />
      </div>
      <Skeleton className="h-3 w-16 shrink-0" />
    </div>
  );
}

function InboxSkeleton() {
  return (
    <Page>
      <PageHeader
        title="Conversations"
        description="Every talk, on one line."
      />
      <div className="flex min-h-0 flex-1">
        <section className="flex min-h-0 min-w-0 flex-1 flex-col border-border lg:border-r">
          <div className="min-h-0 flex-1 overflow-hidden">
            <InboxRowSkeleton active />
            <InboxRowSkeleton />
            <InboxRowSkeleton />
            <InboxRowSkeleton />
            <InboxRowSkeleton />
            <InboxRowSkeleton />
          </div>
        </section>
        <aside className="hidden min-h-0 w-[26rem] shrink-0 flex-col lg:flex">
          <div className="flex items-start gap-3 border-b border-border px-4 py-3">
            <div className="min-w-0 flex-1">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="mt-2 h-3 w-24" />
            </div>
            <Skeleton className="h-9 w-24 rounded-lg" />
          </div>
          <div className="border-b border-border px-4 py-4">
            <p className="text-[11px] tracking-[0.16em] text-subtle uppercase">
              Outcome
            </p>
            <Skeleton className="mt-2 h-5 w-32" />
            <Skeleton className="mt-2 h-4 w-full" />
            <div className="mt-4 grid grid-cols-3 gap-3">
              <Skeleton className="h-8" />
              <Skeleton className="h-8" />
              <Skeleton className="h-8" />
            </div>
          </div>
          <div className="space-y-3 px-4 py-4">
            <Skeleton className="h-16 w-[78%] rounded-xl" />
            <Skeleton className="ml-auto h-12 w-[70%] rounded-xl" />
            <Skeleton className="h-20 w-[82%] rounded-xl" />
          </div>
        </aside>
      </div>
    </Page>
  );
}

export function StudioSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex min-h-14 shrink-0 items-center gap-3 border-b border-border px-4 py-3 sm:px-6">
        <Skeleton className="h-11 w-16 rounded-lg" />
        <Skeleton className="size-10 rounded-full" />
        <div className="min-w-0 flex-1">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="mt-1.5 h-3 w-40" />
        </div>
        <Skeleton className="h-11 w-28 rounded-lg" />
        <Skeleton className="h-11 w-24 rounded-lg" />
      </header>
      <div className="grid min-h-0 flex-1 lg:grid-cols-[9.5rem_minmax(0,1fr)_minmax(22rem,26rem)]">
        <nav className="flex gap-1 border-b border-border px-3 py-2 lg:flex-col lg:border-r lg:border-b-0 lg:px-3 lg:py-4">
          {["Line", "Call", "Flow", "Knowledge", "Hours", "Apps", "Share"].map(
            (e) => (
              <Skeleton className="h-10 w-24 rounded-lg" key={e} />
            ),
          )}
        </nav>
        <div className="min-h-0 overflow-hidden px-4 py-6 sm:px-6">
          <div className="mx-auto grid max-w-xl gap-4">
            <Skeleton className="h-11 rounded-lg" />
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-11 rounded-lg" />
            <Skeleton className="h-36 rounded-xl" />
          </div>
        </div>
        <div className="hidden min-h-0 flex-col border-l border-border lg:flex">
          <div className="flex h-10 shrink-0 items-center border-b border-border px-4">
            <p className="text-xs tracking-[0.16em] text-subtle uppercase">
              Talk
            </p>
          </div>
          <div className="flex flex-1 flex-col items-center px-5 pt-8">
            <Skeleton className="size-[188px] rounded-full" />
            <Skeleton className="mt-4 h-4 w-40" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function RowsSkeleton({
  rows = 6,
  colsClass,
}: {
  rows?: number;
  colsClass?: string;
}) {
  return (
    <ul className="divide-y divide-border">
      {Array.from({ length: rows }).map((_, i) => (
        <li
          className={cn(
            "grid items-center gap-3 px-4 py-3.5 sm:px-6",
            colsClass ?? "sm:grid-cols-[repeat(3,minmax(0,1fr))]",
          )}
          key={i}
        >
          <Skeleton className="h-4 w-36" />
          <Skeleton className="hidden h-4 w-24 sm:block" />
          <Skeleton className="h-4 w-full" />
        </li>
      ))}
    </ul>
  );
}

export function TableSkeleton({
  title,
  description,
  columns,
  rows = 6,
}: {
  title: string;
  description: string;
  columns: string[];
  rows?: number;
}) {
  return (
    <Page>
      <PageHeader title={title} description={description} />
      <PageBody>
        <div className="hidden gap-4 border-b border-border px-4 py-2 sm:grid sm:grid-cols-[repeat(auto-fit,minmax(0,1fr))] sm:px-6">
          {columns.map((c) => (
            <span
              className="text-xs tracking-wide text-subtle uppercase"
              key={c}
            >
              {c}
            </span>
          ))}
        </div>
        <RowsSkeleton rows={rows} />
      </PageBody>
    </Page>
  );
}

export function AnalyticsSkeleton() {
  return (
    <Page>
      <PageHeader
        title="This week"
        description="What the lines did — not a dashboard for its own sake."
      />
      <PageBody className="p-4 sm:p-6">
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              className="rounded-xl px-4 py-4 shadow-[var(--shadow-border)]"
              key={i}
            >
              <Skeleton className="h-3 w-20" />
              <Skeleton className="mt-3 h-7 w-16" />
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-xl px-4 py-4 shadow-[var(--shadow-border)]">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-4 h-48 w-full rounded-lg" />
        </div>
      </PageBody>
    </Page>
  );
}

function SettingsSkeleton() {
  return (
    <Page>
      <PageHeader
        title="Settings"
        description="Account, appearance, and workspace."
      />
      <PageBody className="px-4 py-6 sm:px-6">
        <div className="grid max-w-2xl gap-4">
          <section className="rounded-xl bg-raised/60 p-5">
            <p className="text-xs tracking-wide text-subtle uppercase">
              Appearance
            </p>
            <Skeleton className="mt-4 h-11 w-64 rounded-lg" />
          </section>
          <section className="rounded-xl bg-raised/60 p-5">
            <p className="text-xs tracking-wide text-subtle uppercase">
              Signed in as
            </p>
            <Skeleton className="mt-3 h-6 w-40" />
            <Skeleton className="mt-2 h-4 w-52" />
          </section>
        </div>
      </PageBody>
    </Page>
  );
}

export function DashboardSkeleton() {
  return (
    <Page>
      <PageHeader title="Home" description="" />
      <PageBody className="p-4 sm:p-6">
        <Skeleton className="mb-6 h-72 w-full rounded-3xl" />
        <div className="mb-6 rounded-2xl bg-raised p-4 shadow-[var(--shadow-border)]">
          <Skeleton className="h-4 w-44" />
          <Skeleton className="mt-2.5 h-3 w-full max-w-md" />
          <div className="mt-4 flex gap-2">
            <Skeleton className="h-9 w-24 rounded-lg" />
            <Skeleton className="h-9 w-20 rounded-lg" />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              className="rounded-2xl bg-raised p-4 shadow-[var(--shadow-border)]"
              key={i}
            >
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-2.5 h-7 w-14" />
              {i === 0 ? <Skeleton className="mt-2 h-6 w-full" /> : null}
            </div>
          ))}
        </div>
        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[1.4fr_1fr]">
          {[5, 3].map((count, i) => (
            <section key={i}>
              <div className="mb-3 flex items-center justify-between">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-16" />
              </div>
              <ul className="overflow-hidden rounded-2xl bg-raised shadow-[var(--shadow-border)]">
                {Array.from({ length: count }).map((_, j) => (
                  <li
                    className="flex items-start gap-3 border-b border-border px-4 py-3 last:border-b-0"
                    key={j}
                  >
                    <Skeleton className="mt-0.5 size-4 shrink-0 rounded" />
                    <div className="min-w-0 flex-1">
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="mt-1.5 h-3 w-1/2" />
                    </div>
                    <Skeleton className="h-3 w-12 shrink-0" />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </PageBody>
    </Page>
  );
}

function SettingsShellSkeleton({ children }: { children: ReactNode }) {
  return (
    <Page>
      <PageHeader title="Settings" description="How your business runs." />
      <PageBody className="px-4 py-6 sm:px-6">
        <nav className="mb-6 flex flex-wrap gap-1 border-b border-border pb-3">
          {["w-16", "w-24", "w-28", "w-12"].map((w) => (
            <Skeleton className={cn("h-8 rounded-lg", w)} key={w} />
          ))}
        </nav>
        {children}
      </PageBody>
    </Page>
  );
}

export function HoursSkeleton() {
  return (
    <SettingsShellSkeleton>
      <HoursSkeletonBody />
    </SettingsShellSkeleton>
  );
}

export function HoursSkeletonBody() {
  return (
    <div className="grid max-w-2xl gap-4">
      <section className="rounded-xl bg-raised/60 p-5">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-2 h-4 w-full max-w-sm" />
        <Skeleton className="mt-4 h-9 w-64 rounded-lg" />
      </section>
      <section className="rounded-xl bg-raised/60 p-5">
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-3 w-20" />
        </div>
        <div className="mt-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              className="flex items-center gap-3 border-b border-border py-2.5 last:border-b-0"
              key={i}
            >
              <Skeleton className="h-4 w-20 shrink-0" />
              <Skeleton className="h-8 w-28 rounded-lg" />
              <Skeleton className="h-8 w-28 rounded-lg" />
              <Skeleton className="ml-auto h-8 w-16 rounded-lg" />
            </div>
          ))}
        </div>
        <div className="mt-4 flex gap-4">
          <Skeleton className="h-8 w-28 rounded-lg" />
          <Skeleton className="h-8 w-28 rounded-lg" />
          <Skeleton className="ml-auto h-8 w-24 rounded-lg" />
        </div>
      </section>
    </div>
  );
}

export function BillingSkeleton() {
  return (
    <SettingsShellSkeleton>
      <BillingSkeletonBody />
    </SettingsShellSkeleton>
  );
}

export function BillingSkeletonBody() {
  return (
    <div className="grid max-w-2xl gap-4">
      <section className="rounded-xl bg-raised/60 p-5">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="mt-2 h-8 w-32" />
        <Skeleton className="mt-5 h-4 w-full" />
        <Skeleton className="mt-2 h-1.5 w-full rounded-full" />
        <div className="mt-5 grid gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton className="h-4 w-56" key={i} />
          ))}
        </div>
      </section>
      <section className="rounded-xl bg-raised/60 p-5">
        <Skeleton className="h-3 w-20" />
        <div className="mt-3 grid grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-1.5 h-6 w-10" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function VoicesSkeleton() {
  return (
    <Page>
      <PageHeader
        title="Find your voice"
        description="Hear them here, assign one on the line."
      />
      <PageBody className="p-4 sm:p-6">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              className="flex flex-col items-center rounded-xl bg-bg px-2 py-3 shadow-[var(--shadow-border)]"
              key={i}
            >
              <Skeleton className="size-12 rounded-full" />
              <Skeleton className="mt-2 h-4 w-14" />
              <Skeleton className="mt-1 h-3 w-16" />
            </div>
          ))}
        </div>
      </PageBody>
    </Page>
  );
}

function AppsSkeleton() {
  return (
    <Page>
      <PageHeader
        title="Connected apps"
        description="Tools you run here — forms, CRM, the widget. Then live keys for everyone else."
      />
      <PageBody className="px-4 py-6 sm:px-6">
        <Skeleton className="mb-8 h-10 w-full max-w-md" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              className="flex gap-3 rounded-2xl bg-bg p-4 shadow-[var(--shadow-border)]"
              key={i}
            >
              <Skeleton className="size-11 rounded-full" />
              <div className="min-w-0 flex-1">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="mt-2 h-8 w-full" />
              </div>
            </div>
          ))}
        </div>
      </PageBody>
    </Page>
  );
}

export function AppRouteSkeleton({ pathname }: { pathname: string }) {
  switch (appSkeletonKind(pathname)) {
    case "dashboard":
      return <DashboardSkeleton />;
    case "agents":
      return <AgentsSkeleton />;
    case "studio":
      return <StudioSkeleton />;
    case "hours":
      return <HoursSkeleton />;
    case "billing":
      return <BillingSkeleton />;
    case "settings":
      return <SettingsSkeleton />;
    case "inbox":
      return <InboxSkeleton />;
    case "newAgent":
      return <NewAgentSkeleton />;
    case "analytics":
      return <AnalyticsSkeleton />;
    case "campaigns":
      return (
        <TableSkeleton
          title="Campaigns"
          description="Pick an agent and a list. The line works the book."
          columns={["Campaign", "Agent", "Progress"]}
          rows={4}
        />
      );
    case "contacts":
      return (
        <TableSkeleton
          title="Your people"
          description="The people you call. Campaigns and outbound dials read from this book."
          columns={["Name", "Phone", "Company", "Email"]}
          rows={6}
        />
      );
    case "calls":
      return (
        <TableSkeleton
          title="Call history"
          description="Inbound answers. Outbound dials. Campaigns work the list."
          columns={["Dir", "Numbers", "Agent", "Status", "When"]}
          rows={6}
        />
      );
    case "results":
      return (
        <TableSkeleton
          title="Bookings & follow-ups"
          description="What the lines actually did — bookings, leads, tickets."
          columns={["When", "Who", "Line", "Contact"]}
          rows={6}
        />
      );
    case "phone":
      return (
        <TableSkeleton
          title="Phone numbers"
          description="Assign a number to a live agent. Inbound calls use the same voice and tools."
          columns={["Number", "Provider", "SMS", "Assigned agent"]}
          rows={4}
        />
      );
    case "knowledge":
      return (
        <TableSkeleton
          title="Business knowledge"
          description="URLs, files, and notes. Attach them to agents — the line reads the matching passages."
          columns={["Document", "Agent", "Excerpt"]}
          rows={5}
        />
      );
    case "voices":
      return <VoicesSkeleton />;
    case "apps":
      return <AppsSkeleton />;
  }
  return <AgentsSkeleton />;
}

export function FormSkeleton({ lines = 4 }: { lines?: number }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-bg px-4">
      <div className="w-full max-w-md rounded-2xl bg-raised p-6 shadow-[var(--shadow-border)]">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="mt-2.5 h-4 w-full" />
        <div className="mt-6 grid gap-4">
          {Array.from({ length: lines }).map((_, i) => (
            <div key={i}>
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-1.5 h-9 w-full rounded-lg" />
            </div>
          ))}
        </div>
        <Skeleton className="mt-6 h-10 w-32 rounded-lg" />
      </div>
    </div>
  );
}
