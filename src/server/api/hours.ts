import "server-only";
import { defaultHours, suggestedWindows } from "../agent-defaults";
import { db, save } from "../db";
import { mutation, query, RpcError } from "../rpc";
import { regenerateSlots } from "../slots";
import type { HoursWindow } from "../types";

function validZone(zone: string) {
  if (!zone) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

function hoursFor(agentId: string, templateKey: string | null) {
  const data = db();
  let h = data.hours.find((x) => x.agentId === agentId);
  if (!h) {
    h = { ...defaultHours(agentId, templateKey), unset: true, windows: [] };
    data.hours.push(h);
    save();
  }
  return h;
}

export const hours = {
  get: query((_: void, { user }) => {
    const data = db();
    const zone = data.users.find((u) => u.id === user.id)?.timeZone ?? "";
    const now = Date.now();
    return {
      timeZone: zone,
      agents: data.agents
        .filter((a) => a.userId === user.id)
        .map((a) => {
          const h = hoursFor(a.id, a.templateKey);
          const future = data.slots.filter((s) => s.agentId === a.id && new Date(s.startsAt).getTime() > now);
          return {
            agentId: a.id,
            agentName: a.name,
            templateKey: a.templateKey,
            timeZone: zone,
            slotMinutes: h.slotMinutes,
            horizonDays: h.horizonDays,
            windows: h.windows,
            unset: h.unset,
            openSlots: future.filter((s) => s.status === "open").length,
            bookedSlots: future.filter((s) => s.status === "booked").length,
            fabricatedSlots: future.filter((s) => s.status === "open" && s.fabricated).length,
          };
        }),
    };
  }),

  /** The browser reports its timezone once; it is kept only if the workspace has none yet. */
  adoptTimeZone: mutation((input: { timeZone: string }, { user }) => {
    const u = db().users.find((x) => x.id === user.id);
    if (!u || u.timeZone || !validZone(input.timeZone)) return { adopted: false };
    u.timeZone = input.timeZone;
    save();
    return { adopted: true };
  }),

  setTimeZone: mutation((input: { timeZone: string }, { user }) => {
    if (!validZone(input.timeZone)) throw new RpcError("Choose a real timezone.");
    const data = db();
    const u = data.users.find((x) => x.id === user.id);
    if (!u) throw new RpcError("Please sign in again.", 401);
    u.timeZone = input.timeZone;
    save();
    let created = 0;
    for (const h of data.hours.filter((x) => data.agents.some((a) => a.id === x.agentId && a.userId === user.id))) {
      if (!h.unset && h.windows.length) created += regenerateSlots(user.id, h).created;
    }
    return { created };
  }),

  suggest: mutation((input: { agentId: string }, { user }) => {
    const agent = db().agents.find((a) => a.id === input.agentId && a.userId === user.id);
    if (!agent) throw new RpcError("This receptionist is gone.", 404);
    return { windows: suggestedWindows(agent.templateKey), slotMinutes: agent.templateKey === "salon" ? 45 : 30 };
  }),

  save: mutation((input: { agentId: string; windows: HoursWindow[]; slotMinutes: number; horizonDays: number }, { user }) => {
    const data = db();
    const agent = data.agents.find((a) => a.id === input.agentId && a.userId === user.id);
    if (!agent) throw new RpcError("This receptionist is gone.", 404);
    if (!data.users.find((u) => u.id === user.id)?.timeZone) throw new RpcError("Set your timezone first.");
    const windows = (input.windows ?? [])
      .map((w) => ({ weekday: Number(w.weekday), startMin: Number(w.startMin), endMin: Number(w.endMin) }))
      .filter((w) => w.weekday >= 0 && w.weekday <= 6 && w.startMin >= 0 && w.endMin <= 1440);
    if (windows.some((w) => w.endMin <= w.startMin)) throw new RpcError("A closing time has to be after its opening time.");
    const h = hoursFor(agent.id, agent.templateKey);
    h.windows = windows;
    h.slotMinutes = Math.min(480, Math.max(5, Math.round(input.slotMinutes) || 30));
    h.horizonDays = Math.min(120, Math.max(1, Math.round(input.horizonDays) || 14));
    h.unset = windows.length === 0;
    save();
    return regenerateSlots(user.id, h);
  }),
};
