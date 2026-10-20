import "server-only";
import crypto from "node:crypto";
import { unseal } from "./crypto";
import { db, nowIso, save } from "./db";
import { registerJob } from "./jobs";
import { recordProviderEvent } from "./ai";

registerJob("webhook.deliver", async (p) => {
  const hook = db().webhooks.find((w) => w.id === p.webhookId);
  if (!hook) return;
  const body = JSON.stringify({ event: p.event, at: p.at, data: p.data });
  const signature = crypto.createHmac("sha256", hook.secret).update(body).digest("hex");
  const started = Date.now();
  let status = "error";
  try {
    const res = await fetch(hook.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "Azentoo-Webhooks/1.0",
        "x-azentoo-event": String(p.event),
        "x-azentoo-signature": `sha256=${signature}`,
      },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    status = String(res.status);
    recordProviderEvent("webhook", String(p.event), res.ok, Date.now() - started, res.ok ? null : status);
  } catch (err) {
    recordProviderEvent("webhook", String(p.event), false, Date.now() - started, err instanceof Error ? err.message : "network");
  } finally {
    hook.lastStatus = status;
    hook.lastAt = nowIso();
    save();
  }
  if (!status.startsWith("2")) throw new Error(`Endpoint answered ${status}`);
});

function sheetRow(event: string, data: Record<string, unknown>, at: string) {
  const s = (v: unknown) => (v == null ? "" : String(v));
  switch (event) {
    case "appointment.booked":
      return [at, "Booking", s(data.when), s(data.name), s(data.contact), s(data.reason), s(data.agentName)];
    case "lead.created":
      return [at, "Lead", s(data.name), s(data.contact), s(data.company), s(data.interest), s(data.agentName)];
    case "form.submitted":
      return [at, "Form", s(data.formName), s(data.name), s(data.contact), JSON.stringify(data.values ?? {}), ""];
    default:
      return [at, event, JSON.stringify(data)];
  }
}

registerJob("sheets.append", async (p) => {
  const d = db();
  const dest = d.sheets.find((s) => s.userId === p.userId);
  const conn = dest && d.connections.find((c) => c.id === dest.connectionId);
  if (!dest || !conn) return;
  const creds = unseal<{ token?: string }>(conn.secret);
  if (!creds?.token) throw new Error("Google Sheets token missing");
  const range = encodeURIComponent(`${dest.sheetName || "Azentoo"}!A1`);
  const started = Date.now();
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(dest.spreadsheetId)}/values/${range}:append?valueInputOption=USER_ENTERED`,
    {
      method: "POST",
      headers: { authorization: `Bearer ${creds.token}`, "content-type": "application/json" },
      body: JSON.stringify({ values: [sheetRow(String(p.event), (p.data ?? {}) as Record<string, unknown>, String(p.at))] }),
      signal: AbortSignal.timeout(10_000),
    },
  );
  recordProviderEvent("google", "sheets.append", res.ok, Date.now() - started, res.ok ? null : String(res.status));
  if (!res.ok) throw new Error(`Sheets answered ${res.status}`);
});

registerJob("campaign.tick", async (p) => {
  const { dialNext } = await import("./telephony/campaigns");
  const result = await dialNext(String(p.campaignId), 3);
  if (result.remaining > 0 && result.reason !== "paused") {
    const { enqueue } = await import("./jobs");
    enqueue("campaign.tick", { campaignId: p.campaignId }, result.reason === "outside window" ? 15 * 60_000 : 2 * 60_000);
  }
});

registerJob("call.reconcile", async (p) => {
  const { reconcileCall } = await import("./telephony/calls");
  await reconcileCall(String(p.callId));
});
