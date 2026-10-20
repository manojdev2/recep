import { cookies } from "next/headers";
import { createSession, sessionCookie } from "@/server/auth";
import { db } from "@/server/db";
import { DEMO_ADMIN_EMAIL, DEMO_OWNER_EMAIL, LEGACY_DEMO_EMAILS } from "@/server/seed";
import { isDemoMode } from "@/server/settings";

/** Signs the visitor into one of the two seeded demo accounts. Only in demo mode. */
export async function POST(req: Request) {
  if (!isDemoMode()) return Response.json({ error: "Demo sign-in is turned off." }, { status: 404 });
  let role = "owner";
  try {
    role = (await req.json()).role ?? "owner";
  } catch {}
  const email = role === "admin" ? DEMO_ADMIN_EMAIL : DEMO_OWNER_EMAIL;
  const user = db().users.find((u) => u.email === email || u.email === LEGACY_DEMO_EMAILS[email]);
  if (!user) return Response.json({ error: "The demo account is missing." }, { status: 500 });
  const { token, expiresAt } = createSession(user.id);
  (await cookies()).set(sessionCookie(token, expiresAt));
  return Response.json({ ok: true, to: role === "admin" ? "/admin" : "/app" });
}
