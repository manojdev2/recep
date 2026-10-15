import "server-only";
import { findConnector } from "@/lib/catalog";
import { newId } from "@/lib/utils";
import { recordProviderEvent } from "../ai";
import { seal, unseal } from "../crypto";
import { db, nowIso, save } from "../db";
import { mutation, query, RpcError } from "../rpc";
import { getSetting } from "../settings";

type Cfg = Record<string, string>;

async function probe(provider: string, url: string, init: RequestInit) {
  const started = Date.now();
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(10_000) });
    recordProviderEvent(provider, "verify", res.ok, Date.now() - started, res.ok ? null : String(res.status));
    return res;
  } catch (err) {
    recordProviderEvent(provider, "verify", false, Date.now() - started, err instanceof Error ? err.message : "network");
    throw new RpcError(`Could not reach ${provider}.`);
  }
}

const bearer = (t: string) => ({ authorization: `Bearer ${t}` });

/** Check a credential against the provider's live API before it is stored. */
async function verify(appKey: string, c: Cfg) {
  const t = c.token ?? "";
  const fail = (what = "token") => {
    throw new RpcError(`That ${what} was refused by ${findConnector(appKey)?.name ?? appKey}.`);
  };
  switch (appKey) {
    case "gmail":
    case "gcal":
    case "gsheets": {
      const res = await probe("google", `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(t)}`, {});
      if (!res.ok) fail("access token");
      return;
    }
    case "slack": {
      const res = await probe("slack", "https://slack.com/api/auth.test", { method: "POST", headers: bearer(t) });
      const body = await res.json().catch(() => ({}));
      if (!body.ok) fail();
      return;
    }
    case "hubspot": {
      const res = await probe("hubspot", "https://api.hubapi.com/crm/v3/objects/contacts?limit=1", { headers: bearer(t) });
      if (!res.ok) fail();
      return;
    }
    case "stripe": {
      const res = await probe("stripe", "https://api.stripe.com/v1/balance", { headers: bearer(t) });
      if (!res.ok) fail("secret key");
      return;
    }
    case "notion": {
      const res = await probe("notion", "https://api.notion.com/v1/users/me", { headers: { ...bearer(t), "notion-version": "2022-06-28" } });
      if (!res.ok) fail();
      return;
    }
    case "calendly": {
      const res = await probe("calendly", "https://api.calendly.com/users/me", { headers: bearer(t) });
      if (!res.ok) fail();
      return;
    }
    case "shopify": {
      const shop = (c.shop ?? "").replace(/^https?:\/\//, "").replace(/\/.*$/, "");
      if (!/\.myshopify\.com$/.test(shop)) throw new RpcError("Use the shop's .myshopify.com address.");
      const res = await probe("shopify", `https://${shop}/admin/api/2024-10/shop.json`, { headers: { "x-shopify-access-token": t } });
      if (!res.ok) fail("Admin API token");
      return;
    }
    case "openai": {
      const res = await probe("openai", "https://api.openai.com/v1/models", { headers: bearer(t) });
      if (!res.ok) fail("API key");
      return;
    }
    case "anthropic": {
      const res = await probe("anthropic", "https://api.anthropic.com/v1/models", { headers: { "x-api-key": t, "anthropic-version": "2023-06-01" } });
      if (!res.ok) fail("API key");
      return;
    }
    case "xai": {
      const res = await probe("xai", "https://api.x.ai/v1/models", { headers: bearer(t) });
      if (!res.ok) fail("API key");
      return;
    }
    case "openrouter": {
      const res = await probe("openrouter", "https://openrouter.ai/api/v1/key", { headers: bearer(t) });
      if (!res.ok) fail("API key");
      return;
    }
    case "elevenlabs": {
      const res = await probe("elevenlabs", "https://api.elevenlabs.io/v1/user", { headers: { "xi-api-key": t } });
      if (!res.ok) fail("API key");
      return;
    }
    case "deepgram": {
      const res = await probe("deepgram", "https://api.deepgram.com/v1/projects", { headers: { authorization: `Token ${t}` } });
      if (!res.ok) fail("API key");
      return;
    }
    default:
      return; // No public check for this provider; the key is stored as given.
  }
}

function connectionRow(c: { id: string; appKey: string; accountLabel: string; oauth: boolean; createdAt: string }) {
  return { id: c.id, appKey: c.appKey, accountLabel: c.accountLabel, oauth: c.oauth, createdAt: c.createdAt };
}

async function connect(userId: string, input: { appKey: string; accountLabel: string; config: Cfg }) {
  const def = findConnector(input.appKey);
  if (!def) throw new RpcError("That integration does not exist.");
  const config = Object.fromEntries(Object.entries(input.config ?? {}).map(([k, v]) => [k, String(v).trim()]));
  for (const f of def.fields) if (f.required && !config[f.key]) throw new RpcError(`Add ${f.label ?? f.key}.`);
  await verify(def.key, config);
  const data = db();
  const now = nowIso();
  const label = input.accountLabel.trim() || def.name;
  let conn = data.connections.find((c) => c.userId === userId && c.appKey === def.key);
  if (conn) {
    conn.accountLabel = label;
    conn.secret = seal(config);
    conn.updatedAt = now;
  } else {
    conn = { id: newId("con"), userId, appKey: def.key, accountLabel: label, secret: seal(config), oauth: false, createdAt: now, updatedAt: now };
    data.connections.push(conn);
  }
  save();
  return conn;
}

export const connectors = {
  list: query((_: void, { user }) => db().connections.filter((c) => c.userId === user.id).map(connectionRow)),

  oauthStatus: query(() => {
    const google = !!(getSetting("GOOGLE_CONNECTOR_CLIENT_ID") && getSetting("GOOGLE_CONNECTOR_CLIENT_SECRET"));
    return {
      gmail: google,
      gcal: google,
      gsheets: google,
      outlook: !!(getSetting("MICROSOFT_CLIENT_ID") && getSetting("MICROSOFT_CLIENT_SECRET")),
      salesforce: !!(getSetting("SALESFORCE_CLIENT_ID") && getSetting("SALESFORCE_CLIENT_SECRET")),
    };
  }),

  connect: mutation(async (input: { appKey: string; accountLabel: string; config: Cfg }, { user }) => connectionRow(await connect(user.id, input))),

  /** Connect and attach to one receptionist in a single step (studio Apps tab). */
  connectForAgent: mutation(async (input: { agentId: string; appKey: string; accountLabel: string; config: Cfg }, { user }) => {
    if (!db().agents.some((a) => a.id === input.agentId && a.userId === user.id)) throw new RpcError("This receptionist is gone.");
    const conn = await connect(user.id, input);
    const data = db();
    if (!data.agentConnections.some((l) => l.agentId === input.agentId && l.connectionId === conn.id)) {
      data.agentConnections.push({ id: newId("acn"), agentId: input.agentId, connectionId: conn.id, createdAt: nowIso() });
      save();
    }
    return connectionRow(conn);
  }),

  disconnect: mutation((id: string, { user }) => {
    const data = db();
    data.connections = data.connections.filter((c) => !(c.id === id && c.userId === user.id));
    data.agentConnections = data.agentConnections.filter((l) => l.connectionId !== id);
    save();
    return { ok: true };
  }),

  forAgent: query((agentId: string, { user }) => {
    const data = db();
    if (!data.agents.some((a) => a.id === agentId && a.userId === user.id)) return [];
    return data.agentConnections
      .filter((l) => l.agentId === agentId)
      .map((l) => {
        const c = data.connections.find((x) => x.id === l.connectionId);
        return c
          ? { id: l.id, connectionId: c.id, appKey: c.appKey, accountLabel: c.accountLabel, hasCredentials: !!unseal(c.secret) }
          : null;
      })
      .filter((x) => !!x);
  }),

  attach: mutation((input: { agentId: string; connectionId: string }, { user }) => {
    const data = db();
    if (!data.agents.some((a) => a.id === input.agentId && a.userId === user.id)) throw new RpcError("This receptionist is gone.");
    if (!data.connections.some((c) => c.id === input.connectionId && c.userId === user.id)) throw new RpcError("That connection is gone.");
    if (!data.agentConnections.some((l) => l.agentId === input.agentId && l.connectionId === input.connectionId)) {
      data.agentConnections.push({ id: newId("acn"), agentId: input.agentId, connectionId: input.connectionId, createdAt: nowIso() });
      save();
    }
    return { ok: true };
  }),

  detach: mutation((input: { agentId: string; connectionId: string }, { user }) => {
    const data = db();
    if (!data.agents.some((a) => a.id === input.agentId && a.userId === user.id)) throw new RpcError("This receptionist is gone.");
    data.agentConnections = data.agentConnections.filter((l) => !(l.agentId === input.agentId && l.connectionId === input.connectionId));
    save();
    return { ok: true };
  }),
};
