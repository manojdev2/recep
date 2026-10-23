"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  AudioLines,
  Blocks,
  BookOpen,
  CalendarCheck,
  ChartColumn,
  ChevronRight,
  CircleHelp,
  LayoutDashboard,
  Library,
  LogOut,
  Megaphone,
  Menu,
  MessageSquare,
  Phone,
  PhoneCall,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { Mark } from "@/components/mark";
import { ThemeToggle } from "@/components/theme";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { signOut, useSession } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { openSetup } from "./setup-checklist";
import { AppRouteSkeleton } from "./skeletons";

type NavItem = { to: string; label: string; icon: ComponentType<{ className?: string; strokeWidth?: number }> };

const NAV: { heading: string | null; items: NavItem[] }[] = [
  {
    heading: null,
    items: [
      { to: "/app", label: "Home", icon: LayoutDashboard },
      { to: "/app/conversations", label: "Conversations", icon: MessageSquare },
      { to: "/app/results", label: "Bookings & follow-ups", icon: CalendarCheck },
      { to: "/app/contacts", label: "Your people", icon: Users },
    ],
  },
  {
    heading: "Your receptionist",
    items: [
      { to: "/app/agents", label: "My receptionists", icon: AudioLines },
      { to: "/app/knowledge", label: "Business knowledge", icon: BookOpen },
      { to: "/app/voices", label: "Find a voice", icon: Library },
      { to: "/app/phone", label: "Phone numbers", icon: Phone },
    ],
  },
  {
    heading: "Your business",
    items: [
      { to: "/app/calls", label: "Call history", icon: PhoneCall },
      { to: "/app/campaigns", label: "Reach out", icon: Megaphone },
      { to: "/app/analytics", label: "Insights", icon: ChartColumn },
      { to: "/app/apps", label: "Connected apps", icon: Blocks },
      { to: "/app/settings", label: "Settings", icon: Settings },
    ],
  },
];

function isActive(pathname: string, to: string) {
  if (to === "/app") return pathname === "/app";
  if (to === "/app/apps") return pathname === "/app/apps" || pathname.startsWith("/app/tools");
  return pathname === to || pathname.startsWith(`${to}/`) || (to === "/app/agents" && pathname === "/app/new");
}

function Avatar({ url, label }: { url: string | null; label: string }) {
  const [failed, setFailed] = useState(false);
  return !url || failed ? (
    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-raised text-xs font-medium">
      {label.charAt(0).toUpperCase()}
    </span>
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="size-8 shrink-0 rounded-full object-cover"
    />
  );
}

function AdminLink() {
  const overview = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: () => api.admin.overview(),
    retry: false,
    staleTime: 300_000,
  });
  return overview.data ? (
    <Link
      href="/admin"
      className="mx-2 mt-1 flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted transition-colors hover:bg-raised hover:text-fg"
    >
      <ShieldCheck className="size-4 shrink-0" />
      Platform admin
    </Link>
  ) : null;
}

function SetupProgress({ onNavigate }: { onNavigate?: () => void }) {
  const setup = useQuery({ queryKey: ["setup"], queryFn: () => api.setup.get() });
  if (!setup.data || setup.data.complete) return null;
  const { doneCount, steps, liveReady } = setup.data;
  return (
    <Link
      href="/app#setup"
      onClick={() => {
        openSetup();
        onNavigate?.();
      }}
      className="mx-2 mb-2 flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-raised"
    >
      <span className="relative grid size-4 shrink-0 place-items-center">
        <svg viewBox="0 0 16 16" className="size-4 -rotate-90" aria-hidden="true">
          <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" className="text-border" />
          <circle
            cx="8"
            cy="8"
            r="6.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-accent"
            strokeLinecap="round"
            strokeDasharray={`${(doneCount / steps.length) * 40.8} 40.8`}
          />
        </svg>
      </span>
      <span className="min-w-0 flex-1 truncate">{liveReady ? "Finish setup" : "Setup"}</span>
      <span className="text-xs tabular-nums text-subtle">
        {doneCount}/{steps.length}
      </span>
    </Link>
  );
}

function NavLink({
  item,
  pathname,
  onClick,
  locked,
}: {
  item: NavItem;
  pathname: string;
  onClick: () => void;
  locked: boolean;
}) {
  const active = isActive(pathname, item.to);
  const base = "flex min-h-10 items-center gap-3 rounded-xl px-3 py-2 text-[13px] transition-colors duration-150";
  if (locked) {
    return (
      <span
        className={cn(base, "cursor-default text-subtle/60 select-none")}
        title="Available once you create your first receptionist"
        aria-disabled="true"
      >
        <item.icon className="size-4" strokeWidth={1.6} aria-hidden="true" />
        {item.label}
      </span>
    );
  }
  return (
    <Link
      href={item.to}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        base,
        active
          ? "bg-accent/10 font-semibold text-accent shadow-[inset_3px_0_0_var(--aether-accent)]"
          : "text-muted hover:bg-raised hover:text-fg",
      )}
    >
      <item.icon className="size-4" strokeWidth={1.6} />
      {item.label}
    </Link>
  );
}

export function DemoBanner() {
  const brand = useQuery({ queryKey: ["branding"], queryFn: () => api.site.branding() });
  return brand.data?.demoMode ? (
    <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 border-b border-border bg-raised px-4 py-2 text-center text-xs text-muted">
      <span>
        <span className="font-medium text-fg">Demo</span> — look around and talk to a receptionist. Saving is turned off.
      </span>
      <a href="/docs/" className="text-accent underline underline-offset-2">
        How to install your own
      </a>
    </div>
  ) : null;
}

function browserTimeZone() {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return zone;
  } catch {
    return "";
  }
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user, isPending } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const brandName =
    useQuery({ queryKey: ["branding"], queryFn: () => api.site.branding(), staleTime: 600_000 }).data?.name ??
    "Azentoo";
  const workspace = useQuery({ queryKey: ["workspace"], queryFn: () => api.agents.workspace(), enabled: !!user });
  const qc = useQueryClient();
  const reported = useRef(false);

  useEffect(() => {
    if (!user || reported.current) return;
    const zone = browserTimeZone();
    if (!zone) return;
    reported.current = true;
    api.hours
      .adoptTimeZone({ timeZone: zone })
      .then((r) => {
        if (r.adopted) {
          qc.invalidateQueries({ queryKey: ["hours"] });
          qc.invalidateQueries({ queryKey: ["setup"] });
        }
      })
      .catch(() => {
        reported.current = false;
      });
  }, [user, qc]);

  useEffect(() => {
    if (!isPending && !user) router.replace("/login");
  }, [isPending, user, router]);

  if (!isPending && !user) return null;

  const signedIn = !!user;
  const label = user?.displayName ?? user?.primaryEmail ?? "Account";
  const noAgents = workspace.isSuccess && (workspace.data?.agents ?? 0) === 0;
  // Platform admins can open every page; customers are guided to create a receptionist first.
  const isAdmin = !!user?.adminLevel;
  const alwaysOpen = new Set(["/app", "/app/agents", "/app/settings"]);
  const isLocked = (to: string) => noAgents && !isAdmin && !alwaysOpen.has(to);

  const nav = (
    <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-3">
      {NAV.map((group, i) => (
        <div className={cn(i > 0 && "mt-5")} key={group.heading ?? `group-${i}`}>
          {group.heading ? (
            <p className="mb-2 px-3 text-[11px] font-medium tracking-wide text-subtle">{group.heading}</p>
          ) : null}
          <div className="flex flex-col gap-0.5">
            {group.items.map((item) => (
              <NavLink
                item={item}
                pathname={pathname}
                locked={isLocked(item.to)}
                onClick={() => setMenuOpen(false)}
                key={item.to}
              />
            ))}
          </div>
        </div>
      ))}
    </nav>
  );

  const meet = (
    <div className="shrink-0 px-3 pb-3">
      {noAgents ? <p className="mb-1.5 px-1 text-[11px] leading-snug text-subtle">Your next chapter starts here.</p> : null}
      <Link
        href="/app/new"
        onClick={() => setMenuOpen(false)}
        className="group flex h-9 items-center gap-2 rounded-lg bg-[var(--consumer-peach)] px-2.5 text-[13px] font-medium transition-colors hover:bg-accent/10"
      >
        <Sparkles className="size-3.5 shrink-0 text-accent" />
        <span className="min-w-0 flex-1 truncate">Meet a receptionist</span>
        <ArrowUpRight className="size-3.5 shrink-0 text-subtle transition-colors group-hover:text-accent" />
      </Link>
    </div>
  );

  const footer =
    noAgents && !isAdmin ? null : (
      <div className="shrink-0 border-t border-border py-2">
        {!signedIn || noAgents ? null : <SetupProgress onNavigate={() => setMenuOpen(false)} />}
        {/* The session already says who is an admin; don't make everyone else hit a 404. */}
        {isAdmin ? <AdminLink /> : null}
      </div>
    );

  const current = NAV.flatMap((g) => g.items).find((item) => isActive(pathname, item.to))?.label ?? "Receptionist";

  return (
    <div className="consumer-app flex h-dvh overflow-hidden bg-bg text-fg lg:gap-3 lg:p-3">
      <aside className="app-sidebar hidden h-full w-60 shrink-0 flex-col lg:flex">
        <div className="flex h-[72px] shrink-0 items-center justify-between gap-2 px-3">
          <Link href="/" className="flex min-w-0 flex-1 items-center gap-2">
            <Mark className="size-8" />
            <span className="truncate whitespace-nowrap text-lg font-semibold tracking-[-.04em]">{brandName}</span>
          </Link>
          <ThemeToggle className="size-8 shrink-0" />
        </div>
        <Link href="/app/settings" className="mx-3 mb-2 flex items-center gap-3 rounded-2xl border border-border bg-surface p-3">
          <span className="grid size-8 place-items-center rounded-lg bg-accent/10 text-xs font-semibold text-accent">
            {label.charAt(0).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-semibold">Your workspace</span>
            <span className="block truncate text-[10px] text-subtle">{label}</span>
          </span>
          <ChevronRight className="size-3.5 text-subtle" />
        </Link>
        {nav}
        {footer}
        {meet}
        <div className="shrink-0 border-t border-border p-2">
          {user ? (
            <div className="flex items-center gap-2 rounded-lg px-2 py-1.5">
              <Avatar url={user.profileImageUrl} label={label} />
              <span className="min-w-0 flex-1 truncate text-sm">{label}</span>
              <button
                type="button"
                onClick={() => void signOut("/")}
                className="grid size-9 place-items-center rounded-md text-muted hover:bg-raised hover:text-fg"
                aria-label="Sign out"
              >
                <LogOut className="size-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg px-2 py-1.5">
              <Skeleton className="size-8 rounded-full" />
              <Skeleton className="h-3.5 flex-1" />
              <Skeleton className="size-9 rounded-md" />
            </div>
          )}
        </div>
      </aside>
      <div className="app-content-shell flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-surface lg:rounded-[1.5rem] lg:border lg:border-border">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-3 lg:hidden">
          <Link href="/" className="flex items-center gap-2">
            <Mark className="size-9" />
            <span className="truncate whitespace-nowrap text-base font-medium">{brandName}</span>
          </Link>
          <div className="flex items-center">
            <ThemeToggle />
            <button
              type="button"
              className="grid size-11 place-items-center rounded-lg hover:bg-raised"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Menu"
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </header>
        {menuOpen && (
          <div className="max-h-[70dvh] shrink-0 overflow-y-auto border-b border-border lg:hidden">
            {nav}
            {footer}
            {meet}
          </div>
        )}
        <div className="hidden h-14 shrink-0 items-center justify-between gap-3 border-b border-border px-7 lg:flex">
          <div className="flex items-center gap-2 text-xs text-muted">
            <span>Workspace</span>
            <ChevronRight className="size-3" />
            <span className="font-medium text-fg">{current}</span>
          </div>
          <a href="/docs/" className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs text-muted hover:bg-raised">
            <CircleHelp className="size-3.5" /> Help & guides
          </a>
        </div>
        <DemoBanner />
        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          {signedIn ? children : <AppRouteSkeleton pathname={pathname} />}
        </main>
      </div>
    </div>
  );
}
