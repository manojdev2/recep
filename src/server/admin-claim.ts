import "server-only";
import crypto from "node:crypto";
import { newId } from "@/lib/utils";
import { db, nowIso, save } from "./db";
import { sendMail } from "./mail";
import { appUrl, getSetting } from "./settings";
import type { User } from "./types";

/**
 * ADMIN_EMAILS: addresses that may become super-admins — but only once the address is proven,
 * because sign-ups are open and anyone could register a listed address first.
 * Proof is Google sign-in (Google only reports verified addresses) or an emailed link.
 */

const LINK_MINUTES = 60;
const RESEND_MINUTES = 5;

export function adminEmails() {
  return getSetting("ADMIN_EMAILS")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export const isListedAdmin = (email: string) => adminEmails().includes(email.trim().toLowerCase());

function grantSuper(user: User, how: string) {
  const data = db();
  const existing = data.admins.find((a) => a.userId === user.id);
  if (existing?.level === "super") return;
  if (existing) existing.level = "super";
  else data.admins.push({ userId: user.id, level: "super", createdAt: nowIso() });
  data.audit.push({ id: newId("aud"), actorId: user.id, actor: user.email, action: "admin.grant", target: user.email, detail: `super (ADMIN_EMAILS, ${how})`, at: nowIso() });
  save();
}

/**
 * Called whenever a listed address signs in or opens the admin panel.
 * Verified → becomes a super-admin. Not yet verified → a confirmation link is sent (rate-limited).
 */
export async function claimAdmin(user: User, origin = appUrl()): Promise<"granted" | "already" | "link-sent" | "not-listed"> {
  if (!isListedAdmin(user.email)) return "not-listed";
  if (db().admins.some((a) => a.userId === user.id && a.level === "super")) return "already";
  if (user.emailVerified) {
    grantSuper(user, "verified address");
    return "granted";
  }
  const now = Date.now();
  const pending = user.adminConfirm;
  if (pending && now - Date.parse(pending.sentAt) < RESEND_MINUTES * 60_000 && Date.parse(pending.expiresAt) > now) return "link-sent";
  const token = crypto.randomBytes(24).toString("base64url");
  user.adminConfirm = { token, sentAt: new Date(now).toISOString(), expiresAt: new Date(now + LINK_MINUTES * 60_000).toISOString() };
  save();
  // In production the link is always built from APP_URL: a Host header can be forged, and this link carries a secret.
  const base = process.env.NODE_ENV === "production" ? appUrl() : origin;
  const link = `${base}/api/admin/confirm?token=${token}`;
  await sendMail({
    to: user.email,
    subject: "Confirm your Reception AI admin access",
    logPrefix: "[admin]",
    text: `Open this link in the browser where you are signed in as ${user.email} to become a platform admin:\n\n${link}\n\nIt works for ${LINK_MINUTES} minutes. If you did not ask for this, ignore this email.`,
  });
  return "link-sent";
}

/** The confirmation link was opened by the signed-in owner of the address. */
export function confirmAdmin(user: User, token: string) {
  const pending = user.adminConfirm;
  if (!pending || !token) return { ok: false as const, error: "That link is not valid. Open /admin to get a new one." };
  const a = Buffer.from(pending.token);
  const b = Buffer.from(token);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { ok: false as const, error: "That link is not valid. Open /admin to get a new one." };
  if (Date.parse(pending.expiresAt) < Date.now()) return { ok: false as const, error: "That link has expired. Open /admin to get a new one." };
  user.emailVerified = true;
  user.adminConfirm = null;
  save();
  if (isListedAdmin(user.email)) grantSuper(user, "confirmation link");
  return { ok: true as const };
}
