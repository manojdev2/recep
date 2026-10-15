import "server-only";
import { newId } from "@/lib/utils";
import { parseContactText } from "../contact-parse";
import { db, nowIso, save } from "../db";
import { RpcError } from "../rpc";
import type { Campaign, CampaignContact } from "../types";
import { placeCall } from "./calls";

export function campaignStats(c: Campaign) {
  const data = db();
  const list = data.campaignContacts.filter((t) => t.campaignId === c.id);
  const count = (s: CampaignContact["status"]) => list.filter((t) => t.status === s).length;
  return {
    ...c,
    agentName: data.agents.find((a) => a.id === c.agentId)?.name ?? "—",
    fromE164: data.phoneNumbers.find((p) => p.id === c.phoneId)?.e164 ?? null,
    total: list.length,
    pending: count("pending"),
    ringing: count("ringing"),
    completed: count("completed"),
    noAnswer: count("no_answer"),
    voicemail: count("voicemail"),
    failed: count("failed"),
  };
}

export function ownCampaign(userId: string, id: string) {
  const c = db().campaigns.find((x) => x.id === id && x.userId === userId);
  if (!c) throw new RpcError("This campaign is gone.", 404);
  return c;
}

/** Add people to a campaign from pasted text and/or the contact book. New numbers become contacts. */
export function addToCampaign(userId: string, campaign: Campaign, text: string, contactIds: string[]) {
  const data = db();
  const existing = new Set(data.campaignContacts.filter((t) => t.campaignId === campaign.id).map((t) => t.e164));
  let added = 0;
  const push = (contactId: string | null, e164: string, name: string) => {
    if (existing.has(e164)) return;
    existing.add(e164);
    data.campaignContacts.push({
      id: newId("cct"),
      campaignId: campaign.id,
      contactId,
      e164,
      name,
      status: "pending",
      attempts: 0,
      lastOutcome: "",
      lastAttemptAt: null,
      nextAttemptAt: null,
    });
    added++;
  };
  for (const id of contactIds) {
    const c = data.contacts.find((x) => x.id === id && x.userId === userId);
    if (c && !(campaign.skipDnc && c.dnc)) push(c.id, c.e164, c.name);
  }
  if (text.trim()) {
    const parsed = parseContactText(text);
    for (const row of parsed.contacts) {
      let contact = data.contacts.find((x) => x.userId === userId && x.e164 === row.e164);
      if (!contact) {
        contact = {
          id: newId("ctc"),
          userId,
          name: row.name,
          e164: row.e164,
          email: row.email,
          company: row.company,
          notes: row.notes,
          tags: row.tags,
          dnc: false,
          isSample: false,
          createdAt: nowIso(),
        };
        data.contacts.push(contact);
      }
      if (!(campaign.skipDnc && contact.dnc)) push(contact.id, contact.e164, contact.name || row.name);
    }
  }
  campaign.updatedAt = nowIso();
  save();
  return { added };
}

function minutesOf(hhmm: string) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

function insideWindow(c: Campaign) {
  const start = minutesOf(c.windowStart);
  const end = minutesOf(c.windowEnd);
  if (start == null || end == null) return true;
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: c.timeZone || "UTC", hourCycle: "h23", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date());
  const now = Number(parts.find((p) => p.type === "hour")?.value) * 60 + Number(parts.find((p) => p.type === "minute")?.value);
  return start <= end ? now >= start && now < end : now >= start || now < end;
}

/** Dial the next people on the list, inside the calling window. */
export async function dialNext(campaignId: string, limit = 6) {
  const data = db();
  const c = data.campaigns.find((x) => x.id === campaignId);
  if (!c) return { dialed: 0, remaining: 0, reason: "gone" };
  if (c.status !== "running") return { dialed: 0, remaining: 0, reason: "paused" };
  const due = () => {
    const now = Date.now();
    return data.campaignContacts.filter(
      (t) =>
        t.campaignId === c.id &&
        (t.status === "pending" || (["no_answer", "voicemail"].includes(t.status) && t.attempts < c.maxAttempts)) &&
        (!t.nextAttemptAt || new Date(t.nextAttemptAt).getTime() <= now),
    );
  };
  if (!insideWindow(c)) return { dialed: 0, remaining: due().length, reason: "outside window" };
  const ringing = data.campaignContacts.filter((t) => t.campaignId === c.id && t.status === "ringing").length;
  const room = Math.max(0, Math.min(limit, c.concurrency - ringing));
  let dialed = 0;
  for (const target of due().slice(0, room)) {
    target.attempts += 1;
    target.lastAttemptAt = nowIso();
    target.nextAttemptAt = new Date(Date.now() + c.retryMinutes * 60_000).toISOString();
    try {
      await placeCall(c.userId, { agentId: c.agentId, to: target.e164, phoneId: c.phoneId ?? undefined, campaignId: c.id });
      target.status = "ringing";
      target.lastOutcome = "dialing";
      dialed++;
    } catch (err) {
      target.status = "failed";
      target.lastOutcome = err instanceof Error ? err.message : "failed";
    }
    save();
  }
  const remaining = due().length;
  if (!remaining && !data.campaignContacts.some((t) => t.campaignId === c.id && t.status === "ringing")) {
    c.status = "done";
    c.updatedAt = nowIso();
    save();
  }
  return { dialed, remaining, reason: dialed ? "dialed" : "" };
}
