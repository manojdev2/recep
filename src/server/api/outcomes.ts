import "server-only";
import { db } from "../db";
import { mutation, query, RpcError } from "../rpc";
import { regenerateSlots, slotLabel, upcomingSlots, workspaceZone } from "../slots";

const agentName = (id: string | null) => db().agents.find((a) => a.id === id)?.name ?? "—";

export const outcomes = {
  /** The diary for one receptionist (studio Hours tab). */
  slots: query((agentId: string, { user }) => {
    if (!db().agents.some((a) => a.id === agentId && a.userId === user.id)) return [];
    return upcomingSlots(agentId)
      .slice(0, 200)
      .map(({ id, startsAt, status, bookedName, bookedContact }) => ({ id, startsAt, status, bookedName, bookedContact }));
  }),

  generate: mutation((agentId: string, { user }) => {
    const data = db();
    if (!data.agents.some((a) => a.id === agentId && a.userId === user.id)) throw new RpcError("This receptionist is gone.", 404);
    const hours = data.hours.find((h) => h.agentId === agentId);
    if (!hours || !workspaceZone(user.id)) return { created: 0, removed: 0, orphanedBookings: 0 };
    return regenerateSlots(user.id, hours);
  }),

  bookings: query((_: void, { user }) => {
    const zone = workspaceZone(user.id);
    return db()
      .slots.filter((s) => s.userId === user.id && s.status === "booked")
      .sort((a, b) => b.startsAt.localeCompare(a.startsAt))
      .map((s) => ({
        id: s.id,
        label: slotLabel(s.startsAt, zone),
        startsAt: s.startsAt,
        bookedName: s.bookedName,
        bookedContact: s.bookedContact,
        agentName: agentName(s.agentId),
      }));
  }),

  leads: query((_: void, { user }) =>
    db()
      .leads.filter((l) => l.userId === user.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((l) => ({ ...l, agentName: agentName(l.agentId) })),
  ),

  tickets: query((_: void, { user }) =>
    db()
      .tickets.filter((t) => t.userId === user.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((t) => ({ ...t, agentName: agentName(t.agentId) })),
  ),
};
