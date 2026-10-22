import "server-only";
import { newId } from "@/lib/utils";
import { unseal } from "./crypto";
import { db, nowIso, save } from "./db";
import { appUrl } from "./settings";
import { stripe } from "./stripe";
import type { Menu, Order, OrderItem } from "./types";

/** The menu on a receptionist's take_order tool (empty when the owner has not written one). */
export function menuFor(agentId: string): Menu {
  const tool = db().agentTools.find((t) => t.agentId === agentId && t.toolKey === "take_order");
  const menu = tool?.config?.menu as Partial<Menu> | undefined;
  return {
    currency: typeof menu?.currency === "string" && menu.currency ? menu.currency.toLowerCase() : "usd",
    items: Array.isArray(menu?.items)
      ? menu.items.filter((i) => i && typeof i.name === "string" && i.name.trim() && Number.isFinite(i.priceCents) && i.priceCents >= 0)
      : [],
  };
}

export function money(cents: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

/** Lowercase, no punctuation, no plural, and without words that don't change what the item is. */
const norm = (t: string) =>
  t
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\b(a|an|the|of|please|small|medium|large|regular|hot)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/(es|s)$/, "");

/**
 * The menu item a caller means: the exact name, else the only name that contains their words
 * ("pizza" with one pizza on the menu). "Pumpkin spice latte" is not a Latte, and "pizza" with two pizzas is unclear.
 */
export function matchMenu(menu: Menu, wanted: string) {
  const w = norm(wanted);
  if (!w) return undefined;
  const exact = menu.items.find((i) => norm(i.name) === w);
  if (exact) return exact;
  const near = menu.items.filter((i) => norm(i.name).includes(w));
  return near.length === 1 ? near[0] : undefined;
}

/** The secret key of the Stripe account attached to this receptionist, if any. */
function stripeKeyFor(agentId: string) {
  const data = db();
  const conn = data.agentConnections
    .filter((l) => l.agentId === agentId)
    .map((l) => data.connections.find((c) => c.id === l.connectionId))
    .find((c) => c?.appKey === "stripe");
  return unseal<{ token?: string }>(conn?.secret)?.token || null;
}

function reference() {
  return Math.random().toString(36).slice(2, 7).toUpperCase();
}

export function newOrder(input: Omit<Order, "id" | "reference" | "status" | "payment" | "createdAt" | "updatedAt">): Order {
  const now = nowIso();
  const order: Order = {
    ...input,
    id: newId("ord"),
    reference: reference(),
    status: "new",
    payment: { status: "none", url: null, sessionId: null },
    createdAt: now,
    updatedAt: now,
  };
  db().orders.push(order);
  save();
  return order;
}

export function orderTotal(items: OrderItem[]) {
  return items.every((i) => i.unitCents !== null) ? items.reduce((sum, i) => sum + (i.unitCents ?? 0) * i.qty, 0) : null;
}

/**
 * A Stripe Checkout link on the business's own Stripe account. Card details go to Stripe's page,
 * never through the receptionist. Returns null when no Stripe account is attached or the order has no total.
 */
export async function attachPaymentLink(order: Order) {
  const key = stripeKeyFor(order.agentId);
  if (!key || !order.totalCents) return null;
  const params: Record<string, string> = {
    mode: "payment",
    success_url: `${appUrl()}/pay/thanks?ref=${order.reference}`,
    cancel_url: `${appUrl()}/pay/thanks?ref=${order.reference}&cancelled=1`,
    client_reference_id: order.id,
    "metadata[orderId]": order.id,
    "metadata[reference]": order.reference,
  };
  order.items.forEach((item, i) => {
    params[`line_items[${i}][quantity]`] = String(item.qty);
    params[`line_items[${i}][price_data][currency]`] = order.currency;
    params[`line_items[${i}][price_data][unit_amount]`] = String(item.unitCents ?? 0);
    params[`line_items[${i}][price_data][product_data][name]`] = item.note ? `${item.name} (${item.note})` : item.name;
  });
  const session = await stripe<{ id: string; url: string }>("POST", "/checkout/sessions", params, key);
  order.payment = { status: "pending", url: session.url, sessionId: session.id };
  order.updatedAt = nowIso();
  save();
  return session.url;
}

/** Ask Stripe whether recent unpaid links have been paid (no per-business webhook needed). */
export async function refreshPayments(userId: string) {
  const dayAgo = Date.now() - 2 * 864e5;
  const pending = db()
    .orders.filter((o) => o.userId === userId && o.payment.status === "pending" && o.payment.sessionId && new Date(o.createdAt).getTime() > dayAgo)
    .slice(0, 10);
  await Promise.all(
    pending.map(async (o) => {
      const key = stripeKeyFor(o.agentId);
      if (!key) return;
      try {
        const s = await stripe<{ payment_status: string; status: string }>("GET", `/checkout/sessions/${o.payment.sessionId}`, undefined, key);
        const next = s.payment_status === "paid" ? "paid" : s.status === "expired" ? "expired" : "pending";
        if (next !== o.payment.status) {
          o.payment.status = next;
          o.updatedAt = nowIso();
        }
      } catch {
        // Stripe unreachable or the key was rotated: keep the last known status.
      }
    }),
  );
  if (pending.length) save();
}
