import "server-only";
import { db, save } from "../db";
import { queueStats, schedulerRunning } from "../jobs";
import { mutation, query, RpcError } from "../rpc";
import { getSetting, requestOrigin } from "../settings";
import { applySubscription, stripe } from "../stripe";
import { planFeatures, usageFor } from "../usage";

export const account = {
  get: query((_: void, { user }) => ({
    usage: usageFor(user.id),
    plans: db()
      .plans.filter((p) => p.public)
      .sort((a, b) => a.position - b.position)
      .map(({ id, name, priceLabel, minutes, agents }) => ({ id, name, priceLabel, minutes, agents })),
    queue: queueStats(),
    backgroundWork: schedulerRunning() ? "running" : "not configured",
  })),

  /** Everything the workspace holds, minus connector and carrier secrets. */
  export: mutation(
    (_: void, { user }) => {
      const d = db();
      const mine = <T extends { userId: string }>(rows: T[]) => rows.filter((r) => r.userId === user.id);
      const agentIds = new Set(mine(d.agents).map((a) => a.id));
      const convIds = new Set(mine(d.conversations).map((c) => c.id));
      const formIds = new Set(mine(d.forms).map((f) => f.id));
      const campaignIds = new Set(mine(d.campaigns).map((c) => c.id));
      return {
        exportedAt: new Date().toISOString(),
        account: { id: user.id, email: user.email, name: user.name },
        agents: mine(d.agents),
        tools: d.agentTools.filter((t) => agentIds.has(t.agentId)),
        hours: d.hours.filter((h) => agentIds.has(h.agentId)),
        conversations: mine(d.conversations),
        messages: d.messages.filter((m) => convIds.has(m.conversationId)),
        slots: mine(d.slots),
        leads: mine(d.leads),
        tickets: mine(d.tickets),
        orders: mine(d.orders),
        contacts: mine(d.contacts),
        knowledge: mine(d.knowledge),
        phoneNumbers: mine(d.phoneNumbers).map(({ secret: _s, ...n }) => n),
        calls: mine(d.calls),
        campaigns: mine(d.campaigns),
        campaignContacts: d.campaignContacts.filter((t) => campaignIds.has(t.campaignId)),
        forms: mine(d.forms),
        formSubmissions: d.formSubmissions.filter((s) => formIds.has(s.formId)),
        webhooks: mine(d.webhooks).map(({ secret: _s, ...w }) => w),
        connections: mine(d.connections).map(({ secret: _s, ...c }) => c),
        usage: mine(d.usage),
      };
    },
    { demoWritable: true },
  ),

  deleteWorkspace: mutation((input: { confirmEmail: string }, { user }) => {
    if (input.confirmEmail.trim().toLowerCase() !== user.email.toLowerCase()) throw new RpcError("Type your email exactly to confirm.");
    if (user.adminLevel === "super" && db().admins.filter((a) => a.level === "super").length === 1) {
      throw new RpcError("You are the only super admin. Grant another before deleting this account.");
    }
    const d = db();
    const keep = <T extends { userId: string }>(rows: T[]) => rows.filter((r) => r.userId !== user.id);
    const agentIds = new Set(d.agents.filter((a) => a.userId === user.id).map((a) => a.id));
    const convIds = new Set(d.conversations.filter((c) => c.userId === user.id).map((c) => c.id));
    const formIds = new Set(d.forms.filter((f) => f.userId === user.id).map((f) => f.id));
    const campaignIds = new Set(d.campaigns.filter((c) => c.userId === user.id).map((c) => c.id));
    d.agentTools = d.agentTools.filter((t) => !agentIds.has(t.agentId));
    d.hours = d.hours.filter((h) => !agentIds.has(h.agentId));
    d.agentConnections = d.agentConnections.filter((l) => !agentIds.has(l.agentId));
    d.messages = d.messages.filter((m) => !convIds.has(m.conversationId));
    d.formSubmissions = d.formSubmissions.filter((s) => !formIds.has(s.formId));
    d.campaignContacts = d.campaignContacts.filter((t) => !campaignIds.has(t.campaignId));
    d.agents = keep(d.agents);
    d.conversations = keep(d.conversations);
    d.slots = keep(d.slots);
    d.leads = keep(d.leads);
    d.tickets = keep(d.tickets);
    d.orders = keep(d.orders);
    d.transfers = keep(d.transfers);
    d.contacts = keep(d.contacts);
    d.knowledge = keep(d.knowledge);
    d.phoneNumbers = keep(d.phoneNumbers);
    d.calls = keep(d.calls);
    d.campaigns = keep(d.campaigns);
    d.forms = keep(d.forms);
    d.webhooks = keep(d.webhooks);
    d.sheets = keep(d.sheets);
    d.messaging = keep(d.messaging);
    d.connections = keep(d.connections);
    d.subscriptions = keep(d.subscriptions);
    d.usage = keep(d.usage);
    d.sessions = keep(d.sessions);
    d.admins = keep(d.admins);
    d.users = d.users.filter((u) => u.id !== user.id);
    save();
    return { ok: true };
  }),
};

export const billing = {
  get: query((_: void, { user }) => {
    const d = db();
    const sub = d.subscriptions.find((s) => s.userId === user.id);
    const current = sub && sub.status !== "cancelled" ? sub.planId : (d.users.find((u) => u.id === user.id)?.plan ?? "studio");
    const stripeOn = !!getSetting("STRIPE_SECRET_KEY");
    return {
      currentPlan: current,
      status: sub?.status ?? "active",
      subscribed: !!sub?.subscriptionId && sub.status !== "cancelled",
      checkoutConfigured: stripeOn,
      renewsAt: sub?.renewsAt ?? null,
      supportEmail: getSetting("SUPPORT_EMAIL"),
      plans: d.plans
        .filter((p) => p.public || p.id === current)
        .sort((a, b) => a.position - b.position)
        .map((p) => ({
          id: p.id,
          name: p.name,
          priceLabel: p.priceLabel,
          features: planFeatures(p),
          minutes: p.minutes,
          agents: p.agents,
          numbers: p.numbers,
          checkout: stripeOn && !!p.stripePriceId,
        })),
    };
  }),

  checkout: mutation(async (input: { planId: string }, { user, req }) => {
    const plan = db().plans.find((p) => p.id === input.planId);
    if (!plan?.stripePriceId) throw new RpcError("That plan is not sold online. Get in touch instead.");
    const sub = db().subscriptions.find((s) => s.userId === user.id);
    const base = requestOrigin(req);
    const session = await stripe<{ url: string }>("POST", "/checkout/sessions", {
      mode: "subscription",
      "line_items[0][price]": plan.stripePriceId,
      "line_items[0][quantity]": "1",
      success_url: `${base}/app/settings/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/app/settings/billing?checkout=cancelled`,
      client_reference_id: user.id,
      "metadata[userId]": user.id,
      "metadata[planId]": plan.id,
      "subscription_data[metadata][userId]": user.id,
      "subscription_data[metadata][planId]": plan.id,
      ...(sub?.customerId ? { customer: sub.customerId } : { customer_email: user.email }),
    });
    return { url: session.url };
  }),

  confirm: mutation(async (input: { sessionId: string }, { user }) => {
    const session = await stripe<{
      client_reference_id: string;
      customer: string;
      subscription: { id: string; status: string; current_period_end: number } | string | null;
      metadata: Record<string, string>;
      amount_total: number | null;
    }>("GET", `/checkout/sessions/${encodeURIComponent(input.sessionId)}`, { "expand[]": "subscription" });
    if (session.client_reference_id !== user.id) throw new RpcError("That checkout belongs to someone else.");
    const s = typeof session.subscription === "object" ? session.subscription : null;
    const already = db().subscriptions.find((x) => x.userId === user.id)?.subscriptionId === s?.id;
    const out = applySubscription({
      userId: user.id,
      planId: session.metadata.planId,
      status: s?.status ?? "active",
      customerId: session.customer,
      subscriptionId: s?.id ?? null,
      currentPeriodEnd: s?.current_period_end ?? null,
      amountMicros: !already && session.amount_total ? session.amount_total * 10_000 : 0,
    });
    return { status: out.status, plan: out.planId };
  }),

  portal: mutation(async (_: void, { user, req }) => {
    const sub = db().subscriptions.find((s) => s.userId === user.id);
    if (!sub?.customerId) throw new RpcError("There is no billing account yet.");
    const session = await stripe<{ url: string }>("POST", "/billing_portal/sessions", {
      customer: sub.customerId,
      return_url: `${requestOrigin(req)}/app/settings/billing`,
    });
    return { url: session.url };
  }),
};
