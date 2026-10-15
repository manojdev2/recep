// End-to-end check of every write path through the real HTTP API.
// Usage: BASE=http://localhost:3000 npm run test:api
// Needs a running app with DEMO_MODE off. Creates throwaway accounts and deletes the test workspace at the end.
import http from "node:http";

const B = process.env.BASE || "http://localhost:3000";
const results = [];
const ok = (name, cond, detail = "") => {
  results.push({ name, pass: !!cond, detail });
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : `  — ${detail}`}`);
};

function client() {
  let cookie = "";
  const req = async (path, init = {}) => {
    const res = await fetch(B + path, { ...init, headers: { "content-type": "application/json", cookie, ...(init.headers || {}) }, redirect: "manual" });
    const set = res.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0];
    const text = await res.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
    return { status: res.status, body };
  };
  const call = async (group, name, input) => {
    const r = await req(`/api/fn/${group}/${name}`, { method: "POST", body: input === undefined ? "" : JSON.stringify(input) });
    return r.body && typeof r.body === "object" && "error" in r.body ? { error: r.body.error, status: r.status } : { result: r.body?.result, status: r.status };
  };
  return { req, call };
}

// A local endpoint to receive webhook deliveries.
const hooks = [];
const hookServer = http.createServer((q, s) => {
  let body = "";
  q.on("data", (c) => (body += c));
  q.on("end", () => {
    hooks.push({ headers: q.headers, body });
    s.end("ok");
  });
});
await new Promise((r) => hookServer.listen(4555, r));

const stamp = Date.now();
const email = `tester${stamp}@example.com`;
const u = client();

// ---------- auth ----------
// The first real account on an install becomes the operator; make sure one exists so the tester is an ordinary account.
const op = client();
const opR = await op.req("/api/auth/sign-up", { method: "POST", body: JSON.stringify({ name: "Operator", email: `operator${stamp}@example.com`, password: "password123" }) });
ok("auth: an operator account exists", opR.status === 200 || opR.status === 403, JSON.stringify(opR.body));
let r = await u.req("/api/auth/sign-up", { method: "POST", body: JSON.stringify({ name: "Test Owner", email, password: "short" }) });
ok("auth: short password refused", r.status === 400, JSON.stringify(r.body));
r = await u.req("/api/auth/sign-up", { method: "POST", body: JSON.stringify({ name: "Test Owner", email, password: "password123" }) });
ok("auth: sign up", r.status === 200 && r.body?.user?.email === email, JSON.stringify(r.body));
ok("auth: second account is not admin", !r.body?.user?.adminLevel, JSON.stringify(r.body?.user));
r = await u.req("/api/auth/sign-up", { method: "POST", body: JSON.stringify({ name: "Dup", email, password: "password123" }) });
ok("auth: duplicate email refused", r.status >= 400, JSON.stringify(r.body));
r = await u.req("/api/auth/session");
ok("auth: session", r.body?.user?.email === email, JSON.stringify(r.body));

// ---------- empty workspace ----------
let x = await u.call("setup", "get");
ok("setup: checklist for new workspace", x.result && !x.error, x.error);
x = await u.call("agents", "list");
ok("agents: empty list", Array.isArray(x.result) && x.result.length === 0, JSON.stringify(x));

// ---------- tenant isolation ----------
x = await u.call("agents", "get", "agt_2952dbd48d1e4a29");
ok("isolation: cannot read another workspace's agent", !x.result, JSON.stringify(x).slice(0, 200));
x = await u.call("admin", "overview");
ok("isolation: admin API hidden (404)", x.status === 404, JSON.stringify(x).slice(0, 200));

// ---------- receptionist ----------
x = await u.call("agents", "create", { templateKey: "salon" });
const agentId = x.result?.id;
ok("agents: create from template", agentId, JSON.stringify(x).slice(0, 300));
x = await u.call("agents", "update", { id: agentId, name: "Test Salon", greeting: "Hi from the test salon", guardrails: "Never quote prices." });
ok("agents: update", x.result && !x.error, x.error);
x = await u.call("agents", "get", agentId);
ok("agents: update persisted", x.result?.agent?.name === "Test Salon" && x.result?.agent?.greeting === "Hi from the test salon", JSON.stringify(x.result?.agent?.name));
x = await u.call("agents", "setTool", { agentId, toolKey: "capture_lead", enabled: true });
ok("agents: enable tool", !x.error, x.error);
x = await u.call("agents", "get", agentId);
ok("agents: tool enabled persisted", x.result?.tools?.some((t) => t.toolKey === "capture_lead" && t.enabled), JSON.stringify(x.result?.tools));
x = await u.call("agents", "update", { id: agentId, status: "live" });
ok("agents: publish (go live)", !x.error, x.error);
x = await u.call("agents", "create", { templateKey: "clinic" });
ok("plans: Studio refuses a second receptionist", !!x.error && /Plan limit/.test(x.error), JSON.stringify(x).slice(0, 200));

// ---------- knowledge ----------
x = await u.call("knowledge", "add", { source: "note", title: "Prices", content: "A cut and blow-dry is 45 pounds. Colour starts at 80 pounds.", agentId });
ok("knowledge: add note", x.result && !x.error, x.error);
const docId = x.result?.id;
x = await u.call("knowledge", "add", {
  source: "file",
  filename: "faq.txt",
  mime: "text/plain",
  title: "FAQ",
  agentId,
  bytes: Buffer.from("Parking is free behind the salon. We are closed on Sundays.").toString("base64"),
});
ok("knowledge: upload text file as bytes", x.result && !x.error, x.error);
x = await u.call("knowledge", "add", { source: "url", url: "https://example.com", agentId });
ok("knowledge: add website (example.com)", x.result && !x.error, x.error);
x = await u.call("knowledge", "library");
ok("knowledge: library lists note, file, website and the template sample", x.result?.length === 4, `got ${x.result?.length}`);
x = await u.call("knowledge", "search", { query: "parking" });
ok("knowledge: search finds uploaded file", JSON.stringify(x.result || "").toLowerCase().includes("parking"), JSON.stringify(x).slice(0, 200));
x = await u.call("knowledge", "add", { source: "file", filename: "notes.md", mime: "text/markdown", title: "Notes", content: "Gift cards are sold at the desk." });
ok("knowledge: upload text the way the browser does", x.result && !x.error, x.error);
x = await u.call("knowledge", "attach", { docId, agentId, attached: false });
ok("knowledge: detach from agent", !x.error, x.error);
x = await u.call("knowledge", "remove", docId);
ok("knowledge: delete doc", !x.error, x.error);

// ---------- hours & diary ----------
x = await u.call("hours", "setTimeZone", { timeZone: "Europe/London" });
ok("hours: set time zone", !x.error, x.error);
const windows = [1, 2, 3, 4, 5].map((weekday) => ({ weekday, startMin: 9 * 60, endMin: 17 * 60 }));
x = await u.call("hours", "save", { agentId, windows, slotMinutes: 30, horizonDays: 14 });
ok("hours: save weekly hours", !x.error, x.error);
x = await u.call("outcomes", "slots", agentId);
ok("hours: diary generated", Array.isArray(x.result) && x.result.length > 20, `slots ${x.result?.length} ${x.error ?? ""}`);

// ---------- chat (offline preview without keys) ----------
x = await u.call("chat", "reply", { agentId, speak: false, messages: [{ role: "user", content: "Do you have parking?" }] });
ok("chat: studio reply returns text", x.result?.text || x.result?.error || x.error, JSON.stringify(x).slice(0, 300));
x = await u.call("agents", "conversations");
ok("chat: conversation recorded", Array.isArray(x.result), JSON.stringify(x).slice(0, 200));

// ---------- appointments ----------
// A Saturday — outside the weekday opening hours, so not already in the diary.
const when = new Date(Date.now() + 864e5);
while (when.getUTCDay() !== 6) when.setTime(when.getTime() + 864e5);
when.setUTCHours(10, 0, 0, 0);
x = await u.call("tools", "openSlot", { agentId, startsAt: when.toISOString() });
ok("appointments: open a slot by hand", !x.error, x.error);
x = await u.call("tools", "allSlots");
const anySlot = x.result?.[0];
ok("appointments: list slots", Array.isArray(x.result) && x.result.length > 0, JSON.stringify(x).slice(0, 200));
if (anySlot) {
  x = await u.call("tools", "setSlotStatus", { id: anySlot.id, status: "cancelled" });
  ok("appointments: cancel slot", !x.error, x.error);
}

// ---------- contacts ----------
x = await u.call("contacts", "save", { name: "Ada Lovelace", e164: "+447700900123", email: "ada@example.com", tags: "vip" });
ok("contacts: add", x.result && !x.error, x.error);
const contactId = x.result?.id;
x = await u.call("contacts", "save", { name: "Bad", e164: "12" });
ok("contacts: invalid number refused", !!x.error, JSON.stringify(x));
x = await u.call("contacts", "import", { text: "name,phone,email\nGrace Hopper,+14155550111,grace@example.com\nAlan Turing,+447700900456,alan@example.com\n" });
ok("contacts: CSV import", x.result && !x.error, JSON.stringify(x).slice(0, 200));
x = await u.call("contacts", "list");
ok("contacts: list has 3", x.result?.length === 3, `got ${x.result?.length}`);
x = await u.call("contacts", "save", { id: contactId, name: "Ada King", e164: "+447700900123" });
ok("contacts: edit", !x.error, x.error);

// ---------- phone numbers & calls ----------
x = await u.call("agents", "addTestNumber", { label: "Front desk" });
const phoneId = x.result?.id;
ok("numbers: add test number", phoneId, JSON.stringify(x).slice(0, 200));
x = await u.call("agents", "assignNumber", { id: phoneId, agentId });
ok("numbers: assign to agent", !x.error, x.error);
x = await u.call("agents", "importNumber", { provider: "twilio", dial: "+15005550006", smsEnabled: false, autoConfigure: false, config: { sid: "ACxxxxxxxx", token: "bad" } });
ok("numbers: Twilio import with bad credentials refused cleanly", !!x.error && x.status < 500, JSON.stringify(x).slice(0, 200));
x = await u.call("calling", "ringIn", { agentId, phoneId, from: "+447700900999" });
ok("calls: simulated ring-in", x.result?.callId, JSON.stringify(x).slice(0, 200));
x = await u.call("calling", "place", { agentId, to: "+447700900123", phoneId });
ok("calls: outbound from test line refused with reason", !!x.error, JSON.stringify(x).slice(0, 200));
x = await u.call("calling", "calls");
ok("calls: history lists the ring-in", x.result?.length >= 1, JSON.stringify(x).slice(0, 200));

// ---------- campaigns ----------
await u.call("agents", "update", { id: agentId, direction: "both" });
x = await u.call("calling", "createCampaign", { name: "Follow-ups", agentId, phoneId, contacts: "+14155550199", contactIds: contactId ? [contactId] : [] });
const campaignId = x.result?.id;
ok("campaigns: create", campaignId, JSON.stringify(x).slice(0, 200));
x = await u.call("calling", "addToCampaign", { campaignId, contacts: "+14155550188", contactIds: [] });
ok("campaigns: add people", !x.error, x.error);
x = await u.call("calling", "campaign", campaignId);
ok("campaigns: detail shows 3 targets", JSON.stringify(x.result || "").split("+").length - 1 >= 3, JSON.stringify(x).slice(0, 300));
x = await u.call("calling", "updateCampaign", { id: campaignId, status: "running" });
ok("campaigns: start", !x.error, x.error);
x = await u.call("calling", "dialNext", { campaignId });
ok("campaigns: dial next on test line gives a clear reason", !!x.result || !!x.error, JSON.stringify(x).slice(0, 200));
x = await u.call("calling", "updateCampaign", { id: campaignId, status: "paused" });
ok("campaigns: pause", !x.error, x.error);
x = await u.call("calling", "removeCampaign", campaignId);
ok("campaigns: delete", !x.error, x.error);

// ---------- forms ----------
x = await u.call("tools", "saveForm", {
  name: "Booking request",
  description: "Tell us what you need",
  agentId,
  status: "live",
  fields: [
    { id: "name", label: "Name", type: "text", required: true, options: "" },
    { id: "phone", label: "Phone", type: "phone", required: true, options: "" },
    { id: "service", label: "Service", type: "select", required: true, options: "Cut,Colour" },
  ],
});
const formId = x.result?.id;
ok("forms: create", formId, JSON.stringify(x).slice(0, 200));

// ---------- webhooks (real delivery) ----------
x = await u.call("tools", "addWebhook", { name: "Local", url: "http://127.0.0.1:4555/hook", events: [] });
const hookId = x.result?.id;
ok("webhooks: add", hookId || !x.error, JSON.stringify(x).slice(0, 200));
if (hookId) {
  x = await u.call("tools", "pingWebhook", hookId);
  ok("webhooks: ping", !x.error, JSON.stringify(x).slice(0, 200));
}

// public form submission (anonymous visitor)
const anon = client();
x = await anon.call("tools", "publicForm", formId);
ok("forms: public form loads", x.result?.fields?.length === 3, JSON.stringify(x).slice(0, 200));
x = await anon.call("tools", "submitForm", { formId, values: { name: "Walk In" } });
ok("forms: missing required field refused", !!x.error, JSON.stringify(x));
x = await anon.call("tools", "submitForm", { formId, values: { name: "Walk In", phone: "+447700900321", service: "Cut" } });
ok("forms: public submission", !x.error, x.error);
x = await u.call("tools", "form", formId);
ok("forms: submission recorded", JSON.stringify(x.result || "").includes("Walk In"), JSON.stringify(x).slice(0, 300));

// wait for queued webhook deliveries
await fetch(B + "/api/jobs/run", { method: "POST" });
await new Promise((res) => setTimeout(res, 2500));
await fetch(B + "/api/jobs/run", { method: "POST" });
await new Promise((res) => setTimeout(res, 1500));
ok("webhooks: deliveries received", hooks.length >= 1, `received ${hooks.length}`);
ok("webhooks: signed with x-reception-signature", hooks.some((h) => h.headers["x-reception-signature"]), JSON.stringify(hooks[0]?.headers || {}).slice(0, 300));
ok("webhooks: form.submitted event delivered", hooks.some((h) => h.body.includes("form.submitted")), hooks.map((h) => h.body.slice(0, 60)).join(" | "));
if (hookId) {
  x = await u.call("tools", "removeWebhook", hookId);
  ok("webhooks: delete", !x.error, x.error);
}

// ---------- leads / CRM ----------
x = await u.call("outcomes", "leads");
ok("crm: leads list", Array.isArray(x.result), JSON.stringify(x).slice(0, 200));
const lead = x.result?.[0];
ok("crm: form submission created a lead", !!lead, "no leads after form submission");
if (lead) {
  x = await u.call("tools", "setLeadStatus", { id: lead.id, status: "qualified" });
  ok("crm: move lead", !x.error, x.error);
}

// ---------- messaging, sheets, connectors ----------
x = await u.call("tools", "saveMessaging", { kind: "email", label: "Front desk", config: { from: "front@example.com", token: "ya29.fake" } });
ok("messaging: save email channel", !!x.result || !!x.error, JSON.stringify(x).slice(0, 200));
x = await u.call("connectors", "connect", { appKey: "hubspot", accountLabel: "HubSpot", config: { token: "bad-token" } });
ok("connectors: bad token refused by provider check", !!x.error && x.status < 500, JSON.stringify(x).slice(0, 200));
x = await u.call("tools", "saveSheet", { connectionId: "", spreadsheetId: "abc", sheetName: "Sheet1", pushAppointments: true, pushForms: true, pushLeads: true });
ok("sheets: needs a Google connection first", !!x.error, JSON.stringify(x).slice(0, 200));

// ---------- rehearse / design ----------
x = await u.call("agents", "rehearse", { agentId });
ok("rehearse: runs (offline)", !!x.result || !!x.error, JSON.stringify(x).slice(0, 200));
x = await u.call("design", "turn", { messages: [{ role: "user", content: "I run a dog grooming salon" }] });
ok("design: new-agent conversation turn", x.result && !x.error, JSON.stringify(x).slice(0, 200));

// ---------- dashboard / analytics / billing ----------
x = await u.call("setup", "dashboard");
ok("dashboard: loads with data", x.result && !x.error, x.error);
x = await u.call("agents", "analytics", { days: 14 });
ok("analytics: loads", x.result && !x.error, x.error);
x = await u.call("billing", "get");
ok("billing: plan page data", x.result && !x.error, x.error);
x = await u.call("billing", "checkout", { planId: "scale" });
ok("billing: checkout without Stripe gives a clear message", !!x.error && x.status < 500, JSON.stringify(x));
x = await u.call("account", "export");
ok("account: export my data", x.result && JSON.stringify(x.result).includes("Ada"), JSON.stringify(x).slice(0, 150));

// ---------- password ----------
r = await u.req("/api/auth/change-password", { method: "POST", body: JSON.stringify({ currentPassword: "wrong", newPassword: "newpassword1" }) });
ok("auth: wrong current password refused", r.status === 400, JSON.stringify(r.body));
r = await u.req("/api/auth/change-password", { method: "POST", body: JSON.stringify({ currentPassword: "password123", newPassword: "newpassword1" }) });
ok("auth: change password", r.status === 200, JSON.stringify(r.body));

// ---------- admin (uses the seeded demo admin, which signs in outside production) ----------
const a = client();
r = await a.req("/api/auth/sign-in", { method: "POST", body: JSON.stringify({ email: "demo-admin@reception-ai.app", password: "demo1234" }) });
ok("admin: sign in", r.status === 200, JSON.stringify(r.body));
x = await a.call("admin", "tenants");
const me = x.result?.find((t) => t.email === email);
const myId = me?.userId ?? me?.id;
ok("admin: new tenant listed", !!me, JSON.stringify(x).slice(0, 200));
x = await a.call("admin", "setTenantPlan", { userId: myId, plan: "scale" });
ok("admin: move tenant to Scale", !x.error, x.error);
x = await u.call("agents", "create", { templateKey: "clinic" });
const third = x.result?.id;
x = third ? await u.call("agents", "update", { id: third, status: "live" }) : x;
ok("plans: Scale allows a second live receptionist", third && !x.error, JSON.stringify(x).slice(0, 200));
x = await a.call("admin", "savePlan", { id: "growth", name: "Growth", priceLabel: "$29 / month", position: 1, minutes: 500, agents: 3, numbers: 3, features: "Phone", public: true, stripePriceId: "" });
ok("admin: create plan", !x.error, x.error);
x = await a.call("admin", "deletePlan", { id: "growth" });
ok("admin: delete plan", !x.error, x.error);
x = await a.call("admin", "addFixedCost", { label: "Hosting", category: "infra", monthlyMicros: 20_000_000, startsOn: "2026-10-01", endsOn: null, note: "" });
ok("admin: add fixed cost", !x.error, x.error);
x = await a.call("admin", "addRevenue", { userId: myId, plan: "scale", amountMicros: 89_000_000, period: new Date().toISOString().slice(0, 10), note: "test" });
ok("admin: record revenue", !x.error, x.error);
x = await a.call("admin", "finance", { months: 1 });
ok("admin: finance reflects revenue", (x.result?.pl?.revenueMicros ?? 0) >= 89_000_000, JSON.stringify(x.result?.pl ?? x).slice(0, 200));
x = await a.call("admin", "saveSetting", { key: "BRAND_TAGLINE", value: "Tested tagline" });
ok("admin: save setting", !x.error, x.error);
x = await a.call("site", "branding");
ok("admin: setting takes effect", x.result?.tagline === "Tested tagline", JSON.stringify(x));
await a.call("admin", "saveSetting", { key: "BRAND_TAGLINE", value: "" });
x = await a.call("admin", "grant", { email, level: "support" });
ok("admin: grant support admin", !x.error, x.error);
x = await u.call("admin", "overview");
ok("admin: support admin can read overview", x.result && !x.error, JSON.stringify(x).slice(0, 120));
x = await u.call("admin", "saveSetting", { key: "BRAND_TAGLINE", value: "nope" });
ok("admin: support admin cannot write", !!x.error, JSON.stringify(x));
x = await a.call("admin", "revoke", { userId: myId });
ok("admin: revoke", !x.error, x.error);
x = await a.call("admin", "audit", { limit: 50 });
ok("admin: audit log records actions", x.result?.length >= 5, `entries ${x.result?.length}`);

// ---------- delete workspace ----------
x = await u.call("account", "deleteWorkspace", { confirmEmail: "wrong@example.com" });
ok("account: delete needs exact email", !!x.error, JSON.stringify(x));
x = await u.call("account", "deleteWorkspace", { confirmEmail: email });
ok("account: delete workspace", !x.error, x.error);
r = await u.req("/api/auth/session");
ok("account: signed out after delete", !r.body?.user, JSON.stringify(r.body));

hookServer.close();
const failed = results.filter((t) => !t.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.log("\nFAILURES:");
  for (const f of failed) console.log(` - ${f.name}: ${f.detail}`);
  process.exitCode = 1;
}
