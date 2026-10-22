import "server-only";
import { TEMPLATES, TOOL_CATALOG } from "@/lib/catalog";
import { newId } from "@/lib/utils";
import { agentFromTemplate, blankAgent, defaultHours } from "./agent-defaults";
import { db, nowIso, save } from "./db";
import type { Draft } from "./design";
import { RpcError } from "./rpc";
import { regenerateSlots } from "./slots";
import type { Agent } from "./types";
import { assertAgentSlot } from "./usage";

function attachTools(agentId: string, keys: string[], now: string) {
  const data = db();
  for (const toolKey of keys) {
    if (!TOOL_CATALOG.some((t) => t.key === toolKey)) continue;
    data.agentTools.push({ id: newId("tool"), agentId, toolKey, enabled: true, config: {}, createdAt: now });
  }
}

/** Create a receptionist from a template key, "blank", or a drafted design. */
export function createAgent(userId: string, input: { templateKey?: string; draft?: Draft }): Agent {
  assertAgentSlot(userId);
  const data = db();
  const now = nowIso();
  const id = newId("agt");
  let agent: Agent;

  if (input.draft) {
    const d = input.draft;
    agent = {
      ...blankAgent(id, userId, now),
      name: d.name || "New receptionist",
      tagline: d.tagline,
      description: d.description,
      voiceId: d.voiceId,
      language: d.language,
      job: d.job,
      greeting: d.greeting,
      systemPrompt: d.systemPrompt,
      guardrails: d.guardrails,
    };
    data.agents.push(agent);
    attachTools(id, d.tools ?? [], now);
  } else if (!input.templateKey || input.templateKey === "blank") {
    agent = blankAgent(id, userId, now);
    data.agents.push(agent);
  } else {
    const tpl = TEMPLATES.find((t) => t.key === input.templateKey);
    if (!tpl) throw new RpcError("That starting point no longer exists.");
    agent = agentFromTemplate(tpl, id, userId, now);
    data.agents.push(agent);
    attachTools(id, tpl.tools, now);
    // A sample menu, so ordering works on the first try; the owner edits it like any other draft.
    const orderTool = "menu" in tpl && tpl.menu && data.agentTools.find((t) => t.agentId === id && t.toolKey === "take_order");
    if (orderTool) orderTool.config = { menu: { currency: tpl.menu.currency, items: tpl.menu.items.map((i) => ({ ...i })) } };
    for (const k of tpl.knowledge) {
      data.knowledge.push({
        id: newId("doc"),
        userId,
        title: k.title,
        source: "note",
        sourceUrl: null,
        filename: null,
        mime: null,
        content: k.content,
        agentIds: [id],
        isSample: true,
        fetchedAt: null,
        createdAt: now,
        updatedAt: now,
      });
    }
  }
  const hours = defaultHours(id, agent.templateKey);
  data.hours.push(hours);
  save();
  // With a timezone known, the diary is ready straight away.
  if (data.users.find((u) => u.id === userId)?.timeZone) regenerateSlots(userId, hours);
  return agent;
}
