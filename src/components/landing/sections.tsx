"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { Accordion, Tabs } from "radix-ui";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  AudioLines,
  BookOpen,
  CalendarCheck,
  ChartColumn,
  Check,
  ChevronDown,
  Clock3,
  Dumbbell,
  FileText,
  GitBranch,
  Headphones,
  HeartPulse,
  Menu,
  MessageCircle,
  Pause,
  Phone,
  PhoneOutgoing,
  Play,
  Plus,
  Scissors,
  Search,
  ShieldCheck,
  ShoppingBag,
  Users,
  Utensils,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import { AppMark, ProviderMark, ToolMark } from "@/components/brand-marks";
import { Mark, Wordmark } from "@/components/mark";
import { PLATFORM_TOOLS } from "@/components/app/platform-tools";
import { ThemeToggle } from "@/components/theme";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/auth-client";
import { CONNECTORS, VOICES, isConnectorSupported, realtimeVoiceId, type Connector } from "@/lib/catalog";
import { cn } from "@/lib/utils";

/* ---------- reveal-on-scroll ---------- */

export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root || typeof IntersectionObserver === "undefined") return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const running = new Set<Animation>();
    const seen = new WeakSet<Element>();
    const items = Array.from(root.querySelectorAll<HTMLElement>("[data-reveal]"));
    let observer: IntersectionObserver | undefined;
    const cancel = () => {
      running.forEach((a) => a.cancel());
      running.clear();
    };
    const setup = () => {
      observer?.disconnect();
      cancel();
      if (reduce.matches) return;
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            const el = entry.target as HTMLElement;
            observer?.unobserve(el);
            if (seen.has(el)) continue;
            seen.add(el);
            if (el.contains(document.activeElement) || typeof el.animate !== "function") continue;
            const delay = window.matchMedia("(min-width: 640px)").matches ? Math.min(Number(el.dataset.revealDelay) || 0, 120) : 0;
            const anim = el.animate(
              [
                { opacity: 0, transform: "translateY(16px)" },
                { opacity: 1, transform: "translateY(0)" },
              ],
              { duration: 650, delay, easing: "cubic-bezier(0.22, 0.61, 0.36, 1)", fill: "backwards" },
            );
            running.add(anim);
            anim.onfinish = () => running.delete(anim);
            anim.oncancel = () => running.delete(anim);
          }
        },
        { threshold: 0, rootMargin: "0px 0px -32px 0px" },
      );
      for (const el of items) {
        if (el.getBoundingClientRect().top < window.innerHeight) seen.add(el);
        if (!seen.has(el)) observer.observe(el);
      }
    };
    setup();
    reduce.addEventListener("change", setup);
    root.addEventListener("focusin", cancel);
    window.addEventListener("beforeprint", cancel);
    return () => {
      observer?.disconnect();
      cancel();
      reduce.removeEventListener("change", setup);
      root.removeEventListener("focusin", cancel);
      window.removeEventListener("beforeprint", cancel);
    };
  }, []);
  return ref;
}

/* ---------- header ---------- */

const NAV = [
  { href: "#features", label: "Features" },
  { href: "#integrations", label: "Integrations" },
  { href: "#use", label: "Who it’s for" },
  { href: "#tools", label: "Built-in tools" },
  { href: "#pricing", label: "Pricing" },
];

export function LandingHeader({ name }: { name?: string }) {
  const { user, isPending } = useSession();
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 px-3 pt-3 sm:px-6 sm:pt-4">
      <div className="mx-auto max-w-6xl rounded-[1.7rem] border border-border/80 bg-surface/90 shadow-[0_8px_35px_#0d0d1208] backdrop-blur-xl">
        <div className="flex h-[68px] items-center justify-between gap-2 px-4 sm:px-5">
          <Link href="/" aria-label="Azentoo home" onClick={() => setOpen(false)}>
            <Wordmark name={name} />
          </Link>
          <nav className="hidden items-center gap-0.5 rounded-full bg-bg/70 px-2 py-1 text-sm text-muted lg:flex">
            {NAV.map((n) => (
              <a href={n.href} className="rounded-full px-3 py-2 transition-colors hover:bg-accent/8 hover:text-accent" key={n.href}>
                {n.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-1">
            <ThemeToggle className="size-9 rounded-full" />
            {user ? (
              <Button asChild>
                <Link href="/app">My home</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" className="hidden sm:inline-flex">
                  <Link href="/login">Sign in</Link>
                </Button>
                <Button asChild className={`px-4 max-[380px]:hidden ${isPending ? "opacity-80" : ""}`}>
                  <Link href="/login">
                    Start free <ArrowUpRight className="hidden sm:block" />
                  </Link>
                </Button>
              </>
            )}
            <button
              type="button"
              className="grid size-10 place-items-center rounded-xl text-muted hover:bg-raised hover:text-fg lg:hidden"
              aria-expanded={open}
              aria-controls="landing-nav"
              onClick={() => setOpen((o) => !o)}
            >
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
              <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
            </button>
          </div>
        </div>
        <div id="landing-nav" hidden={!open} className="border-t border-border px-3 pb-4 pt-2 lg:hidden">
          <nav className="grid gap-1 text-sm">
            {NAV.map((n) => (
              <a href={n.href} onClick={() => setOpen(false)} className="rounded-xl px-3 py-3 text-muted hover:bg-raised hover:text-fg" key={n.href}>
                {n.label}
              </a>
            ))}
            <Link href={user ? "/app" : "/login"} onClick={() => setOpen(false)} className="rounded-xl px-3 py-3 text-fg">
              {user ? "My home" : "Sign in"}
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}

/* ---------- features ---------- */

const FEATURES: { id: string; label: string; icon: LucideIcon; title: string; copy: string; points: string[]; to: string }[] = [
  {
    id: "conversations",
    label: "Conversations",
    icon: MessageCircle,
    title: "Every hello has a home.",
    copy: "Answer calls and welcome website visitors with a receptionist that knows your business. Keep the conversation, the context, and the next step together.",
    points: [
      "Inbound phone calls and an embeddable voice & chat widget",
      "Searchable transcripts with channel and outcome filters",
      "SMS, WhatsApp Business, and email sending with connected accounts",
    ],
    to: "/app/conversations",
  },
  {
    id: "customers",
    label: "Bookings & leads",
    icon: CalendarCheck,
    title: "A good conversation goes somewhere.",
    copy: "Turn interest into an appointment, a new lead, or a support ticket. Your team can find the details and carry the relationship forward.",
    points: [
      "Check available slots and book appointments",
      "Capture leads in the built-in CRM board",
      "Manage contacts, import CSVs, and collect details with forms",
    ],
    to: "/app/results",
  },
  {
    id: "campaigns",
    label: "Outbound calls",
    icon: PhoneOutgoing,
    title: "Be the one who calls first.",
    copy: "Give follow-ups a place in your day. Build an outbound campaign from your contact book, choose a receptionist and a phone number, then track each call.",
    points: [
      "Select saved contacts or paste a calling list",
      "Start, pause, and review campaigns from one workspace",
      "Set calling windows, retry intervals, and attempt limits",
      "See call progress, outcomes, and conversation details",
    ],
    to: "/app/campaigns",
  },
  {
    id: "knowledge",
    label: "Knowledge & flows",
    icon: GitBranch,
    title: "Your know-how. Your way of working.",
    copy: "Give your receptionist the information and instructions that make your business yours. Build a conversation flow for the moments that need a specific next step.",
    points: [
      "Add websites, PDFs, Word documents, or written notes",
      "Choose which knowledge each receptionist can use",
      "Connect conversation steps, conditions, tools, and handovers",
    ],
    to: "/app/knowledge",
  },
  {
    id: "insights",
    label: "Insights",
    icon: ChartColumn,
    title: "See what your conversations achieve.",
    copy: "Go beyond counting calls. Understand which conversations lead to bookings, capture interest, or need a person’s attention.",
    points: [
      "Track bookings, leads, resolution, and average duration",
      "Compare activity by channel, language, or receptionist",
      "Choose a date range and export daily results to CSV",
    ],
    to: "/app/analytics",
  },
];

export function Features() {
  return (
    <section id="features" className="scroll-mt-28 px-6 py-20 lg:py-28">
      <div className="mx-auto max-w-6xl">
        <div data-reveal="" className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <p className="eyebrow">The whole front desk, connected</p>
            <h2 className="section-title mt-4">
              The hello is just
              <br />
              the beginning.
            </h2>
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-muted">
            Calls, customers, follow-ups, and the tools behind them. Explore the workspace that keeps it all moving.
          </p>
        </div>
        <Tabs.Root data-reveal="" defaultValue="conversations" className="mt-10">
          <Tabs.List aria-label="Explore product features" className="flex w-fit flex-wrap gap-1 rounded-xl bg-transparent p-0">
            {FEATURES.map(({ id, label, icon: Icon }) => (
              <Tabs.Trigger
                value={id}
                className="flex min-h-11 items-center gap-2 rounded-full border border-border px-4 py-2 text-sm text-muted transition-colors duration-150 data-[state=active]:border-accent data-[state=active]:bg-accent data-[state=active]:text-accent-fg data-[state=active]:shadow-[var(--shadow-border)]"
                key={id}
              >
                <Icon className="size-4" />
                {label}
              </Tabs.Trigger>
            ))}
          </Tabs.List>
          {FEATURES.map((f) => (
            <Tabs.Content value={f.id} className="mt-6 rounded-[2rem] border border-border bg-surface outline-none focus-visible:ring-2 focus-visible:ring-accent" key={f.id}>
              <div className="grid overflow-hidden rounded-[2rem] lg:grid-cols-[.9fr_1.1fr]">
                <div className="flex flex-col p-7 sm:p-10 lg:p-12">
                  <f.icon className="size-7 text-accent" strokeWidth={1.5} />
                  <h3 className="mt-7 max-w-sm text-3xl font-semibold leading-tight tracking-[-.04em]">{f.title}</h3>
                  <p className="mt-4 text-sm leading-relaxed text-muted">{f.copy}</p>
                  <ul className="my-7 space-y-4">
                    {f.points.map((p) => (
                      <li className="flex gap-3 text-sm leading-relaxed" key={p}>
                        <Check className="mt-1 size-4 shrink-0 text-live" />
                        {p}
                      </li>
                    ))}
                  </ul>
                  <Link href={f.to} className="mt-auto inline-flex w-fit items-center gap-2 text-sm font-semibold text-accent">
                    Explore in your workspace <ArrowUpRight className="size-4" />
                  </Link>
                </div>
                <div className="product-preview flex min-w-0 flex-col justify-center p-5 sm:p-9">
                  <div className="rounded-2xl border border-border bg-surface p-5 shadow-[0_18px_60px_-30px_#0d0d1240] sm:p-7">
                    <div className="mb-6 flex items-center gap-2 border-b border-border pb-4">
                      <Mark className="size-6" />
                      <span className="text-xs font-semibold">Azentoo</span>
                      <span className="ml-auto text-[10px] text-muted">{f.label}</span>
                    </div>
                    <Preview id={f.id} />
                  </div>
                  <p className="mt-4 text-center text-[11px] text-muted">Illustrative workspace preview · Sample data</p>
                </div>
              </div>
            </Tabs.Content>
          ))}
        </Tabs.Root>
      </div>
    </section>
  );
}

function Preview({ id }: { id: string }) {
  if (id === "conversations") {
    return (
      <div>
        <div className="mb-5 flex items-center justify-between">
          <h4 className="font-semibold">A conversation, continued.</h4>
          <Phone className="size-4 text-accent" />
        </div>
        <div className="space-y-3 text-sm leading-relaxed">
          <p className="mr-6 rounded-2xl rounded-bl-sm bg-raised p-4">Hi! Could I book a consultation for next week?</p>
          <p className="ml-6 rounded-2xl rounded-br-sm bg-accent/10 p-4">Of course. I have Tuesday at 10 or Thursday at 2. Which works for you?</p>
          <p className="mr-6 w-fit rounded-2xl rounded-bl-sm bg-raised p-4">Tuesday would be lovely.</p>
        </div>
        <div className="mt-5 flex items-center gap-3 rounded-xl border border-live/25 bg-live/5 p-4">
          <CalendarCheck className="size-5 text-live" />
          <div>
            <p className="text-sm font-semibold">Consultation booked</p>
            <p className="mt-1 text-xs text-muted">Tuesday · 10:00 AM · Details saved</p>
          </div>
        </div>
      </div>
    );
  }
  if (id === "customers") {
    return (
      <div>
        <h4 className="font-semibold">From first call to next visit</h4>
        <div className="mt-5 grid grid-cols-2 gap-3">
          {[
            ["New lead", "Maya Patel", "Interested in a consultation"],
            ["Booked", "Alex Morgan", "Tuesday · 10:00 AM"],
          ].map(([tag, who, what]) => (
            <div className="rounded-xl bg-raised p-4" key={tag}>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-accent">{tag}</p>
              <div className="my-4 grid size-9 place-items-center rounded-full bg-surface text-sm font-semibold">{who.charAt(0)}</div>
              <p className="text-sm font-semibold">{who}</p>
              <p className="mt-2 text-xs leading-relaxed text-muted">{what}</p>
            </div>
          ))}
        </div>
        <div className="mt-5 rounded-xl border border-border p-4">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Users className="size-4 text-accent" /> A contact record worth keeping
          </p>
          <p className="mt-2 text-xs leading-relaxed text-muted">Contact details, notes, tags, and the next step — ready for your team.</p>
        </div>
      </div>
    );
  }
  if (id === "campaigns") {
    return (
      <div>
        <div className="flex items-center justify-between gap-3">
          <h4 className="font-semibold">Consultation follow-ups</h4>
          <span className="rounded-full bg-accent/10 px-2.5 py-1 text-[10px] text-accent">In progress</span>
        </div>
        <p className="mt-2 text-xs text-muted">A dedicated receptionist. A clear next step.</p>
        <div className="mt-6 h-2 overflow-hidden rounded-full bg-raised">
          <div className="h-full w-2/3 rounded-full bg-accent" />
        </div>
        <p className="mt-2 text-xs text-muted">8 of 12 contacts called</p>
        <div className="mt-5 divide-y divide-border">
          {[
            ["Alex Morgan", "Completed"],
            ["Maya Patel", "Calling"],
            ["Sam Taylor", "Queued"],
          ].map(([who, state]) => (
            <div className="flex items-center justify-between py-4 text-sm" key={who}>
              <span>{who}</span>
              <span className="text-xs text-muted">{state}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (id === "knowledge") {
    const steps: [string, LucideIcon][] = [
      ["Welcome the caller", MessageCircle],
      ["Understand what they need", GitBranch],
      ["Check availability & book", CalendarCheck],
    ];
    return (
      <div>
        <div className="mb-5 flex items-center gap-3 rounded-xl bg-raised p-4">
          <FileText className="size-5 text-accent" />
          <div>
            <p className="text-sm font-semibold">Services & business hours.pdf</p>
            <p className="mt-1 text-xs text-muted">Your business knowledge</p>
          </div>
        </div>
        <div className="flex flex-col items-center">
          {steps.map(([label, Icon], i) => (
            <div className="flex w-full flex-col items-center" key={label}>
              {i > 0 && <ArrowDown className="my-2 size-4 text-subtle" />}
              <div className="flex w-full items-center gap-3 rounded-xl border border-border px-4 py-3 text-sm">
                <Icon className="size-4 text-accent" />
                {label}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div>
      <h4 className="font-semibold">Your business, at a glance</h4>
      <div className="mt-5 grid grid-cols-3 gap-2">
        {[
          ["Conversations", "128"],
          ["Bookings", "32"],
          ["Leads", "18"],
        ].map(([label, n]) => (
          <div className="rounded-xl bg-raised p-3" key={label}>
            <p className="text-[10px] text-muted">{label}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight">{n}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 flex h-32 items-end gap-3 border-b border-border pb-2" role="img" aria-label="Illustrative weekly conversation activity">
        <span className="sr-only">Sample activity over seven days</span>
        {[35, 55, 43, 72, 62, 90, 78].map((h, i) => (
          <div className="flex-1 rounded-t-md bg-accent/65" style={{ height: `${h}%` }} key={i} />
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-muted">
        <span>Monday</span>
        <span>Sunday</span>
      </div>
      <p className="mt-5 text-xs text-muted">Filter by receptionist and date. See channel breakdowns.</p>
    </div>
  );
}

/* ---------- built-in tools ---------- */

const TOOL_COPY: Record<string, string> = {
  forms: "Build shareable forms to collect enquiries and customer details.",
  appointments: "Keep bookings made by your receptionists and forms in one place.",
  webhooks: "Send business events to your own endpoints and automations.",
  widget: "Embed voice and chat on your site, with your own headline, logo, and accent colour.",
  crm: "Move leads through a visual board and keep track of the next step.",
  incoming: "Assign your connected phone numbers to the right receptionist.",
  messaging: "Send WhatsApp Business messages and email through connected accounts.",
  sheets: "Export appointments, form responses, and leads to Google Sheets.",
};

export function Toolkit() {
  return (
    <section id="tools" className="scroll-mt-28 border-y border-border bg-surface px-6 py-20 lg:py-24">
      <div className="mx-auto max-w-6xl">
        <div data-reveal="" className="max-w-2xl">
          <p className="eyebrow">Already part of your workspace</p>
          <h2 className="section-title mt-4">
            A front desk with
            <br />a very full toolkit.
          </h2>
          <p className="mt-5 leading-relaxed text-muted">Give every conversation somewhere useful to go. These tools live right inside Azentoo.</p>
        </div>
        <div className="mt-12 grid gap-x-8 gap-y-0 sm:grid-cols-2 lg:grid-cols-4">
          {PLATFORM_TOOLS.map((t) => (
            <Link href={t.to} className="group border-t border-border py-7" key={t.id}>
              <div className="flex items-center justify-between">
                <ToolMark id={t.id} />
                <ArrowUpRight className="size-4 text-subtle transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </div>
              <h3 className="mt-5 font-semibold group-hover:text-accent">{t.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{TOOL_COPY[t.id]}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- controls ---------- */

export function Controls() {
  const items: [LucideIcon, string, string][] = [
    [Clock3, "Hours that fit your business", "Set weekly opening times, your timezone, appointment lengths, and after-hours handling."],
    [ShieldCheck, "Clear rules & human handover", "Define topics to avoid and when a conversation should move to your team."],
    [AudioLines, "A voice you can make your own", "Choose a voice, language, greeting, and response style. Fine-tune with practice conversations."],
    [BookOpen, "A head start for your industry", "Start with a business template, then adapt the instructions, knowledge, and tools."],
  ];
  return (
    <section id="controls" className="scroll-mt-28 px-6 py-20">
      <div data-reveal="" className="mx-auto max-w-6xl rounded-[2rem] bg-accent/5 p-7 sm:p-10 lg:p-12">
        <div className="grid gap-10 lg:grid-cols-[.9fr_1.1fr]">
          <div>
            <span className="inline-flex rounded-2xl bg-surface p-3 text-accent">
              <ShieldCheck className="size-6" />
            </span>
            <p className="eyebrow mt-6">You set the boundaries</p>
            <h2 className="section-title mt-4">
              Your receptionist.
              <br />
              Your ground rules.
            </h2>
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-muted">
              Decide what it knows, how it responds, and when it brings in a person. Rehearse before the first real call.
            </p>
            <Link href="/app/new" className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-accent">
              Make it yours <ArrowUpRight className="size-4" />
            </Link>
          </div>
          <div className="grid gap-7 sm:grid-cols-2">
            {items.map(([Icon, title, body]) => (
              <div key={title}>
                <Icon className="size-5 text-accent" />
                <h3 className="mt-4 font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- integrations ---------- */

const WIRE_COLORS: [string, string][] = [
  ["gmail", "#e36c59"],
  ["gcal", "#5186ed"],
  ["gsheets", "#39a574"],
  ["outlook", "#329aca"],
  ["calendly", "#597ae3"],
  ["openai", "#41a38f"],
  ["anthropic", "#bc856d"],
  ["together", "#5983ef"],
  ["openrouter", "#8b76e8"],
  ["mcp", "#9280c9"],
  ["slack", "#cd739e"],
  ["notion", "#7d8297"],
  ["elevenlabs", "#8c80b6"],
  ["cartesia", "#44a978"],
  ["deepgram", "#36b6a1"],
  ["hubspot", "#e78c65"],
  ["salesforce", "#46a6d5"],
  ["shopify", "#8bac56"],
  ["stripe", "#8a7be4"],
  ["zendesk", "#52928c"],
];

function wireLayout(i: number) {
  const side = Math.floor(i / 5);
  const n = i % 5;
  const off = (n - 2) * 23;
  if (side === 0 || side === 2) {
    const x = 310 + n * 125;
    const top = side === 0;
    return {
      x,
      y: top ? 90 : 670,
      path: top ? `M${x} 128 C${x} 225 ${560 + off} 210 ${560 + off} 300` : `M${x} 632 C${x} 535 ${560 + off} 550 ${560 + off} 460`,
    };
  }
  const y = 150 + n * 115;
  const left = side === 3;
  return {
    x: left ? 95 : 1025,
    y,
    path: left ? `M133 ${y} C350 ${y} 350 ${380 + off} 480 ${380 + off}` : `M987 ${y} C770 ${y} 770 ${380 + off} 640 ${380 + off}`,
  };
}

const APPS = CONNECTORS.filter((c) => isConnectorSupported(c.key));
const APP_GROUPS = ["All apps", "Everyday work", "Sales & support", "Voice & AI", "Custom tools"];
const APP_COPY: Record<string, { group: string; copy: string }> = {
  gmail: { group: "Everyday work", copy: "Read and send email." },
  gcal: { group: "Everyday work", copy: "Find and create calendar events." },
  gsheets: { group: "Everyday work", copy: "Export leads, forms, and bookings." },
  outlook: { group: "Everyday work", copy: "Search and send Outlook email." },
  slack: { group: "Everyday work", copy: "Post messages and find teammates." },
  notion: { group: "Everyday work", copy: "Find shared pages and databases." },
  calendly: { group: "Everyday work", copy: "View event types and scheduled events." },
  hubspot: { group: "Sales & support", copy: "Find and create CRM contacts." },
  salesforce: { group: "Sales & support", copy: "Search and create sales leads." },
  shopify: { group: "Sales & support", copy: "Look up orders and fulfillment status." },
  stripe: { group: "Sales & support", copy: "Look up customers and payment status." },
  zendesk: { group: "Sales & support", copy: "Search and create support tickets." },
  openai: { group: "Voice & AI", copy: "Connect a model provider for replies." },
  anthropic: { group: "Voice & AI", copy: "Use Claude for your agent’s replies." },
  together: { group: "Voice & AI", copy: "Connect Together AI model inference." },
  openrouter: { group: "Voice & AI", copy: "Access models through OpenRouter." },
  elevenlabs: { group: "Voice & AI", copy: "Connect speech generation." },
  cartesia: { group: "Voice & AI", copy: "Connect speech generation." },
  deepgram: { group: "Voice & AI", copy: "Connect speech transcription." },
  mcp: { group: "Custom tools", copy: "Let your agent call your server’s tools." },
};

function Constellation({ apps }: { apps: Connector[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [visible, setVisible] = useState(true);
  const [paused, setPaused] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const nodes = WIRE_COLORS.flatMap(([key, color], i) => {
    const app = apps.find((a) => a.key === key);
    return app ? [{ app, color, ...wireLayout(i) }] : [];
  });
  const chosen = apps.find((a) => a.key === selected);

  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0 });
    if (ref.current) io.observe(ref.current);
    const onVis = () => setVisible(!document.hidden);
    onVis();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return (
    <div ref={ref} className="integration-constellation mt-10" data-playing={inView && visible && !paused}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 sm:px-7">
        <p className="text-xs text-muted">{nodes.length} apps. One connected receptionist.</p>
        <button
          type="button"
          onClick={() => setPaused(!paused)}
          className="integration-motion-toggle inline-flex min-h-10 items-center gap-2 rounded-full border border-border bg-surface/80 px-3 text-xs text-muted hover:text-fg"
          aria-label={paused ? "Play connection animation" : "Pause connection animation"}
        >
          {paused ? <Play className="size-3" /> : <Pause className="size-3" />}
          {paused ? "Play motion" : "Pause motion"}
        </button>
      </div>
      <div className="integration-map" aria-label="Apps connected to Azentoo">
        <svg className="integration-paths integration-paths-desktop" viewBox="0 0 1120 760" fill="none" aria-hidden="true">
          {nodes.map(({ app, color, path }, i) => (
            <g data-selected={selected === app.key} className="integration-wire" key={app.key}>
              <path d={path} stroke={color} strokeWidth="1.5" strokeDasharray="2 5" className="integration-wire-base" />
              <path
                d={path}
                pathLength={100}
                stroke={color}
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeDasharray="2 98"
                className="integration-pulse"
                style={{ animationDelay: `${i * -0.73}s` }}
              />
            </g>
          ))}
        </svg>
        <svg className="integration-paths integration-paths-mobile" viewBox="0 0 100 100" preserveAspectRatio="none" fill="none" aria-hidden="true">
          {nodes.map(({ app, color }, i) => {
            const left = i < 10;
            const y = 5 + (i % 10) * 10;
            const d = `M${left ? 13 : 87} ${y} H${left ? 29 : 71} V50 H50`;
            return (
              <g key={app.key}>
                <path d={d} stroke={color} strokeWidth="1" vectorEffect="non-scaling-stroke" strokeDasharray="2 5" opacity=".4" />
                <path
                  d={d}
                  pathLength={100}
                  stroke={color}
                  strokeWidth="2.5"
                  vectorEffect="non-scaling-stroke"
                  strokeDasharray="1 99"
                  className="integration-pulse"
                  style={{ animationDelay: `${i * -0.73}s` }}
                />
              </g>
            );
          })}
        </svg>
        <div className="integration-hub">
          <div className="integration-hub-inner">
            <Mark />
            <span className="integration-hub-name">Azentoo</span>
            <span className="integration-hub-caption">
              Every conversation.
              <br />
              Connected.
            </span>
          </div>
        </div>
        <ul className="contents" aria-label="Available integrations">
          {nodes.map(({ app, color, x, y }, i) => (
            <li
              className="integration-node"
              style={
                {
                  "--node-x": `${x / 11.2}%`,
                  "--node-y": `${y / 7.6}%`,
                  "--mobile-x": i < 10 ? "13%" : "87%",
                  "--mobile-y": `${5 + (i % 10) * 10}%`,
                  "--app-color": color,
                } as React.CSSProperties
              }
              key={app.key}
            >
              <button
                type="button"
                aria-pressed={selected === app.key}
                onClick={() => setSelected(app.key)}
                className="integration-node-button"
                aria-label={`Explore ${app.name}`}
              >
                <span className="integration-node-icon">
                  <AppMark appKey={app.key} />
                </span>
                <span className="integration-node-name">{app.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="integration-map-detail" aria-live="polite" aria-atomic="true">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{chosen ? chosen.name : "Your tools, working together."}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            {chosen ? (APP_COPY[chosen.key]?.copy ?? chosen.description) : "Select an app to see what your receptionist can do with it."}
          </p>
        </div>
        <Link href="/app/apps" className="inline-flex shrink-0 items-center gap-2 text-xs font-semibold text-accent">
          {chosen ? "Set up connection" : "Connect your apps"}
          <ArrowUpRight className="size-4" />
        </Link>
      </div>
    </div>
  );
}

export function Integrations() {
  const [group, setGroup] = useState("All apps");
  const [query, setQuery] = useState("");
  const shown = APPS.filter((a) => {
    const meta = APP_COPY[a.key];
    return (
      (group === "All apps" || meta?.group === group) &&
      `${a.name} ${meta?.copy ?? a.description}`.toLowerCase().includes(query.trim().toLowerCase())
    );
  });
  return (
    <section id="integrations" className="scroll-mt-28 px-6 py-20 lg:py-28">
      <div className="mx-auto max-w-6xl">
        <div data-reveal="" className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <p className="eyebrow">Works with your world</p>
            <h2 className="section-title mt-4">
              Your favourite tools.
              <br />
              Now in the conversation.
            </h2>
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-muted">
            Connect your calendar, CRM, inbox, and more. Give your receptionist the tools to turn a helpful answer into a useful action.
          </p>
        </div>
        <Constellation apps={APPS} />
        <details className="integration-directory group mt-8">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 rounded-2xl border border-border bg-surface px-5 text-sm font-semibold">
            Browse all {APPS.length} apps & providers <ChevronDown className="size-4 text-muted transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-6 flex flex-col justify-between gap-5 xl:flex-row xl:items-center">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter integrations by category">
              {APP_GROUPS.map((g) => (
                <button
                  type="button"
                  aria-pressed={group === g}
                  onClick={() => setGroup(g)}
                  className={`min-h-11 rounded-full border px-4 text-xs font-medium transition-colors ${group === g ? "border-accent bg-accent text-accent-fg" : "border-border bg-surface text-muted hover:border-accent/40 hover:text-fg"}`}
                  key={g}
                >
                  {g}
                </button>
              ))}
            </div>
            <label className="flex min-h-11 items-center gap-2 rounded-full border border-border bg-surface px-4 xl:max-w-60">
              <Search className="size-4 shrink-0 text-muted" />
              <span className="sr-only">Search integrations</span>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find your app"
                className="min-w-0 w-full bg-transparent text-sm outline-none placeholder:text-subtle"
              />
            </label>
          </div>
          <p className="mt-5 text-xs text-muted" role="status">
            {shown.length} of {APPS.length} available app & provider integrations
          </p>
          <div className="mt-4 grid gap-3 min-[380px]:grid-cols-2 lg:grid-cols-4">
            {shown.map((a) => (
              <article className="rounded-2xl border border-border bg-surface p-5" key={a.key}>
                <AppMark appKey={a.key} />
                <h3 className="mt-4 text-sm font-semibold">{a.name}</h3>
                <p className="mt-2 text-xs leading-relaxed text-muted">{APP_COPY[a.key]?.copy ?? a.description}</p>
              </article>
            ))}
          </div>
          {shown.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border p-10 text-center">
              <Wrench className="mx-auto size-6 text-muted" />
              <p className="mt-3 font-medium">No apps match those filters.</p>
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setGroup("All apps");
                }}
                className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm text-accent"
              >
                <X className="size-4" /> Clear filters
              </button>
            </div>
          )}
        </details>
        <div className="mt-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <p className="max-w-xl text-xs leading-relaxed text-muted">
            Connect your own accounts and choose which tools each receptionist can use. Provider access and charges depend on the services you connect.
          </p>
          <Link href="/app/apps" className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-accent">
            Connect your apps <ArrowUpRight className="size-4" />
          </Link>
        </div>
        <div className="mt-10 grid gap-6 rounded-2xl border border-border bg-surface p-6 lg:grid-cols-[1fr_1.5fr] lg:items-center">
          <div>
            <h3 className="font-semibold">Bring your business number, too.</h3>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              Import a number you already own and assign a receptionist. Twilio and Plivo numbers answer with a live conversation, and Twilio can call out too. Carrier setup is
              required for live calls.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-4">
            {[
              ["twilio", "Twilio", "answers and calls"],
              ["plivo", "Plivo", "answers calls"],
              ["sip", "SIP trunk", "answers calls"],
              ["vonage", "Vonage", "limited outbound"],
              ["telnyx", "Telnyx", "limited outbound"],
            ].map(([key, name, what]) => (
              <div className="flex items-center gap-2 text-xs font-medium" key={key}>
                <span className="inline-flex scale-75">
                  <ProviderMark provider={key} />
                </span>
                <span>
                  {name}
                  <span className="block text-[11px] font-normal text-subtle">{what}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- use cases ---------- */

const USE_CASES = [
  {
    name: "Salons & studios",
    icon: Scissors,
    mood: "lilac",
    image: "/images/use-salon.png",
    imageAlt: "A stylist sectioning hair in a quiet salon",
    focus: "center 42%",
    label: "When your hands are busy",
    title: "Keep the appointment.\nStay in the moment.",
    description: "You’re halfway through a haircut. Someone calls about their first visit. Give both customers your attention, in different ways.",
    tasks: ["Explain services, prices, and opening hours", "Help with appointment and callback requests", "Share the details before a first visit"],
    caller: "I’m new here. Do you do colour consultations?",
    reply: "I can help with that. Would you like to know what to expect, or arrange a consultation?",
    followup: "I’d love to arrange one for next week.",
    outcome: "A new enquiry, ready for the next step.",
    setup: "Add your service menu, hours, and booking process.",
    handoff: "Specific treatment advice goes to your team.",
  },
  {
    name: "Cafés & restaurants",
    icon: Utensils,
    mood: "sage",
    image: "/images/use-cafe.png",
    imageAlt: "Two cups waiting on a stone table before service",
    focus: "center 72%",
    label: "In the middle of the rush",
    title: "More time at the table.\nLess time on the phone.",
    description:
      "The kitchen is moving, guests are arriving, and the phone rings. Azentoo helps with the questions that shouldn’t interrupt a good service.",
    tasks: ["Answer questions about hours and facilities", "Collect reservation requests and party sizes", "Pass special requests to the right person"],
    caller: "Could we bring a group of six on Saturday?",
    reply: "Of course, I can help with a reservation request. What time were you hoping for?",
    followup: "Around seven, if there’s space.",
    outcome: "The essentials for a reservation, together.",
    setup: "Share your hours, reservation rules, and current menu.",
    handoff: "Allergy questions and unusual requests go to staff.",
  },
  {
    name: "Home services",
    icon: Wrench,
    mood: "blue",
    image: "/images/use-home.png",
    imageAlt: "Hands fitting a brass tap on a wooden workbench",
    focus: "center 58%",
    label: "While you’re on the job",
    title: "Finish this job.\nGet ready for the next.",
    description: "Whether you’re fixing a tap or measuring a room, a new enquiry can arrive at the wrong moment. Give it a helpful first response.",
    tasks: ["Explain service areas and working hours", "Collect the problem and preferred callback time", "Prepare a clear message for your team"],
    caller: "Do you cover the north side of town?",
    reply: "I can check the service area details. Which neighbourhood is the job in?",
    followup: "Riverside. It’s a dripping kitchen tap.",
    outcome: "A clearer callback, with the context you need.",
    setup: "Add your coverage, services, and callback instructions.",
    handoff: "Quotes and urgent situations follow your escalation rules.",
  },
  {
    name: "Clinics & care",
    icon: HeartPulse,
    mood: "sage",
    image: "/images/use-clinic.png",
    imageAlt: "A calm waiting chair beside a single white flower",
    focus: "center 55%",
    label: "Care starts with a calm welcome",
    title: "Be present for patients.\nKeep the front desk moving.",
    description: "Let your team focus on the person in front of them while routine administrative questions get a calm, clear response.",
    tasks: ["Share opening hours and visit information", "Help with appointment requests", "Route questions to the appropriate staff"],
    caller: "I’d like to arrange a first appointment.",
    reply: "I can help with an appointment request. Is there a day that usually works for you?",
    followup: "A weekday morning would be best.",
    outcome: "An appointment enquiry for your front desk.",
    setup: "Add administrative information and clear handover rules.",
    handoff: "Medical questions go to qualified staff. No diagnosis or advice.",
  },
  {
    name: "Shops & boutiques",
    icon: ShoppingBag,
    mood: "lilac",
    image: "/images/use-shop.png",
    imageAlt: "A linen shirt hanging in a small boutique at dusk",
    focus: "center 46%",
    label: "For the customer just outside",
    title: "A warm welcome,\nbeyond your shop door.",
    description: "Help someone plan a visit, understand your collection process, or reach your team while you look after customers in store.",
    tasks: ["Answer questions about visiting and collection", "Explain the policies you’ve provided", "Collect order enquiries for follow-up"],
    caller: "Can someone help me with a collection?",
    reply: "Yes. Is this about arranging a collection, or asking your team about an existing order?",
    followup: "An existing order. I’d like a callback.",
    outcome: "An enquiry your team can pick up from.",
    setup: "Share store hours, collection details, and customer policies.",
    handoff: "Stock checks and refunds need your connected tools or team.",
  },
  {
    name: "Fitness & classes",
    icon: Dumbbell,
    mood: "blue",
    image: "/images/use-fitness.png",
    imageAlt: "An empty studio with a mat and a folded towel",
    focus: "center 70%",
    label: "Keep your focus on the room",
    title: "Lead the class.\nWelcome the next member.",
    description: "Someone’s first class begins with a question. Help them feel comfortable before they ever walk through the door.",
    tasks: ["Explain class types and newcomer information", "Share schedules and membership details", "Help arrange a trial or callback"],
    caller: "I’ve never tried Pilates. Where should I start?",
    reply: "I can share the beginner class information. Would you like the timetable or details about a first visit?",
    followup: "The timetable would be great.",
    outcome: "A more confident first visit.",
    setup: "Add your schedule, membership options, and trial process.",
    handoff: "Personal health and training advice goes to an instructor.",
  },
];

export function UseCases() {
  const [active, setActive] = useState(0);
  const uid = useId();
  const c = USE_CASES[active];
  const Icon = c.icon;
  return (
    <section id="use" className="mx-auto max-w-6xl scroll-mt-24 px-6 py-20 sm:py-24">
      <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <div>
          <p className="eyebrow">Who is Azentoo for?</p>
          <h2 data-reveal="" className="section-title mt-4">
            Real businesses.
            <br />
            Very real busy days.
          </h2>
        </div>
        <p className="max-w-sm text-sm leading-relaxed text-muted">
          For the people who do a little of everything. Find your kind of work and see where a little help could fit.
        </p>
      </div>
      <div className="mt-9 flex gap-2 overflow-x-auto pb-3" role="tablist" aria-label="Explore business use cases">
        {USE_CASES.map((u, i) => (
          <button
            type="button"
            id={`${uid}-tab-${i}`}
            role="tab"
            aria-selected={active === i}
            aria-controls={`${uid}-panel`}
            tabIndex={active === i ? 0 : -1}
            onClick={() => setActive(i)}
            onKeyDown={(e) => {
              let next = i;
              if (e.key === "ArrowRight") next = (i + 1) % USE_CASES.length;
              else if (e.key === "ArrowLeft") next = (i + USE_CASES.length - 1) % USE_CASES.length;
              else if (e.key === "Home") next = 0;
              else if (e.key === "End") next = USE_CASES.length - 1;
              else return;
              e.preventDefault();
              setActive(next);
              document.getElementById(`${uid}-tab-${next}`)?.focus();
            }}
            className={cn(
              "inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-3 text-xs font-medium transition-colors",
              active === i ? "border-accent bg-accent text-accent-fg" : "border-border bg-surface text-muted hover:border-accent/30 hover:text-fg",
            )}
            key={u.name}
          >
            <u.icon className="size-4" />
            {u.name}
          </button>
        ))}
      </div>
      <div
        id={`${uid}-panel`}
        role="tabpanel"
        aria-labelledby={`${uid}-tab-${active}`}
        tabIndex={0}
        className="use-case-panel mt-3 overflow-hidden rounded-[2rem] border border-border bg-surface"
        data-mood={c.mood}
      >
        <div className="grid lg:grid-cols-[1.05fr_1fr]">
          <div>
            <figure className="use-case-still">
              {USE_CASES.map((u) => {
                const shown = u.name === c.name;
                return (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={u.image}
                    alt={shown ? u.imageAlt : ""}
                    aria-hidden={!shown || undefined}
                    className={shown ? "is-shown" : undefined}
                    style={{ objectPosition: u.focus }}
                    key={u.image}
                  />
                );
              })}
            </figure>
            <div className="px-7 pb-8 sm:px-10 sm:pb-10">
              <span className="relative z-10 -mt-7 mb-5 inline-grid size-12 place-items-center rounded-2xl border border-border bg-surface text-accent shadow-[var(--shadow-border)]">
                <Icon className="size-5" />
              </span>
              <p className="text-[10px] font-semibold tracking-widest text-subtle uppercase">{c.label}</p>
              <h3 className="mt-4 whitespace-pre-line text-3xl font-semibold leading-[1.15] tracking-[-.04em] sm:text-4xl">{c.title}</h3>
              <p className="mt-5 max-w-md text-sm leading-relaxed text-muted">{c.description}</p>
              <ul className="mt-7 space-y-3">
                {c.tasks.map((t) => (
                  <li className="flex gap-3 text-sm leading-relaxed" key={t}>
                    <Check className="mt-0.5 size-4 shrink-0 text-accent" />
                    {t}
                  </li>
                ))}
              </ul>
              <Link href="/login" className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-accent">
                Make Azentoo your own <ArrowUpRight className="size-4" />
              </Link>
            </div>
          </div>
          <div className="use-case-scene flex flex-col justify-center p-6 sm:p-9">
            <div className="mb-6 flex items-center justify-between">
              <span className="flex items-center gap-2 text-xs font-semibold">
                <Phone className="size-3.5" /> A little moment, handled
              </span>
              <span className="rounded-full border border-current/10 px-2.5 py-1 text-[9px] font-medium text-muted">Example conversation</span>
            </div>
            <div className="space-y-4">
              <div className="ml-8 rounded-[1.3rem] rounded-br-md bg-surface/90 p-4">
                <p className="mb-1.5 text-[9px] font-semibold tracking-widest text-subtle uppercase">Customer</p>
                <p className="text-sm leading-relaxed">{c.caller}</p>
              </div>
              <div className="mr-6 rounded-[1.3rem] rounded-bl-md bg-accent p-5 text-accent-fg">
                <p className="mb-1.5 flex items-center gap-1.5 text-[9px] font-semibold tracking-widest uppercase opacity-70">
                  <MessageCircle className="size-3" /> Azentoo
                </p>
                <p className="text-sm leading-relaxed">{c.reply}</p>
              </div>
              <div className="ml-8 rounded-[1.3rem] rounded-br-md bg-surface/90 p-4">
                <p className="text-sm leading-relaxed">{c.followup}</p>
              </div>
            </div>
            <div className="mt-7 flex items-center gap-3 rounded-2xl border border-current/8 p-4">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface text-accent">
                <ArrowRight className="size-4" />
              </span>
              <p className="text-xs font-medium leading-relaxed">{c.outcome}</p>
            </div>
          </div>
        </div>
        <div className="grid gap-5 border-t border-border bg-bg/50 p-6 sm:grid-cols-2 sm:px-10">
          <div>
            <p className="text-[10px] font-semibold tracking-widest text-subtle uppercase">Make it yours</p>
            <p className="mt-2 text-xs leading-relaxed text-muted">{c.setup}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold tracking-widest text-subtle uppercase">Keep the human touch</p>
            <p className="mt-2 text-xs leading-relaxed text-muted">{c.handoff}</p>
          </div>
        </div>
      </div>
      <div className="mt-6 flex flex-col justify-between gap-3 text-xs leading-relaxed text-muted sm:flex-row">
        <p>These are examples. Your instructions and connected tools shape what Azentoo can do.</p>
        <Link href="/login" className="inline-flex shrink-0 items-center gap-1.5 font-semibold text-accent">
          Something different? Start with your business. <ArrowUpRight className="size-3.5" />
        </Link>
      </div>
    </section>
  );
}

/* ---------- voices ---------- */

type Personality = { id: string; name: string; gender: string; tone: string; aliases: string[] };

function personalities() {
  const map = new Map<string, Personality>();
  for (const v of VOICES) {
    const id = realtimeVoiceId(v.id);
    const p = map.get(id);
    if (!p) {
      map.set(id, { id, name: v.name, gender: v.gender, tone: v.tone, aliases: [] });
      continue;
    }
    if (v.id === id) {
      p.aliases.push(p.name);
      p.name = v.name;
      p.tone = v.tone;
    } else p.aliases.push(v.name);
  }
  return [...map.values()];
}
const PERSONALITIES = personalities();

export function VoiceStudio() {
  const [playing, setPlaying] = useState<string | null>(null);
  const [current, setCurrent] = useState("marin");
  const [filter, setFilter] = useState("All voices");
  const [error, setError] = useState("");
  const audio = useRef<HTMLAudioElement | null>(null);
  useEffect(() => () => audio.current?.pause(), []);

  const toggle = (id: string) => {
    setCurrent(id);
    setError("");
    if (playing === id) {
      audio.current?.pause();
      setPlaying(null);
      return;
    }
    audio.current?.pause();
    const a = new Audio(`/voices/samples/${id}.mp3`);
    audio.current = a;
    setPlaying(id);
    a.onended = () => {
      if (audio.current === a) setPlaying(null);
    };
    const failed = () => {
      if (audio.current === a) {
        setPlaying(null);
        setError("This sample couldn’t play. Please try another voice.");
      }
    };
    a.onerror = failed;
    a.play().catch(failed);
  };

  const hero = PERSONALITIES.find((p) => p.id === current) ?? PERSONALITIES[0];
  const shown = PERSONALITIES.filter((p) => filter === "All voices" || p.gender === filter);

  return (
    <div className="voice-studio overflow-hidden rounded-[2rem] border border-border bg-surface">
      <div data-reveal="" className="grid lg:grid-cols-[.85fr_1.15fr]">
        <div className="voice-feature relative flex flex-col p-7 sm:p-10">
          <div className="flex items-center gap-2 text-xs font-semibold tracking-wider uppercase">
            <Headphones className="size-4" /> The listening room
          </div>
          <h2 className="mt-6 text-3xl font-semibold leading-tight tracking-[-.04em] sm:text-4xl">
            Good conversations
            <br />
            start with a voice.
          </h2>
          <p className="mt-4 max-w-sm text-sm leading-relaxed opacity-70">Find the personality that fits your business. Press play and picture your next hello.</p>
          <div className="voice-wave my-10 flex h-24 items-center justify-center gap-1.5" data-playing={playing === hero.id} aria-hidden="true">
            {Array.from({ length: 35 }, (_, i) => (
              <span
                style={{ height: `${(18 + Math.sin(i * 0.75) ** 2 * 55 + Math.sin(i * 0.24) ** 2 * 25).toFixed(2)}%`, animationDelay: `${i * 35}ms` }}
                key={i}
              />
            ))}
          </div>
          <div className="mt-auto flex items-center gap-4">
            <button
              type="button"
              aria-label={playing === hero.id ? `Pause ${hero.name}` : `Play ${hero.name}`}
              onClick={() => toggle(hero.id)}
              className="grid size-14 shrink-0 place-items-center rounded-full bg-white text-[#0d0d12] shadow-lg transition-transform hover:scale-105 focus-visible:ring-4 focus-visible:ring-white/50"
            >
              {playing === hero.id ? <Pause className="size-5" /> : <Play className="ml-1 size-5" />}
            </button>
            <div>
              <p className="text-2xl font-semibold tracking-tight">{hero.name}</p>
              <p className="mt-1 text-xs opacity-70">{hero.tone}</p>
            </div>
          </div>
          <p className="mt-5 text-xs opacity-60">{playing ? "Playing voice sample" : "A little preview of your next receptionist"}</p>
        </div>
        <div className="p-6 sm:p-9">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm font-semibold">Explore {PERSONALITIES.length} personalities</p>
            <div className="flex gap-1 rounded-full bg-bg p-1" role="group" aria-label="Filter voices">
              {["All voices", "Female", "Male"].map((f) => (
                <button
                  type="button"
                  aria-pressed={filter === f}
                  onClick={() => setFilter(f)}
                  className={cn("rounded-full px-3 py-2 text-xs transition-colors", filter === f ? "bg-surface text-fg shadow-sm" : "text-muted hover:text-fg")}
                  key={f}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          <ul className="mt-6 grid gap-2 sm:grid-cols-2">
            {shown.map((p, i) => (
              <li key={p.id}>
                <button
                  type="button"
                  aria-label={`${playing === p.id ? "Pause" : "Hear"} ${p.name}`}
                  aria-pressed={current === p.id}
                  onClick={() => toggle(p.id)}
                  className={cn(
                    "group flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors",
                    current === p.id ? "border-accent/30 bg-accent/7" : "border-transparent hover:border-border hover:bg-bg",
                  )}
                >
                  <span
                    className="voice-initial grid size-10 shrink-0 place-items-center rounded-xl text-sm font-medium"
                    style={{ background: ["#f3ffd1", "#eaf6ef", "#f0f2f6", "#e8eef7"][i % 4], color: "#1a1a1c" }}
                  >
                    {p.name.slice(0, 1)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{p.name}</span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-muted">{p.tone.split(",").slice(0, 2).join(" ·")}</span>
                  </span>
                  {playing === p.id ? <Pause className="size-3.5 shrink-0 text-accent" /> : <Play className="size-3.5 shrink-0 text-subtle" />}
                </button>
              </li>
            ))}
          </ul>
          {error && (
            <p className="mt-4 text-xs text-danger" role="alert">
              {error}
            </p>
          )}
          <div className="mt-6 flex items-center justify-between gap-4 border-t border-border pt-5">
            <p className="max-w-56 text-xs leading-relaxed text-muted">
              Your voice. Your greeting.
              <br />
              Make the first impression yours.
            </p>
            <Link href="/login" className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent">
              Get started <ArrowUpRight className="size-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- FAQ ---------- */

const FAQ = [
  {
    q: "What can Azentoo help with?",
    a: "Answer calls and website conversations, book appointments, capture leads, run outbound campaigns, and review results. The workspace also includes a CRM, forms, business knowledge, workflows, and app connections. You choose which tools your receptionist can use.",
  },
  {
    q: "Can I try it before connecting my phone?",
    a: "Yes. Start with the demo above, then create your receptionist and have a practice conversation before connecting a phone or website.",
  },
  {
    q: "How do I make it sound like my business?",
    a: "Choose a voice, write a greeting, and add your business details. Try the questions your customers usually ask and refine the instructions as you go.",
  },
  {
    q: "What if someone needs a person?",
    a: "Set instructions for when to hand over, along with the contact details or message-taking process your business uses. Test these situations before going live.",
  },
  {
    q: "Where can I catch up on conversations?",
    a: "Your dashboard brings conversations and messages together so you can review what happened and decide what needs a follow-up.",
  },
  {
    q: "Which apps can I connect?",
    a: "Connect Google Calendar, Gmail, Google Sheets, Outlook, Slack, HubSpot, Salesforce, Shopify, Stripe, Zendesk, Notion, and Calendly. You can also connect supported voice and AI providers, or your own tools through an MCP server. Each integration has specific supported actions, shown in the directory above.",
  },
  {
    q: "Do I need a separate CRM or booking tool?",
    a: "Azentoo includes a lead board, contact book, appointments, and forms. Use those to get started, or connect your existing apps when you want your receptionist to work with them. External accounts need to be connected and configured first.",
  },
  {
    q: "Can I change things later?",
    a: "Yes. Update your greeting, business information, voice, and instructions as your business changes.",
  },
];

export function Faq() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
        <div>
          <span className="mb-5 inline-grid size-12 place-items-center rounded-2xl bg-accent/10 text-accent">
            <MessageCircle className="size-5" />
          </span>
          <p className="eyebrow">Good questions</p>
          <h2 data-reveal="" className="section-title mt-4">
            A little clarity,
            <br />
            before your first hello.
          </h2>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted">Get to know your new receptionist before you hand over the first hello.</p>
          <a href="#demo" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-accent">
            Ask Azentoo yourself <ArrowUpRight className="size-4" />
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
  );
}

/* ---------- footer ---------- */

export function LandingFooter({
  name,
  companyName,
  termsUrl,
  privacyUrl,
  supportEmail,
}: {
  name?: string;
  companyName?: string;
  termsUrl?: string;
  privacyUrl?: string;
  supportEmail?: string;
}) {
  return (
    <footer className="px-3 pb-3 sm:px-6 sm:pb-6">
      <div className="footer-garden mx-auto max-w-7xl overflow-hidden rounded-[2rem] px-6 pt-10 sm:px-12 sm:pt-14">
        <div className="flex flex-col justify-between gap-8 border-b border-current/15 pb-10 sm:flex-row sm:items-end">
          <div>
            <Wordmark name={name} />
            <p className="mt-5 max-w-sm text-2xl font-medium leading-snug tracking-tight">
              A little more connection.
              <br />A lot more room to breathe.
            </p>
          </div>
          <a href="#demo" className="inline-flex w-fit items-center gap-3 rounded-full bg-white px-5 py-3 text-sm font-semibold text-[#0d0d12]">
            Come say hello <ArrowUpRight className="size-4" />
          </a>
        </div>
        <div className="grid grid-cols-2 gap-9 py-10 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <p className="col-span-2 max-w-xs text-sm leading-relaxed opacity-70 md:col-span-1">
            Thoughtful conversations for the people behind small businesses. Here for the next hello.
          </p>
          <nav aria-label="Explore Azentoo" className="flex flex-col items-start gap-3 text-sm">
            <p className="mb-1 text-[10px] font-semibold tracking-widest uppercase opacity-60">Explore</p>
            {[
              ["#features", "Product features"],
              ["#integrations", "Integrations"],
              ["#tools", "Built-in tools"],
              ["#how", "How it works"],
              ["#voices", "Find your voice"],
              ["#pricing", "Plans & pricing"],
            ].map(([href, label]) => (
              <a className="hover:underline underline-offset-4" href={href} key={href}>
                {label}
              </a>
            ))}
          </nav>
          <nav aria-label="For your business" className="flex flex-col items-start gap-3 text-sm">
            <p className="mb-1 text-[10px] font-semibold tracking-widest uppercase opacity-60">Made for you</p>
            {["Salons & studios", "Cafés & restaurants", "Local services"].map((l) => (
              <a href="#use" className="hover:underline underline-offset-4" key={l}>
                {l}
              </a>
            ))}
          </nav>
          <nav aria-label="Help and account" className="flex flex-col items-start gap-3 text-sm">
            <p className="mb-1 text-[10px] font-semibold tracking-widest uppercase opacity-60">Stay connected</p>
            <Link href="/login" className="hover:underline underline-offset-4">
              Sign in
            </Link>
            <Link href="/app" className="hover:underline underline-offset-4">
              Your workspace
            </Link>
            <a href="/docs/" className="hover:underline underline-offset-4">
              Help & guides
            </a>
            {supportEmail && (
              <a href={`mailto:${supportEmail}`} className="hover:underline underline-offset-4">
                Say hello
              </a>
            )}
          </nav>
        </div>
        <div
          className="footer-signature select-none text-[clamp(2.9rem,14vw,12rem)] whitespace-nowrap font-semibold leading-[.85] tracking-[-.075em] opacity-[.12]"
          aria-hidden="true"
        >
          {name || "Azentoo"}
          <span className="text-accent">.</span>
        </div>
        <div className="mt-8 flex flex-wrap items-center justify-between gap-5 border-t border-current/15 py-6 text-xs">
          <p>
            © {new Date().getFullYear()} {companyName || name || "Azentoo"}
          </p>
          <div className="flex items-center gap-5">
            {termsUrl && <a href={termsUrl}>Terms</a>}
            {privacyUrl && <a href={privacyUrl}>Privacy</a>}
            <a href="#top" className="inline-flex items-center gap-2">
              Back to top <ArrowUp className="size-3.5" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
