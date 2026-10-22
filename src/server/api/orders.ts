import "server-only";
import { newId } from "@/lib/utils";
import { db, nowIso, save } from "../db";
import { attachPaymentLink, menuFor, money, refreshPayments } from "../orders";
import { mutation, query, RpcError } from "../rpc";
import type { Order } from "../types";

const agentName = (id: string) => db().agents.find((a) => a.id === id)?.name ?? "—";

function ownOrder(userId: string, id: string) {
  const order = db().orders.find((o) => o.id === id && o.userId === userId);
  if (!order) throw new RpcError("That order is gone.", 404);
  return order;
}

export const orders = {
  /** Newest first. Unpaid links are checked with Stripe on the way. */
  list: query(async (_: void, { user }) => {
    await refreshPayments(user.id);
    return db()
      .orders.filter((o) => o.userId === user.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 200)
      .map((o) => ({ ...o, total: o.totalCents === null ? null : money(o.totalCents, o.currency), agentName: agentName(o.agentId) }));
  }),

  setStatus: mutation((input: { id: string; status: Order["status"] }, { user }) => {
    if (!["new", "ready", "done", "cancelled"].includes(input.status)) throw new RpcError("Unknown status.");
    const order = ownOrder(user.id, input.id);
    order.status = input.status;
    order.updatedAt = nowIso();
    save();
    return { ok: true };
  }),

  /** A payment link for the team to send (phone orders, or one that expired). */
  paymentLink: mutation(async (id: string, { user }) => {
    const order = ownOrder(user.id, id);
    if (order.payment.status === "paid") throw new RpcError("This order is already paid.");
    if (!order.totalCents) throw new RpcError("This order has no total. Add prices to the menu first.");
    order.payment = { status: "none", url: null, sessionId: null };
    const url = await attachPaymentLink(order);
    if (!url) throw new RpcError("Connect Stripe to this receptionist (Apps tab) to send payment links.");
    return { url };
  }),

  menu: query((agentId: string, { user }) => {
    if (!db().agents.some((a) => a.id === agentId && a.userId === user.id)) throw new RpcError("This receptionist is gone.", 404);
    return menuFor(agentId);
  }),

  saveMenu: mutation((input: { agentId: string; currency: string; items: { name: string; price: string | number }[] }, { user }) => {
    const data = db();
    if (!data.agents.some((a) => a.id === input.agentId && a.userId === user.id)) throw new RpcError("This receptionist is gone.", 404);
    const currency = String(input.currency || "usd").trim().toLowerCase();
    if (!/^[a-z]{3}$/.test(currency)) throw new RpcError("Use a three-letter currency code, like USD or GBP.");
    const items = [];
    for (const i of input.items ?? []) {
      const name = String(i.name ?? "").trim();
      if (!name) continue;
      const price = Number(String(i.price ?? "").replace(/[^\d.]/g, ""));
      if (!Number.isFinite(price) || price < 0) throw new RpcError(`Give ${name} a price.`);
      items.push({ name: name.slice(0, 80), priceCents: Math.round(price * 100) });
    }
    let tool = data.agentTools.find((t) => t.agentId === input.agentId && t.toolKey === "take_order");
    if (!tool) {
      tool = { id: newId("tool"), agentId: input.agentId, toolKey: "take_order", enabled: true, config: {}, createdAt: nowIso() };
      data.agentTools.push(tool);
    }
    tool.config = { ...tool.config, menu: { currency, items } };
    save();
    return { items: items.length };
  }),
};
