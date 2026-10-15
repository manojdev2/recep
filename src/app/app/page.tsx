"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  AudioLines,
  BookOpen,
  CalendarCheck,
  MessageSquare,
  PhoneCall,
  Plus,
  Sparkles,
  Timer,
  UserPlus,
} from "lucide-react";
import { Page, PageBody, PageHeader } from "@/components/app/page";
import { SetupChecklist } from "@/components/app/setup-checklist";
import { DashboardSkeleton } from "@/components/app/skeletons";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useCurrentUser } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) return null;
  const max = Math.max(...points, 1);
  const step = 100 / (points.length - 1);
  const d = points.map((p, i) => `${i === 0 ? "M" : "L"} ${(i * step).toFixed(1)} ${(24 - (p / max) * 22).toFixed(1)}`).join(" ");
  return (
    <svg viewBox="0 0 100 24" preserveAspectRatio="none" className="mt-2 h-6 w-full text-accent" aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

const KIND_ICON = {
  appointment: CalendarCheck,
  lead: UserPlus,
  ticket: MessageSquare,
  transfer: PhoneCall,
} as const;

function ago(at: string) {
  const mins = Math.round((Date.now() - new Date(at).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  return hrs < 24 ? `${hrs}h ago` : `${Math.round(hrs / 24)}d ago`;
}

export default function HomePage() {
  const user = useCurrentUser();
  const agentsQuery = useQuery({ queryKey: ["agents"], queryFn: () => api.agents.list() });
  const dashboardQuery = useQuery({ queryKey: ["dashboard"], queryFn: () => api.setup.dashboard() });
  if (dashboardQuery.isPending || agentsQuery.isPending) return <DashboardSkeleton />;

  const live = (agentsQuery.data ?? []).filter((a) => a.status === "live");
  const d = dashboardQuery.data;
  const stats = [
    { label: "Calls this week", value: d?.callsThisWeek, icon: PhoneCall, to: "/app/calls", spark: true },
    { label: "Bookings", value: d?.bookings, icon: CalendarCheck, to: "/app/results", spark: false },
    { label: "New enquiries", value: d?.leads, icon: UserPlus, to: "/app/results", spark: false },
    { label: "Minutes of conversation", value: d?.minutesUsed, icon: Timer, to: "/app/settings", spark: false },
  ];

  return (
    <Page>
      <PageHeader
        title={user?.displayName && !user.isDevFallback ? `Hello, ${user.displayName.split(" ")[0]}.` : "Welcome to your workspace."}
        description={
          live.length
            ? `${live.length} receptionist${live.length === 1 ? " is" : "s are"} ready to help.`
            : "Welcome home. Let’s get your first receptionist ready."
        }
        actions={
          <Button variant="secondary" asChild>
            <Link href="/app/agents">
              My receptionists
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        }
      />
      <PageBody className="dashboard-body px-5 pb-8 sm:px-8">
        <section className="dashboard-welcome mb-6 grid gap-6 overflow-hidden rounded-[1.5rem] border border-accent/10 p-6 sm:p-8 lg:grid-cols-[1.5fr_1fr]">
          <div>
            <p className="eyebrow text-accent">
              <Sparkles className="size-4" /> Your day, a little lighter
            </p>
            <h2 className="mt-4 text-3xl leading-tight font-semibold tracking-[-.04em]">
              {live.length ? "You’re in good company." : "A great first hello starts here."}
            </h2>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">
              {live.length
                ? "Your receptionists are ready. Catch up on conversations, check the details, and see what’s next."
                : "Give your business a familiar voice. Start with the essentials and make your receptionist feel like you."}
            </p>
            <Button asChild className="mt-6">
              <Link href={live.length ? "/app/conversations" : "/app/new"}>
                {live.length ? "Open conversations" : "Create my receptionist"}
                <ArrowRight />
              </Link>
            </Button>
          </div>
          <div className="flex flex-col justify-center gap-3 rounded-2xl bg-surface/80 p-5">
            <p className="text-[10px] font-semibold tracking-widest text-subtle uppercase">Your front desk</p>
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-xl bg-accent/10 text-accent">
                <AudioLines className="size-5" />
              </span>
              <div>
                <p className="text-sm font-semibold">{live.length} ready to answer</p>
                <p className="mt-1 text-xs text-muted">{agentsQuery.data?.length ?? 0} receptionists in your workspace</p>
              </div>
            </div>
            <Link
              href="/app/agents"
              className="mt-2 flex items-center justify-between border-t border-border pt-3 text-xs font-medium text-accent"
            >
              Meet & manage your team <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </section>
        <SetupChecklist />
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">Your week, at a glance</h2>
          <Link href="/app/analytics" className="flex items-center gap-1 text-xs text-muted">
            View insights <ArrowRight className="size-3" />
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s) => (
            <Link
              href={s.to}
              className="stat-card group rounded-2xl border border-border bg-surface p-5 transition-colors hover:border-accent/30"
              key={s.label}
            >
              <div className="flex items-center gap-2 text-sm text-muted">
                <span className="grid size-8 place-items-center rounded-lg bg-accent/7 text-accent">
                  <s.icon className="size-4" />
                </span>
                {s.label}
              </div>
              <p className={cn("mt-5 text-4xl font-semibold tracking-tight tabular-nums")}>{s.value ?? 0}</p>
              {s.spark && d?.callsByDay?.length ? <Sparkline points={d.callsByDay} /> : null}
            </Link>
          ))}
        </div>
        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[1.4fr_1fr]">
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-medium">Recent activity</h2>
              <Link href="/app/results" className="text-xs text-subtle transition-colors hover:text-fg">
                All results
              </Link>
            </div>
            <ul className="overflow-hidden rounded-2xl bg-surface shadow-[var(--shadow-border)]">
              {d?.recent?.length ? (
                d.recent.map((r, i) => {
                  const Icon = KIND_ICON[r.kind as keyof typeof KIND_ICON] ?? CalendarCheck;
                  return (
                    <li className="flex items-start gap-3 border-b border-border px-4 py-3 last:border-b-0" key={`${r.kind}-${r.at}-${i}`}>
                      <Icon className="mt-0.5 size-4 shrink-0 text-subtle" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">{r.title}</p>
                        <p className="truncate text-xs text-muted">{r.detail}</p>
                      </div>
                      <span className="shrink-0 text-xs text-subtle">{ago(r.at)}</span>
                    </li>
                  );
                })
              ) : (
                <li className="flex items-start gap-3 px-4 py-3">
                  <CalendarCheck className="mt-0.5 size-4 shrink-0 text-subtle" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-muted">Your activity will appear here</p>
                    <p className="text-xs text-subtle">
                      New bookings, enquiries, and requests will appear as your receptionist helps callers.
                    </p>
                  </div>
                </li>
              )}
            </ul>
          </section>
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-medium">Your receptionists</h2>
              <Link href="/app/agents" className="text-xs text-subtle transition-colors hover:text-fg">
                All receptionists
              </Link>
            </div>
            <ul className="overflow-hidden rounded-2xl bg-surface shadow-[var(--shadow-border)]">
              {live.length ? (
                live.slice(0, 4).map((a) => (
                  <li className="border-b border-border last:border-b-0" key={a.id}>
                    <Link
                      href={`/app/agents/${a.id}`}
                      className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-surface"
                    >
                      <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{a.name}</p>
                        <p className="line-clamp-2 text-xs text-muted">{a.tagline}</p>
                      </div>
                    </Link>
                  </li>
                ))
              ) : (
                <li className="flex items-start gap-3 px-4 py-3">
                  <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-border" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-muted">Your receptionist is waiting to meet you</p>
                    <Link href="/app/agents" className="text-xs text-accent transition-colors hover:underline">
                      Let’s get started
                    </Link>
                  </div>
                </li>
              )}
            </ul>
          </section>
        </div>
        <section className="mt-8">
          <h2 className="mb-4 text-base font-semibold">Make it yours</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { to: "/app/voices", icon: AudioLines, title: "Find your voice", text: "Hear a few. Pick your favourite." },
              { to: "/app/knowledge", icon: BookOpen, title: "Share what you know", text: "The details that make you, you." },
              { to: "/app/apps", icon: Plus, title: "Bring your apps along", text: "A little more connected." },
            ].map(({ to, icon: Icon, title, text }) => (
              <Link
                href={to}
                className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-5 transition-colors hover:bg-raised"
                key={to}
              >
                <Icon className="size-5 shrink-0 text-accent" />
                <span>
                  <span className="block text-sm font-medium">{title}</span>
                  <span className="mt-1 block text-xs text-muted">{text}</span>
                </span>
                <ArrowRight className="ml-auto size-4 shrink-0 text-subtle" />
              </Link>
            ))}
          </div>
        </section>
      </PageBody>
    </Page>
  );
}
