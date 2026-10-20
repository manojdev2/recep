import type { Agent, AgentHours, CallConfig, WidgetConfig } from "./types";
import { TEMPLATES } from "@/lib/catalog";

export type Template = (typeof TEMPLATES)[number];

export const DEFAULT_CALL_CONFIG: CallConfig = {
  responseEagerness: "medium",
  record: true,
  maxDurationSec: 600,
  afterHours: "voicemail",
  afterHoursMessage: "We're closed. Leave a message after the tone, and we'll call you back.",
  transferNumber: "",
  voicemailMessage: "Please leave a message after the tone.",
  outboundCallerId: "",
  outboundVoicemail: "message",
  outboundFirstMessage: "",
  callingWindowStart: "09:00",
  callingWindowEnd: "18:00",
  callingTimezone: "America/New_York",
  maxAttempts: 2,
  amd: true,
};

export const DEFAULT_WIDGET: WidgetConfig = {
  color: "",
  logoUrl: "",
  headline: "",
  hideBrand: false,
  allowedDomains: [],
};

export function blankAgent(id: string, userId: string, now: string): Agent {
  return {
    id,
    userId,
    name: "New receptionist",
    tagline: "",
    description: "",
    voiceId: "marin",
    language: "en",
    systemPrompt: "",
    greeting: "",
    temperature: "0.6",
    status: "draft",
    firstMessageMode: "wait",
    channels: ["web"],
    guardrails: "",
    job: "support",
    modelId: "grok-4.5",
    interrupt: true,
    knowCaller: false,
    direction: "both",
    brain: "prompt",
    callConfig: { ...DEFAULT_CALL_CONFIG },
    workflow: { nodes: [], edges: [] },
    widgetConfig: { ...DEFAULT_WIDGET, allowedDomains: [] },
    templateKey: null,
    rehearsal: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function agentFromTemplate(t: Template, id: string, userId: string, now: string): Agent {
  return {
    ...blankAgent(id, userId, now),
    name: t.name,
    tagline: t.tagline,
    description: t.description,
    voiceId: t.voiceId,
    language: t.language,
    job: t.job,
    greeting: t.greeting,
    systemPrompt: t.systemPrompt,
    guardrails: t.guardrails,
    templateKey: t.key,
  };
}

/** Opening hours a trade usually keeps — a starting point the owner confirms. */
export function suggestedWindows(templateKey: string | null | undefined) {
  const days = (list: number[], start: number, end: number) => list.map((weekday) => ({ weekday, startMin: start, endMin: end }));
  switch (templateKey) {
    case "clinic":
    case "dental":
      return [1, 2, 3, 4, 5, 6].flatMap((weekday) => [
        { weekday, startMin: 480, endMin: 720 },
        { weekday, startMin: 780, endMin: 1080 },
      ]);
    // Keep these in step with the hours the template's script tells callers.
    case "salon":
      return days([2, 3, 4, 5, 6], 540, 1140);
    case "restaurant":
      return [2, 3, 4, 5, 6, 0].flatMap((weekday) => [
        { weekday, startMin: 690, endMin: 870 },
        { weekday, startMin: 1050, endMin: 1320 },
      ]);
    case "gym":
      return days([1, 2, 3, 4, 5], 360, 1320).concat(days([6, 0], 480, 1200));
    case "after_hours":
      return days([0, 1, 2, 3, 4, 5, 6], 0, 1440);
    default:
      return days([1, 2, 3, 4, 5], 540, 1020);
  }
}

export function defaultHours(agentId: string, templateKey?: string | null): AgentHours {
  return { agentId, slotMinutes: 30, horizonDays: 14, windows: suggestedWindows(templateKey), unset: false };
}
