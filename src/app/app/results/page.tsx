"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarCheck, CircleDot, UserRound } from "lucide-react";
import { DataTable, EmptyState, Page, PageBody, PageHeader, Segmented } from "@/components/app/page";
import { RowsSkeleton } from "@/components/app/skeletons";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";

export default function ResultsPage() {
  const [tab, setTab] = useState<"bookings" | "leads" | "tickets">("bookings");
  const bookings = useQuery({ queryKey: ["booked-slots"], queryFn: () => api.outcomes.bookings() });
  const leads = useQuery({ queryKey: ["leads"], queryFn: () => api.outcomes.leads() });
  const tickets = useQuery({ queryKey: ["tickets"], queryFn: () => api.outcomes.tickets() });

  return (
    <Page>
      <PageHeader
        title="Bookings & follow-ups"
        description="New appointments, interested customers, and people who need a hand."
        actions={
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { id: "bookings", label: "Bookings" },
              { id: "leads", label: "Leads" },
              { id: "tickets", label: "Tickets" },
            ]}
          />
        }
      />
      <PageBody>
        {tab === "bookings" &&
          (bookings.isPending ? (
            <RowsSkeleton colsClass="sm:grid-cols-[12rem_minmax(0,1fr)_10rem_10rem]" />
          ) : bookings.data && bookings.data.length > 0 ? (
            <DataTable columns={["When", "Who", "Line", "Contact"]} colsClass="sm:grid-cols-[12rem_minmax(0,1fr)_10rem_10rem]">
              {bookings.data.map((b) => (
                <li className="grid items-center gap-1 px-4 py-3.5 sm:grid-cols-[12rem_minmax(0,1fr)_10rem_10rem] sm:gap-4 sm:px-6" key={b.id}>
                  <span className="text-sm font-medium">{b.label}</span>
                  <span className="text-sm">{b.bookedName || "—"}</span>
                  <span className="text-sm text-muted">{b.agentName}</span>
                  <span className="text-sm text-muted">{b.bookedContact || "—"}</span>
                </li>
              ))}
            </DataTable>
          ) : (
            <EmptyState
              icon={CalendarCheck}
              title="No bookings yet"
              description="Appointments appear here when your receptionist helps a caller book a time."
              action={
                <Link href="/app/new" className="text-sm font-medium hover:underline">
                  New agent
                </Link>
              }
            />
          ))}
        {tab === "leads" &&
          (leads.isPending ? (
            <RowsSkeleton colsClass="sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_10rem_7rem]" />
          ) : leads.data && leads.data.length > 0 ? (
            <DataTable columns={["Name", "Interest", "Line", "Status"]} colsClass="sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_10rem_7rem]">
              {leads.data.map((l) => (
                <li className="grid items-center gap-1 px-4 py-3.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_10rem_7rem] sm:gap-4 sm:px-6" key={l.id}>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{l.name}</span>
                    <span className="block truncate text-xs text-subtle">{l.contact || l.company}</span>
                  </span>
                  <span className="truncate text-sm text-muted">{l.interest || "—"}</span>
                  <span className="text-sm text-muted">{l.agentName}</span>
                  <Badge tone="live">{l.status}</Badge>
                </li>
              ))}
            </DataTable>
          ) : (
            <EmptyState icon={UserRound} title="No leads yet" description="A sales or pitch line writes a lead when it has a name and an interest." />
          ))}
        {tab === "tickets" &&
          (tickets.isPending ? (
            <RowsSkeleton colsClass="sm:grid-cols-[minmax(0,1.6fr)_10rem_7rem]" />
          ) : tickets.data && tickets.data.length > 0 ? (
            <DataTable columns={["Subject", "Line", "Status"]} colsClass="sm:grid-cols-[minmax(0,1.6fr)_10rem_7rem]">
              {tickets.data.map((t) => (
                <li className="grid items-center gap-1 px-4 py-3.5 sm:grid-cols-[minmax(0,1.6fr)_10rem_7rem] sm:gap-4 sm:px-6" key={t.id}>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{t.subject}</span>
                    <span className="block truncate text-xs text-subtle">{t.body || "—"}</span>
                  </span>
                  <span className="text-sm text-muted">{t.agentName}</span>
                  <Badge>{t.status}</Badge>
                </li>
              ))}
            </DataTable>
          ) : (
            <EmptyState icon={CircleDot} title="No tickets yet" description="Support lines open a ticket when they cannot finish the call." />
          ))}
      </PageBody>
    </Page>
  );
}
