import "server-only";
import { newId } from "@/lib/utils";
import { mask } from "../crypto";
import { db, nowIso, save } from "../db";
import { adminMutation, adminQuery, RpcError, type UserCtx } from "../rpc";
import { SETTING_DEFS } from "../setting-defs";
import { getSetting, settingSource } from "../settings";
import { minutesUsed, monthKey } from "../usage";
import type { AdminLevel, Plan, RateCard } from "../types";

const REQUIRED = ["OPENAI_API_KEY", "APP_URL", "DATABASE_URL", "CREDENTIAL_ENCRYPTION_KEY"];

function requireSuper(ctx: UserCtx) {
  if (ctx.user.adminLevel !== "super") throw new RpcError("Only a super admin can do that.", 403);
}

function audit(ctx: UserCtx, action: string, target: string, detail = "") {
  db().audit.push({ id: newId("aud"), actorId: ctx.user.id, actor: ctx.user.email, action, target, detail, at: nowIso() });
  save();
}

function plansWithAccounts() {
  const d = db();
  return [...d.plans]
    .sort((a, b) => a.position - b.position)
    .map((p) => ({ ...p, accounts: d.subscriptions.filter((s) => s.planId === p.id && s.status !== "cancelled").length }));
}

function auditRows(input: { limit?: number; action?: string; actor?: string; days?: number }) {
  const since = Date.now() - (input.days ?? 3650) * 864e5;
  return db()
    .audit.filter(
      (a) =>
        new Date(a.at).getTime() >= since &&
        (!input.action || a.action === input.action) &&
        (!input.actor || a.actor.toLowerCase().includes(input.actor.toLowerCase())),
    )
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, Math.min(1000, input.limit ?? 200))
    .map(({ id, action, target, detail, actor, at }) => ({ id, action, target, detail, actor, at }));
}

export const admin = {
  overview: adminQuery(() => {
    const d = db();
    const monthAgo = Date.now() - 30 * 864e5;
    const active = new Set(d.conversations.filter((c) => new Date(c.lastAt).getTime() >= monthAgo).map((c) => c.userId));
    for (const c of d.calls) if (new Date(c.startedAt).getTime() >= monthAgo) active.add(c.userId);
    return {
      tenants: d.users.length,
      activeTenants: active.size,
      liveAgents: d.agents.filter((a) => a.status === "live").length,
      numbers: d.phoneNumbers.length,
      calls30d: d.calls.filter((c) => new Date(c.startedAt).getTime() >= monthAgo).length,
      missing: REQUIRED.filter((k) => settingSource(k) === "unset" || !getSetting(k))
        .map((k) => SETTING_DEFS.find((s) => s.key === k))
        .filter((s) => !!s)
        .map((s) => ({ key: s.key, label: s.label, help: s.help })),
    };
  }),

  tenants: adminQuery(() => {
    const d = db();
    const monthAgo = Date.now() - 30 * 864e5;
    return [...d.users]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 500)
      .map((u) => {
        const calls = d.calls.filter((c) => c.userId === u.id);
        const lastCall = calls.map((c) => c.startedAt).sort().at(-1) ?? null;
        return {
          userId: u.id,
          email: u.email,
          name: u.name,
          createdAt: u.createdAt,
          plan: u.plan,
          agents: d.agents.filter((a) => a.userId === u.id).length,
          liveAgents: d.agents.filter((a) => a.userId === u.id && a.status === "live").length,
          numbers: d.phoneNumbers.filter((n) => n.userId === u.id).length,
          calls30d: calls.filter((c) => new Date(c.startedAt).getTime() >= monthAgo).length,
          minutesUsed: minutesUsed(u.id),
          lastSeen: lastCall,
        };
      });
  }),

  setTenantPlan: adminMutation((input: { userId: string; plan: string }, ctx) => {
    requireSuper(ctx);
    const d = db();
    const u = d.users.find((x) => x.id === input.userId);
    if (!u) throw new RpcError("That account is gone.");
    if (!d.plans.some((p) => p.id === input.plan)) throw new RpcError("That plan does not exist.");
    const from = u.plan;
    u.plan = input.plan;
    const sub = d.subscriptions.find((s) => s.userId === u.id);
    if (sub) sub.planId = input.plan;
    save();
    audit(ctx, "tenant.plan", u.email, `${from} → ${input.plan}`);
    return { ok: true };
  }),

  plans: adminQuery(() => plansWithAccounts()),

  savePlan: adminMutation((input: Omit<Plan, "id"> & { id: string }, ctx) => {
    requireSuper(ctx);
    const d = db();
    const id = input.id.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
    if (!id) throw new RpcError("Give the plan an id, like growth.");
    if (!input.name.trim()) throw new RpcError("Give the plan a name.");
    const clean = (v: number | null) => (v === null || v === undefined || Number.isNaN(Number(v)) ? null : Math.max(0, Number(v)));
    const row: Plan = {
      id,
      name: input.name.trim(),
      priceLabel: input.priceLabel.trim(),
      position: Number(input.position) || 0,
      minutes: clean(input.minutes),
      agents: clean(input.agents),
      numbers: clean(input.numbers),
      features: input.features ?? "",
      public: !!input.public,
      stripePriceId: (input.stripePriceId ?? "").trim(),
    };
    const existing = d.plans.findIndex((p) => p.id === id);
    if (existing >= 0) d.plans[existing] = row;
    else d.plans.push(row);
    save();
    audit(ctx, existing >= 0 ? "plan.update" : "plan.create", id, row.priceLabel);
    return { ok: true };
  }),

  deletePlan: adminMutation((input: { id: string }, ctx) => {
    requireSuper(ctx);
    const d = db();
    if (d.users.some((u) => u.plan === input.id)) throw new RpcError("Accounts are on this plan. Move them first.");
    if (d.plans.length <= 1) throw new RpcError("Keep at least one plan.");
    d.plans = d.plans.filter((p) => p.id !== input.id);
    save();
    audit(ctx, "plan.delete", input.id);
    return { ok: true };
  }),

  finance: adminQuery((input: { months: number }, ctx) => {
    requireSuper(ctx);
    const d = db();
    const months = Math.max(1, Math.min(24, input.months || 1));
    // A rolling window (30 days per month), so "this month" early in a month still has history.
    const now = new Date();
    const since = new Date(now.getTime() - months * 30 * 864e5);
    const keys: string[] = [];
    for (let m = new Date(Date.UTC(since.getUTCFullYear(), since.getUTCMonth(), 1)); m <= now; m = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + 1, 1))) {
      keys.push(monthKey(m));
    }
    const sinceIso = since.toISOString();
    const costs = d.costs.filter((c) => c.at >= sinceIso);
    const revenue = d.revenue.filter((r) => r.period >= sinceIso.slice(0, 10));
    const revenueMicros = revenue.reduce((s, r) => s + r.amountMicros, 0);
    const apiCostMicros = costs.reduce((s, c) => s + c.costMicros, 0);
    const fixedCostMicros = d.fixedCosts.reduce((s, f) => s + f.monthlyMicros, 0) * months;
    const totalCostMicros = apiCostMicros + fixedCostMicros;
    const netMicros = revenueMicros - totalCostMicros;
    const byProviderMap = new Map<string, { provider: string; operation: string; costMicros: number; events: number }>();
    for (const c of costs) {
      const k = `${c.provider}:${c.operation}`;
      const row = byProviderMap.get(k) ?? { provider: c.provider, operation: c.operation, costMicros: 0, events: 0 };
      row.costMicros += c.costMicros;
      row.events += 1;
      byProviderMap.set(k, row);
    }
    const priceOf = (planId: string) => {
      const label = d.plans.find((p) => p.id === planId)?.priceLabel ?? "";
      const m = /\$\s?([\d,.]+)/.exec(label);
      return m ? Math.round(Number(m[1].replace(/,/g, "")) * 1e6) : 0;
    };
    const mrrMicros = d.subscriptions.filter((s) => s.status === "active").reduce((s, sub) => s + priceOf(sub.planId), 0);
    return {
      pl: {
        months,
        revenueMicros,
        apiCostMicros,
        fixedCostMicros,
        totalCostMicros,
        netMicros,
        marginPct: revenueMicros ? Math.round((netMicros / revenueMicros) * 100) : null,
        mrrMicros,
        byProvider: [...byProviderMap.values()].sort((a, b) => b.costMicros - a.costMicros),
        byMonth: keys.map((month) => {
          const rev = d.revenue.filter((r) => r.period.startsWith(month)).reduce((s, r) => s + r.amountMicros, 0);
          const cost = d.costs.filter((c) => c.at.startsWith(month)).reduce((s, c) => s + c.costMicros, 0);
          return { month, revenueMicros: rev, costMicros: cost, netMicros: rev - cost };
        }),
      },
      tenants: d.users
        .map((u) => {
          const rev = revenue.filter((r) => r.userId === u.id).reduce((s, r) => s + r.amountMicros, 0);
          const cost = costs.filter((c) => c.userId === u.id).reduce((s, c) => s + c.costMicros, 0);
          const minutes = Math.round(d.usage.filter((x) => x.userId === u.id && x.at >= sinceIso).reduce((s, x) => s + x.minutes, 0) * 10) / 10;
          return { userId: u.id, email: u.email, plan: u.plan, revenueMicros: rev, costMicros: cost, netMicros: rev - cost, minutes };
        })
        .sort((a, b) => a.netMicros - b.netMicros),
      rates: [...d.rates].sort((a, b) => `${a.provider}${a.operation}`.localeCompare(`${b.provider}${b.operation}`)),
      fixed: d.fixedCosts,
      revenue: [...d.revenue]
        .sort((a, b) => b.period.localeCompare(a.period))
        .map((r) => ({ ...r, email: d.users.find((u) => u.id === r.userId)?.email ?? "deleted account" })),
    };
  }),

  addFixedCost: adminMutation(
    (input: { label: string; category: string; monthlyMicros: number; startsOn: string; endsOn: string | null; note: string }, ctx) => {
      requireSuper(ctx);
      if (!input.label.trim()) throw new RpcError("Name the cost.");
      db().fixedCosts.push({
        id: newId("fix"),
        label: input.label.trim(),
        category: input.category || "other",
        monthlyMicros: Math.max(0, Math.round(input.monthlyMicros) || 0),
        startsOn: input.startsOn,
        endsOn: input.endsOn,
        note: input.note ?? "",
        createdAt: nowIso(),
      });
      save();
      audit(ctx, "finance.fixed.add", input.label);
      return { ok: true };
    },
  ),

  removeFixedCost: adminMutation((input: { id: string }, ctx) => {
    requireSuper(ctx);
    const d = db();
    d.fixedCosts = d.fixedCosts.filter((f) => f.id !== input.id);
    save();
    audit(ctx, "finance.fixed.remove", input.id);
    return { ok: true };
  }),

  addRevenue: adminMutation((input: { userId: string; plan: string; amountMicros: number; period: string; note: string }, ctx) => {
    requireSuper(ctx);
    const d = db();
    const u = d.users.find((x) => x.id === input.userId);
    if (!u) throw new RpcError("Choose an account.");
    d.revenue.push({
      id: newId("rev"),
      userId: u.id,
      plan: input.plan || u.plan,
      amountMicros: Math.max(0, Math.round(input.amountMicros) || 0),
      currency: "USD",
      period: input.period || nowIso().slice(0, 10),
      note: input.note ?? "",
      source: "manual",
      createdAt: nowIso(),
    });
    save();
    audit(ctx, "finance.revenue.add", u.email);
    return { ok: true };
  }),

  removeRevenue: adminMutation((input: { id: string }, ctx) => {
    requireSuper(ctx);
    const d = db();
    d.revenue = d.revenue.filter((r) => r.id !== input.id);
    save();
    audit(ctx, "finance.revenue.remove", input.id);
    return { ok: true };
  }),

  saveRate: adminMutation((input: Omit<RateCard, "updatedAt">, ctx) => {
    requireSuper(ctx);
    const d = db();
    const row = d.rates.find((r) => r.provider === input.provider && r.operation === input.operation);
    if (row) {
      row.costMicros = Math.max(0, Math.round(input.costMicros) || 0);
      row.updatedAt = nowIso();
    } else d.rates.push({ ...input, updatedAt: nowIso() });
    save();
    audit(ctx, "finance.rate", `${input.provider} ${input.operation}`, String(input.costMicros));
    return { ok: true };
  }),

  removeRate: adminMutation((input: { provider: string; operation: string }, ctx) => {
    requireSuper(ctx);
    const d = db();
    d.rates = d.rates.filter((r) => !(r.provider === input.provider && r.operation === input.operation));
    save();
    return { ok: true };
  }),

  health: adminQuery((input: { hours: number }) => {
    const since = Date.now() - (input.hours || 24) * 3600_000;
    const events = db().providerEvents.filter((e) => new Date(e.at).getTime() >= since);
    const groups = new Map<string, typeof events>();
    for (const e of events) {
      const k = `${e.provider}:${e.operation}`;
      groups.set(k, [...(groups.get(k) ?? []), e]);
    }
    const providers = [...groups.values()].map((list) => {
      const failures = list.filter((e) => !e.ok);
      const errorRate = Math.round((failures.length / list.length) * 100);
      return {
        provider: list[0].provider,
        operation: list[0].operation,
        calls: list.length,
        failures: failures.length,
        errorRate,
        avgMs: Math.round(list.reduce((s, e) => s + e.latencyMs, 0) / list.length),
        maxMs: Math.max(...list.map((e) => e.latencyMs)),
        lastFailureAt: failures.map((f) => f.at).sort().at(-1) ?? null,
        status: (errorRate >= 50 ? "failing" : errorRate > 0 ? "degraded" : "healthy") as "failing" | "degraded" | "healthy",
      };
    });
    return {
      hours: input.hours || 24,
      providers: providers.sort((a, b) => b.calls - a.calls),
      failures: events
        .filter((e) => !e.ok)
        .sort((a, b) => b.at.localeCompare(a.at))
        .slice(0, 50)
        .map((e) => ({
          id: e.id,
          at: e.at,
          provider: e.provider,
          operation: e.operation,
          status: /^\d{3}/.exec(e.error ?? "")?.[0] ?? "",
          detail: e.error ?? "",
        })),
    };
  }),

  settings: adminQuery((_: void, ctx) => {
    requireSuper(ctx);
    const rows = db().settings;
    return SETTING_DEFS.map((def) => {
      const source = settingSource(def.key);
      const value = getSetting(def.key);
      const stored = rows.find((r) => r.key === def.key);
      return {
        ...def,
        source,
        display: !value ? "" : def.secret ? mask(value) : value,
        configured: !!value,
        updatedAt: stored?.updatedAt ?? null,
        updatedBy: stored?.updatedBy ?? "",
      };
    });
  }),

  saveSetting: adminMutation((input: { key: string; value: string }, ctx) => {
    requireSuper(ctx);
    const def = SETTING_DEFS.find((d) => d.key === input.key);
    if (!def) throw new RpcError("Unknown setting.");
    if (def.envOnly) throw new RpcError("This one can only come from the environment.");
    const value = String(input.value ?? "").trim();
    if (def.kind === "number" && value && Number.isNaN(Number(value))) throw new RpcError("That needs to be a number.");
    const d = db();
    d.settings = d.settings.filter((s) => s.key !== def.key);
    d.settings.push({ key: def.key, value, updatedAt: nowIso(), updatedBy: ctx.user.email });
    save();
    audit(ctx, "setting.update", def.key, value ? (def.secret ? "secret updated" : value) : "turned off");
    return { ok: true };
  }),

  admins: adminQuery(() => {
    const d = db();
    return d.admins.map((a) => {
      const u = d.users.find((x) => x.id === a.userId);
      return { userId: a.userId, email: u?.email ?? "deleted", name: u?.name ?? "", level: a.level, createdAt: a.createdAt };
    });
  }),

  grant: adminMutation((input: { email: string; level: AdminLevel }, ctx) => {
    requireSuper(ctx);
    const d = db();
    const u = d.users.find((x) => x.email.toLowerCase() === input.email.trim().toLowerCase());
    if (!u) throw new RpcError("No account uses that email. They must sign in once first.");
    const level: AdminLevel = input.level === "super" ? "super" : "support";
    const existing = d.admins.find((a) => a.userId === u.id);
    if (existing) existing.level = level;
    else d.admins.push({ userId: u.id, level, createdAt: nowIso() });
    save();
    audit(ctx, "admin.grant", u.email, level);
    return { ok: true };
  }),

  revoke: adminMutation((input: { userId: string }, ctx) => {
    requireSuper(ctx);
    const d = db();
    const target = d.admins.find((a) => a.userId === input.userId);
    if (!target) return { ok: true };
    if (target.level === "super" && d.admins.filter((a) => a.level === "super").length === 1) {
      throw new RpcError("Keep at least one super admin.");
    }
    d.admins = d.admins.filter((a) => a.userId !== input.userId);
    save();
    audit(ctx, "admin.revoke", d.users.find((u) => u.id === input.userId)?.email ?? input.userId);
    return { ok: true };
  }),

  audit: adminQuery((input: { limit?: number; action?: string; actor?: string; days?: number }) => auditRows(input ?? {})),

  auditActions: adminQuery(() => [...new Set(db().audit.map((a) => a.action))].sort()),

  auditCsv: adminQuery((input: { action?: string; actor?: string; days?: number }) => {
    const rows = auditRows({ ...input, limit: 1000 });
    const esc = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
    return ["when,who,action,target,detail", ...rows.map((r) => [r.at, r.actor, r.action, r.target, r.detail].map(esc).join(","))].join("\n");
  }),
};
