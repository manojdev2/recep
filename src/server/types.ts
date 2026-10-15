// Data model, recovered from the original app's API payloads and screens.

export type User = {
  id: string;
  email: string;
  name: string;
  image: string | null;
  passwordHash: string;
  createdAt: string;
  plan: string;
  timeZone: string | null;
  lastSeen: string | null;
  disabled?: boolean;
  /** Proven by Google sign-in or by opening an emailed confirmation link. */
  emailVerified?: boolean;
  /** A pending admin confirmation link (ADMIN_EMAILS). */
  adminConfirm?: { token: string; expiresAt: string; sentAt: string } | null;
};

export type Session = { token: string; userId: string; expiresAt: string; createdAt: string };

export type AdminLevel = "super" | "support";
export type Admin = { userId: string; level: AdminLevel; createdAt: string };

export type CallConfig = {
  responseEagerness: "low" | "medium" | "high";
  record: boolean;
  maxDurationSec: number;
  afterHours: "voicemail" | "message" | "hangup";
  afterHoursMessage: string;
  transferNumber: string;
  voicemailMessage: string;
  outboundCallerId: string;
  outboundVoicemail: "message" | "hangup";
  outboundFirstMessage: string;
  callingWindowStart: string;
  callingWindowEnd: string;
  callingTimezone: string;
  maxAttempts: number;
  amd: boolean;
};

export type WorkflowNodeType = "start" | "conversation" | "speak" | "listen" | "branch" | "tool" | "transfer" | "sms" | "end";

export type WorkflowNode = {
  id: string;
  type: WorkflowNodeType;
  x: number;
  y: number;
  data: {
    label: string;
    text?: string;
    trigger?: "any" | "inbound" | "outbound";
    variable?: string;
    toolKey?: string;
    destination?: string;
    endReason?: string;
  };
};

export type EdgeCondition = { match: "says" | "contains" | "equals" | "else"; phrases: string };
export type WorkflowEdge = { id: string; from: string; to: string; label?: string; condition?: EdgeCondition };
export type Workflow = { nodes: WorkflowNode[]; edges: WorkflowEdge[] };

export type WidgetConfig = {
  color: string;
  logoUrl: string;
  headline: string;
  hideBrand: boolean;
  allowedDomains: string[];
};

export type AgentStatus = "draft" | "live" | "paused";

export type Agent = {
  id: string;
  userId: string;
  name: string;
  tagline: string;
  description: string;
  voiceId: string;
  language: string;
  systemPrompt: string;
  greeting: string;
  temperature: string;
  status: AgentStatus;
  firstMessageMode: "wait" | "speak";
  channels: string[];
  guardrails: string;
  job: string;
  modelId: string;
  interrupt: boolean;
  knowCaller: boolean;
  direction: "inbound" | "outbound" | "both";
  brain: "prompt" | "workflow";
  callConfig: CallConfig;
  workflow: Workflow;
  widgetConfig: WidgetConfig;
  templateKey: string | null;
  rehearsal: { passed: number; total: number; at: string } | null;
  createdAt: string;
  updatedAt: string;
};

export type AgentTool = {
  id: string;
  agentId: string;
  toolKey: string;
  enabled: boolean;
  config: Record<string, unknown>;
  createdAt: string;
};

export type Conversation = {
  id: string;
  userId: string;
  agentId: string;
  channel: string;
  language: string;
  resolved: boolean;
  sentiment: "positive" | "neutral" | "negative";
  durationSec: number;
  isSample: boolean;
  startedAt: string;
  lastAt: string;
  callerName: string | null;
  callerContact: string | null;
  callId: string | null;
  outcome: { kind: "appointment" | "lead" | "ticket" | "transfer"; title: string; summary: string } | null;
};

export type Message = {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  created_at: string;
};

export type Slot = {
  id: string;
  userId: string;
  agentId: string;
  startsAt: string;
  endsAt: string;
  status: "open" | "booked" | "cancelled";
  bookedName: string;
  bookedContact: string;
  reason: string;
  confirmation: string;
  conversationId: string | null;
  bookedAt: string | null;
  /** Generated from opening hours (replaced when hours change), versus opened by hand. */
  generated: boolean;
  /** Generated from a trade guess rather than the owner's real hours. */
  fabricated: boolean;
  createdAt: string;
};

export type LeadStatus = "new" | "qualified" | "won" | "lost";

export type Lead = {
  id: string;
  userId: string;
  agentId: string | null;
  conversationId: string | null;
  name: string;
  contact: string;
  company: string;
  interest: string;
  status: LeadStatus;
  notes: string;
  source: string;
  createdAt: string;
  updatedAt: string;
};

export type Ticket = {
  id: string;
  userId: string;
  agentId: string | null;
  conversationId: string | null;
  subject: string;
  body: string;
  contact: string;
  status: "open" | "closed";
  reference: string;
  createdAt: string;
};

export type Transfer = {
  id: string;
  userId: string;
  agentId: string | null;
  conversationId: string | null;
  brief: string;
  destination: string;
  createdAt: string;
};

export type Contact = {
  id: string;
  userId: string;
  name: string;
  e164: string;
  email: string;
  company: string;
  notes: string;
  tags: string;
  dnc: boolean;
  isSample: boolean;
  createdAt: string;
};

export type KnowledgeDoc = {
  id: string;
  userId: string;
  title: string;
  source: "note" | "paste" | "url" | "file";
  sourceUrl: string | null;
  filename: string | null;
  mime: string | null;
  content: string;
  agentIds: string[];
  isSample: boolean;
  fetchedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type HoursWindow = { weekday: number; startMin: number; endMin: number };

export type AgentHours = {
  agentId: string;
  slotMinutes: number;
  horizonDays: number;
  windows: HoursWindow[];
  unset: boolean;
};

export type PhoneNumber = {
  id: string;
  userId: string;
  e164: string;
  label: string;
  provider: string;
  smsEnabled: boolean;
  agentId: string | null;
  sipUri: string | null;
  status: "active" | "error";
  /** Carrier credentials for this number (encrypted at rest). */
  secret: string | null;
  providerSid: string | null;
  createdAt: string;
};

export type CallStatus = "queued" | "ringing" | "answered" | "completed" | "no_answer" | "busy" | "failed" | "voicemail";

export type Call = {
  id: string;
  userId: string;
  agentId: string | null;
  campaignId: string | null;
  phoneId: string | null;
  direction: "inbound" | "outbound";
  fromE164: string;
  toE164: string;
  status: CallStatus;
  durationSec: number;
  summary: string;
  disposition: string;
  live: boolean;
  providerSid: string | null;
  conversationId: string | null;
  startedAt: string;
  endedAt: string | null;
};

export type Campaign = {
  id: string;
  userId: string;
  agentId: string;
  name: string;
  status: "draft" | "running" | "paused" | "done";
  phoneId: string | null;
  windowStart: string;
  windowEnd: string;
  timeZone: string;
  maxAttempts: number;
  voicemailMode: "message" | "hangup";
  concurrency: number;
  retryMinutes: number;
  skipDnc: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CampaignContactStatus = "pending" | "ringing" | "completed" | "no_answer" | "voicemail" | "failed" | "skipped";

export type CampaignContact = {
  id: string;
  campaignId: string;
  contactId: string | null;
  e164: string;
  name: string;
  status: CampaignContactStatus;
  attempts: number;
  lastOutcome: string;
  lastAttemptAt: string | null;
  nextAttemptAt: string | null;
};

export type FormField = {
  id: string;
  label: string;
  type: "text" | "email" | "phone" | "textarea" | "select";
  required: boolean;
  options: string;
};

export type Form = {
  id: string;
  userId: string;
  name: string;
  description: string;
  agentId: string;
  fields: FormField[];
  status: "draft" | "live";
  createdAt: string;
  updatedAt: string;
};

export type FormSubmission = {
  id: string;
  formId: string;
  userId: string;
  values: Record<string, string>;
  name: string;
  contact: string;
  createdAt: string;
};

export type Webhook = {
  id: string;
  userId: string;
  name: string;
  url: string;
  events: string[];
  secret: string;
  lastStatus: string;
  lastAt: string | null;
  createdAt: string;
};

export type SheetDestination = {
  userId: string;
  connectionId: string;
  spreadsheetId: string;
  sheetName: string;
  pushAppointments: boolean;
  pushForms: boolean;
  pushLeads: boolean;
  updatedAt: string;
};

export type MessagingChannel = {
  id: string;
  userId: string;
  kind: "whatsapp" | "email";
  label: string;
  config: Record<string, string>;
  status: "connected" | "error" | "off";
  lastError: string;
  createdAt: string;
};

export type Connection = {
  id: string;
  userId: string;
  appKey: string;
  accountLabel: string;
  /** Encrypted JSON of the fields the connector asked for (or OAuth tokens). */
  secret: string;
  oauth: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AgentConnection = { id: string; agentId: string; connectionId: string; createdAt: string };

export type Plan = {
  id: string;
  name: string;
  priceLabel: string;
  position: number;
  minutes: number | null;
  agents: number | null;
  numbers: number | null;
  features: string;
  public: boolean;
  stripePriceId: string;
};

export type Subscription = {
  userId: string;
  planId: string;
  status: "active" | "past_due" | "cancelled";
  customerId: string | null;
  subscriptionId: string | null;
  renewsAt: string | null;
  updatedAt: string;
};

export type UsageEvent = { id: string; userId: string; kind: "voice" | "phone_turn" | "text"; minutes: number; at: string };

export type CostEvent = {
  id: string;
  userId: string | null;
  provider: string;
  operation: string;
  units: number;
  costMicros: number;
  at: string;
};

export type RateCard = {
  provider: string;
  operation: string;
  unit: string;
  costMicros: number;
  note: string;
  updatedAt: string;
};

export type FixedCost = {
  id: string;
  label: string;
  category: string;
  monthlyMicros: number;
  startsOn: string;
  endsOn: string | null;
  note: string;
  createdAt: string;
};

export type RevenueEntry = {
  id: string;
  userId: string;
  plan: string;
  amountMicros: number;
  currency: string;
  period: string;
  note: string;
  source: "manual" | "stripe";
  createdAt: string;
};

export type PlatformSetting = { key: string; value: string; updatedAt: string; updatedBy: string };

export type AuditEntry = { id: string; actorId: string; actor: string; action: string; target: string; detail: string; at: string };

export type ProviderEvent = {
  id: string;
  provider: string;
  operation: string;
  ok: boolean;
  latencyMs: number;
  error: string | null;
  at: string;
};

export type Job = {
  id: string;
  kind: string;
  payload: Record<string, unknown>;
  status: "queued" | "running" | "done" | "failed";
  attempts: number;
  runAt: string;
  lastError: string;
  createdAt: string;
};

export type Database = {
  users: User[];
  sessions: Session[];
  admins: Admin[];
  agents: Agent[];
  agentTools: AgentTool[];
  conversations: Conversation[];
  messages: Message[];
  slots: Slot[];
  leads: Lead[];
  tickets: Ticket[];
  transfers: Transfer[];
  contacts: Contact[];
  knowledge: KnowledgeDoc[];
  hours: AgentHours[];
  phoneNumbers: PhoneNumber[];
  calls: Call[];
  campaigns: Campaign[];
  campaignContacts: CampaignContact[];
  forms: Form[];
  formSubmissions: FormSubmission[];
  webhooks: Webhook[];
  sheets: SheetDestination[];
  messaging: MessagingChannel[];
  connections: Connection[];
  agentConnections: AgentConnection[];
  plans: Plan[];
  subscriptions: Subscription[];
  usage: UsageEvent[];
  costs: CostEvent[];
  rates: RateCard[];
  fixedCosts: FixedCost[];
  revenue: RevenueEntry[];
  settings: PlatformSetting[];
  audit: AuditEntry[];
  providerEvents: ProviderEvent[];
  jobs: Job[];
};
