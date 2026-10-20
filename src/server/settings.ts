import "server-only";
import { db } from "./db";
import { SETTING_DEFS } from "./setting-defs";

/**
 * A platform setting. A row saved by an operator wins over the environment — including
 * an empty row, which means "off" and does not fall back to the environment.
 */
export function getSetting(key: string): string {
  const def = SETTING_DEFS.find((d) => d.key === key);
  if (!def?.envOnly) {
    const stored = db().settings.find((s) => s.key === key);
    if (stored) return stored.value;
  }
  return process.env[key] ?? "";
}

export function settingSource(key: string): "database" | "environment" | "cleared" | "unset" {
  const def = SETTING_DEFS.find((d) => d.key === key);
  const stored = def?.envOnly ? undefined : db().settings.find((s) => s.key === key);
  if (stored) return stored.value === "" ? "cleared" : "database";
  return process.env[key] ? "environment" : "unset";
}

/** Reads a setting. Defaults to the store; pass `() => ""` for built-in defaults without one. */
type Get = (key: string) => string;

export function flag(key: string, fallback: boolean, get: Get = getSetting) {
  const v = get(key).toLowerCase();
  if (v === "true" || v === "1" || v === "on") return true;
  if (v === "false" || v === "0" || v === "off") return false;
  return fallback;
}

export function numberSetting(key: string, fallback: number) {
  const n = Number(getSetting(key));
  return Number.isFinite(n) && getSetting(key) !== "" ? n : fallback;
}

export function isDemoMode() {
  return (process.env.DEMO_MODE ?? "").toLowerCase() === "true";
}

export const DEMO_REFUSAL = "Demo mode: changes are disabled here. Your own install saves everything normally.";

export function branding(get: Get = getSetting) {
  return {
    name: get("BRAND_NAME") || "Reception AI",
    tagline: get("BRAND_TAGLINE") || "Never miss a call again.",
    supportEmail: get("SUPPORT_EMAIL"),
    signupsOpen: flag("FEATURE_SIGNUPS", true, get) && !isDemoMode(),
    demoMode: isDemoMode(),
    /** Sign-in providers offered on /login next to email. */
    socialProviders: get("GOOGLE_CLIENT_ID") && get("GOOGLE_CLIENT_SECRET") ? [{ id: "google", label: "Google" }] : [],
  };
}

export function siteMeta(get: Get = getSetting) {
  const name = get("BRAND_NAME") || "Reception AI";
  return {
    title: get("SITE_TITLE") || name,
    description:
      get("SITE_DESCRIPTION") ||
      "Reception AI connects calls, website conversations, bookings, leads, and follow-ups with your business apps. One workspace for your whole front desk.",
    ogImage: get("SITE_OG_IMAGE"),
    favicon: get("SITE_FAVICON") || "/favicon.svg",
    noindex: flag("SITE_NOINDEX", false, get),
    gaId: get("ANALYTICS_GA_ID"),
    plausibleDomain: get("ANALYTICS_PLAUSIBLE_DOMAIN"),
    termsUrl: get("TERMS_URL"),
    privacyUrl: get("PRIVACY_URL"),
    companyName: get("COMPANY_NAME"),
  };
}

export function appUrl() {
  return (getSetting("APP_URL") || "http://localhost:3000").replace(/\/$/, "");
}

/**
 * The origin the browser actually used. Prefers APP_URL; otherwise reads the Host header
 * (req.url carries the bind address, e.g. 0.0.0.0, behind the custom server).
 */
export function requestOrigin(req: Request) {
  const configured = getSetting("APP_URL");
  if (configured) return configured.replace(/\/$/, "");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? new URL(req.url).host;
  const proto = req.headers.get("x-forwarded-proto") ?? new URL(req.url).protocol.replace(":", "");
  return `${proto}://${host}`;
}
