"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, CircleDot, ShoppingBag, UserRound } from "lucide-react";
import { toast } from "sonner";
import { DataTable, EmptyState, Page, PageBody, PageHeader, Segmented } from "@/components/app/page";
import { RowsSkeleton } from "@/components/app/skeletons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api, type ApiResult } from "@/lib/api";

type OrderRow = ApiResult<"orders", "list">[number];

const PAYMENT: Record<OrderRow["payment"]["status"], { label: string; tone: "live" | "warn" | "mute" }> = {
  paid: { label: "Paid", tone: "live" },
  pending: { label: "Link sent", tone: "warn" },
  expired: { label: "Link expired", tone: "mute" },
  none: { label: "Pay on collection", tone: "mute" },
};

/** What the team does next with an order. */
const NEXT: Record<OrderRow["status"], { status: OrderRow["status"]; label: string }[]> = {
  new: [
    { status: "ready", label: "Ready" },
    { status: "cancelled", label: "Cancel" },
  ],
  ready: [{ status: "done", label: "Collected" }],
  done: [],
  cancelled: [{ status: "new", label: "Reopen" }],
};

function Orders() {
  const qc = useQueryClient();
  const orders = useQuery({ queryKey: ["orders"], queryFn: () => api.orders.list() });
  const setStatus = useMutation({
    mutationFn: (input: { id: string; status: OrderRow["status"] }) => api.orders.setStatus(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orders"] }),
    onError: (e: Error) => toast.error(e.message),
  });
  const link = useMutation({
    mutationFn: (id: string) => api.orders.paymentLink(id),
    onSuccess: async (out) => {
      await qc.invalidateQueries({ queryKey: ["orders"] });
      try {
        await navigator.clipboard.writeText(out.url);
        toast.success("Payment link copied. Text it to the customer.");
      } catch {
        toast.success("Payment link ready — copy it from the order.");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const cols = "sm:grid-cols-[minmax(0,1fr)_7.5rem_11rem]";
  if (orders.isPending) return <RowsSkeleton colsClass={cols} />;
  if (!orders.data?.length) {
    return (
      <EmptyState
        icon={ShoppingBag}
        title="No orders yet"
        description="Turn on Take order for a receptionist and add your menu. Orders appear here with a total and whether they're paid."
      />
    );
  }
  return (
    <DataTable columns={["Order", "Total", "Status"]} colsClass={cols}>
      {orders.data.map((o) => {
        const pay = PAYMENT[o.payment.status];
        return (
          <li className={`grid items-center gap-2 px-4 py-3.5 sm:gap-3 sm:px-6 ${cols}`} key={o.id}>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">
                {o.name} <span className="text-xs font-normal text-subtle">#{o.reference}</span>
              </span>
              <span className="block text-sm text-muted">{o.items.map((i) => `${i.qty} × ${i.name}${i.note ? ` (${i.note})` : ""}`).join(", ")}</span>
              <span className="block truncate text-xs text-subtle">
                {o.fulfilment === "delivery" ? `Delivery to ${o.address}` : "Pickup"}
                {o.readyAt ? ` · ${o.readyAt}` : ""}
                {o.contact ? ` · ${o.contact}` : ""}
                {o.notes ? ` · ${o.notes}` : ""}
              </span>
            </span>
            <span className="grid justify-items-start gap-1">
              <span className="text-sm font-medium tabular-nums">{o.total ?? "To confirm"}</span>
              <Badge tone={pay.tone}>{pay.label}</Badge>
            </span>
            <span className="flex flex-wrap items-center gap-1.5">
              <Badge tone={o.status === "new" ? "warn" : o.status === "ready" ? "live" : "mute"}>{o.status}</Badge>
              {NEXT[o.status].map((n) => (
                <Button size="sm" variant="ghost" className="h-7 px-2.5 text-xs" disabled={setStatus.isPending} onClick={() => setStatus.mutate({ id: o.id, status: n.status })} key={n.status}>
                  {n.label}
                </Button>
              ))}
              {o.payment.status !== "paid" && o.status !== "cancelled" && o.total ? (
                <Button size="sm" variant="ghost" className="h-7 px-2.5 text-xs" disabled={link.isPending} onClick={() => link.mutate(o.id)}>
                  {o.payment.status === "pending" ? "New link" : "Payment link"}
                </Button>
              ) : null}
            </span>
          </li>
        );
      })}
    </DataTable>
  );
}

export default function ResultsPage() {
  const [tab, setTab] = useState<"bookings" | "orders" | "leads" | "tickets">("bookings");
  const bookings = useQuery({ queryKey: ["booked-slots"], queryFn: () => api.outcomes.bookings() });
  const leads = useQuery({ queryKey: ["leads"], queryFn: () => api.outcomes.leads() });
  const tickets = useQuery({ queryKey: ["tickets"], queryFn: () => api.outcomes.tickets() });

  return (
    <Page>
      <PageHeader
        title="Bookings & follow-ups"
        description="New appointments, orders, interested customers, and people who need a hand."
        actions={
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { id: "bookings", label: "Bookings" },
              { id: "orders", label: "Orders" },
              { id: "leads", label: "Leads" },
              { id: "tickets", label: "Tickets" },
            ]}
          />
        }
      />
      <PageBody>
        {tab === "bookings" &&
          (bookings.isPending ? (
            <RowsSkeleton colsClass="sm:grid-cols-[minmax(8.5rem,0.9fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]" />
          ) : bookings.data && bookings.data.length > 0 ? (
            <DataTable columns={["When", "Who", "Line", "Contact"]} colsClass="sm:grid-cols-[minmax(8.5rem,0.9fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
              {bookings.data.map((b) => (
                <li className="grid items-center gap-1 px-4 py-3.5 sm:grid-cols-[minmax(8.5rem,0.9fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] sm:gap-3 sm:px-6" key={b.id}>
                  <span className="text-sm font-medium whitespace-nowrap">{b.label}</span>
                  <span className="truncate text-sm" title={b.bookedName}>
                    {b.bookedName || "—"}
                  </span>
                  <span className="truncate text-sm text-muted" title={b.agentName}>
                    {b.agentName}
                  </span>
                  <span className="truncate text-sm text-muted">{b.bookedContact || "—"}</span>
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
        {tab === "orders" && <Orders />}
        {tab === "leads" &&
          (leads.isPending ? (
            <RowsSkeleton colsClass="sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1fr)_6.5rem]" />
          ) : leads.data && leads.data.length > 0 ? (
            <DataTable columns={["Name", "Interest", "Line", "Status"]} colsClass="sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1fr)_6.5rem]">
              {leads.data.map((l) => (
                <li className="grid items-center gap-1 px-4 py-3.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1fr)_6.5rem] sm:gap-3 sm:px-6" key={l.id}>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{l.name}</span>
                    <span className="block truncate text-xs text-subtle">{l.contact || l.company}</span>
                  </span>
                  <span className="truncate text-sm text-muted">{l.interest || "—"}</span>
                  <span className="truncate text-sm text-muted" title={l.agentName}>
                    {l.agentName}
                  </span>
                  <Badge tone="live">{l.status}</Badge>
                </li>
              ))}
            </DataTable>
          ) : (
            <EmptyState icon={UserRound} title="No leads yet" description="A sales or pitch line writes a lead when it has a name and an interest." />
          ))}
        {tab === "tickets" &&
          (tickets.isPending ? (
            <RowsSkeleton colsClass="sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_6.5rem]" />
          ) : tickets.data && tickets.data.length > 0 ? (
            <DataTable columns={["Subject", "Line", "Status"]} colsClass="sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_6.5rem]">
              {tickets.data.map((t) => (
                <li className="grid items-center gap-1 px-4 py-3.5 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_6.5rem] sm:gap-3 sm:px-6" key={t.id}>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{t.subject}</span>
                    <span className="block truncate text-xs text-subtle">{t.body || "—"}</span>
                  </span>
                  <span className="truncate text-sm text-muted" title={t.agentName}>
                    {t.agentName}
                  </span>
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
