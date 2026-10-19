import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  createSession,
  createUser,
  demoAccountsOpen,
  destroySession,
  isDemoAccount,
  hashPassword,
  sessionCookie,
  toSessionUser,
  userFromRequest,
  verifyPassword,
} from "@/server/auth";
import { claimAdmin, isListedAdmin } from "@/server/admin-claim";
import { db, save } from "@/server/db";
import { branding, DEMO_REFUSAL, isDemoMode, requestOrigin } from "@/server/settings";

type Params = { params: Promise<{ action: string }> };

export async function GET(req: Request, { params }: Params) {
  const { action } = await params;
  if (action !== "session") return Response.json({ error: "Not found" }, { status: 404 });
  const user = userFromRequest(req);
  return Response.json(user ? { user } : null);
}

export async function POST(req: Request, { params }: Params) {
  const { action } = await params;
  const jar = await cookies();

  if (action === "sign-out") {
    const token = jar.get(SESSION_COOKIE)?.value;
    if (token) destroySession(token);
    jar.delete(SESSION_COOKIE);
    return Response.json({ ok: true });
  }

  let body: { email?: string; password?: string; name?: string; currentPassword?: string; newPassword?: string } = {};
  try {
    body = await req.json();
  } catch {}

  if (action === "change-password") {
    const session = userFromRequest(req);
    if (!session) return Response.json({ error: "Please sign in again." }, { status: 401 });
    if (isDemoMode()) return Response.json({ error: DEMO_REFUSAL }, { status: 403 });
    const data = db();
    const user = data.users.find((u) => u.id === session.id);
    if (!user || !verifyPassword(body.currentPassword ?? "", user.passwordHash)) {
      return Response.json({ error: "Your current password is not right." }, { status: 400 });
    }
    if ((body.newPassword ?? "").length < 8) return Response.json({ error: "Use at least 8 characters." }, { status: 400 });
    user.passwordHash = hashPassword(body.newPassword ?? "");
    // Sign out every other session.
    const token = jar.get(SESSION_COOKIE)?.value;
    data.sessions = data.sessions.filter((s) => s.userId !== user.id || s.token === token);
    save();
    return Response.json({ ok: true });
  }
  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";

  if (action === "sign-in") {
    const user = db().users.find((u) => u.email.toLowerCase() === email);
    if (!user || user.disabled || (isDemoAccount(user) && !demoAccountsOpen()) || !verifyPassword(password, user.passwordHash)) {
      return Response.json({ error: "That email and password do not match." }, { status: 401 });
    }
    const { token, expiresAt } = createSession(user.id);
    jar.set(sessionCookie(token, expiresAt));
    await claimAdmin(user, requestOrigin(req));
    return Response.json({ user: toSessionUser(user) });
  }

  if (action === "sign-up") {
    // A listed operator address may always register — otherwise a closed or demo install could never be administered.
    if (!branding().signupsOpen && !isListedAdmin(email)) return Response.json({ error: "New accounts are closed right now." }, { status: 403 });
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return Response.json({ error: "Enter a valid email address." }, { status: 400 });
    }
    if (password.length < 8) return Response.json({ error: "Use at least 8 characters." }, { status: 400 });
    const data = db();
    if (data.users.some((u) => u.email.toLowerCase() === email)) {
      return Response.json({ error: "An account with that email already exists." }, { status: 409 });
    }
    const user = createUser({ email, name: body.name ?? "", passwordHash: hashPassword(password) });
    const { token, expiresAt } = createSession(user.id);
    jar.set(sessionCookie(token, expiresAt));
    await claimAdmin(user, requestOrigin(req));
    return Response.json({ user: toSessionUser(user) });
  }

  return Response.json({ error: "Not found" }, { status: 404 });
}
