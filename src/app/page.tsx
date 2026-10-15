import { Landing, type LandingPlan } from "@/components/landing/landing";
import { db } from "@/server/db";
import { branding, siteMeta } from "@/server/settings";

export const dynamic = "force-dynamic";

function plan(id: string, fallback: LandingPlan): LandingPlan {
  const p = db().plans.find((x) => x.id === id);
  return p ? { name: p.name, minutes: p.minutes, agents: p.agents } : fallback;
}

export default function Home() {
  const brand = branding();
  const meta = siteMeta();
  return (
    <Landing
      name={brand.name}
      supportEmail={brand.supportEmail || undefined}
      companyName={meta.companyName || undefined}
      termsUrl={meta.termsUrl || undefined}
      privacyUrl={meta.privacyUrl || undefined}
      plans={{
        studio: plan("studio", { name: "Studio", minutes: 15, agents: 1 }),
        scale: plan("scale", { name: "Scale", minutes: 2000, agents: 25 }),
        enterprise: plan("enterprise", { name: "Enterprise", minutes: null, agents: null }),
      }}
    />
  );
}
