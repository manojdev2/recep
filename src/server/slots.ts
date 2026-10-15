import "server-only";
import { newId } from "@/lib/utils";
import { db, nowIso, save } from "./db";
import type { AgentHours, Slot } from "./types";

/** Offset (ms) of a timezone from UTC at a given instant. */
function zoneOffset(at: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - at.getTime();
}

/** The UTC instant of a wall-clock time (year, month0, day, minutes) in a timezone. */
export function zonedInstant(y: number, m: number, d: number, minutes: number, timeZone: string) {
  const guess = Date.UTC(y, m, d, 0, minutes);
  let t = guess - zoneOffset(new Date(guess), timeZone);
  t = guess - zoneOffset(new Date(t), timeZone);
  return new Date(t);
}

/** Calendar date parts "today" in a timezone. */
function zonedToday(timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { y: get("year"), m: get("month") - 1, d: get("day") };
}

export function workspaceZone(userId: string) {
  return db().users.find((u) => u.id === userId)?.timeZone || "";
}

export function slotLabel(startsAt: string, timeZone: string) {
  return new Date(startsAt).toLocaleString("en-GB", {
    timeZone: timeZone || "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function spokenTime(startsAt: string, timeZone: string) {
  return new Date(startsAt).toLocaleString("en-US", {
    timeZone: timeZone || "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Rebuild the generated diary for one agent from its opening hours. Booked times are
 * kept even when they now fall outside the hours (reported as orphaned).
 */
export function regenerateSlots(userId: string, hours: AgentHours) {
  const data = db();
  const zone = workspaceZone(userId);
  const now = Date.now();
  const before = data.slots.filter((s) => s.agentId === hours.agentId && s.generated && s.status === "open").length;
  data.slots = data.slots.filter((s) => !(s.agentId === hours.agentId && s.generated && s.status === "open"));
  if (!zone || hours.unset || hours.windows.length === 0) {
    save();
    return { created: 0, removed: before, orphanedBookings: 0 };
  }
  const booked = data.slots.filter((s) => s.agentId === hours.agentId && s.status === "booked");
  const taken = new Set(booked.map((s) => s.startsAt));
  const today = zonedToday(zone);
  const fresh: Slot[] = [];
  const created = nowIso();
  for (let i = 0; i < hours.horizonDays; i++) {
    const day = new Date(Date.UTC(today.y, today.m, today.d + i));
    const weekday = day.getUTCDay();
    for (const w of hours.windows.filter((x) => x.weekday === weekday)) {
      for (let start = w.startMin; start + hours.slotMinutes <= w.endMin; start += hours.slotMinutes) {
        const at = zonedInstant(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), start, zone);
        if (at.getTime() <= now + 30 * 60_000) continue;
        const startsAt = at.toISOString();
        if (taken.has(startsAt)) continue;
        fresh.push({
          id: newId("slot"),
          userId,
          agentId: hours.agentId,
          startsAt,
          endsAt: new Date(at.getTime() + hours.slotMinutes * 60_000).toISOString(),
          status: "open",
          bookedName: "",
          bookedContact: "",
          reason: "",
          confirmation: "",
          conversationId: null,
          bookedAt: null,
          generated: true,
          fabricated: false,
          createdAt: created,
        });
      }
    }
  }
  data.slots.push(...fresh);
  const inside = (s: Slot) => {
    const local = new Date(new Date(s.startsAt).getTime() + zoneOffset(new Date(s.startsAt), zone));
    const minutes = local.getUTCHours() * 60 + local.getUTCMinutes();
    return hours.windows.some((w) => w.weekday === local.getUTCDay() && minutes >= w.startMin && minutes < w.endMin);
  };
  const orphanedBookings = booked.filter((s) => new Date(s.startsAt).getTime() > now && !inside(s)).length;
  save();
  return { created: fresh.length, removed: before, orphanedBookings };
}

export function upcomingSlots(agentId: string) {
  const now = Date.now();
  return db()
    .slots.filter((s) => s.agentId === agentId && s.status !== "cancelled" && new Date(s.startsAt).getTime() > now - 3600_000)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export function openSlots(agentId: string, limit = 6, after?: Date) {
  const from = (after ?? new Date()).getTime();
  return db()
    .slots.filter((s) => s.agentId === agentId && s.status === "open" && new Date(s.startsAt).getTime() > from)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .slice(0, limit);
}

function confirmationCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export function bookSlot(
  slot: Slot,
  booking: { name: string; contact: string; reason: string; conversationId: string | null },
) {
  slot.status = "booked";
  slot.bookedName = booking.name;
  slot.bookedContact = booking.contact;
  slot.reason = booking.reason;
  slot.conversationId = booking.conversationId;
  slot.bookedAt = nowIso();
  slot.confirmation = confirmationCode();
  save();
  return slot;
}

/** Top up every diary that has run dry (fresh installs, or a process that ran past the horizon). */
export function refreshDiaries() {
  const data = db();
  const now = Date.now();
  let created = 0;
  for (const h of data.hours) {
    const agent = data.agents.find((a) => a.id === h.agentId);
    if (!agent || h.unset || !h.windows.length || !workspaceZone(agent.userId)) continue;
    const future = data.slots.filter((s) => s.agentId === h.agentId && s.status === "open" && new Date(s.startsAt).getTime() > now);
    // Regenerate once less than half the horizon is left.
    const horizonEnd = now + (h.horizonDays / 2) * 864e5;
    if (future.some((s) => new Date(s.startsAt).getTime() > horizonEnd)) continue;
    created += regenerateSlots(agent.userId, h).created;
  }
  return created;
}
