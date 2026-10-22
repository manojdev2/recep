import "server-only";
import crypto from "node:crypto";
import { recordProviderEvent } from "./ai";
import { db, nowIso, save } from "./db";
import { RpcError } from "./rpc";
import { getSetting } from "./settings";
import { newId } from "@/lib/utils";

/**
 * Minimal Stripe client over fetch (form-encoded, like the official SDK). Uses the platform's key
 * unless `accountKey` (a business's own connected Stripe account) is given.
 */
export async function stripe<T = Record<string, unknown>>(method: "GET" | "POST", path: string, params?: Record<string, string>, accountKey?: string) {
  const key = accountKey || getSetting("STRIPE_SECRET_KEY");
  if (!key) throw new RpcError("Card payments aren’t switched on for this workspace yet.");
  const qs = params ? new URLSearchParams(params).toString() : "";
  const started = Date.now();
  const res = await fetch(`https://api.stripe.com/v1${path}${method === "GET" && qs ? `?${qs}` : ""}`, {
    method,
    headers: { authorization: `Bearer ${key}`, ...(method === "POST" ? { "content-type": "application/x-www-form-urlencoded" } : {}) },
    body: method === "POST" ? qs : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  recordProviderEvent("stripe", path.split("/")[1] ?? "api", res.ok, Date.now() - started, res.ok ? null : String(res.status));
  const body = await res.json();
  if (!res.ok) throw new RpcError(body.error?.message ?? `Stripe answered ${res.status}.`);
  return body as T;
}

export function verifyStripeSignature(payload: string, header: string | null) {
  const secret = getSetting("STRIPE_WEBHOOK_SECRET");
  if (!secret || !header) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
  const t = parts.t;
  const v1 = header
    .split(",")
    .filter((p) => p.startsWith("v1="))
    .map((p) => p.slice(3));
  if (!t || !v1.length || Math.abs(Date.now() / 1000 - Number(t)) > 600) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
  return v1.some((sig) => sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)));
}

/** Record a subscription as Stripe reports it. */
export function applySubscription(input: {
  userId: string;
  planId?: string;
  status: string;
  customerId?: string | null;
  subscriptionId?: string | null;
  currentPeriodEnd?: number | null;
  amountMicros?: number;
}) {
  const data = db();
  const status: "active" | "past_due" | "cancelled" =
    input.status === "active" || input.status === "trialing" ? "active" : input.status === "past_due" || input.status === "unpaid" ? "past_due" : "cancelled";
  let sub = data.subscriptions.find((s) => s.userId === input.userId);
  if (!sub) {
    sub = { userId: input.userId, planId: input.planId ?? "studio", status, customerId: null, subscriptionId: null, renewsAt: null, updatedAt: nowIso() };
    data.subscriptions.push(sub);
  }
  if (input.planId) sub.planId = input.planId;
  sub.status = status;
  if (input.customerId) sub.customerId = input.customerId;
  if (input.subscriptionId) sub.subscriptionId = input.subscriptionId;
  if (input.currentPeriodEnd) sub.renewsAt = new Date(input.currentPeriodEnd * 1000).toISOString();
  sub.updatedAt = nowIso();
  const user = data.users.find((u) => u.id === input.userId);
  if (user) user.plan = status === "cancelled" ? "studio" : sub.planId;
  if (input.amountMicros) {
    data.revenue.push({
      id: newId("rev"),
      userId: input.userId,
      plan: sub.planId,
      amountMicros: input.amountMicros,
      currency: "USD",
      period: nowIso().slice(0, 10),
      note: "Stripe",
      source: "stripe",
      createdAt: nowIso(),
    });
  }
  save();
  return sub;
}
