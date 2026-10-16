"use client";

import Link from "next/link";
import { ArrowRight, AudioLines, CalendarCheck, Check, MessageCircle, Phone, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DemoPanel } from "./demo-panel";
import { Controls, Faq, Features, Integrations, LandingFooter, LandingHeader, Toolkit, UseCases, useReveal, VoiceStudio } from "./sections";

export type LandingPlan = { name: string; minutes: number | null; agents: number | null };

export type LandingProps = {
  name: string;
  supportEmail?: string;
  companyName?: string;
  termsUrl?: string;
  privacyUrl?: string;
  plans: { studio: LandingPlan; scale: LandingPlan; enterprise: LandingPlan };
};

const fmt = (n: number | null) => (n === null ? "Unlimited" : n.toLocaleString());

export function Landing({ name, supportEmail, companyName, termsUrl, privacyUrl, plans }: LandingProps) {
  const main = useReveal<HTMLElement>();
  const tiers = [
    {
      name: plans.studio.name,
      price: "Free",
      detail: "To start",
      points: [`${fmt(plans.studio.minutes)} minutes of talk time`, `${fmt(plans.studio.agents)} AI receptionist`, "Chat on your website", "All your conversations in one place"],
    },
    {
      name: plans.scale.name,
      price: "$89",
      detail: "per seat / month",
      points: [`${fmt(plans.scale.minutes)} minutes included`, "Phone, SMS, WhatsApp", "Call insights and practice calls", "Connects to your calendar"],
      featured: true,
    },
    {
      name: plans.enterprise.name,
      price: "Custom",
      detail: "Talk to us",
      points: ["Single sign-on", "A voice made for you", "We help you set it up", "Contracts and support"],
    },
  ];
  const story: [LucideIcon, string, string][] = [
    [Phone, "Every caller gets a welcome", "Answer everyday questions using the details you share."],
    [CalendarCheck, "Turn a conversation into a plan", "Help people book a visit or request a callback."],
    [MessageCircle, "Pick up where they left off", "Find messages and conversations together when you’re ready."],
  ];

  return (
    <div id="top" className="consumer-site min-h-dvh bg-bg text-fg">
      <LandingHeader name={name} />
      <main ref={main}>
        <section className="new-hero mx-auto max-w-7xl px-6 pt-14 pb-16 lg:pt-20">
          <div className="mx-auto max-w-3xl text-center">
            <p className="eyebrow justify-center">
              <span className="size-2 rounded-full bg-live" /> Your business. A little more human.
            </p>
            <h1 className="mt-6 text-[clamp(2.8rem,6.5vw,5.7rem)] font-semibold leading-[1.04] tracking-[-0.065em]">
              More life.
              <br />
              <span className="text-accent">Fewer missed calls.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
              Reception AI answers calls, books appointments, captures leads, and follows up — connected to the apps you already use. Your whole front desk, in one workspace.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg">
                <Link href="/login">
                  Meet your new receptionist <ArrowRight />
                </Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <a href="#demo">
                  <AudioLines /> Give it a hello
                </a>
              </Button>
            </div>
            <p className="mt-4 text-xs text-muted">Start free · Phone & website · Bookings & CRM · Connected apps</p>
          </div>
          <div id="demo" className="experience-stage relative mx-auto mt-10 max-w-5xl scroll-mt-24">
            <div className="experience-note experience-note-left">
              <span className="note-icon">
                <Phone className="size-4" />
              </span>
              <p className="text-xs text-muted">A warm welcome</p>
              <p className="mt-1 text-sm font-medium">Even when you’re busy.</p>
            </div>
            <div className="experience-note experience-note-right">
              <span className="note-icon">
                <CalendarCheck className="size-4" />
              </span>
              <p className="text-xs text-muted">The next appointment</p>
              <p className="mt-1 text-sm font-medium">One less thing to juggle.</p>
            </div>
            <div className="relative z-10 mx-auto max-w-[520px]">
              <DemoPanel />
            </div>
            <p className="relative z-10 mt-4 text-center text-xs text-muted">Live AI demo · The microphone stays on only while a conversation is running.</p>
          </div>
        </section>

        <section id="product" className="story-section scroll-mt-24 px-6 py-20 lg:py-28">
          <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-2 lg:items-center">
            <div data-reveal="" className="story-photo relative overflow-hidden rounded-[2rem]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/florist-hero.png" alt="A florist at work in her flower shop" className="h-full w-full object-cover" loading="lazy" />
              <div className="absolute bottom-5 left-5 right-5 rounded-2xl bg-white/95 p-5 text-[#0d0d12] shadow-lg">
                <p className="text-[10px] font-semibold tracking-widest uppercase">Made for moments like this</p>
                <p className="mt-2 text-xl font-medium tracking-tight">Stay with the work you love.</p>
              </div>
            </div>
            <div data-reveal="" data-reveal-delay="70" className="lg:pl-8">
              <p className="eyebrow">A little space in your day</p>
              <h2 className="section-title mt-4">
                Your hands are full.
                <br />
                Your phone doesn’t
                <br className="hidden lg:block" /> have to be.
              </h2>
              <p className="mt-6 max-w-md leading-relaxed text-muted">
                The lunch rush. The finishing touches. A customer who needs a little extra time. Reception AI helps you stay present, without leaving your callers waiting.
              </p>
              <div className="mt-8 divide-y divide-border">
                {story.map(([Icon, title, body]) => (
                  <div className="flex gap-4 py-5" key={title}>
                    <Icon className="mt-1 size-5 shrink-0 text-accent" />
                    <div>
                      <h3 className="font-semibold">{title}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-muted">{body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <Features />
        <Integrations />
        <Toolkit />
        <UseCases />
        <Controls />

        <section id="how" className="setup-story scroll-mt-24 px-6 py-20">
          <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-[1fr_1.2fr]">
            <div data-reveal="">
              <p className="eyebrow">Feels like you, from hello</p>
              <h2 className="section-title mt-4">
                A new teammate.
                <br />A familiar voice.
              </h2>
              <p className="mt-5 max-w-sm leading-relaxed text-muted">You know your business best. Give Reception AI the essentials, then make it your own.</p>
            </div>
            <ol data-reveal="" data-reveal-delay="70" className="divide-y divide-border">
              {[
                ["Tell us the essentials", "Your services, hours, and the things people ask. Write them naturally, just as you’d explain them to someone new."],
                ["Find your voice", "Choose a voice and greeting. Try a conversation and adjust until it feels right."],
                ["Open the conversation", "Connect your phone or website. Set your boundaries and decide when a person should take over."],
              ].map(([title, body], i) => (
                <li className="flex gap-5 py-6 first:pt-0" key={title}>
                  <span className="pt-1 text-sm text-accent">0{i + 1}</span>
                  <div>
                    <h3 className="text-xl font-semibold tracking-tight">{title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="voices" className="mx-auto max-w-6xl scroll-mt-24 px-6 py-24">
          <p className="eyebrow mb-4">The sound of a warm welcome</p>
          <VoiceStudio />
        </section>

        <section id="pricing" className="mx-auto max-w-6xl scroll-mt-24 px-6 py-20">
          <div data-reveal="" className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <p className="eyebrow">Space to start. Room to grow.</p>
              <h2 className="section-title mt-4">
                Your next hello,
                <br />
                at your own pace.
              </h2>
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-muted">Start with a free receptionist. When you’re ready for more conversations, there’s a plan for that.</p>
          </div>
          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {tiers.map((t, i) => (
              <article
                data-reveal=""
                data-reveal-delay={i * 60}
                className={`pricing-card relative flex flex-col overflow-hidden rounded-[1.75rem] border p-7 ${t.featured ? "border-accent/40 bg-accent/5" : "border-border bg-surface"}`}
                key={t.name}
              >
                <div className="flex items-center justify-between">
                  <span className="grid size-10 place-items-center rounded-xl bg-accent/10 text-accent">
                    {i === 0 ? <MessageCircle className="size-5" /> : i === 1 ? <AudioLines className="size-5" /> : <Phone className="size-5" />}
                  </span>
                  {t.featured && <span className="rounded-full bg-accent px-3 py-1.5 text-[10px] font-semibold text-accent-fg">For your everyday</span>}
                </div>
                <h3 className="mt-6 text-xl font-semibold">{t.name}</h3>
                <p className="mt-2 text-sm text-muted">
                  {["A first hello. A feel for what’s possible.", "A familiar voice for your busiest days.", "More people. More possibilities."][i]}
                </p>
                <div className="mt-7 border-b border-border pb-7">
                  <p className="text-5xl font-semibold tracking-[-.055em]">{t.price}</p>
                  <p className="mt-2 text-xs text-muted">{t.detail}</p>
                </div>
                <p className="mt-6 text-[10px] font-semibold tracking-widest text-subtle uppercase">A little help with</p>
                <ul className="mt-4 flex-1 space-y-3.5">
                  {t.points.map((p) => (
                    <li className="flex gap-3 text-sm" key={p}>
                      <Check className="mt-0.5 size-4 shrink-0 text-accent" />
                      {p}
                    </li>
                  ))}
                </ul>
                <Button asChild variant={t.featured ? "primary" : "secondary"} className="mt-8 w-full">
                  <Link href="/login">
                    {i === 0 ? "Try it for free" : i === 1 ? `Choose ${t.name}` : "Let’s talk"}
                    <ArrowRight />
                  </Link>
                </Button>
              </article>
            ))}
          </div>
          <p className="mt-5 text-center text-xs text-muted">All plans start with your business, your greeting, and your choice of voice.</p>
        </section>

        <Faq />

        <section className="mx-auto max-w-6xl px-6 py-10 pb-24">
          <div data-reveal="" className="closing-garden relative grid overflow-hidden rounded-[2rem] p-8 sm:p-12 lg:grid-cols-[1.25fr_1fr] lg:p-14">
            <div className="relative z-10">
              <p className="eyebrow">One less thing on your mind</p>
              <h2 className="section-title mt-5">
                Make room for
                <br />
                your real work.
              </h2>
              <p className="mt-5 max-w-sm text-sm leading-relaxed text-muted">
                The work you love. The people who need you. The moments you don’t want to miss. Let Reception AI take the next call.
              </p>
              <Button asChild size="lg" className="mt-8">
                <Link href="/login">
                  Find a little breathing room <ArrowRight />
                </Link>
              </Button>
              <p className="mt-4 text-xs text-muted">Start free. Make it yours.</p>
            </div>
            <div className="closing-art relative mt-12 flex min-h-64 items-center justify-center lg:mt-0" aria-hidden="true">
              <div className="closing-orbit" />
              <div className="closing-note">
                <span className="mb-5 inline-grid size-10 place-items-center rounded-full bg-accent/10 text-accent">
                  <Check className="size-5" />
                </span>
                <p className="text-xs text-muted">Today’s to-do</p>
                <p className="mt-2 text-xl font-medium tracking-tight">
                  A little less.
                  <br />A little better.
                </p>
                <div className="mt-5 flex items-center gap-2 border-t border-border pt-4 text-xs text-muted">
                  <Phone className="size-3.5" /> Leave the hello to us.
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <LandingFooter name={name} companyName={companyName} termsUrl={termsUrl} privacyUrl={privacyUrl} supportEmail={supportEmail} />
    </div>
  );
}
