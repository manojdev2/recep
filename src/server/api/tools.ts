import "server-only";
import crypto from "node:crypto";
import { newId } from "@/lib/utils";
import { recordProviderEvent } from "../ai";
import { db, nowIso, save } from "../db";
import { emit, WEBHOOK_EVENTS } from "../events";
import { allow, clientIp } from "../rate-limit";
import { mutation, publicMutation, publicQuery, query, RpcError } from "../rpc";
import { numberSetting } from "../settings";
import { slotLabel, workspaceZone, zonedInstant } from "../slots";
import type { Form, FormField, LeadStatus, MessagingChannel } from "../types";

function formRow(f: Form) {
  return { ...f, submissions: db().formSubmissions.filter((s) => s.formId === f.id).length };
}

function cleanFields(fields: FormField[]) {
  return (fields ?? []).slice(0, 40).map((f) => ({
    id: String(f.id || newId("fld").slice(0, 10)).slice(0, 40),
    label: String(f.label || "Field").slice(0, 120),
    type: (["text", "email", "phone", "textarea", "select"].includes(f.type) ? f.type : "text") as FormField["type"],
    required: !!f.required,
    options: String(f.options ?? "").slice(0, 1000),
  }));
}

async function sendWhatsApp(cfg: Record<string, string>, to: string, body: string) {
  const started = Date.now();
  const res = await fetch(`https://graph.facebook.com/v20.0/${encodeURIComponent(cfg.phoneNumberId)}/messages`, {
    method: "POST",
    headers: { authorization: `Bearer ${cfg.token}`, "content-type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: to.replace(/[^\d]/g, ""), type: "text", text: { body } }),
    signal: AbortSignal.timeout(15_000),
  });
  recordProviderEvent("whatsapp", "send", res.ok, Date.now() - started, res.ok ? null : String(res.status));
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new RpcError(err.error?.message ?? `WhatsApp answered ${res.status}.`);
  }
}

async function sendGmail(cfg: Record<string, string>, to: string, body: string) {
  const raw = Buffer.from(
    [`From: ${cfg.from}`, `To: ${to}`, "Subject: A message from Reception AI", "Content-Type: text/plain; charset=utf-8", "", body].join("\r\n"),
  )
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const started = Date.now();
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { authorization: `Bearer ${cfg.token}`, "content-type": "application/json" },
    body: JSON.stringify({ raw }),
    signal: AbortSignal.timeout(15_000),
  });
  recordProviderEvent("gmail", "send", res.ok, Date.now() - started, res.ok ? null : String(res.status));
  if (!res.ok) throw new RpcError(`Gmail answered ${res.status}. Check the access token has gmail.send.`);
}

export const tools = {
  events: query(() => [...WEBHOOK_EVENTS]),

  overview: query((_: void, { user }) => {
    const d = db();
    const mine = <T extends { userId: string }>(rows: T[]) => rows.filter((r) => r.userId === user.id);
    return {
      forms: mine(d.forms).length,
      webhooks: mine(d.webhooks).length,
      leads: mine(d.leads).length,
      booked: mine(d.slots).filter((s) => s.status === "booked").length,
      phones: mine(d.phoneNumbers).length,
      sheets: d.sheets.filter((s) => s.userId === user.id && s.spreadsheetId).length,
      messaging: mine(d.messaging).filter((m) => m.status === "connected").length,
      agents: mine(d.agents).length,
    };
  }),

  // ---- Forms ---------------------------------------------------------------------------
  forms: query((_: void, { user }) =>
    db()
      .forms.filter((f) => f.userId === user.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(formRow),
  ),

  form: query((id: string, { user }) => {
    const f = db().forms.find((x) => x.id === id && x.userId === user.id);
    if (!f) return null;
    return {
      form: formRow(f),
      submissions: db()
        .formSubmissions.filter((s) => s.formId === f.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(({ id, createdAt, name, contact, values }) => ({ id, createdAt, name, contact, values })),
    };
  }),

  saveForm: mutation(
    (input: { id?: string; name: string; description: string; agentId?: string; fields: FormField[]; status?: "draft" | "live" }, { user }) => {
      const data = db();
      const now = nowIso();
      if (input.id) {
        const f = data.forms.find((x) => x.id === input.id && x.userId === user.id);
        if (!f) throw new RpcError("This form is gone.", 404);
        f.name = input.name.trim() || "Form";
        f.description = input.description ?? "";
        f.agentId = input.agentId && data.agents.some((a) => a.id === input.agentId && a.userId === user.id) ? input.agentId : "";
        f.fields = cleanFields(input.fields);
        if (input.status) f.status = input.status;
        f.updatedAt = now;
        save();
        return { id: f.id };
      }
      const f: Form = {
        id: newId("frm"),
        userId: user.id,
        name: input.name.trim() || "New form",
        description: input.description ?? "",
        agentId: "",
        fields: cleanFields(input.fields),
        status: input.status ?? "draft",
        createdAt: now,
        updatedAt: now,
      };
      data.forms.push(f);
      save();
      return { id: f.id };
    },
  ),

  removeForm: mutation((id: string, { user }) => {
    const data = db();
    data.forms = data.forms.filter((f) => !(f.id === id && f.userId === user.id));
    data.formSubmissions = data.formSubmissions.filter((s) => s.formId !== id);
    save();
    return { ok: true };
  }),

  publicForm: publicQuery((id: string) => {
    const f = db().forms.find((x) => x.id === id && x.status === "live");
    return f ? { id: f.id, name: f.name, description: f.description, fields: f.fields } : null;
  }),

  submitForm: publicMutation((input: { formId: string; values: Record<string, string> }, ctx) => {
    if (!allow(`form-ip:${clientIp(ctx.req)}`, numberSetting("LIMIT_FORM_IP", 6), 60_000)) throw new RpcError("Too many submissions — try again in a minute.", 429);
    if (!allow(`form:${input.formId}`, numberSetting("LIMIT_FORM_FORM", 120), 60_000)) throw new RpcError("This form is busy. Try again shortly.", 429);
    const data = db();
    const f = data.forms.find((x) => x.id === input.formId && x.status === "live");
    if (!f) throw new RpcError("This form is closed.", 404);
    const values: Record<string, string> = {};
    for (const field of f.fields) {
      const v = String(input.values?.[field.id] ?? "").trim().slice(0, 5000);
      if (field.required && !v) throw new RpcError(`${field.label} is required.`);
      if (v && field.type === "email" && !/^[^@\s]+@[^@\s]+$/.test(v)) throw new RpcError(`${field.label} is not an email address.`);
      values[field.id] = v;
    }
    const name = f.fields.find((x) => /name/i.test(x.label) || x.id === "name")?.id;
    const contactField = f.fields.find((x) => x.type === "phone") ?? f.fields.find((x) => x.type === "email");
    const sub = {
      id: newId("sub"),
      formId: f.id,
      userId: f.userId,
      values,
      name: name ? values[name] : "",
      contact: contactField ? values[contactField.id] : "",
      createdAt: nowIso(),
    };
    data.formSubmissions.push(sub);
    if (sub.name || sub.contact) {
      const now = nowIso();
      const interest = f.fields
        .filter((x) => x.type === "textarea")
        .map((x) => values[x.id])
        .filter(Boolean)
        .join(" — ");
      data.leads.push({
        id: newId("lead"),
        userId: f.userId,
        agentId: f.agentId || null,
        conversationId: null,
        name: sub.name || "Form visitor",
        contact: sub.contact,
        company: "",
        interest: interest || `Submitted ${f.name}`,
        status: "new",
        notes: "",
        source: "form",
        createdAt: now,
        updatedAt: now,
      });
    }
    save();
    emit(f.userId, "form.submitted", { formId: f.id, formName: f.name, name: sub.name, contact: sub.contact, values });
    return { ok: true };
  }),

  // ---- Appointments --------------------------------------------------------------------
  allSlots: query((_: void, { user }) => {
    const data = db();
    const zone = workspaceZone(user.id);
    const since = Date.now() - 7 * 864e5;
    return data.slots
      .filter((s) => s.userId === user.id && new Date(s.startsAt).getTime() > since)
      .sort((a, b) => b.startsAt.localeCompare(a.startsAt))
      .slice(0, 300)
      .map((s) => ({
        id: s.id,
        starts_at: s.startsAt,
        label: slotLabel(s.startsAt, zone),
        agent_name: data.agents.find((a) => a.id === s.agentId)?.name ?? "—",
        status: s.status,
        booked_name: s.bookedName,
        booked_contact: s.bookedContact,
      }));
  }),

  openSlot: mutation((input: { agentId: string; startsAt: string }, { user }) => {
    const data = db();
    const agent = data.agents.find((a) => a.id === input.agentId && a.userId === user.id);
    if (!agent) throw new RpcError("Choose a receptionist.");
    // A bare wall-clock time ("2026-10-20T10:00", from a datetime-local input) is read in the
    // workspace timezone, not the browser's; anything with an offset is taken as given.
    const zone = workspaceZone(user.id);
    const wall = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(input.startsAt ?? "");
    const at = wall
      ? zonedInstant(+wall[1], +wall[2] - 1, +wall[3], +wall[4] * 60 + +wall[5], zone || "UTC")
      : new Date(input.startsAt);
    if (Number.isNaN(at.getTime())) throw new RpcError("Pick a date and time.");
    if (at.getTime() < Date.now()) throw new RpcError("That time has passed.");
    const length = data.hours.find((h) => h.agentId === agent.id)?.slotMinutes ?? 30;
    const end = at.getTime() + length * 60_000;
    const clash = data.slots.find(
      (s) =>
        s.agentId === agent.id &&
        s.status !== "cancelled" &&
        new Date(s.startsAt).getTime() < end &&
        new Date(s.endsAt).getTime() > at.getTime(),
    );
    if (clash) throw new RpcError(`That overlaps ${slotLabel(clash.startsAt, zone)}, already in the diary.`);
    data.slots.push({
      id: newId("slot"),
      userId: user.id,
      agentId: agent.id,
      startsAt: at.toISOString(),
      endsAt: new Date(end).toISOString(),
      status: "open",
      bookedName: "",
      bookedContact: "",
      reason: "",
      confirmation: "",
      conversationId: null,
      bookedAt: null,
      generated: false,
      fabricated: false,
      createdAt: nowIso(),
    });
    save();
    return { ok: true, timeZone: zone };
  }),

  setSlotStatus: mutation((input: { id: string; status: "open" | "cancelled" }, { user }) => {
    const data = db();
    const s = data.slots.find((x) => x.id === input.id && x.userId === user.id);
    if (!s) throw new RpcError("That time is gone.", 404);
    if (input.status !== "open" && input.status !== "cancelled") throw new RpcError("Unknown status.");
    if (input.status === "open") {
      if (s.status === "booked") throw new RpcError("Cancel the booking first.");
      if (data.slots.some((x) => x.id !== s.id && x.agentId === s.agentId && x.startsAt === s.startsAt && x.status !== "cancelled")) {
        throw new RpcError("That time is already in the diary.");
      }
      Object.assign(s, { bookedName: "", bookedContact: "", reason: "", confirmation: "", conversationId: null, bookedAt: null });
    } else if (s.status === "booked" && new Date(s.startsAt).getTime() > Date.now()) {
      // The booking record stays (cancelled); a fresh open time takes its place in the diary.
      data.slots.push({
        ...s,
        id: newId("slot"),
        status: "open",
        bookedName: "",
        bookedContact: "",
        reason: "",
        confirmation: "",
        conversationId: null,
        bookedAt: null,
        createdAt: nowIso(),
      });
    }
    s.status = input.status;
    save();
    return { ok: true };
  }),

  // ---- CRM -----------------------------------------------------------------------------
  setLeadStatus: mutation((input: { id: string; status: LeadStatus }, { user }) => {
    const l = db().leads.find((x) => x.id === input.id && x.userId === user.id);
    if (!l) throw new RpcError("That lead is gone.", 404);
    if (!["new", "qualified", "won", "lost"].includes(input.status)) throw new RpcError("Unknown stage.");
    l.status = input.status;
    l.updatedAt = nowIso();
    save();
    return { ok: true };
  }),

  // ---- Webhooks ------------------------------------------------------------------------
  webhooks: query((_: void, { user }) =>
    db()
      .webhooks.filter((w) => w.userId === user.id)
      .map(({ id, name, url, events, lastStatus, lastAt, createdAt }) => ({ id, name, url, events, lastStatus, lastAt, createdAt })),
  ),

  addWebhook: mutation((input: { name: string; url: string; events: string[] }, { user }) => {
    let url: URL;
    try {
      url = new URL(input.url.trim());
    } catch {
      throw new RpcError("Paste a full https:// address.");
    }
    if (url.protocol !== "https:" && !/^(localhost|127\.0\.0\.1)$/.test(url.hostname)) throw new RpcError("Webhooks must use https.");
    const hook = {
      id: newId("whk"),
      userId: user.id,
      name: input.name.trim() || "Events",
      url: url.toString(),
      events: (input.events ?? []).filter((e) => (WEBHOOK_EVENTS as readonly string[]).includes(e)),
      secret: crypto.randomBytes(24).toString("hex"),
      lastStatus: "",
      lastAt: null,
      createdAt: nowIso(),
    };
    db().webhooks.push(hook);
    save();
    return { id: hook.id, secret: hook.secret };
  }),

  pingWebhook: mutation(async (id: string, { user }) => {
    const hook = db().webhooks.find((w) => w.id === id && w.userId === user.id);
    if (!hook) throw new RpcError("That endpoint is gone.", 404);
    const body = JSON.stringify({ event: "ping", at: nowIso(), data: { hello: "from Reception AI" } });
    const signature = crypto.createHmac("sha256", hook.secret).update(body).digest("hex");
    let status = "error";
    try {
      const res = await fetch(hook.url, {
        method: "POST",
        headers: { "content-type": "application/json", "x-reception-event": "ping", "x-reception-signature": `sha256=${signature}` },
        body,
        signal: AbortSignal.timeout(10_000),
      });
      status = String(res.status);
    } catch {
      status = "unreachable";
    }
    hook.lastStatus = status;
    hook.lastAt = nowIso();
    save();
    return { status };
  }),

  removeWebhook: mutation((id: string, { user }) => {
    const data = db();
    data.webhooks = data.webhooks.filter((w) => !(w.id === id && w.userId === user.id));
    save();
    return { ok: true };
  }),

  // ---- Google Sheets -------------------------------------------------------------------
  sheet: query((_: void, { user }) => {
    const s = db().sheets.find((x) => x.userId === user.id);
    return s
      ? {
          connection_id: s.connectionId,
          spreadsheet_id: s.spreadsheetId,
          sheet_name: s.sheetName,
          push_appointments: s.pushAppointments,
          push_forms: s.pushForms,
          push_leads: s.pushLeads,
        }
      : null;
  }),

  saveSheet: mutation(
    (
      input: { connectionId: string; spreadsheetId: string; sheetName: string; pushAppointments: boolean; pushForms: boolean; pushLeads: boolean },
      { user },
    ) => {
      const data = db();
      if (!input.connectionId || !data.connections.some((c) => c.id === input.connectionId && c.userId === user.id)) {
        throw new RpcError("Connect Google Sheets first.");
      }
      const id = input.spreadsheetId.trim().replace(/^.*\/d\/([^/]+).*$/, "$1");
      if (!id) throw new RpcError("Paste the spreadsheet ID (or its link).");
      const row = {
        userId: user.id,
        connectionId: input.connectionId,
        spreadsheetId: id,
        sheetName: input.sheetName.trim() || "Reception AI",
        pushAppointments: !!input.pushAppointments,
        pushForms: !!input.pushForms,
        pushLeads: !!input.pushLeads,
        updatedAt: nowIso(),
      };
      data.sheets = [...data.sheets.filter((s) => s.userId !== user.id), row];
      save();
      return { ok: true };
    },
  ),

  // ---- Messaging -----------------------------------------------------------------------
  messaging: query((_: void, { user }) =>
    db()
      .messaging.filter((m) => m.userId === user.id)
      .map((m) => ({ ...m, config: { ...m.config, token: m.config.token ? "••••••••" : "" } })),
  ),

  saveMessaging: mutation((input: { id?: string; kind: "whatsapp" | "email"; label: string; config: Record<string, string> }, { user }) => {
    const data = db();
    const existing = input.id ? data.messaging.find((m) => m.id === input.id && m.userId === user.id) : undefined;
    const config = { ...(existing?.config ?? {}) };
    for (const [k, v] of Object.entries(input.config ?? {})) if (v && v !== "••••••••") config[k] = String(v).trim();
    const required = input.kind === "whatsapp" ? ["phoneNumberId", "token"] : ["from", "token"];
    const missing = required.filter((k) => !config[k]);
    const row: MessagingChannel = existing ?? {
      id: newId("msgc"),
      userId: user.id,
      kind: input.kind,
      label: input.label,
      config,
      status: "off",
      lastError: "",
      createdAt: nowIso(),
    };
    row.config = config;
    row.status = missing.length ? "off" : "connected";
    row.lastError = missing.length ? `Missing ${missing.join(", ")}` : "";
    if (!existing) data.messaging.push(row);
    save();
    return { id: row.id, status: row.status };
  }),

  testMessaging: mutation(async (input: { id: string; to: string; body: string }, { user }) => {
    const row = db().messaging.find((m) => m.id === input.id && m.userId === user.id);
    if (!row) throw new RpcError("Save the channel first.");
    if (!input.to.trim()) throw new RpcError("Add a recipient.");
    try {
      if (row.kind === "whatsapp") await sendWhatsApp(row.config, input.to.trim(), input.body);
      else await sendGmail(row.config, input.to.trim(), input.body);
      row.status = "connected";
      row.lastError = "";
    } catch (err) {
      row.status = "error";
      row.lastError = err instanceof Error ? err.message : "Could not send";
      save();
      throw err;
    }
    save();
    return { ok: true };
  }),
};
