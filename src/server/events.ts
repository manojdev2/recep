import "server-only";
import { db } from "./db";
import { enqueue } from "./jobs";

export const WEBHOOK_EVENTS = ["appointment.booked", "lead.created", "form.submitted", "call.completed"] as const;
export type EventName = (typeof WEBHOOK_EVENTS)[number];

/** Fan an event out to the workspace's webhooks and Google Sheet. */
export function emit(userId: string, event: EventName, data: Record<string, unknown>) {
  const d = db();
  for (const hook of d.webhooks.filter((w) => w.userId === userId)) {
    if (hook.events.length && !hook.events.includes(event)) continue;
    enqueue("webhook.deliver", { webhookId: hook.id, event, data, at: new Date().toISOString() });
  }
  const sheet = d.sheets.find((s) => s.userId === userId);
  if (sheet?.spreadsheetId && sheet.connectionId) {
    const wanted =
      (event === "appointment.booked" && sheet.pushAppointments) ||
      (event === "form.submitted" && sheet.pushForms) ||
      (event === "lead.created" && sheet.pushLeads);
    if (wanted) enqueue("sheets.append", { userId, event, data, at: new Date().toISOString() });
  }
}
