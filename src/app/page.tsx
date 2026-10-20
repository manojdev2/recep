import { Landing } from "@/components/landing/landing";
import { loadLanding } from "@/server/landing";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { brand, meta, plans } = await loadLanding();
  return (
    <Landing
      name={brand.name}
      supportEmail={brand.supportEmail || undefined}
      companyName={meta.companyName || undefined}
      termsUrl={meta.termsUrl || undefined}
      privacyUrl={meta.privacyUrl || undefined}
      plans={plans}
    />
  );
}
