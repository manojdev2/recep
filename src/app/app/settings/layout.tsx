"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { CalendarClock, CreditCard, Hash, User } from "lucide-react";
import { Page, PageBody, PageHeader } from "@/components/app/page";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/app/settings", label: "Account", icon: User, exact: true },
  { to: "/app/settings/hours", label: "Opening hours", icon: CalendarClock, exact: false },
  { to: "/app/phone", label: "Phone numbers", icon: Hash, exact: false },
  { to: "/app/settings/billing", label: "Plan", icon: CreditCard, exact: false },
];

export default function SettingsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <Page>
      <PageHeader title="Settings" description="The details that make this workspace yours." />
      <PageBody className="px-4 py-6 sm:px-6">
        <nav className="mb-7 flex w-fit max-w-full flex-wrap gap-1 rounded-2xl border border-border bg-surface p-1.5">
          {TABS.map((t) => {
            const on = t.exact ? pathname === t.to : pathname.startsWith(t.to);
            return (
              <Link
                href={t.to}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm transition-colors",
                  on ? "bg-accent/10 font-semibold text-accent" : "text-muted hover:bg-raised hover:text-fg",
                )}
                key={t.to}
              >
                <t.icon className="size-3.5" />
                {t.label}
              </Link>
            );
          })}
        </nav>
        {children}
      </PageBody>
    </Page>
  );
}
