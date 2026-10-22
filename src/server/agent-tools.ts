import "server-only";
import { TOOL_CATALOG } from "@/lib/catalog";
import { newId } from "@/lib/utils";
import type { ToolSpec } from "./ai";
import { unseal } from "./crypto";
import { db, nowIso, save } from "./db";
import { emit } from "./events";
import { searchPassages } from "./extract";
import { attachPaymentLink, matchMenu, menuFor, money, newOrder, orderTotal } from "./orders";
import { bookSlot, cancelBooking, openSlots, spokenTime, workspaceZone, zonedInstant } from "./slots";
import type { Agent, Conversation, OrderItem } from "./types";

const str = { type: "string" } as const;

const SCHEMAS: Record<string, { description?: string; properties: Record<string, unknown>; required?: string[] }> = {
  list_slots: {
    properties: {
      after: {
        type: "string",
        description:
          "Optional. Only times from this point on. Pass the caller's day and time in their own words — 'Saturday 4:30pm', 'tomorrow at 11', 'the 27th around 3pm', 'next Friday' — and the system works out the date. Don't convert it to a date yourself.",
      },
      limit: { type: "number", description: "How many open times to return (default 6)." },
    },
  },
  book_appointment: {
    properties: {
      slot_id: { type: "string", description: "The exact id of an open time, copied from a list_slots result — not its position, the time, or a made-up id." },
      name: { type: "string", description: "Caller's full name." },
      contact: { type: "string", description: "Callback phone number or email." },
      reason: { type: "string", description: "What the visit is for." },
      reschedule: { type: "boolean", description: "True only when the caller asked to move the booking they already made in this conversation to this time." },
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
  take_order: {
    properties: {
      items: {
        type: "array",
        description: "What the caller is ordering, using the menu's item names.",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "Menu item name." },
            qty: { type: "number", description: "How many." },
            note: { type: "string", description: "Optional: milk, no onions, allergy note." },
          },
          required: ["name", "qty"],
        },
      },
      name: { type: "string", description: "Caller's name for the order." },
      contact: { type: "string", description: "Phone number or email." },
      fulfilment: { type: "string", enum: ["pickup", "delivery"] },
      ready_time: { type: "string", description: "When they want it, in their words: '6pm', 'in 20 minutes', 'as soon as possible'." },
      address: { type: "string", description: "Delivery address (delivery only)." },
      notes: str,
    },
    required: ["items", "name"],
  },
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
      // The model only knows the menu from here, so it can't offer (or price) what isn't on it.
      let description: string = def.description;
      if (t.toolKey === "take_order") {
        const menu = menuFor(agentId);
        description = menu.items.length
          ? `${def.description} Menu: ${menu.items.map((i) => `${i.name} ${money(i.priceCents, menu.currency)}`).join("; ")}.`
          : `${def.description} No menu is set up yet: take the order in the caller's words; the team will confirm the price.`;
      }
      return {
        type: "function" as const,
        function: {
          name: t.toolKey,
          description,
          parameters: { type: "object", properties: schema.properties, required: schema.required ?? [] },
        },
      };
    })
    .filter((x): x is ToolSpec => x !== null);
}

/**
 * `callerText`: the caller's latest words, when the channel has them as text.
 * `recentCallerText`: a live call's last few transcribed caller lines (the transcript is only saved at hang-up).
 */
export type ToolContext = { agent: Agent; conversation: Conversation; callerText?: string; recentCallerText?: string[] };

/** Words a caller uses when they want an existing booking at a different time. */
const MOVE_WORDS = /\b(move|moving|change|changing|reschedul\w*|instead|switch|swap|different|earlier|later|another (time|day)|push (it )?back|bring (it )?forward|rather)\b/i;

function setOutcome(c: Conversation, kind: NonNullable<Conversation["outcome"]>["kind"], title: string, summary: string) {
  c.outcome = { kind, title, summary };
  if (kind !== "transfer") c.resolved = true;
  save();
}

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const MONTH = "(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?";

/**
 * Minutes past midnight for a clock time in free text ("16:30", "4:30pm", "3 p.m.", "around 3", "noon").
 * `strict` (a caller's whole sentence): a bare number only counts after "at", "around"… — "a table for 4" is not 4pm.
 */
function clockMinutes(text: string, strict = false): number | null {
  if (/\bnoon\b/.test(text)) return 720;
  const t = strict
    ? /(?:\b(?:at|around|about|after|before|by|from)\s+)?\b(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?(?![\d:])/g
    : /\b(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?(?![\d:])/g;
  let match: RegExpExecArray | null = null;
  for (let x = t.exec(text); x; x = t.exec(text)) {
    if (!strict || x[2] || x[3] || /^(at|around|about|after|before|by|from)\s/.test(x[0])) {
      match = x;
      break;
    }
  }
  if (match) {
    let h = Number(match[1]);
    const min = Number(match[2] ?? 0);
    const mer = match[3]?.[0];
    if (h > 23 || min > 59) return null;
    if (mer === "p" && h < 12) h += 12;
    else if (mer === "a" && h === 12) h = 0;
    // No am/pm: business talk, so "at 3" is 3pm, and so is "4" in the afternoon or evening.
    else if (!mer && h < 12 && (h < 8 || /afternoon|evening|tonight/.test(text))) h += 12;
    return h * 60 + min;
  }
  if (/afternoon/.test(text)) return 720;
  if (/evening|tonight/.test(text)) return 1020;
  return null;
}

/**
 * Where to start looking for times a caller asked for, in the workspace zone. Takes an ISO date or
 * date-time, or the caller's words ("Saturday 4:30pm", "tomorrow at 11", "the 27th around 3",
 * "Oct 30"), so the model never has to do date arithmetic. A slot starting exactly then is included.
 */
function dayFilter(after: string | undefined, zone: string, strict = false): { from: Date; exact: Date | null } | undefined {
  if (!after) return undefined;
  const tz = zone || "UTC";
  // `exact` is the time the caller named, if they named one.
  const at = (y: number, m: number, d: number, minutes: number | null) => {
    const t = zonedInstant(y, m, d, minutes ?? 0, tz);
    return { from: new Date(t.getTime() - 60_000), exact: minutes === null ? null : t };
  };
  // An ISO time is the business's wall clock; any offset is ignored.
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{1,2}):(\d{2}))?/.exec(after);
  if (iso) return at(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), iso[4] ? Number(iso[4]) * 60 + Number(iso[5]) : null);

  const text = after.toLowerCase();
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", weekday: "long" }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const y = Number(get("year"));
  const m = Number(get("month")) - 1;
  const d = Number(get("day"));
  let day: [number, number, number] | null = null;
  let rest = text;

  const monthFirst = new RegExp(`\\b${MONTH}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`).exec(text);
  const dayFirst = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH}`).exec(text);
  const ordinal = /\b(\d{1,2})(st|nd|rd|th)\b/.exec(text);
  if (monthFirst || dayFirst) {
    const month = MONTHS.indexOf((monthFirst ? monthFirst[1] : dayFirst![2]).slice(0, 3));
    const date = Number(monthFirst ? monthFirst[2] : dayFirst![1]);
    // A date already past this year means next year.
    day = month < m || (month === m && date < d) ? [y + 1, month, date] : [y, month, date];
    rest = text.replace((monthFirst ?? dayFirst)![0], " ");
  } else if (ordinal) {
    const date = Number(ordinal[1]);
    day = date < d ? [y, m + 1, date] : [y, m, date];
    rest = text.replace(ordinal[0], " ");
  } else if (/tomorrow/.test(text)) {
    day = [y, m, d + 1];
  } else if (/today|tonight/.test(text)) {
    day = [y, m, d];
  } else {
    const idx = WEEKDAYS.findIndex((w) => text.includes(w) || new RegExp(`\\b${w.slice(0, 3)}\\b`).test(text));
    if (idx >= 0) {
      let delta = (idx - WEEKDAYS.indexOf(get("weekday").toLowerCase()) + 7) % 7;
      if (delta === 0 && /\bnext\b/.test(text)) delta = 7;
      // "a week from Thursday", "Thursday week"
      if (/week (from|on)|day week\b/.test(text)) delta += 7;
      day = [y, m, d + delta];
    }
  }
  const minutes = clockMinutes(rest, strict);
  if (!day && minutes === null) return undefined;
  const [yy, mm, dd] = day ?? [y, m, d];
  return at(yy, mm, dd, minutes);
}

export async function runTool(name: string, args: Record<string, unknown>, ctx: ToolContext): Promise<Record<string, unknown>> {
  const { agent, conversation } = ctx;
  const data = db();
  const zone = workspaceZone(agent.userId);
  const s = (v: unknown) => (typeof v === "string" ? v.trim() : v == null ? "" : String(v));

  switch (name) {
    case "list_slots": {
      if (!zone) return { slots: [], note: "Opening hours are not set, so no times can be offered. Take a name and number for a callback." };
      // Models sometimes rename the argument; a dropped filter would offer the wrong day.
      let wanted = dayFilter(s(args.after ?? args.start ?? args.from ?? args.date ?? args.day) || undefined, zone);
      // Models often pass nothing, "now", or the caller's current booking instead of the time the
      // caller just named. When the caller's own words name a day and time, they win (unless the
      // caller is ruling it out: "I can't do 2pm"); a time that is now or past only means "from now on".
      const soon = (t: Date | null | undefined) => !!t && t.getTime() < Date.now() + 15 * 60_000;
      const said = ctx.callerText ? dayFilter(ctx.callerText, zone, true) : undefined;
      const callerNamed = said?.exact && !soon(said.exact) && !/\b(can'?t|cannot|not|no|isn'?t|won'?t)\b/i.test(ctx.callerText ?? "");
      if (callerNamed && said.exact!.getTime() !== wanted?.exact?.getTime()) wanted = said;
      else if (!wanted || soon(wanted.exact)) {
        if (said && !soon(said.exact) && said.from.getTime() > Date.now() - 864e5) wanted = said;
        else if (wanted) wanted = { from: wanted.from, exact: null };
      }
      const limit = Math.min(10, Math.max(1, Number(args.limit) || 6));
      let slots = openSlots(agent.id, limit, wanted?.from);
      if (!slots.length && wanted) slots = openSlots(agent.id, limit);
      if (!slots.length) return { slots: [], note: "No open times in the diary. Offer to take a message and a callback number." };
      const offered = slots.map((x) => ({ id: x.id, when: spokenTime(x.startsAt, zone) }));
      conversation.offeredSlots = offered;
      save();
      // Say plainly whether the time the caller named is free; models misread the bare list.
      const exact = wanted?.exact;
      const hit = exact ? slots.find((x) => new Date(x.startsAt).getTime() === exact.getTime()) : undefined;
      const requested = !exact
        ? undefined
        : hit
          ? `${spokenTime(hit.startsAt, zone)} is open (id ${hit.id}). Offer it.`
          : `${spokenTime(exact.toISOString(), zone)} is not open. Offer the nearest times below.`;
      return { timezone: zone, ...(requested ? { requested } : {}), slots: offered };
    }
    case "book_appointment": {
      const id = s(args.slot_id);
      let slot =
        data.slots.find((x) => x.id === id && x.agentId === agent.id) ??
        data.slots.find((x) => x.agentId === agent.id && x.status === "open" && spokenTime(x.startsAt, zone).toLowerCase() === id.toLowerCase());
      if (!slot) {
        // Usually a position ("1") or a bare time instead of an id: hand back the open times so the
        // model can retry with the right id in the same turn rather than telling the caller it's gone.
        const open = openSlots(agent.id, 6).map((x) => ({ id: x.id, when: spokenTime(x.startsAt, zone) }));
        return {
          booked: false,
          error:
            "slot_id must be an id from list_slots, not a number or a time. If the caller's time is below, use its id. If not, call list_slots with after set to the caller's date and time (e.g. 2026-10-20T13:00) before saying it isn't available.",
          slots: open,
        };
      }
      // A repeated call for the time this caller already has: answer again, don't book twice.
      if (slot.status === "booked" && slot.conversationId === conversation.id) {
        return { booked: true, when: spokenTime(slot.startsAt, zone), name: slot.bookedName, confirmation: slot.confirmation, note: "Already booked earlier in this conversation." };
      }
      // A time with several seats (tables): another seat at the same time will do.
      if (slot.status !== "open") {
        const startsAt = slot.startsAt;
        slot = data.slots.find((x) => x.agentId === agent.id && x.status === "open" && x.startsAt === startsAt) ?? slot;
      }
      if (slot.status !== "open") return { booked: false, error: "That time was just taken. Offer the next open time." };
      if (new Date(slot.startsAt).getTime() <= Date.now()) return { booked: false, error: "That time has passed. Call list_slots and offer a later one." };
      const name = s(args.name);
      if (!name) return { booked: false, error: "Ask for the caller's name first." };
      // One booking per conversation: a second one is a move, and only when the caller asked for it.
      const previous = data.slots.find(
        (x) => x.agentId === agent.id && x.conversationId === conversation.id && x.status === "booked" && new Date(x.startsAt).getTime() > Date.now(),
      );
      if (previous && previous.startsAt === slot.startsAt) {
        return { booked: true, when: spokenTime(previous.startsAt, zone), name: previous.bookedName, confirmation: previous.confirmation, note: "Already booked earlier in this conversation." };
      }
      if (previous && args.reschedule !== true) {
        return {
          booked: false,
          error: `This caller is already booked for ${spokenTime(previous.startsAt, zone)} (confirmation ${previous.confirmation}). Don't book again. If they want to move it, confirm, then call book_appointment with reschedule: true.`,
        };
      }
      // Models read "yes, book it" as the go-ahead to move. Only move when the caller's own words since
      // that booking (on a live call, their last few lines) ask for a change or name this new time.
      const said =
        ctx.callerText !== undefined
          ? [
              ...data.messages
                .filter((m) => m.conversationId === conversation.id && m.role === "user" && m.created_at >= (previous?.bookedAt ?? ""))
                .map((m) => m.content),
              ctx.callerText,
            ]
          : ctx.recentCallerText;
      if (previous && said) {
        const target = slot.startsAt;
        const asked = said.some((t) => MOVE_WORDS.test(t) || dayFilter(t, zone, true)?.exact?.getTime() === new Date(target).getTime());
        if (!asked) {
          return {
            booked: false,
            error: `The caller has not asked to move their booking. They are booked for ${spokenTime(previous.startsAt, zone)} (confirmation ${previous.confirmation}). Confirm that time; don't book or move anything.`,
          };
        }
      }
      if (previous) cancelBooking(previous);
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
    case "take_order": {
      const menu = menuFor(agent.id);
      const raw = Array.isArray(args.items) ? (args.items as Record<string, unknown>[]) : [];
      const items: OrderItem[] = [];
      const unknown: string[] = [];
      for (const r of raw) {
        const qty = Math.max(1, Math.min(99, Math.round(Number(r?.qty) || 1)));
        const wanted = s(r?.name);
        if (!wanted) continue;
        const hit = menu.items.length ? matchMenu(menu, wanted) : undefined;
        if (menu.items.length && !hit) unknown.push(wanted);
        else items.push({ name: hit?.name ?? wanted, qty, unitCents: hit ? hit.priceCents : null, note: s(r?.note) });
      }
      if (unknown.length) {
        return { placed: false, error: `Not on the menu (or unclear which one): ${unknown.join(", ")}. Offer only menu items.`, menu: menu.items.map((i) => i.name) };
      }
      if (!items.length) return { placed: false, error: "Ask what they would like first." };
      const name = s(args.name);
      if (!name) return { placed: false, error: "Ask for a name for the order first." };
      const fulfilment = s(args.fulfilment) === "delivery" ? "delivery" : "pickup";
      const address = s(args.address);
      if (fulfilment === "delivery" && !address) return { placed: false, error: "Ask for the delivery address first." };
      const totalCents = orderTotal(items);
      const contact = s(args.contact) || conversation.callerContact || "";
      // Callers confirm twice; a second call in the same conversation changes the order instead of adding one.
      const existing = data.orders.find((o) => o.conversationId === conversation.id && o.status === "new" && o.payment.status !== "paid");
      const fields = { name, contact, items, fulfilment, readyAt: s(args.ready_time), address, notes: s(args.notes), currency: menu.currency, totalCents } as const;
      const order = existing ?? newOrder({ ...fields, userId: agent.userId, agentId: agent.id, conversationId: conversation.id });
      if (existing) {
        const changed = JSON.stringify(existing.items) !== JSON.stringify(items) || existing.totalCents !== totalCents;
        Object.assign(existing, fields, { updatedAt: nowIso() });
        // A changed basket needs a new link for the new amount.
        if (changed) existing.payment = { status: "none", url: null, sessionId: null };
        save();
      }
      let paymentUrl = order.payment.url;
      let paymentNote = "";
      if (!paymentUrl) {
        try {
          paymentUrl = await attachPaymentLink(order);
        } catch (e) {
          paymentNote = `The payment link could not be made (${e instanceof Error ? e.message : "Stripe error"}). They can pay on collection.`;
        }
      }
      const total = totalCents === null ? null : money(totalCents, menu.currency);
      const summary = items.map((i) => `${i.qty} × ${i.name}${i.note ? ` (${i.note})` : ""}`).join(", ");
      conversation.callerName = conversation.callerName || name;
      conversation.callerContact = conversation.callerContact || contact || null;
      setOutcome(conversation, "order", `Order ${order.reference}`, `${name}: ${summary}${total ? ` — ${total}` : ""}.`);
      if (!existing) emit(agent.userId, "order.placed", { reference: order.reference, name, contact, items: summary, total, fulfilment, readyAt: order.readyAt, agentName: agent.name });
      return {
        placed: true,
        ...(existing ? { note: "Updated the order already taken in this conversation." } : {}),
        reference: order.reference,
        items: summary,
        total: total ?? "to be confirmed by the team",
        ...(paymentUrl
          ? conversation.channel === "phone"
            ? { payment: "A secure payment link was created for the team to text. Don't read it out; say they can pay by that link or on collection." }
            : { payment_url: paymentUrl, payment: "Share this secure link to pay by card. Never take card details yourself." }
          : { payment: paymentNote || "Payment is taken on collection." }),
      };
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
