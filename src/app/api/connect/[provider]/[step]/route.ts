import crypto from "node:crypto";
import { findConnector } from "@/lib/catalog";
import { newId } from "@/lib/utils";
import { recordProviderEvent } from "@/server/ai";
import { userFromRequest } from "@/server/auth";
import { seal } from "@/server/crypto";
import { db, nowIso, save } from "@/server/db";
import { getSetting, requestOrigin } from "@/server/settings";

type Provider = {
  apps: string[];
  clientId: () => string;
  clientSecret: () => string;
  authorize: () => string;
  token: () => string;
  scopes: (app: string) => string[];
  extra?: Record<string, string>;
};

const GOOGLE_SCOPES: Record<string, string[]> = {
  gmail: ["https://www.googleapis.com/auth/gmail.send", ...(getSetting("GOOGLE_ENABLE_GMAIL_READ") === "true" ? ["https://www.googleapis.com/auth/gmail.readonly"] : [])],
  gcal: ["https://www.googleapis.com/auth/calendar.events"],
  gsheets: ["https://www.googleapis.com/auth/spreadsheets"],
};

const PROVIDERS: Record<string, Provider> = {
  google: {
    apps: ["gmail", "gcal", "gsheets"],
    clientId: () => getSetting("GOOGLE_CONNECTOR_CLIENT_ID"),
    clientSecret: () => getSetting("GOOGLE_CONNECTOR_CLIENT_SECRET"),
    authorize: () => "https://accounts.google.com/o/oauth2/v2/auth",
    token: () => "https://oauth2.googleapis.com/token",
    scopes: (app) => ["openid", "email", ...(GOOGLE_SCOPES[app] ?? [])],
    extra: { access_type: "offline", prompt: "consent", include_granted_scopes: "true" },
  },
  microsoft: {
    apps: ["outlook"],
    clientId: () => getSetting("MICROSOFT_CLIENT_ID"),
    clientSecret: () => getSetting("MICROSOFT_CLIENT_SECRET"),
    authorize: () => `https://login.microsoftonline.com/${getSetting("MICROSOFT_TENANT") || "common"}/oauth2/v2.0/authorize`,
    token: () => `https://login.microsoftonline.com/${getSetting("MICROSOFT_TENANT") || "common"}/oauth2/v2.0/token`,
    scopes: () => ["offline_access", "openid", "email", "Mail.Send", "Mail.Read"],
  },
  salesforce: {
    apps: ["salesforce"],
    clientId: () => getSetting("SALESFORCE_CLIENT_ID"),
    clientSecret: () => getSetting("SALESFORCE_CLIENT_SECRET"),
    authorize: () => `${getSetting("SALESFORCE_LOGIN_URL") || "https://login.salesforce.com"}/services/oauth2/authorize`,
    token: () => `${getSetting("SALESFORCE_LOGIN_URL") || "https://login.salesforce.com"}/services/oauth2/token`,
    scopes: () => ["api", "refresh_token"],
  },
};

const COOKIE = "ra_oauth";
const back = (query: string) => new Response(null, { status: 302, headers: { location: `/app/apps?${query}` } });

function readCookie(req: Request) {
  for (const part of (req.headers.get("cookie") ?? "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === COOKIE) return decodeURIComponent(v.join("="));
  }
  return "";
}

export async function GET(req: Request, { params }: { params: Promise<{ provider: string; step: string }> }) {
  const { provider: name, step } = await params;
  const provider = PROVIDERS[name];
  if (!provider || !provider.clientId() || !provider.clientSecret()) return new Response("Not found", { status: 404 });
  const user = userFromRequest(req);
  if (!user) return new Response(null, { status: 302, headers: { location: "/login" } });
  const url = new URL(req.url);
  const base = requestOrigin(req);
  const redirectUri = `${base}/api/connect/${name}/callback`;

  if (step === "start") {
    const app = url.searchParams.get("app") ?? provider.apps[0];
    if (!provider.apps.includes(app)) return back("error=unknown-app");
    const state = crypto.randomBytes(18).toString("base64url");
    const q = new URLSearchParams({
      client_id: provider.clientId(),
      redirect_uri: redirectUri,
      response_type: "code",
      scope: provider.scopes(app).join(" "),
      state,
      ...provider.extra,
    });
    return new Response(null, {
      status: 302,
      headers: {
        location: `${provider.authorize()}?${q}`,
        "set-cookie": `${COOKIE}=${encodeURIComponent(`${state}.${app}.${user.id}`)}; Path=/api/connect; HttpOnly; SameSite=Lax; Max-Age=600${base.startsWith("https") ? "; Secure" : ""}`,
      },
    });
  }

  if (step !== "callback") return new Response("Not found", { status: 404 });
  const [state, app, userId] = readCookie(req).split(".");
  if (!state || state !== url.searchParams.get("state") || userId !== user.id) return back("error=state");
  const code = url.searchParams.get("code");
  if (!code) return back(`error=${encodeURIComponent(url.searchParams.get("error") ?? "denied")}`);

  const started = Date.now();
  const res = await fetch(provider.token(), {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: provider.clientId(),
      client_secret: provider.clientSecret(),
    }),
    signal: AbortSignal.timeout(15_000),
  });
  recordProviderEvent(name, "oauth.token", res.ok, Date.now() - started, res.ok ? null : String(res.status));
  if (!res.ok) return back("error=token");
  const tok = (await res.json()) as { access_token: string; refresh_token?: string; expires_in?: number; instance_url?: string; id_token?: string };

  let label = findConnector(app)?.name ?? app;
  if (tok.id_token) {
    try {
      const claims = JSON.parse(Buffer.from(tok.id_token.split(".")[1], "base64url").toString());
      if (claims.email) label = claims.email;
    } catch {}
  }
  const config: Record<string, string> = { token: tok.access_token };
  if (tok.refresh_token) config.refreshToken = tok.refresh_token;
  if (tok.expires_in) config.expiresAt = new Date(Date.now() + tok.expires_in * 1000).toISOString();
  if (tok.instance_url) config.instanceUrl = tok.instance_url;

  const data = db();
  const now = nowIso();
  const existing = data.connections.find((c) => c.userId === user.id && c.appKey === app && c.accountLabel === label);
  if (existing) {
    existing.secret = seal(config);
    existing.oauth = true;
    existing.updatedAt = now;
  } else {
    data.connections.push({ id: newId("con"), userId: user.id, appKey: app, accountLabel: label, secret: seal(config), oauth: true, createdAt: now, updatedAt: now });
  }
  save();
  return new Response(null, {
    status: 302,
    headers: { location: `/app/apps?connected=${app}`, "set-cookie": `${COOKIE}=; Path=/api/connect; Max-Age=0` },
  });
}
