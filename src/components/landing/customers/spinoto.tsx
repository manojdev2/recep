"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Accordion } from "radix-ui";
import {
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  BadgeCheck,
  Battery,
  Bike,
  CalendarCheck,
  Car,
  Check,
  ClipboardCheck,
  Clock3,
  Droplets,
  Fan,
  Gauge,
  MapPin,
  Menu,
  MessageCircle,
  Phone,
  Plus,
  ScanSearch,
  ShieldCheck,
  Star,
  UserCheck,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useReveal } from "../sections";

/* ---------- content (sourced from spinoto.com) ---------- */

const PHONE = "+91 74800 33800";
const TEL = "tel:+917480033800";
const WHATSAPP = "https://wa.me/917480033800";
const EMAIL = "support@spinoto.com";

const NAV = [
  { href: "#services", label: "Services" },
  { href: "#trust", label: "Trust & safety" },
  { href: "#how", label: "How it works" },
  { href: "#areas", label: "Locations" },
  { href: "#faq", label: "FAQ" },
];

const STATS: [string, string][] = [
  ["4.8/5", "Average service rating"],
  ["35+", "Ahmedabad areas"],
  ["40+", "Vehicle brands"],
  ["365", "Days a year, 8 AM – 8 PM"],
];

const SERVICES: Record<"two" | "four", { icon: LucideIcon; title: string; body: string; soon?: boolean }[]> = {
  two: [
    { icon: Wrench, title: "General service", body: "Routine care at your doorstep, with or without an engine oil change." },
    { icon: ClipboardCheck, title: "Comprehensive service", body: "A complete check for scooters and motorcycles." },
    { icon: Gauge, title: "Half & full engine repair", body: "Engine work handled by skill-tested experts." },
    { icon: Battery, title: "Battery support", body: "Jump-starts, checks and replacements wherever you are parked." },
    { icon: ScanSearch, title: "Diagnostics & specific repairs", body: "Find the fault first, then fix exactly what’s needed." },
    { icon: Droplets, title: "Washing & detailing", body: "A deep clean for your two-wheeler.", soon: true },
  ],
  four: [
    { icon: ClipboardCheck, title: "Periodic service packages", body: "Basic (15 checks), Standard (18 checks) or Comprehensive (23 checks)." },
    { icon: Wrench, title: "Engine oil replacement", body: "Quick, clean oil changes at home or at the office." },
    { icon: Battery, title: "Battery support", body: "Diagnosis, jump-starts and replacements." },
    { icon: Fan, title: "AC servicing", body: "Keep the cabin cool through an Ahmedabad summer." },
    { icon: Gauge, title: "Wheel & ride check", body: "Tyres, alignment and suspension, inspected." },
    { icon: ScanSearch, title: "Inspections & PDI", body: "Pre-delivery and used-car inspections, with expert help when you need it." },
  ],
};

const TRUST: [LucideIcon, string, string][] = [
  [UserCheck, "Know who’s coming", "Every mechanic is identity-verified before they reach your door."],
  [ShieldCheck, "Background checked", "A background check is completed before any booking."],
  [BadgeCheck, "Skill tested", "Hands-on skill tests, not just a CV."],
  [Star, "Rated after every visit", "Experts who fall below 4.5/5 are paused and retrained."],
];

const AREAS = ["SG Highway", "Bopal", "Vastrapur", "Prahlad Nagar", "Satellite", "Thaltej", "Bodakdev", "Gota", "Chandkheda", "Maninagar", "Navrangpura", "South Bopal"];

const REVIEWS = [
  { name: "Rahul D.", area: "Vastrapur", quote: "Battery died in the mall parking. They reached fast and had me moving again. Absolute lifesavers!" },
  { name: "Sneha M.", area: "Prahlad Nagar", quote: "Got my Activa serviced at home. No mess, totally professional. Highly recommend!" },
  { name: "Amit S.", area: "SG Highway", quote: "Car serviced while I was at the office. Smooth experience and no garage waiting room." },
  { name: "Mehul P.", area: "Bopal", quote: "The warning light on my SUV had me worried. The technician explained the scan report clearly." },
];

const FAQ = [
  {
    q: "When can I book a mechanic?",
    a: "Any time. Call, WhatsApp or use the app 24/7 and the Spinoto desk will take your booking. Doorstep visits run from 8:00 AM to 8:00 PM, 365 days a year, subject to local availability.",
  },
  {
    q: "Who picks up when I call?",
    a: "Spinoto’s AI desk answers every call instantly, day or night. It takes your vehicle and location details, books a slot, and hands you to a person whenever you’d like one.",
  },
  {
    q: "How is pricing decided?",
    a: "You approve every quote before work begins. No surprise charges, ever.",
  },
  {
    q: "Which vehicles do you service?",
    a: "Bikes, scooters, cars and SUVs across 40+ brands: Honda, Hero, TVS, Bajaj, Royal Enfield, Ather, Ola Electric, Toyota, Hyundai, BMW, Mercedes, Audi and more.",
  },
  {
    q: "Do you offer pickup and drop?",
    a: "Yes, pickup and drop is available for four-wheelers. Most two-wheeler services are done right at your doorstep.",
  },
  {
    q: "Which cities are live?",
    a: "Ahmedabad is live across 35+ areas. Mumbai and Bangalore are coming soon.",
  },
];

const SCRIPT: { role: "caller" | "desk"; text: string }[] = [
  { role: "desk", text: "Hi, this is Spinoto. How can I help with your vehicle today?" },
  { role: "caller", text: "My scooter won’t start. I’m parked at the office on SG Highway." },
  { role: "desk", text: "Sounds like the battery. I can send a verified mechanic, and the earliest slot is 11:30 AM. Which scooter is it?" },
  { role: "caller", text: "Honda Activa. 11:30 works." },
  { role: "desk", text: "Booked. You’ll get the mechanic’s name on WhatsApp, and you approve the quote before any work starts." },
];

/* ---------- pieces ---------- */

function SpinotoMark() {
  return (
    <span className="flex items-center gap-2.5">
      <span className="grid size-9 place-items-center rounded-xl bg-[#cbff3d] text-[#0d0d12]">
        <Wrench className="size-4.5" strokeWidth={2.2} />
      </span>
      <span className="text-lg font-semibold tracking-[-0.04em]">Spinoto</span>
    </span>
  );
}

function Header() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 px-3 pt-3 sm:px-6 sm:pt-4">
      <div className="mx-auto max-w-6xl rounded-[1.7rem] border border-border/80 bg-surface/90 shadow-[0_8px_35px_#0d0d1208] backdrop-blur-xl">
        <div className="flex h-[68px] items-center justify-between gap-2 px-4 sm:px-5">
          <a href="#top" aria-label="Spinoto home" onClick={() => setOpen(false)}>
            <SpinotoMark />
          </a>
          <nav className="hidden items-center gap-0.5 rounded-full bg-bg/70 px-2 py-1 text-sm text-muted lg:flex">
            {NAV.map((n) => (
              <a href={n.href} className="rounded-full px-3 py-2 transition-colors hover:bg-accent/8 hover:text-accent" key={n.href}>
                {n.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-1">
            <ThemeToggle className="size-9 rounded-full" />
            <Button asChild variant="ghost" className="hidden sm:inline-flex">
              <a href={WHATSAPP} target="_blank" rel="noreferrer">
                WhatsApp
              </a>
            </Button>
            <Button asChild className="px-4 max-[380px]:hidden">
              <a href={TEL}>
                <Phone /> Book a mechanic
              </a>
            </Button>
            <button
              type="button"
              className="grid size-10 place-items-center rounded-xl text-muted hover:bg-raised hover:text-fg lg:hidden"
              aria-expanded={open}
              aria-controls="spinoto-nav"
              onClick={() => setOpen((o) => !o)}
            >
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
              <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
            </button>
          </div>
        </div>
        <div id="spinoto-nav" hidden={!open} className="border-t border-border px-3 pb-4 pt-2 lg:hidden">
          <nav className="grid gap-1 text-sm">
            {NAV.map((n) => (
              <a href={n.href} onClick={() => setOpen(false)} className="rounded-xl px-3 py-3 text-muted hover:bg-raised hover:text-fg" key={n.href}>
                {n.label}
              </a>
            ))}
            <a href={TEL} className="rounded-xl px-3 py-3 text-fg">
              Call {PHONE}
            </a>
          </nav>
        </div>
      </div>
    </header>
  );
}

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
function subscribeReducedMotion(cb: () => void) {
  const mq = window.matchMedia(REDUCED_MOTION);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

/** A scripted call with Spinoto's AI desk. Lines appear one by one, then loop. */
function CallPreview() {
  const reduced = useSyncExternalStore(subscribeReducedMotion, () => window.matchMedia(REDUCED_MOTION).matches, () => false);
  const [tick, setTick] = useState(1);
  useEffect(() => {
    if (reduced) return;
    const t = setInterval(() => setTick((n) => (n >= SCRIPT.length + 2 ? 1 : n + 1)), 1900);
    return () => clearInterval(t);
  }, [reduced]);
  const shown = reduced ? SCRIPT.length : tick;
  const lines = SCRIPT.slice(0, Math.min(shown, SCRIPT.length));
  return (
    <div className="rounded-[2rem] border border-border bg-surface p-5 shadow-[0_30px_80px_-40px_#0d0d1240] sm:p-6">
      <div className="flex items-center justify-between gap-3 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-full bg-accent/10 text-accent">
            <AudioLines className="size-5" />
          </span>
          <div>
            <p className="text-sm font-semibold">Spinoto booking desk</p>
            <p className="text-xs text-muted">Answers every call, 24/7 · Powered by Azentoo</p>
          </div>
        </div>
        <span className="demo-live">
          <span className="demo-live-dot" /> On call
        </span>
      </div>
      <div className="mt-4 flex min-h-[19rem] flex-col gap-3" role="log" aria-label="Example call with the Spinoto booking desk">
        {lines.map((l, i) => (
          <div
            className={cn(
              "rise w-fit max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
              l.role === "caller" ? "ml-auto rounded-br-md bg-accent text-accent-fg" : "mr-auto rounded-bl-md bg-raised text-fg",
            )}
            key={i}
          >
            {l.text}
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-2 border-t border-border pt-4 text-xs text-muted">
        <CalendarCheck className="size-3.5 text-live" />
        {shown >= SCRIPT.length ? "Mechanic booked · SG Highway · 11:30 AM" : "Booking in progress…"}
      </div>
    </div>
  );
}

function Services() {
  const [kind, setKind] = useState<"two" | "four">("two");
  return (
    <section id="services" className="mx-auto max-w-6xl scroll-mt-24 px-6 py-20 lg:py-24">
      <div data-reveal="" className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
        <div>
          <p className="eyebrow">Certified care. Every ride.</p>
          <h2 className="section-title mt-4">
            One app for
            <br />
            every vehicle you own.
          </h2>
        </div>
        <div className="flex w-fit gap-1 rounded-full border border-border bg-surface p-1" role="tablist" aria-label="Vehicle type">
          {(
            [
              ["two", Bike, "Two-wheeler"],
              ["four", Car, "Four-wheeler"],
            ] as const
          ).map(([id, Icon, label]) => (
            <button
              type="button"
              role="tab"
              aria-selected={kind === id}
              onClick={() => setKind(id)}
              className={cn(
                "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                kind === id ? "bg-accent text-accent-fg" : "text-muted hover:text-fg",
              )}
              key={id}
            >
              <Icon className="size-4" /> {label}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="tabpanel">
        {SERVICES[kind].map(({ icon: Icon, title, body, soon }) => (
          <article className="rounded-[1.5rem] border border-border bg-surface p-6 transition-shadow hover:shadow-border-hover" key={title}>
            <div className="flex items-start justify-between">
              <span className="grid size-11 place-items-center rounded-xl bg-accent/10 text-accent">
                <Icon className="size-5" />
              </span>
              {soon && <span className="rounded-full bg-raised px-2.5 py-1 text-[10px] font-semibold text-muted">Soon</span>}
            </div>
            <h3 className="mt-5 font-semibold">{title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">{body}</p>
          </article>
        ))}
      </div>
      <p className="mt-6 text-center text-xs text-muted">
        {kind === "four" ? "Pickup & drop available for four-wheelers." : "Doorstep service at home, the office or the parking lot."} Subscriptions & AMC plans available.
      </p>
    </section>
  );
}

/* ---------- page ---------- */

export function SpinotoLanding() {
  const main = useReveal<HTMLElement>();
  return (
    <div id="top" className="consumer-site min-h-dvh bg-bg text-fg">
      <Header />
      <main ref={main}>
        <section className="new-hero mx-auto max-w-7xl px-6 pt-14 pb-16 lg:pt-20">
          <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_1fr]">
            <div className="text-center lg:text-left">
              <p className="eyebrow justify-center lg:justify-start">
                <span className="size-2 rounded-full bg-live" /> Mechanic in minutes · Live in Ahmedabad
              </p>
              <h1 className="mt-6 text-[clamp(2.6rem,6vw,5.2rem)] font-semibold leading-[1.04] tracking-[-0.065em]">
                Your mechanic.
                <br />
                <span className="text-accent">Exactly when you need one.</span>
              </h1>
              <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-muted sm:text-lg lg:mx-0">
                Verified mechanics for bikes, scooters, cars and SUVs, at your doorstep. Instant help or scheduled care, and pricing you approve first.
              </p>
              <div className="mt-7 flex flex-wrap justify-center gap-3 lg:justify-start">
                <Button asChild size="lg">
                  <a href={TEL}>
                    <Phone /> Call {PHONE}
                  </a>
                </Button>
                <Button asChild size="lg" variant="secondary">
                  <a href={WHATSAPP} target="_blank" rel="noreferrer">
                    <MessageCircle /> Book on WhatsApp
                  </a>
                </Button>
              </div>
              <p className="mt-4 text-xs text-muted">Bookings open 24/7 · Doorstep visits 8 AM – 8 PM · 100% quotes approved by you</p>
            </div>
            <div className="experience-stage relative mx-auto w-full max-w-[520px]">
              <div className="relative z-10">
                <CallPreview />
              </div>
            </div>
          </div>
          <dl className="mx-auto mt-14 grid max-w-5xl grid-cols-2 gap-px overflow-hidden rounded-[1.5rem] border border-border bg-border md:grid-cols-4">
            {STATS.map(([value, label]) => (
              <div className="bg-surface px-6 py-6 text-center" key={label}>
                <dt className="sr-only">{label}</dt>
                <dd className="text-3xl font-semibold tracking-[-0.05em]">{value}</dd>
                <dd className="mt-1 text-xs text-muted">{label}</dd>
              </div>
            ))}
          </dl>
        </section>

        <Services />

        <section id="trust" className="story-section scroll-mt-24 px-6 py-20 lg:py-28">
          <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-2 lg:items-center">
            <div data-reveal="">
              <p className="eyebrow">Trust, built in</p>
              <h2 className="section-title mt-4">
                Doorstep care,
                <br />
                built on trust.
              </h2>
              <p className="mt-6 max-w-md leading-relaxed text-muted">
                Letting someone work on your vehicle takes trust. Every Spinoto expert is verified, tested and rated, and your vehicle details are RTO-verified before the visit.
              </p>
              <div className="mt-8 flex items-center gap-4 rounded-2xl border border-border bg-bg p-5">
                <span className="text-4xl font-semibold tracking-[-0.06em]">4.8</span>
                <div>
                  <div className="flex gap-0.5 text-accent" aria-label="4.8 out of 5 stars">
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star className="size-4 fill-current" key={i} />
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-muted">Average from 1,200+ ratings</p>
                </div>
              </div>
            </div>
            <div data-reveal="" data-reveal-delay="70" className="divide-y divide-border">
              {TRUST.map(([Icon, title, body]) => (
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
        </section>

        <section id="how" className="mx-auto max-w-6xl scroll-mt-24 px-6 py-20">
          <div className="grid gap-12 md:grid-cols-[1fr_1.2fr]">
            <div data-reveal="">
              <p className="eyebrow">No garage waiting room</p>
              <h2 className="section-title mt-4">
                Call. Approve.
                <br />
                Get back on the road.
              </h2>
              <p className="mt-5 max-w-sm leading-relaxed text-muted">
                Our booking desk picks up every call, so you’re never left on hold when your vehicle won’t start.
              </p>
            </div>
            <ol data-reveal="" data-reveal-delay="70" className="divide-y divide-border">
              {[
                ["Tell us what’s wrong", "Call, WhatsApp or tap in the app. Share your vehicle, the problem and where you’re parked, at any hour."],
                ["Approve your quote", "See the price before anything happens. Nothing starts until you say yes."],
                ["A verified mechanic arrives", "Know who’s coming before they reach you. Rate the visit once your ride is ready."],
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

        <section id="areas" className="mx-auto max-w-6xl scroll-mt-24 px-6 pb-20">
          <div data-reveal="" className="integration-constellation p-7 sm:p-10 lg:p-12">
            <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
              <div>
                <p className="eyebrow">
                  <MapPin className="size-3.5" /> Where we are
                </p>
                <h2 className="section-title mt-4">
                  35+ areas of Ahmedabad,
                  <br />
                  and growing.
                </h2>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="demo-live">
                  <span className="demo-live-dot" /> Ahmedabad · Live
                </span>
                <span className="rounded-full bg-raised px-3 py-1 font-semibold text-muted">Mumbai · Coming soon</span>
                <span className="rounded-full bg-raised px-3 py-1 font-semibold text-muted">Bangalore · Coming soon</span>
              </div>
            </div>
            <ul className="mt-8 flex flex-wrap gap-2">
              {AREAS.map((a) => (
                <li className="demo-chip" key={a}>
                  {a}
                </li>
              ))}
              <li className="demo-chip">+ many more</li>
            </ul>
          </div>
        </section>

        <section className="story-section px-6 py-20">
          <div className="mx-auto max-w-6xl">
            <div data-reveal="" className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
              <div>
                <p className="eyebrow">From riders across the city</p>
                <h2 className="section-title mt-4">
                  Back on the road,
                  <br />
                  in their words.
                </h2>
              </div>
              <p className="max-w-sm text-sm leading-relaxed text-muted">Trusted for 40+ brands, from Honda and Royal Enfield to Ather, Hyundai and BMW.</p>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-2">
              {REVIEWS.map((r, i) => (
                <figure data-reveal="" data-reveal-delay={i * 60} className="rounded-[1.5rem] border border-border bg-bg p-6" key={r.name}>
                  <div className="flex gap-0.5 text-accent" aria-label="5 out of 5 stars">
                    {Array.from({ length: 5 }, (_, k) => (
                      <Star className="size-3.5 fill-current" key={k} />
                    ))}
                  </div>
                  <blockquote className="mt-4 text-lg leading-snug font-medium tracking-tight">“{r.quote}”</blockquote>
                  <figcaption className="mt-5 text-xs text-muted">
                    {r.name} · {r.area}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        <section id="faq" className="mx-auto max-w-6xl scroll-mt-24 px-6 py-20">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
            <div>
              <span className="mb-5 inline-grid size-12 place-items-center rounded-2xl bg-accent/10 text-accent">
                <MessageCircle className="size-5" />
              </span>
              <p className="eyebrow">Good questions</p>
              <h2 data-reveal="" className="section-title mt-4">
                Before your
                <br />
                first booking.
              </h2>
              <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted">Still unsure? Call us. The booking desk is always on.</p>
              <a href={TEL} className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-accent">
                Ask the Spinoto desk <ArrowUpRight className="size-4" />
              </a>
            </div>
            <Accordion.Root data-reveal="" type="single" collapsible className="space-y-3">
              {FAQ.map((f, i) => (
                <Accordion.Item
                  value={`q-${i}`}
                  className="rounded-2xl border border-border bg-surface px-5 data-[state=open]:border-accent/30 data-[state=open]:bg-accent/3"
                  key={f.q}
                >
                  <Accordion.Header>
                    <Accordion.Trigger className="group flex w-full items-center justify-between gap-4 py-5 text-left">
                      <span className="text-sm font-semibold leading-relaxed">{f.q}</span>
                      <Plus className="size-4 shrink-0 text-muted transition-transform duration-200 group-data-[state=open]:rotate-45" strokeWidth={1.6} />
                    </Accordion.Trigger>
                  </Accordion.Header>
                  <Accordion.Content className="landing-acc overflow-hidden">
                    <p className="pb-5 text-sm leading-relaxed text-muted">{f.a}</p>
                  </Accordion.Content>
                </Accordion.Item>
              ))}
            </Accordion.Root>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-10 pb-24">
          <div data-reveal="" className="closing-garden relative grid overflow-hidden rounded-[2rem] p-8 sm:p-12 lg:grid-cols-[1.25fr_1fr] lg:p-14">
            <div className="relative z-10">
              <p className="eyebrow">Stuck right now?</p>
              <h2 className="section-title mt-5">
                A verified mechanic,
                <br />
                one call away.
              </h2>
              <p className="mt-5 max-w-sm text-sm leading-relaxed text-muted">Dead battery, warning light or a service that’s overdue. Call now and we’ll take it from there.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <a href={TEL}>
                    Call {PHONE} <ArrowRight />
                  </a>
                </Button>
                <Button asChild size="lg" variant="secondary">
                  <a href={WHATSAPP} target="_blank" rel="noreferrer">
                    <MessageCircle /> WhatsApp
                  </a>
                </Button>
              </div>
            </div>
            <div className="closing-art relative mt-12 flex min-h-64 items-center justify-center lg:mt-0" aria-hidden="true">
              <div className="closing-orbit" />
              <div className="closing-note">
                <span className="closing-check mb-5 inline-grid size-10 place-items-center rounded-full">
                  <Check className="size-5" />
                </span>
                <p className="text-xs text-muted">Booking confirmed</p>
                <p className="mt-2 text-xl font-medium tracking-tight">
                  Mechanic on the way.
                  <br />
                  Quote approved.
                </p>
                <div className="mt-5 flex items-center gap-2 border-t border-border pt-4 text-xs text-muted">
                  <Clock3 className="size-3.5" /> Arriving 11:30 AM
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="px-3 pb-3 sm:px-6 sm:pb-6">
        <div className="footer-garden mx-auto max-w-7xl overflow-hidden rounded-[2rem] px-6 pt-10 sm:px-12 sm:pt-14">
          <div className="flex flex-col justify-between gap-8 border-b border-current/15 pb-10 sm:flex-row sm:items-end">
            <div>
              <SpinotoMark />
              <p className="mt-5 max-w-sm text-2xl font-medium leading-snug tracking-tight">
                Mechanic in minutes.
                <br />
                Certified care, every ride.
              </p>
            </div>
            <a href={TEL} className="inline-flex w-fit items-center gap-3 rounded-full bg-white px-5 py-3 text-sm font-semibold text-[#0d0d12]">
              Book a mechanic <ArrowUpRight className="size-4" />
            </a>
          </div>
          <div className="grid grid-cols-2 gap-9 py-10 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
            <p className="col-span-2 max-w-xs text-sm leading-relaxed opacity-70 md:col-span-1">
              Doorstep vehicle care for bikes, scooters, cars and SUVs. Operated by Aeromechx Automotive Private Limited.
            </p>
            <nav aria-label="Services" className="flex flex-col items-start gap-3 text-sm">
              <p className="mb-1 text-[10px] font-semibold tracking-widest uppercase opacity-60">Services</p>
              {["Two-wheeler", "Four-wheeler", "Battery support", "Inspections & PDI"].map((l) => (
                <a href="#services" className="hover:underline underline-offset-4" key={l}>
                  {l}
                </a>
              ))}
            </nav>
            <nav aria-label="Explore Spinoto" className="flex flex-col items-start gap-3 text-sm">
              <p className="mb-1 text-[10px] font-semibold tracking-widest uppercase opacity-60">Explore</p>
              {[
                ["#trust", "Trust & safety"],
                ["#how", "How it works"],
                ["#areas", "Locations"],
                ["#faq", "FAQ"],
              ].map(([href, label]) => (
                <a href={href} className="hover:underline underline-offset-4" key={href}>
                  {label}
                </a>
              ))}
            </nav>
            <nav aria-label="Contact" className="flex flex-col items-start gap-3 text-sm">
              <p className="mb-1 text-[10px] font-semibold tracking-widest uppercase opacity-60">Contact</p>
              <a href={TEL} className="hover:underline underline-offset-4">
                {PHONE}
              </a>
              <a href={WHATSAPP} target="_blank" rel="noreferrer" className="hover:underline underline-offset-4">
                WhatsApp
              </a>
              <a href={`mailto:${EMAIL}`} className="hover:underline underline-offset-4">
                {EMAIL}
              </a>
            </nav>
          </div>
          <div className="flex flex-col justify-between gap-3 border-t border-current/15 py-6 text-xs opacity-70 sm:flex-row">
            <p>© {new Date().getFullYear()} Aeromechx Automotive Pvt. Ltd.</p>
            <p className="flex items-center gap-1.5">
              <AudioLines className="size-3.5" /> Calls answered by Azentoo
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
