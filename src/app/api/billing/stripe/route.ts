import { db } from "@/server/db";
import { applySubscription, verifyStripeSignature } from "@/server/stripe";

type StripeSub = {
  id: string;
  customer: string;
  status: string;
  metadata?: Record<string, string>;
  current_period_end?: number;
  items?: { data?: { current_period_end?: number; price?: { id?: string } }[] };
};

const planForPrice = (priceId?: string) => (priceId ? db().plans.find((p) => p.stripePriceId === priceId)?.id : undefined);

function ownerOf(sub: { customer?: string | null; id?: string; metadata?: Record<string, string> }) {
  if (sub.metadata?.userId) return sub.metadata.userId;
  const row = db().subscriptions.find((s) => (sub.id && s.subscriptionId === sub.id) || (sub.customer && s.customerId === sub.customer));
  return row?.userId;
}

/** Stripe webhook: checkout completed, subscription changed or ended, payment failed. */
export async function POST(req: Request) {
  const payload = await req.text();
  if (!verifyStripeSignature(payload, req.headers.get("stripe-signature"))) return new Response("Invalid signature", { status: 400 });
  const event = JSON.parse(payload) as { type: string; data: { object: Record<string, unknown> } };
  const obj = event.data.object;

  switch (event.type) {
    case "checkout.session.completed": {
      const s = obj as { client_reference_id?: string; customer?: string; subscription?: string; metadata?: Record<string, string>; amount_total?: number };
      const userId = s.client_reference_id || s.metadata?.userId;
      if (!userId) break;
      const already = db().subscriptions.find((x) => x.userId === userId)?.subscriptionId === s.subscription;
      applySubscription({
        userId,
        planId: s.metadata?.planId,
        status: "active",
        customerId: s.customer ?? null,
        subscriptionId: s.subscription ?? null,
        amountMicros: already || !s.amount_total ? undefined : s.amount_total * 10_000,
      });
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = obj as unknown as StripeSub;
      const userId = ownerOf(sub);
      if (!userId) break;
      const item = sub.items?.data?.[0];
      applySubscription({
        userId,
        planId: sub.metadata?.planId ?? planForPrice(item?.price?.id),
        status: event.type === "customer.subscription.deleted" ? "canceled" : sub.status,
        customerId: sub.customer,
        subscriptionId: sub.id,
        currentPeriodEnd: sub.current_period_end ?? item?.current_period_end ?? null,
      });
      break;
    }
    case "invoice.payment_failed": {
      const inv = obj as { customer?: string; subscription?: string };
      const userId = ownerOf({ customer: inv.customer, id: inv.subscription });
      if (userId) applySubscription({ userId, status: "past_due" });
      break;
    }
    case "invoice.paid": {
      const inv = obj as { customer?: string; subscription?: string; amount_paid?: number; billing_reason?: string };
      const userId = ownerOf({ customer: inv.customer, id: inv.subscription });
      // The first invoice is already counted at checkout.
      if (userId && inv.billing_reason === "subscription_cycle" && inv.amount_paid) {
        applySubscription({ userId, status: "active", amountMicros: inv.amount_paid * 10_000 });
      }
      break;
    }
  }
  return Response.json({ received: true });
}
