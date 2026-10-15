"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, ArrowLeft, CreditCard, ScrollText, Settings2, ShieldCheck, Users, Wallet } from "lucide-react";
import { AdminRouteSkeleton } from "@/components/admin/skeletons";
import { api } from "@/lib/api";
import { useSession } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/admin", label: "Overview", icon: ShieldCheck, exact: true },
  { to: "/admin/tenants", label: "Accounts", icon: Users, exact: false },
  { to: "/admin/finance", label: "Finance", icon: Wallet, exact: false },
  { to: "/admin/plans", label: "Plans", icon: CreditCard, exact: false },
  { to: "/admin/health", label: "Service health", icon: Activity, exact: false },
  { to: "/admin/settings", label: "Configuration", icon: Settings2, exact: false },
  { to: "/admin/audit", label: "Audit", icon: ScrollText, exact: false },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { user, isPending } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const overview = useQuery({ queryKey: ["admin", "overview"], queryFn: () => api.admin.overview(), retry: false, enabled: !!user });

  useEffect(() => {
    if (!isPending && !user) router.replace("/login");
  }, [isPending, user, router]);

  if (overview.isError) {
    return (
      <div className="grid min-h-dvh place-items-center bg-bg px-6">
        <div className="max-w-sm text-center">
          <h1 className="text-2xl font-medium tracking-tight">Not found</h1>
          <p className="mt-2 text-sm text-muted">There is nothing at this address.</p>
          <Link href="/app" className="mt-6 inline-flex items-center gap-2 text-sm text-accent hover:underline">
            <ArrowLeft className="size-4" />
            Back to the app
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-bg">
      <header className="bg-fg text-bg">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4" />
            <span className="text-sm font-medium">Platform admin</span>
          </div>
          <nav className="flex flex-wrap items-center gap-1">
            {NAV.map((n) => {
              const on = n.exact ? pathname === n.to : pathname.startsWith(n.to);
              return (
                <Link
                  href={n.to}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors",
                    on ? "bg-bg/20 font-medium" : "text-bg/70 hover:bg-bg/10 hover:text-bg",
                  )}
                  key={n.to}
                >
                  <n.icon className="size-3.5" />
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <Link href="/app" className="ml-auto flex items-center gap-1.5 text-sm text-bg/70 transition-colors hover:text-bg">
            <ArrowLeft className="size-3.5" />
            Your workspace
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">{overview.isPending ? <AdminRouteSkeleton pathname={pathname} /> : children}</main>
    </div>
  );
}
