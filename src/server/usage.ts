import "server-only";
import { newId } from "@/lib/utils";
import { db, nowIso, save } from "./db";
import { RpcError } from "./rpc";
import { numberSetting } from "./settings";
import type { Plan } from "./types";

/** Stand-in for "no limit" so the UI's `> 1e6` checks read as unlimited. */
export const UNLIMITED = Number.MAX_SAFE_INTEGER;

export function monthKey(d = new Date()) {
  return d.toISOString().slice(0, 7);
}

export function planFeatures(plan: Plan) {
  return plan.features
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function planFor(userId: string): Plan {
  const data = db();
  const user = data.users.find((u) => u.id === userId);
  const sub = data.subscriptions.find((s) => s.userId === userId && s.status !== "cancelled");
  const id = sub?.planId ?? user?.plan ?? "studio";
  return data.plans.find((p) => p.id === id) ?? data.plans.sort((a, b) => a.position - b.position)[0];
}

export function minutesUsed(userId: string, month = monthKey()) {
  const total = db()
    .usage.filter((u) => u.userId === userId && u.at.startsWith(month))
    .reduce((sum, u) => sum + u.minutes, 0);
  return Math.round(total * 10) / 10;
}

export function usageFor(userId: string) {
  const data = db();
  const plan = planFor(userId);
  const month = monthKey();
  const used = minutesUsed(userId, month);
  const included = plan.minutes;
  const agents = data.agents.filter((a) => a.userId === userId);
  return {
    plan: {
      id: plan.id,
      name: plan.name,
      priceLabel: plan.priceLabel,
      minutes: plan.minutes ?? UNLIMITED,
      agents: plan.agents ?? UNLIMITED,
      numbers: plan.numbers ?? UNLIMITED,
      features: planFeatures(plan),
      public: plan.public,
      stripePriceId: plan.stripePriceId,
    },
    month,
    minutesUsed: used,
    minutesIncluded: included,
    fraction: included ? Math.min(1, used / included) : 0,
    overLimit: included != null && used >= included,
    agents: agents.filter((a) => a.status === "live").length,
    totalAgents: agents.length,
    numbers: data.phoneNumbers.filter((n) => n.userId === userId).length,
  };
}

function capAgents(plan: Plan) {
  const cap = numberSetting("MAX_AGENTS_PER_WORKSPACE", 0) || null;
  return Math.min(plan.agents ?? Infinity, cap ?? Infinity);
}

/** Throws a "Plan limit: …" error the client turns into an upgrade toast. */
export function assertAgentSlot(userId: string) {
  const plan = planFor(userId);
  const count = db().agents.filter((a) => a.userId === userId).length;
  const limit = capAgents(plan);
  if (count >= limit) {
    throw new RpcError(
      `Plan limit: ${plan.name} includes ${limit} receptionist${limit === 1 ? "" : "s"}. Upgrade to add another.`,
    );
  }
}

/** Live receptionists are what the plan counts; drafts are free. */
export function assertLiveSlot(userId: string, agentId: string) {
  const plan = planFor(userId);
  const live = db().agents.filter((a) => a.userId === userId && a.status === "live" && a.id !== agentId).length;
  const limit = capAgents(plan);
  if (live >= limit) {
    throw new RpcError(
      `Plan limit: ${plan.name} includes ${limit} live receptionist${limit === 1 ? "" : "s"}. Pause another one or upgrade.`,
    );
  }
}

export function assertNumberSlot(userId: string) {
  const plan = planFor(userId);
  const count = db().phoneNumbers.filter((n) => n.userId === userId).length;
  if (plan.numbers != null && count >= plan.numbers) {
    throw new RpcError(
      `Plan limit: ${plan.name} includes ${plan.numbers} phone number${plan.numbers === 1 ? "" : "s"}. Upgrade to add another.`,
    );
  }
}

/** Refuses model work once the month's minutes are spent. */
export function assertMinutes(userId: string) {
  const u = usageFor(userId);
  if (u.overLimit) {
    throw new RpcError(`Plan limit: this month's ${u.minutesIncluded} minutes are used up. Upgrade to keep talking.`);
  }
}

export function rate(provider: string, operation: string) {
  return db().rates.find((r) => r.provider === provider && r.operation === operation)?.costMicros ?? 0;
}

/**
 * Meter one exchange: voice-equivalent minutes for the plan, plus what the providers
 * cost us. Fails open — a metering bug must never drop a live conversation.
 */
export function meter(
  userId: string | null,
  usage: { kind: "voice" | "phone_turn" | "text"; minutes?: number } | null,
  costs: { provider: string; operation: string; units: number }[] = [],
) {
  try {
    const data = db();
    const at = nowIso();
    if (userId && usage) {
      const minutes =
        usage.minutes ??
        (usage.kind === "text"
          ? numberSetting("RATE_TEXT_MESSAGE", 0.025)
          : usage.kind === "phone_turn"
            ? numberSetting("RATE_PHONE_TURN", 0.25)
            : numberSetting("RATE_VOICE_MINUTE", 1));
      data.usage.push({ id: newId("use"), userId, kind: usage.kind, minutes, at });
    }
    for (const c of costs) {
      data.costs.push({
        id: newId("cost"),
        userId,
        provider: c.provider,
        operation: c.operation,
        units: c.units,
        costMicros: Math.round(c.units * rate(c.provider, c.operation)),
        at,
      });
    }
    save();
  } catch (err) {
    console.error("[meter] failed", err);
  }
}
