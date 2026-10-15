import "server-only";
import { newId } from "@/lib/utils";
import { recordProviderEvent } from "../ai";
import { seal, unseal } from "../crypto";
import { db, nowIso, save } from "../db";
import { RpcError } from "../rpc";
import { appUrl, getSetting } from "../settings";
import type { PhoneNumber } from "../types";
import { assertNumberSlot } from "../usage";

export function publicPhone(n: PhoneNumber) {
  return {
    id: n.id,
    e164: n.e164,
    label: n.label,
    provider: n.provider,
    smsEnabled: n.smsEnabled,
    agentId: n.agentId,
    sipUri: n.sipUri,
    status: n.status,
    createdAt: n.createdAt,
  };
}

function normalize(raw: string, dial: string) {
  const digits = raw.replace(/[^\d+]/g, "");
  if (!digits) return "";
  if (digits.startsWith("+")) return digits;
  return `${dial}${digits.replace(/^0+/, "")}`;
}

function add(userId: string, n: Omit<PhoneNumber, "id" | "userId" | "createdAt">) {
  assertNumberSlot(userId);
  const data = db();
  if (data.phoneNumbers.some((p) => p.e164 === n.e164 && p.userId === userId)) throw new RpcError(`${n.e164} is already in this workspace.`);
  const row: PhoneNumber = { ...n, id: newId("num"), userId, createdAt: nowIso() };
  data.phoneNumbers.push(row);
  save();
  return row;
}

/** A fictional number for clicking around without a carrier. */
export function testNumber(userId: string, label: string) {
  const tail = String(Math.floor(Math.random() * 100)).padStart(2, "0");
  const e164 = `+1555010${tail}${Math.floor(Math.random() * 10)}`.slice(0, 12);
  return add(userId, {
    e164,
    label,
    provider: "aether",
    smsEnabled: false,
    agentId: null,
    sipUri: null,
    status: "active",
    secret: null,
    providerSid: null,
  });
}

async function twilioFetch(sid: string, token: string, path: string, init?: RequestInit) {
  const started = Date.now();
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}${path}`, {
    ...init,
    headers: {
      authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
      ...(init?.body ? { "content-type": "application/x-www-form-urlencoded" } : {}),
    },
    signal: AbortSignal.timeout(15_000),
  });
  recordProviderEvent("twilio", path.split("/")[1]?.split(".")[0] ?? "api", res.ok, Date.now() - started, res.ok ? null : String(res.status));
  return res;
}

export async function twilioConfigure(sid: string, token: string, numberSid: string) {
  const base = appUrl();
  if (/localhost|127\.0\.0\.1/.test(base)) {
    return { configured: false, error: "APP_URL is a local address, so Twilio cannot reach it. Set a public APP_URL first." };
  }
  const res = await twilioFetch(sid, token, `/IncomingPhoneNumbers/${numberSid}.json`, {
    method: "POST",
    body: new URLSearchParams({
      VoiceUrl: `${base}/api/voice/inbound`,
      VoiceMethod: "POST",
      StatusCallback: `${base}/api/voice/status`,
      StatusCallbackMethod: "POST",
    }).toString(),
  });
  if (!res.ok) return { configured: false, error: `Twilio answered ${res.status}.` };
  return { configured: true, voiceUrl: `${base}/api/voice/inbound` };
}

async function verifyTwilio(e164: string, cfg: Record<string, string>) {
  const res = await twilioFetch(cfg.sid, cfg.token, `/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(e164)}`);
  if (res.status === 401) throw new RpcError("Twilio refused those credentials. Check the Account SID and Auth Token.");
  if (!res.ok) throw new RpcError(`Twilio answered ${res.status}.`);
  const body = await res.json();
  const match = body.incoming_phone_numbers?.[0];
  if (!match) throw new RpcError(`${e164} is not a number on that Twilio account.`);
  return { sid: match.sid as string, sms: !!match.capabilities?.sms };
}

async function plivoFetch(authId: string, token: string, path: string, init?: RequestInit) {
  const started = Date.now();
  const res = await fetch(`https://api.plivo.com/v1/Account/${encodeURIComponent(authId)}${path}`, {
    ...init,
    headers: {
      authorization: `Basic ${Buffer.from(`${authId}:${token}`).toString("base64")}`,
      "content-type": "application/json",
    },
    signal: AbortSignal.timeout(15_000),
  });
  recordProviderEvent("plivo", "api", res.ok, Date.now() - started, res.ok ? null : String(res.status));
  return res;
}

export async function plivoConfigure(authId: string, token: string, e164: string) {
  const base = appUrl();
  if (/localhost|127\.0\.0\.1/.test(base)) return { configured: false, error: "APP_URL is a local address, so Plivo cannot reach it." };
  const app = await plivoFetch(authId, token, "/Application/", {
    method: "POST",
    body: JSON.stringify({ app_name: `Reception AI ${e164}`, answer_url: `${base}/api/voice/plivo`, answer_method: "POST" }),
  });
  if (!app.ok) return { configured: false, error: `Plivo answered ${app.status} creating the application.` };
  const appId = (await app.json()).app_id;
  const link = await plivoFetch(authId, token, `/Number/${e164.replace("+", "")}/`, { method: "POST", body: JSON.stringify({ app_id: appId }) });
  if (!link.ok) return { configured: false, error: `Plivo answered ${link.status} linking the number.` };
  return { configured: true, voiceUrl: `${base}/api/voice/plivo` };
}

export async function importNumber(
  userId: string,
  input: {
    provider: string;
    e164?: string;
    dial: string;
    label?: string;
    smsEnabled: boolean;
    autoConfigure: boolean;
    config: Record<string, string>;
  },
) {
  const cfg = Object.fromEntries(Object.entries(input.config ?? {}).map(([k, v]) => [k, String(v).trim()]));
  const label = input.label?.trim() || "";
  if (input.provider === "aether") {
    const n = testNumber(userId, label || "Test line");
    if (!input.smsEnabled) n.smsEnabled = false;
    return { ...publicPhone(n), webhook: null };
  }
  if (input.provider === "aether-sip") {
    const id = newId("sip").slice(4, 14);
    const n = add(userId, {
      e164: `+1000${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`,
      label: label || "Test SIP address",
      provider: "aether-sip",
      smsEnabled: false,
      agentId: null,
      sipUri: `sip:${id}@sip.reception.test`,
      status: "active",
      secret: null,
      providerSid: null,
    });
    return { ...publicPhone(n), webhook: null };
  }

  const e164 = normalize(input.e164 ?? "", input.dial);
  if (!/^\+\d{7,15}$/.test(e164)) throw new RpcError("Enter the full number, with its country code.");

  if (input.provider === "twilio") {
    if (!cfg.sid || !cfg.token) throw new RpcError("Add the Twilio Account SID and Auth Token.");
    const found = await verifyTwilio(e164, cfg);
    const n = add(userId, {
      e164,
      label: label || "Twilio line",
      provider: "twilio",
      smsEnabled: input.smsEnabled && found.sms,
      agentId: null,
      sipUri: null,
      status: "active",
      secret: seal({ sid: cfg.sid, token: cfg.token }),
      providerSid: found.sid,
    });
    const webhook = input.autoConfigure ? await twilioConfigure(cfg.sid, cfg.token, found.sid) : null;
    return { ...publicPhone(n), webhook };
  }

  if (input.provider === "plivo") {
    const authId = cfg.authId || getSetting("PLIVO_AUTH_ID");
    const authToken = cfg.authToken || getSetting("PLIVO_AUTH_TOKEN");
    if (!authId || !authToken) throw new RpcError("Add the Plivo Auth ID and Auth Token.");
    const res = await plivoFetch(authId, authToken, `/Number/${e164.replace("+", "")}/`);
    if (res.status === 401) throw new RpcError("Plivo refused those credentials.");
    if (res.status === 404) throw new RpcError(`${e164} is not a number on that Plivo account.`);
    if (!res.ok) throw new RpcError(`Plivo answered ${res.status}.`);
    const n = add(userId, {
      e164,
      label: label || "Plivo line",
      provider: "plivo",
      smsEnabled: input.smsEnabled,
      agentId: null,
      sipUri: null,
      status: "active",
      secret: seal({ authId, authToken }),
      providerSid: null,
    });
    return { ...publicPhone(n), webhook: null };
  }

  if (input.provider === "vonage") {
    if (!cfg.apiKey || !cfg.apiSecret) throw new RpcError("Add the Vonage API key and secret.");
    const started = Date.now();
    const res = await fetch(
      `https://rest.nexmo.com/account/numbers?api_key=${encodeURIComponent(cfg.apiKey)}&api_secret=${encodeURIComponent(cfg.apiSecret)}&pattern=${e164.replace("+", "")}&search_pattern=0`,
      { signal: AbortSignal.timeout(15_000) },
    );
    recordProviderEvent("vonage", "numbers", res.ok, Date.now() - started, res.ok ? null : String(res.status));
    if (res.status === 401) throw new RpcError("Vonage refused those credentials.");
    if (!res.ok) throw new RpcError(`Vonage answered ${res.status}.`);
    const body = await res.json();
    if (!body.count) throw new RpcError(`${e164} is not a number on that Vonage account.`);
    const n = add(userId, {
      e164,
      label: label || "Vonage line",
      provider: "vonage",
      smsEnabled: input.smsEnabled,
      agentId: null,
      sipUri: null,
      status: "active",
      secret: seal({ apiKey: cfg.apiKey, apiSecret: cfg.apiSecret }),
      providerSid: null,
    });
    return { ...publicPhone(n), webhook: null };
  }

  if (input.provider === "telnyx") {
    if (!cfg.token) throw new RpcError("Add the Telnyx API key.");
    const started = Date.now();
    const res = await fetch(`https://api.telnyx.com/v2/phone_numbers?filter[phone_number]=${encodeURIComponent(e164)}`, {
      headers: { authorization: `Bearer ${cfg.token}` },
      signal: AbortSignal.timeout(15_000),
    });
    recordProviderEvent("telnyx", "numbers", res.ok, Date.now() - started, res.ok ? null : String(res.status));
    if (res.status === 401) throw new RpcError("Telnyx refused that key.");
    if (!res.ok) throw new RpcError(`Telnyx answered ${res.status}.`);
    const body = await res.json();
    if (!body.data?.length) throw new RpcError(`${e164} is not a number on that Telnyx account.`);
    const n = add(userId, {
      e164,
      label: label || "Telnyx line",
      provider: "telnyx",
      smsEnabled: input.smsEnabled,
      agentId: null,
      sipUri: null,
      status: "active",
      secret: seal({ token: cfg.token, connectionId: body.data[0].connection_id ?? "" }),
      providerSid: body.data[0].id ?? null,
    });
    return { ...publicPhone(n), webhook: null };
  }

  if (input.provider === "sip") {
    if (!cfg.sipUri || !cfg.username || !cfg.password) throw new RpcError("Add the SIP URI, username and password.");
    const n = add(userId, {
      e164,
      label: label || "SIP trunk",
      provider: "sip",
      smsEnabled: false,
      agentId: null,
      sipUri: cfg.sipUri,
      status: "active",
      secret: seal({ username: cfg.username, password: cfg.password }),
      providerSid: null,
    });
    return { ...publicPhone(n), webhook: null };
  }

  throw new RpcError("That provider is not supported.");
}

export async function pointNumber(userId: string, id: string) {
  const n = db().phoneNumbers.find((p) => p.id === id && p.userId === userId);
  if (!n) throw new RpcError("That number is gone.", 404);
  const creds = unseal<Record<string, string>>(n.secret);
  if (!creds) throw new RpcError("The carrier credentials for this number are missing.");
  const result =
    n.provider === "twilio" && n.providerSid
      ? await twilioConfigure(creds.sid, creds.token, n.providerSid)
      : n.provider === "plivo"
        ? await plivoConfigure(creds.authId, creds.authToken, n.e164)
        : { configured: false, error: "This carrier cannot be pointed automatically." };
  if (!result.configured || !("voiceUrl" in result)) throw new RpcError(result.error ?? "Could not update the carrier.");
  return { voiceUrl: result.voiceUrl as string };
}

export function removeNumber(userId: string, id: string) {
  const data = db();
  const n = data.phoneNumbers.find((p) => p.id === id && p.userId === userId);
  if (!n) throw new RpcError("That number is gone.", 404);
  data.phoneNumbers = data.phoneNumbers.filter((p) => p.id !== id);
  for (const c of data.campaigns) if (c.phoneId === id) c.phoneId = null;
  save();
  const note =
    n.provider === "aether" || n.provider === "aether-sip"
      ? "It was a test line."
      : "It is still yours on the carrier — point its webhook elsewhere if you no longer use it.";
  return { e164: n.e164, note };
}
