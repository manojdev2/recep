"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowUpRight, Check, CreditCard, Mail } from "lucide-react";
import { BillingSkeletonBody } from "@/components/app/skeletons";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

function Billing() {
  const qc = useQueryClient();
  const router = useRouter();
  const search = useSearchParams();
  const account = useQuery({ queryKey: ["account"], queryFn: () => api.account.get() });
  const billing = useQuery({ queryKey: ["billing"], queryFn: () => api.billing.get() });
  const usage = account.data?.usage;
  const checkout = useMutation({
    mutationFn: (planId: string) => api.billing.checkout({ planId }),
    onSuccess: ({ url }) => window.location.assign(url),
    onError: (e: Error) => toast.error(e.message),
  });
  const portal = useMutation({
    mutationFn: () => api.billing.portal(),
    onSuccess: ({ url }) => window.location.assign(url),
    onError: (e: Error) => toast.error(e.message),
  });
  const handled = useRef(false);
  const result = search.get("checkout");
  const sessionId = search.get("session_id");

  useEffect(() => {
    if (handled.current || !result) return;
    handled.current = true;
    const done = () => {
      router.replace("/app/settings/billing");
      qc.invalidateQueries();
    };
    if (result === "success" && sessionId) {
      api.billing
        .confirm({ sessionId })
        .then((out) => {
          if (out && out.status === "active") {
            toast.success(`You’re on ${billing.data?.plans.find((p) => p.id === out.plan)?.name ?? out.plan} now. Thank you!`);
          } else toast.message("Payment received. Your plan will update in a moment.");
        })
        .catch(() => toast.message("Payment received. Your plan will update in a moment."))
        .finally(done);
    } else {
      if (result === "cancelled") toast.message("No changes made.");
      done();
    }
  }, [result, sessionId, router, qc, billing.data]);

  if (account.isPending || billing.isPending) return <BillingSkeletonBody />;
  if (!usage || !billing.data) return null;
  const b = billing.data;
  const unlimited = usage.plan.minutes > 1e6;
  const pct = unlimited ? 0 : Math.round(usage.fraction * 100);
  const currentIndex = b.plans.findIndex((p) => p.id === b.currentPlan);
  const mail = b.supportEmail ? `mailto:${b.supportEmail}?subject=Plan%20enquiry` : null;

  return (
    <div className="grid max-w-3xl gap-4">
      <section className="rounded-xl bg-raised/60 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs tracking-wide text-subtle uppercase">Your plan</p>
            <div className="mt-2 flex flex-wrap items-baseline gap-2">
              <p className="text-2xl font-medium">{usage.plan.name}</p>
              <p className="text-sm text-muted">{usage.plan.priceLabel}</p>
              {b.status === "past_due" ? (
                <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-xs text-red-600 dark:text-red-400">Payment overdue</span>
              ) : null}
            </div>
            {b.renewsAt ? (
              <p className="mt-1 text-xs text-muted">
                {b.status === "cancelled" ? "Ended" : "Renews"}{" "}
                {new Date(b.renewsAt).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}
              </p>
            ) : null}
          </div>
          {b.subscribed ? (
            <Button variant="secondary" size="sm" onClick={() => portal.mutate()} disabled={portal.isPending}>
              <CreditCard className="size-4" />
              {portal.isPending ? "Opening…" : "Manage billing"}
            </Button>
          ) : null}
        </div>
        <div className="mt-5">
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-muted">Minutes used this month</span>
            <span className="tabular-nums">
              {usage.minutesUsed}
              {unlimited ? "" : ` / ${usage.minutesIncluded}`}
            </span>
          </div>
          {unlimited ? null : (
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface">
              <div className={cn("h-full rounded-full", usage.overLimit ? "bg-red-500" : "bg-accent")} style={{ width: `${Math.min(100, pct)}%` }} />
            </div>
          )}
          {usage.overLimit ? (
            <p className="mt-2 text-xs text-red-500">You are over the included minutes for this month. Upgrading lifts the limit straight away.</p>
          ) : null}
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          {[
            ["Live receptionists", `${usage.agents} / ${usage.plan.agents > 1e6 ? "∞" : usage.plan.agents}`],
            ["Phone numbers", `${usage.numbers} / ${usage.plan.numbers > 1e6 ? "∞" : usage.plan.numbers}`],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-muted">{k}</dt>
              <dd className="text-lg tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
        <Link href="/app/analytics" className="mt-3 inline-block text-xs text-accent hover:underline">
          See what they did
        </Link>
      </section>
      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-medium">Change your plan</h2>
          {b.checkoutConfigured ? null : <p className="text-xs text-muted">Card payments aren’t switched on for this workspace yet.</p>}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {b.plans.map((p, i) => {
            const current = p.id === b.currentPlan;
            const higher = i > currentIndex;
            return (
              <article className={cn("flex flex-col rounded-xl border p-5", current ? "border-accent/50 bg-accent/5" : "border-border bg-surface")} key={p.id}>
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="font-semibold">{p.name}</h3>
                  {current ? <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-accent-fg">Current</span> : null}
                </div>
                <p className="mt-1 text-sm text-muted">{p.priceLabel}</p>
                <ul className="mt-4 flex-1 space-y-1.5 text-sm">
                  {[
                    p.minutes === null ? "Unlimited minutes" : `${p.minutes.toLocaleString()} minutes / month`,
                    p.agents === null ? "Unlimited receptionists" : `${p.agents} receptionist${p.agents === 1 ? "" : "s"}`,
                    p.numbers === null ? "Unlimited numbers" : `${p.numbers} phone number${p.numbers === 1 ? "" : "s"}`,
                    ...p.features,
                  ].map((f) => (
                    <li className="flex items-start gap-2 text-muted" key={f}>
                      <Check className="mt-0.5 size-3.5 shrink-0 text-accent" />
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-5">
                  {current ? (
                    <Button variant="secondary" size="sm" className="w-full" disabled>
                      Your plan
                    </Button>
                  ) : p.checkout ? (
                    <Button
                      size="sm"
                      variant={higher ? "primary" : "secondary"}
                      className="w-full"
                      onClick={() => (higher || !b.subscribed ? checkout.mutate(p.id) : portal.mutate())}
                      disabled={checkout.isPending || portal.isPending}
                    >
                      {checkout.isPending || portal.isPending ? "One moment…" : higher ? `Upgrade to ${p.name}` : `Switch to ${p.name}`}
                    </Button>
                  ) : mail ? (
                    <Button asChild variant="secondary" size="sm" className="w-full">
                      <a href={mail}>
                        <Mail className="size-4" /> Talk to us
                      </a>
                    </Button>
                  ) : (
                    <Button variant="secondary" size="sm" className="w-full" disabled>
                      By arrangement
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted">
          Payments are handled by Stripe; your card details never touch this app. Change or cancel any time from{" "}
          <button type="button" className="text-accent hover:underline" onClick={() => portal.mutate()} disabled={!b.subscribed}>
            Manage billing
          </button>
          .
          {mail ? (
            <>
              {" "}
              Questions?{" "}
              <a href={mail} className="inline-flex items-center gap-1 text-accent hover:underline">
                Email support <ArrowUpRight className="size-3" />
              </a>
            </>
          ) : null}
        </p>
      </section>
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={<BillingSkeletonBody />}>
      <Billing />
    </Suspense>
  );
}
