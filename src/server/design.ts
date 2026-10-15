import "server-only";
import { JOBS, LANGUAGES, TEMPLATES, TOOL_CATALOG, VOICES } from "@/lib/catalog";
import { chatComplete } from "./ai";

export type Draft = {
  name: string;
  tagline: string;
  description: string;
  voiceId: string;
  language: string;
  job: string;
  tools: string[];
  greeting: string;
  systemPrompt: string;
  guardrails: string;
};

export type DesignTurn = { message: string; chips: { label: string; send: string }[]; ready: boolean; draft: Draft | null };

const SYSTEM = `You help a small-business owner set up an AI phone receptionist. Talk warmly and briefly (two sentences).
Ask at most one question per turn. Once you know what the business does and what the line should handle, produce a draft.
Always answer with JSON only:
{"message": string, "chips": [{"label": string, "send": string}], "ready": boolean,
 "draft": null | {"name": string, "tagline": string, "description": string, "voiceId": string, "language": string,
 "job": string, "tools": string[], "greeting": string, "systemPrompt": string, "guardrails": string}}
chips are 2–4 short suggested replies. Set ready=true only when draft is complete.
voiceId must be one of: ${VOICES.map((v) => v.id).join(", ")}.
language must be one of: ${LANGUAGES.map((l) => l.id).join(", ")}.
job must be one of: ${JOBS.map((j) => j.id).join(", ")}.
tools may only use: ${TOOL_CATALOG.filter((t) => t.group === "workflow").map((t) => t.key).join(", ")}.
systemPrompt is the full instruction for the receptionist, in second person, with hours, what to collect, and when to hand over.`;

function closestTemplate(text: string) {
  const t = text.toLowerCase();
  let best = TEMPLATES[0];
  let score = -1;
  for (const tpl of TEMPLATES) {
    const words = `${tpl.name} ${tpl.category} ${tpl.tagline} ${tpl.description}`.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 3);
    const s = words.filter((w) => t.includes(w)).length;
    if (s > score) {
      score = s;
      best = tpl;
    }
  }
  return best;
}

function fromTemplate(tpl: (typeof TEMPLATES)[number]): Draft {
  return {
    name: tpl.name,
    tagline: tpl.tagline,
    description: tpl.description,
    voiceId: tpl.voiceId,
    language: tpl.language,
    job: tpl.job,
    tools: [...tpl.tools],
    greeting: tpl.greeting,
    systemPrompt: tpl.systemPrompt,
    guardrails: tpl.guardrails,
  };
}

/** Offline path: match what the owner said to the closest template. */
function fallbackTurn(messages: { role: string; content: string }[]): DesignTurn {
  const said = messages.filter((m) => m.role === "user").map((m) => m.content).join(" ");
  const tpl = closestTemplate(said);
  return {
    message: `That sounds like a good fit for a “${tpl.name}” line. I’ve drafted one below — you can change every word once it exists.`,
    chips: [],
    ready: true,
    draft: fromTemplate(tpl),
  };
}

function sanitize(d: Partial<Draft> | null | undefined): Draft | null {
  if (!d || !d.name) return null;
  const tools = TOOL_CATALOG.map((t) => t.key);
  return {
    name: String(d.name).slice(0, 80),
    tagline: String(d.tagline ?? "").slice(0, 160),
    description: String(d.description ?? "").slice(0, 600),
    voiceId: VOICES.some((v) => v.id === d.voiceId) ? String(d.voiceId) : "marin",
    language: LANGUAGES.some((l) => l.id === d.language) ? String(d.language) : "en",
    job: JOBS.some((j) => j.id === d.job) ? String(d.job) : "support",
    tools: Array.isArray(d.tools) ? d.tools.filter((t) => tools.includes(t)) : [],
    greeting: String(d.greeting ?? "").slice(0, 400),
    systemPrompt: String(d.systemPrompt ?? "").slice(0, 8000),
    guardrails: String(d.guardrails ?? "").slice(0, 2000),
  };
}

export async function designTurn(messages: { role: "user" | "assistant"; content: string }[]): Promise<DesignTurn> {
  let out;
  try {
    out = await chatComplete({ messages: [{ role: "system", content: SYSTEM }, ...messages], temperature: 0.5, json: true });
  } catch {
    out = null;
  }
  if (!out) return fallbackTurn(messages);
  try {
    const parsed = JSON.parse(out.content.replace(/^```(json)?|```$/g, ""));
    const draft = sanitize(parsed.draft);
    return {
      message: String(parsed.message ?? ""),
      chips: Array.isArray(parsed.chips)
        ? parsed.chips.slice(0, 4).map((c: { label?: string; send?: string }) => ({ label: String(c.label ?? c.send ?? ""), send: String(c.send ?? c.label ?? "") }))
        : [],
      ready: !!parsed.ready && !!draft,
      draft,
    };
  } catch {
    return fallbackTurn(messages);
  }
}
