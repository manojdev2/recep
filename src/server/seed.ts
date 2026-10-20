import crypto from "node:crypto";
import { TEMPLATES } from "@/lib/catalog";
import { agentFromTemplate, defaultHours } from "./agent-defaults";
import type { Database, RateCard } from "./types";

function hash(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  return `scrypt:${salt}:${crypto.scryptSync(password, salt, 64).toString("hex")}`;
}

export const DEMO_OWNER_EMAIL = "demo@azentoo.app";
export const DEMO_ADMIN_EMAIL = "demo-admin@azentoo.app";
/**
 * The same two accounts in databases seeded before the rename to Azentoo. They must stay
 * demo accounts: their password is published, so production keeps them locked.
 */
export const LEGACY_DEMO_EMAILS: Record<string, string> = {
  [DEMO_OWNER_EMAIL]: "demo@reception-ai.app",
  [DEMO_ADMIN_EMAIL]: "demo-admin@reception-ai.app",
};
export const DEMO_PASSWORD = "demo1234";

export const DEFAULT_RATES: Omit<RateCard, "updatedAt">[] = [
  { provider: "anthropic", operation: "chat", unit: "ktoken", costMicros: 3000, note: "Estimate" },
  { provider: "openai", operation: "chat", unit: "ktoken", costMicros: 600, note: "Estimate — varies by model" },
  { provider: "openai", operation: "speech", unit: "kchar", costMicros: 15000, note: "gpt-4o-mini-tts, estimate" },
  { provider: "openai", operation: "transcribe", unit: "minute", costMicros: 6000, note: "whisper-1, estimate" },
  {
    provider: "openai-realtime",
    operation: "audio",
    unit: "minute",
    costMicros: 30000,
    note: "Estimate — check against your OpenAI invoice",
  },
  { provider: "plivo", operation: "call.in", unit: "minute", costMicros: 8500, note: "Estimate — varies by country" },
  { provider: "plivo", operation: "call.out", unit: "minute", costMicros: 14000, note: "Estimate — varies by destination" },
  { provider: "plivo", operation: "number", unit: "month", costMicros: 50000, note: "Per phone number, per month" },
  { provider: "twilio", operation: "call.in", unit: "minute", costMicros: 8500, note: "Estimate — varies by country" },
  { provider: "twilio", operation: "call.out", unit: "minute", costMicros: 14000, note: "Estimate — varies by destination" },
  { provider: "twilio", operation: "number", unit: "month", costMicros: 115000, note: "Per phone number, per month" },
  { provider: "xai", operation: "chat", unit: "ktoken", costMicros: 500, note: "Estimate" },
  { provider: "xai", operation: "speech", unit: "kchar", costMicros: 10000, note: "Estimate" },
];

/**
 * A fresh database: the plan table, provider rates, and — so a new install has something
 * to look at — the two demo accounts with a live clinic receptionist.
 */
export function seedDatabase(): Database {
  const created = "2026-09-22T14:55:49.000Z";
  const ownerId = "X0hSX9sdRz8WsclgdGZSOIhjvlILMnmV";
  const adminId = "nWTw17uLL0jU2iXlLnlUujZZl6yxdEmX";
  const clinic = TEMPLATES.find((t) => t.key === "clinic")!;
  const agent = {
    ...agentFromTemplate(clinic, "agt_2952dbd48d1e4a29", ownerId, created),
    status: "live" as const,
    guardrails: "No financial advice. No medical diagnosis. No legal counsel.",
    // Matches the original showroom: built before templates were tracked, with no tools switched on.
    templateKey: null,
  };

  return {
    users: [
      {
        id: adminId,
        email: DEMO_ADMIN_EMAIL,
        name: "Demo Operator",
        image: null,
        passwordHash: hash(DEMO_PASSWORD),
        createdAt: created,
        plan: "studio",
        timeZone: null,
        lastSeen: null,
      },
      {
        id: ownerId,
        email: DEMO_OWNER_EMAIL,
        name: "Priya Nair",
        image: null,
        passwordHash: hash(DEMO_PASSWORD),
        createdAt: created,
        plan: "studio",
        timeZone: "Europe/London",
        lastSeen: null,
      },
    ],
    sessions: [],
    admins: [{ userId: adminId, level: "super", createdAt: created }],
    agents: [agent],
    agentTools: [],
    conversations: [
      {
        id: "cnv_fe231ec5790c402d",
        userId: ownerId,
        agentId: agent.id,
        channel: "web",
        language: "en",
        resolved: false,
        sentiment: "neutral",
        durationSec: 0,
        isSample: false,
        startedAt: "2026-10-07T14:00:50.000Z",
        lastAt: "2026-10-07T14:01:16.333Z",
        callerName: null,
        callerContact: null,
        callId: null,
        outcome: null,
      },
      {
        id: "cnv_9f29051c94254cb8",
        userId: ownerId,
        agentId: agent.id,
        channel: "web",
        language: "en",
        resolved: false,
        sentiment: "neutral",
        durationSec: 0,
        isSample: false,
        startedAt: "2026-09-22T15:15:43.000Z",
        lastAt: "2026-09-22T15:15:46.000Z",
        callerName: "Anil Verma",
        callerContact: null,
        callId: null,
        outcome: null,
      },
    ],
    messages: [
      { id: "msg_d14b24ca1337484c", conversationId: "cnv_fe231ec5790c402d", role: "user", content: "Hello", created_at: "2026-10-07T14:00:53.232Z" },
      {
        id: "msg_02533eacc3824962",
        conversationId: "cnv_fe231ec5790c402d",
        role: "assistant",
        content: "Hello—clinic front desk. Are you booking, changing, or checking an appointment?",
        created_at: "2026-10-07T14:00:53.275Z",
      },
      {
        id: "msg_f42a52e2a8bf4d38",
        conversationId: "cnv_fe231ec5790c402d",
        role: "user",
        content: "checking an appointment",
        created_at: "2026-10-07T14:01:16.328Z",
      },
      {
        id: "msg_2c0676f76242476b",
        conversationId: "cnv_fe231ec5790c402d",
        role: "assistant",
        content:
          "I can help you check an appointment. What’s the full name on the booking, and do you have a confirmation code or the day and time it was for?",
        created_at: "2026-10-07T14:01:16.333Z",
      },
      {
        id: "msg_5d0b3c1e8a2f4b71",
        conversationId: "cnv_9f29051c94254cb8",
        role: "user",
        content: "Hi, can I book a check-up on Wednesday morning? Anil Verma.",
        created_at: "2026-09-22T15:15:45.000Z",
      },
      {
        id: "msg_9a7c2e4d6b1f4e08",
        conversationId: "cnv_9f29051c94254cb8",
        role: "assistant",
        content: "Of course, Anil. Let me check Wednesday morning for you — one moment.",
        created_at: "2026-09-22T15:15:46.000Z",
      },
    ],
    slots: [],
    leads: [],
    tickets: [],
    transfers: [],
    contacts: [],
    // The original demo workspace starts with an empty library: the setup checklist asks for real knowledge.
    knowledge: [],
    hours: [defaultHours(agent.id, "clinic")],
    phoneNumbers: [],
    calls: [],
    campaigns: [],
    campaignContacts: [],
    forms: [
      {
        id: "frm_contact_default",
        userId: ownerId,
        name: "Clinic intake",
        description: "Name, phone, and why they are reaching out.",
        agentId: agent.id,
        fields: [
          { id: "name", label: "Name", type: "text", required: true, options: "" },
          { id: "phone", label: "Phone", type: "phone", required: true, options: "" },
          { id: "reason", label: "Reason", type: "select", required: true, options: "New patient,Follow-up,Billing" },
          { id: "notes", label: "Anything we should know", type: "textarea", required: false, options: "" },
        ],
        status: "live",
        createdAt: created,
        updatedAt: created,
      },
    ],
    formSubmissions: [],
    webhooks: [],
    sheets: [],
    messaging: [],
    connections: [],
    agentConnections: [],
    plans: [
      {
        id: "studio",
        name: "Studio",
        priceLabel: "Free",
        position: 0,
        minutes: 15,
        agents: 1,
        numbers: 1,
        features: "Web widget\nConversation log",
        public: true,
        stripePriceId: "",
      },
      {
        id: "scale",
        name: "Scale",
        priceLabel: "$89 / seat / month",
        position: 1,
        minutes: 2000,
        agents: 25,
        numbers: 25,
        features: "Phone, SMS, WhatsApp\nAnalytics and simulations\nConnects to your calendar",
        public: true,
        stripePriceId: "",
      },
      {
        id: "enterprise",
        name: "Enterprise",
        priceLabel: "Custom",
        position: 2,
        minutes: null,
        agents: null,
        numbers: null,
        features: "Single sign-on\nA voice made for you\nWe help you set it up\nContracts and support",
        public: true,
        stripePriceId: "",
      },
    ],
    subscriptions: [],
    usage: [{ id: "use_seed_1", userId: ownerId, kind: "text", minutes: 0.1, at: "2026-10-07T14:01:16.000Z" }],
    costs: [
      {
        id: "cost_seed_1",
        userId: ownerId,
        provider: "xai",
        operation: "speech",
        units: 0.776,
        costMicros: 7760,
        at: "2026-10-07T14:01:16.000Z",
      },
    ],
    rates: DEFAULT_RATES.map((r) => ({ ...r, updatedAt: "2026-09-22T13:53:00.000Z" })),
    fixedCosts: [],
    revenue: [],
    settings: [],
    audit: [],
    providerEvents: [],
    jobs: [],
  };
}
