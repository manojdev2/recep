import "server-only";
import { newId } from "@/lib/utils";
import { db, nowIso, save } from "../db";
import { enqueue } from "../jobs";
import { mutation, query, RpcError } from "../rpc";
import { callRow, placeCall, simulateInbound } from "../telephony/calls";
import { addToCampaign, campaignStats, dialNext, ownCampaign } from "../telephony/campaigns";
import type { Campaign } from "../types";

export const calling = {
  calls: query((input: { campaignId?: string } | undefined, { user }) =>
    db()
      .calls.filter((c) => c.userId === user.id && (!input?.campaignId || c.campaignId === input.campaignId))
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .slice(0, 500)
      .map(callRow),
  ),

  place: mutation((input: { agentId: string; to: string; phoneId?: string }, { user }) => placeCall(user.id, input)),

  ringIn: mutation((input: { agentId: string; phoneId?: string; from: string }, { user }) => simulateInbound(user.id, input)),

  campaigns: query((_: void, { user }) =>
    db()
      .campaigns.filter((c) => c.userId === user.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(campaignStats),
  ),

  campaign: query((id: string, { user }) => {
    const c = db().campaigns.find((x) => x.id === id && x.userId === user.id);
    if (!c) return null;
    return {
      campaign: campaignStats(c),
      contacts: db()
        .campaignContacts.filter((t) => t.campaignId === c.id)
        .map(({ id, e164, name, status, attempts, lastOutcome }) => ({ id, e164, name, status, attempts, lastOutcome })),
    };
  }),

  createCampaign: mutation(
    (input: { name: string; agentId: string; phoneId: string | null; contacts: string; contactIds: string[] }, { user }) => {
      const data = db();
      const agent = data.agents.find((a) => a.id === input.agentId && a.userId === user.id);
      if (!agent) throw new RpcError("Choose a receptionist.");
      const now = nowIso();
      const campaign: Campaign = {
        id: newId("cmp"),
        userId: user.id,
        agentId: agent.id,
        name: input.name.trim() || "Outbound list",
        status: "draft",
        phoneId: input.phoneId && data.phoneNumbers.some((p) => p.id === input.phoneId && p.userId === user.id) ? input.phoneId : null,
        windowStart: agent.callConfig.callingWindowStart || "09:00",
        windowEnd: agent.callConfig.callingWindowEnd || "18:00",
        timeZone: data.users.find((u) => u.id === user.id)?.timeZone || agent.callConfig.callingTimezone || "UTC",
        maxAttempts: agent.callConfig.maxAttempts || 2,
        voicemailMode: agent.callConfig.outboundVoicemail,
        concurrency: 3,
        retryMinutes: 60,
        skipDnc: true,
        createdAt: now,
        updatedAt: now,
      };
      data.campaigns.push(campaign);
      addToCampaign(user.id, campaign, input.contacts ?? "", input.contactIds ?? []);
      return { id: campaign.id };
    },
  ),

  updateCampaign: mutation((input: Partial<Campaign> & { id: string }, { user }) => {
    const c = ownCampaign(user.id, input.id);
    const fields = ["name", "status", "phoneId", "windowStart", "windowEnd", "maxAttempts", "voicemailMode", "concurrency", "retryMinutes", "skipDnc"] as const;
    for (const f of fields) if (input[f] !== undefined) (c as Record<string, unknown>)[f] = input[f];
    c.maxAttempts = Math.min(5, Math.max(1, Number(c.maxAttempts) || 1));
    c.concurrency = Math.min(8, Math.max(1, Number(c.concurrency) || 3));
    c.retryMinutes = Math.min(1440, Math.max(5, Number(c.retryMinutes) || 60));
    c.updatedAt = nowIso();
    save();
    if (input.status === "running") enqueue("campaign.tick", { campaignId: c.id }, 60_000);
    return campaignStats(c);
  }),

  addToCampaign: mutation((input: { campaignId: string; contacts: string; contactIds: string[] }, { user }) => {
    const c = ownCampaign(user.id, input.campaignId);
    return addToCampaign(user.id, c, input.contacts ?? "", input.contactIds ?? []);
  }),

  dialNext: mutation(async (input: { campaignId: string; limit?: number }, { user }) => {
    const c = ownCampaign(user.id, input.campaignId);
    return dialNext(c.id, input.limit ?? 6);
  }),

  removeCampaign: mutation((id: string, { user }) => {
    const c = ownCampaign(user.id, id);
    const data = db();
    data.campaigns = data.campaigns.filter((x) => x.id !== c.id);
    data.campaignContacts = data.campaignContacts.filter((t) => t.campaignId !== c.id);
    save();
    return { ok: true };
  }),
};
