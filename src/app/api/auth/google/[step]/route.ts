import crypto from "node:crypto";
import { claimAdmin, isListedAdmin } from "@/server/admin-claim";
import { recordProviderEvent } from "@/server/ai";
import { createSession, createUser, demoAccountsOpen, isDemoAccount, sessionCookie, SESSION_COOKIE } from "@/server/auth";
import { db, save } from "@/server/db";
import { branding, getSetting, requestOrigin } from "@/server/settings";

const STATE_COOKIE = "ra_google_state";

const origin = (req: Request) => requestOrigin(req);
const back = (to: string, extraCookie?: string) =>
  new Response(null, { status: 302, headers: { location: to, ...(extraCookie ? { "set-cookie": extraCookie } : {}) } });
const fail = (message: string) => back(`/login?error=${encodeURIComponent(message)}`, `${STATE_COOKIE}=; Path=/api/auth/google; Max-Age=0`);

function readCookie(req: Request, name: string) {
  for (const part of (req.headers.get("cookie") ?? "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return "";
}

/** "Continue with Google" — shown on the sign-in page when GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set. */
export async function GET(req: Request, { params }: { params: Promise<{ step: string }> }) {
  const { step } = await params;
  const clientId = getSetting("GOOGLE_CLIENT_ID");
  const secret = getSetting("GOOGLE_CLIENT_SECRET");
  if (!clientId || !secret) return fail("That sign-in method is not configured.");
  const redirectUri = `${origin(req)}/api/auth/google/callback`;
  const secure = redirectUri.startsWith("https") ? "; Secure" : "";

  if (step === "start") {
    const state = crypto.randomBytes(18).toString("base64url");
    const q = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      state,
      prompt: "select_account",
    });
    return back(`https://accounts.google.com/o/oauth2/v2/auth?${q}`, `${STATE_COOKIE}=${state}; Path=/api/auth/google; HttpOnly; SameSite=Lax; Max-Age=600${secure}`);
  }
  if (step !== "callback") return new Response("Not found", { status: 404 });

  const url = new URL(req.url);
  const state = readCookie(req, STATE_COOKIE);
  if (!state || state !== url.searchParams.get("state")) return fail("That sign-in took too long. Please try again.");
  const code = url.searchParams.get("code");
  if (!code) return fail("Google sign-in was cancelled.");

  const started = Date.now();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri, client_id: clientId, client_secret: secret }),
    signal: AbortSignal.timeout(15_000),
  });
  recordProviderEvent("google", "signin", res.ok, Date.now() - started, res.ok ? null : String(res.status));
  if (!res.ok) return fail("Google did not accept that sign-in. Please try again.");
  const { id_token } = (await res.json()) as { id_token?: string };
  // The token came straight from Google's token endpoint over TLS, so its claims can be read directly.
  let claims: { email?: string; email_verified?: boolean; name?: string; picture?: string; aud?: string } = {};
  try {
    claims = JSON.parse(Buffer.from((id_token ?? "").split(".")[1] ?? "", "base64url").toString());
  } catch {}
  if (!claims.email || claims.aud !== clientId) return fail("Google did not share an email address.");
  if (!claims.email_verified) return fail("Your Google address is not verified.");
  const email = claims.email.toLowerCase();

  const data = db();
  let user = data.users.find((u) => u.email.toLowerCase() === email);
  if (user) {
    if (user.disabled || (isDemoAccount(user) && !demoAccountsOpen())) return fail("That account cannot sign in here.");
    user.emailVerified = true;
    if (!user.image && claims.picture) user.image = claims.picture;
    save();
  } else {
    if (!branding().signupsOpen && !isListedAdmin(email)) return fail("New accounts are closed right now.");
    user = createUser({ email, name: claims.name ?? "", passwordHash: "", emailVerified: true, image: claims.picture ?? null });
  }
  const { token, expiresAt } = createSession(user.id);
  await claimAdmin(user, origin(req));
  const c = sessionCookie(token, expiresAt);
  const sessionHeader = `${SESSION_COOKIE}=${c.value}; Path=/; HttpOnly; SameSite=Lax; Expires=${expiresAt.toUTCString()}${c.secure ? "; Secure" : ""}`;
  const headers = new Headers({ location: "/app" });
  headers.append("set-cookie", sessionHeader);
  headers.append("set-cookie", `${STATE_COOKIE}=; Path=/api/auth/google; Max-Age=0`);
  return new Response(null, { status: 302, headers });
}
