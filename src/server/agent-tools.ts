import "server-only";
import { TOOL_CATALOG } from "@/lib/catalog";
import { newId } from "@/lib/utils";
import type { ToolSpec } from "./ai";
import { unseal } from "./crypto";
import { db, nowIso, save } from "./db";
import { emit } from "./events";
import { searchPassages } from "./extract";
import { bookSlot, openSlots, spokenTime, workspaceZone, zonedInstant } from "./slots";
import type { Agent, Conversation } from "./types";

const str = { type: "string" } as const;

const SCHEMAS: Record<string, { description?: string; properties: Record<string, unknown>; required?: string[] }> = {
  list_slots: {
    properties: {
      after: { type: "string", description: "Optional ISO date or day the caller prefers, e.g. 2026-10-14 or 'Wednesday'." },
      limit: { type: "number", description: "How many open times to return (default 6)." },
    },
  },
  book_appointment: {
    properties: {
      slot_id: { type: "string", description: "The exact id (like slot_ab12…) of an open time from list_slots — not its position or the time." },
      name: { type: "string", description: "Caller's full name." },
      contact: { type: "string", description: "Callback phone number or email." },
      reason: { type: "string", description: "What the visit is for." },
    },
    required: ["slot_id", "name"],
  },
  capture_lead: {
    properties: { name: str, contact: str, company: str, interest: { type: "string", description: "What they want." } },
    required: ["name"],
  },
  create_ticket: { properties: { subject: str, details: str, contact: str }, required: ["subject"] },
  transfer_human: { properties: { brief: { type: "string", description: "A short written brief for the person taking over." } }, required: ["brief"] },
  transfer_call: { properties: { brief: str, destination: { type: "string", description: "Phone number or SIP address." } }, required: ["brief"] },
  lookup_order: { properties: { order: { type: "string", description: "Order number." }, email: str } },
  search_catalog: { properties: { query: str }, required: ["query"] },
  send_sms: { properties: { to: str, body: str }, required: ["to", "body"] },
  web_search: { properties: { query: str }, required: ["query"] },
  x_search: { properties: { query: str }, required: ["query"] },
  api_request: { properties: { path: str, body: str } },
};

export function toolSpecs(agentId: string): ToolSpec[] {
  const enabled = db().agentTools.filter((t) => t.agentId === agentId && t.enabled);
  return enabled
    .map((t): ToolSpec | null => {
      const def = TOOL_CATALOG.find((d) => d.key === t.toolKey);
      const schema = SCHEMAS[t.toolKey];
      if (!def || !schema) return null;
      return {
        type: "function" as const,
        function: {
          name: t.toolKey,
          description: def.description,
          parameters: { type: "object", properties: schema.properties, required: schema.required ?? [] },
        },
      };
    })
    .filter((x): x is ToolSpec => x !== null);
}

export type ToolContext = { agent: Agent; conversation: Conversation };

function setOutcome(c: Conversation, kind: NonNullable<Conversation["outcome"]>["kind"], title: string, summary: string) {
  c.outcome = { kind, title, summary };
  if (kind !== "transfer") c.resolved = true;
  save();
}

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

/** Start of the day a caller asked for ("Wednesday", "tomorrow", or an ISO date), in the workspace zone. */
function dayFilter(after: string | undefined, zone: string) {
  if (!after) return undefined;
  const tz = zone || "UTC";
  const iso = /^\d{4}-\d{2}-\d{2}/.test(after) ? after.slice(0, 10).split("-").map(Number) : null;
  if (iso) return zonedInstant(iso[0], iso[1] - 1, iso[2], 0, tz);
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", weekday: "long" }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const today = WEEKDAYS.indexOf(get("weekday").toLowerCase());
  let delta = -1;
  if (/tomorrow/i.test(after)) delta = 1;
  else if (/today/i.test(after)) delta = 0;
  else {
    const idx = WEEKDAYS.findIndex((d) => after.toLowerCase().includes(d));
    if (idx >= 0) delta = (idx - today + 7) % 7;
  }
  if (delta < 0) return undefined;
  return zonedInstant(Number(get("year")), Number(get("month")) - 1, Number(get("day")) + delta, 0, tz);
}

export async function runTool(name: string, args: Record<string, unknown>, ctx: ToolContext): Promise<Record<string, unknown>> {
  const { agent, conversation } = ctx;
  const data = db();
  const zone = workspaceZone(agent.userId);
  const s = (v: unknown) => (typeof v === "string" ? v.trim() : v == null ? "" : String(v));

  switch (name) {
    case "list_slots": {
      if (!zone) return { slots: [], note: "Opening hours are not set, so no times can be offered. Take a name and number for a callback." };
      const after = dayFilter(s(args.after) || undefined, zone);
      const limit = Math.min(10, Math.max(1, Number(args.limit) || 6));
      let slots = openSlots(agent.id, limit, after);
      if (!slots.length && after) slots = openSlots(agent.id, limit);
      if (!slots.length) return { slots: [], note: "No open times in the diary. Offer to take a message and a callback number." };
      const offered = slots.map((x) => ({ id: x.id, when: spokenTime(x.startsAt, zone) }));
      conversation.offeredSlots = offered;
      save();
      return { timezone: zone, slots: offered };
    }
    case "book_appointment": {
      const id = s(args.slot_id);
      const slot =
        data.slots.find((x) => x.id === id && x.agentId === agent.id) ??
        data.slots.find((x) => x.agentId === agent.id && x.status === "open" && spokenTime(x.startsAt, zone).toLowerCase() === id.toLowerCase());
      if (!slot) {
        // Usually a position ("1") or a bare time instead of an id: hand back the open times so the
        // model can retry with the right id in the same turn rather than telling the caller it's gone.
        const open = openSlots(agent.id, 6).map((x) => ({ id: x.id, when: spokenTime(x.startsAt, zone) }));
        return {
          booked: false,
          error: "slot_id must be one of the ids below, not a number or a time. Pick the one the caller chose and call book_appointment again.",
          slots: open,
        };
      }
      if (slot.status !== "open") return { booked: false, error: "That time was just taken. Offer the next open time." };
      if (new Date(slot.startsAt).getTime() <= Date.now()) return { booked: false, error: "That time has passed. Call list_slots and offer a later one." };
      const name = s(args.name);
      if (!name) return { booked: false, error: "Ask for the caller's name first." };
      const contact = s(args.contact) || conversation.callerContact || "";
      bookSlot(slot, { name, contact, reason: s(args.reason), conversationId: conversation.id });
      const when = spokenTime(slot.startsAt, zone);
      conversation.offeredSlots = undefined;
      conversation.callerName = conversation.callerName || name;
      conversation.callerContact = conversation.callerContact || contact || null;
      setOutcome(conversation, "appointment", when, `Booked ${name} for ${when}.`);
      emit(agent.userId, "appointment.booked", { when, startsAt: slot.startsAt, name, contact, reason: slot.reason, agentName: agent.name, confirmation: slot.confirmation });
      return { booked: true, when, name, confirmation: slot.confirmation };
    }
    case "capture_lead": {
      const now = nowIso();
      const lead = {
        id: newId("lead"),
        userId: agent.userId,
        agentId: agent.id,
        conversationId: conversation.id,
        name: s(args.name) || "Unnamed",
        contact: s(args.contact) || conversation.callerContact || "",
        company: s(args.company),
        interest: s(args.interest),
        status: "new" as const,
        notes: "",
        source: conversation.channel,
        createdAt: now,
        updatedAt: now,
      };
      data.leads.push(lead);
      setOutcome(conversation, "lead", lead.name, lead.interest);
      emit(agent.userId, "lead.created", { ...lead, agentName: agent.name });
      return { captured: true, name: lead.name };
    }
    case "create_ticket": {
      const reference = `T-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
      data.tickets.push({
        id: newId("tkt"),
        userId: agent.userId,
        agentId: agent.id,
        conversationId: conversation.id,
        subject: s(args.subject) || "Support request",
        body: s(args.details),
        contact: s(args.contact) || conversation.callerContact || "",
        status: "open",
        reference,
        createdAt: nowIso(),
      });
      setOutcome(conversation, "ticket", s(args.subject) || "Support request", reference);
      return { ticket: reference };
    }
    case "transfer_human":
    case "transfer_call": {
      const destination = s(args.destination) || agent.callConfig.transferNumber;
      data.transfers.push({
        id: newId("xfr"),
        userId: agent.userId,
        agentId: agent.id,
        conversationId: conversation.id,
        brief: s(args.brief),
        destination,
        createdAt: nowIso(),
      });
      setOutcome(conversation, "transfer", "Handed off", s(args.brief) || "Handed to a human.");
      return destination
        ? { transferred: true, to: destination, note: "Tell the caller you are putting them through now." }
        : { transferred: false, note: "No transfer number is set. Take a name and callback number; the team has the brief." };
    }
    case "search_catalog": {
      const docs = data.knowledge.filter((k) => k.agentIds.includes(agent.id));
      const hits = searchPassages(docs, s(args.query), 3);
      return hits.length ? { results: hits.map((h) => ({ title: h.title, text: h.text.slice(0, 600) })) } : { results: [], note: "Nothing in the catalog matches." };
    }
    case "lookup_order": {
      const link = data.agentConnections
        .filter((l) => l.agentId === agent.id)
        .map((l) => data.connections.find((c) => c.id === l.connectionId))
        .find((c) => c?.appKey === "shopify");
      if (!link) return { found: false, note: "No order system is connected to this line. Offer to open a ticket." };
      const creds = unseal<{ shop?: string; token?: string }>(link.secret);
      if (!creds?.shop || !creds.token) return { found: false, note: "The order system connection is incomplete." };
      const order = s(args.order).replace(/^#/, "");
      try {
        const res = await fetch(
          `https://${creds.shop.replace(/^https?:\/\//, "")}/admin/api/2024-10/orders.json?status=any&name=${encodeURIComponent(order)}`,
          { headers: { "x-shopify-access-token": creds.token }, signal: AbortSignal.timeout(10_000) },
        );
        if (!res.ok) return { found: false, note: `The store answered ${res.status}.` };
        const body = await res.json();
        const o = body.orders?.[0];
        if (!o) return { found: false, note: `No order ${order} was found.` };
        return {
          found: true,
          order: o.name,
          status: o.fulfillment_status ?? "unfulfilled",
          financial: o.financial_status,
          items: (o.line_items ?? []).map((i: { name: string; quantity: number }) => `${i.quantity} × ${i.name}`),
        };
      } catch {
        return { found: false, note: "The store did not answer." };
      }
    }
    case "send_sms":
      return { sent: false, note: "Texting needs a phone number with SMS enabled on a connected carrier." };
    case "web_search":
    case "x_search":
      return { results: [], note: "Search is not connected on this line. Answer from what you know about the business." };
    case "api_request":
      return { ok: false, note: "No API endpoint is configured for this line." };
    default:
      return { error: `Unknown tool ${name}` };
  }
}
