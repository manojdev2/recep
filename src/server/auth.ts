import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { newId } from "@/lib/utils";
import { adminEmails } from "./admin-claim";
import { db, save, nowIso } from "./db";
import { DEMO_ADMIN_EMAIL, DEMO_OWNER_EMAIL, LEGACY_DEMO_EMAILS } from "./seed";
import { isDemoMode } from "./settings";
import type { AdminLevel, User } from "./types";

export const SESSION_COOKIE = "ra_session";
const SESSION_DAYS = 7;

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  image: string | null;
  adminLevel: AdminLevel | null;
};

export function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string) {
  const [scheme, salt, hash] = stored.split(":");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return expected.length === candidate.length && crypto.timingSafeEqual(expected, candidate);
}

const DEMO_EMAILS = [DEMO_OWNER_EMAIL, DEMO_ADMIN_EMAIL, ...Object.values(LEGACY_DEMO_EMAILS)];

export function isDemoAccount(user: Pick<User, "email">) {
  return DEMO_EMAILS.includes(user.email.toLowerCase());
}

/**
 * The seeded demo accounts have a published password. They only open in demo mode, or on a
 * development machine — never on a real production install.
 */
export function demoAccountsOpen() {
  return isDemoMode() || process.env.NODE_ENV !== "production";
}

export function toSessionUser(user: User): SessionUser {
  const admin = db().admins.find((a) => a.userId === user.id);
  return { id: user.id, email: user.email, name: user.name, image: user.image, adminLevel: admin?.level ?? null };
}

export function createSession(userId: string) {
  const token = crypto.randomBytes(24).toString("base64url");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DAYS * 864e5);
  const data = db();
  data.sessions = data.sessions.filter((s) => new Date(s.expiresAt) > now);
  data.sessions.push({ token, userId, createdAt: now.toISOString(), expiresAt: expiresAt.toISOString() });
  const user = data.users.find((u) => u.id === userId);
  if (user) user.lastSeen = nowIso();
  save();
  return { token, expiresAt };
}

export function destroySession(token: string) {
  const data = db();
  data.sessions = data.sessions.filter((s) => s.token !== token);
  save();
}

export function userFromToken(token: string | undefined | null): SessionUser | null {
  if (!token) return null;
  const data = db();
  const session = data.sessions.find((s) => s.token === token);
  if (!session || new Date(session.expiresAt) < new Date()) return null;
  const user = data.users.find((u) => u.id === session.userId);
  if (!user || user.disabled) return null;
  if (isDemoAccount(user) && !demoAccountsOpen()) return null;
  return toSessionUser(user);
}

function tokenFromRequest(req: Request) {
  const header = req.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === SESSION_COOKIE) return decodeURIComponent(v.join("="));
  }
  return null;
}

export function userFromRequest(req: Request) {
  return userFromToken(tokenFromRequest(req));
}

export async function currentUser() {
  const jar = await cookies();
  return userFromToken(jar.get(SESSION_COOKIE)?.value);
}

export function sessionCookie(token: string, expiresAt: Date) {
  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  };
}

/**
 * Create an account. Without ADMIN_EMAILS, the very first real (non-demo) account becomes the
 * platform's super-admin; with it, only listed and confirmed addresses do.
 */
export function createUser(input: { email: string; name: string; passwordHash: string; emailVerified?: boolean; image?: string | null }): User {
  const data = db();
  const user: User = {
    id: newId("usr"),
    email: input.email.trim().toLowerCase(),
    name: input.name.trim() || input.email.split("@")[0],
    image: input.image ?? null,
    passwordHash: input.passwordHash,
    createdAt: nowIso(),
    plan: "studio",
    timeZone: null,
    lastSeen: null,
    emailVerified: input.emailVerified ?? false,
  };
  data.users.push(user);
  const realAdmins = data.admins.filter((a) => {
    const u = data.users.find((x) => x.id === a.userId);
    return u && !isDemoAccount(u);
  });
  if (realAdmins.length === 0 && adminEmails().length === 0) data.admins.push({ userId: user.id, level: "super", createdAt: nowIso() });
  save();
  return user;
}
