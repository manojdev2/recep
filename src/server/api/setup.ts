import "server-only";
import { db } from "../db";
import { query } from "../rpc";
import { slotLabel } from "../slots";
import { minutesUsed } from "../usage";

type Step = {
  key: string;
  title: string;
  why: string;
  done: boolean;
  optional?: boolean;
  href: string;
  action: string;
};

export function setupState(userId: string) {
  const data = db();
  const agents = data.agents.filter((a) => a.userId === userId);
  const first = agents[0];
  const agentHref = first ? `/app/agents/${first.id}` : "/app/agents";
  const numbers = data.phoneNumbers.filter((n) => n.userId === userId);
  const live = agents.filter((a) => a.status === "live");
  const liveReady = numbers.some((n) => n.agentId && live.some((a) => a.id === n.agentId));
  const hours = data.hours.filter((h) => agents.some((a) => a.id === h.agentId));

  const steps: Step[] = [
    {
      key: "create",
      title: "Meet your first receptionist",
      why: "Pick the kind of business you run. We write the first version for you, and you can change every word of it.",
      done: agents.length > 0,
      href: "/app/agents",
      action: "Start",
    },
    {
      key: "teach",
      title: "Tell it what it needs to know",
      why: "Opening hours, prices, policies. Upload a PDF or paste it in — it only answers from what you give it.",
      // Sample documents that ship with a template do not count as teaching it.
      done: data.knowledge.some((k) => k.userId === userId && !k.isSample),
      href: "/app/knowledge",
      action: "Add details",
    },
    {
      key: "hours",
      title: "Set your opening hours",
      why: "When you are open, in your timezone. Your receptionist offers appointment times from this — without it, it cannot book anything.",
      done: hours.some((h) => !h.unset && h.windows.length > 0),
      href: "/app/settings/hours",
      action: "Set hours",
    },
    {
      key: "number",
      title: "Connect a phone number",
      why: "Use a number you already own, or add a new one. This is what your customers will ring.",
      done: numbers.length > 0,
      href: "/app/phone",
      action: "Connect",
    },
    {
      key: "rehearse",
      title: "Hear it for yourself",
      why: "Have a conversation before anyone else does, and change anything that sounds wrong.",
      done: data.conversations.some((c) => c.userId === userId),
      href: agentHref,
      action: "Try it",
    },
    {
      key: "publish",
      title: "Take it live",
      why: "Connect your number to your receptionist and start answering real calls. You can pause it again at any time.",
      done: liveReady,
      href: agentHref,
      action: "Go live",
    },
    {
      key: "contacts",
      title: "Import your contact list",
      why: "Only needed if you want to make calls as well as answer them. A CSV of names and numbers is enough.",
      done: data.contacts.some((c) => c.userId === userId && !c.isSample),
      optional: true,
      href: "/app/contacts",
      action: "Import",
    },
    {
      key: "tools",
      title: "Connect your other tools",
      why: "Send bookings to your calendar, leads to your CRM, notes to a spreadsheet.",
      done:
        data.connections.some((c) => c.userId === userId) ||
        data.webhooks.some((w) => w.userId === userId) ||
        data.sheets.some((s) => s.userId === userId),
      optional: true,
      href: "/app/apps",
      action: "Connect",
    },
    {
      key: "campaign",
      title: "Plan your first outreach",
      why: "Give it a list and a reason to call, and it works through them on your behalf.",
      done: data.campaigns.some((c) => c.userId === userId),
      optional: true,
      href: "/app/campaigns",
      action: "Create",
    },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  return { steps, doneCount, complete: steps.every((s) => s.done || s.optional), liveReady };
}

export const setup = {
  get: query((_: void, { user }) => setupState(user.id)),

  dashboard: query((_: void, { user }) => {
    const data = db();
    const now = Date.now();
    const weekAgo = now - 7 * 864e5;
    const calls = data.calls.filter((c) => c.userId === user.id);
    const bookings = data.slots.filter((s) => s.userId === user.id && s.status === "booked" && s.bookedAt);
    const leads = data.leads.filter((l) => l.userId === user.id);
    const tickets = data.tickets.filter((t) => t.userId === user.id);
    const transfers = data.transfers.filter((t) => t.userId === user.id);

    const callsByDay = Array.from({ length: 14 }, (_, i) => {
      const start = new Date(now - (13 - i) * 864e5);
      start.setHours(0, 0, 0, 0);
      const end = start.getTime() + 864e5;
      return calls.filter((c) => {
        const t = new Date(c.startedAt).getTime();
        return t >= start.getTime() && t < end;
      }).length;
    });

    const zone = data.users.find((u) => u.id === user.id)?.timeZone || "UTC";
    const recent = [
      ...bookings.map((s) => ({
        kind: "appointment",
        title: `${s.bookedName || "Someone"} booked a visit`,
        detail: `${slotLabel(s.startsAt, zone)}${s.reason ? ` · ${s.reason}` : ""}`,
        at: s.bookedAt as string,
      })),
      ...leads.map((l) => ({
        kind: "lead",
        title: `New enquiry from ${l.name || "a caller"}`,
        detail: l.interest || l.company || l.contact,
        at: l.createdAt,
      })),
      ...tickets.map((t) => ({ kind: "ticket", title: t.subject, detail: t.body || t.reference, at: t.createdAt })),
      ...transfers.map((t) => ({
        kind: "transfer",
        title: "Handed to a person",
        detail: t.brief,
        at: t.createdAt,
      })),
    ]
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 6);

    return {
      callsThisWeek: calls.filter((c) => new Date(c.startedAt).getTime() >= weekAgo).length,
      bookings: bookings.filter((s) => new Date(s.bookedAt as string).getTime() >= weekAgo).length,
      leads: leads.filter((l) => new Date(l.createdAt).getTime() >= weekAgo).length,
      minutesUsed: minutesUsed(user.id),
      callsByDay,
      recent,
    };
  }),
};
