import "server-only";
import type { LandingPlan } from "@/components/landing/landing";
import { db } from "./db";
import { branding, getSetting, siteMeta } from "./settings";
import type { Plan } from "./types";

/**
 * Brand, site meta and plan limits for the server-rendered pages (root layout, landing page).
 *
 * A frontend-only deploy (API_ORIGIN set, e.g. Vercel) has no store: /api/* is proxied to the
 * backend (see next.config.ts), and these pages ask the backend for the same data.
 */

export const apiOrigin = () => (process.env.API_ORIGIN ?? "").trim().replace(/\/$/, "");

export function landingData(plans: Plan[] = db().plans, get: (key: string) => string = getSetting) {
  const plan = (id: string, fallback: LandingPlan): LandingPlan => {
    const p = plans.find((x) => x.id === id);
    return p ? { name: p.name, minutes: p.minutes, agents: p.agents } : fallback;
  };
  return {
    brand: branding(get),
    meta: siteMeta(get),
    plans: {
      studio: plan("studio", { name: "Studio", minutes: 15, agents: 1 }),
      scale: plan("scale", { name: "Scale", minutes: 2000, agents: 25 }),
      enterprise: plan("enterprise", { name: "Enterprise", minutes: null, agents: null }),
    },
  };
}

export type LandingData = ReturnType<typeof landingData>;

export async function loadLanding(): Promise<LandingData> {
  const origin = apiOrigin();
  if (!origin) return landingData();
  try {
    const res = await fetch(`${origin}/api/fn/site/landing`, { next: { revalidate: 60 }, signal: AbortSignal.timeout(10_000) });
    const body = (await res.json()) as { result?: LandingData };
    if (res.ok && body.result) return body.result;
    console.error(`[landing] ${origin} answered ${res.status}`);
  } catch (err) {
    console.error(`[landing] could not reach ${origin}`, err);
  }
  // Backend asleep or down: render with the built-in defaults rather than failing every page.
  return landingData([], () => "");
}
