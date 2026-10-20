// End-to-end check of the booking flow with the real model (needs OPENAI_API_KEY or XAI_API_KEY on the server).
// Usage: BASE=http://localhost:3000 node scripts/booking-check.mjs
// Creates a throwaway workspace (New York time, so times are not UTC), books through the studio
// chat and the public widget, tries to double-book, cancels, and deletes the workspace at the end.

const B = process.env.BASE || "http://localhost:3000";
const ZONE = "America/New_York";
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
    try {
      return { status: res.status, body: JSON.parse(text) };
    } catch {
      return { status: res.status, body: text };
    }
  };
  const call = async (group, name, input) => {
    const r = await req(`/api/fn/${group}/${name}`, { method: "POST", body: input === undefined ? "" : JSON.stringify(input) });
    return r.body && typeof r.body === "object" && "error" in r.body ? { error: r.body.error, status: r.status } : { result: r.body?.result, status: r.status };
  };
  return { req, call };
}

const spoken = (iso) =>
  new Date(iso).toLocaleString("en-US", { timeZone: ZONE, weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" });
const clock = (iso) => new Date(iso).toLocaleString("en-US", { timeZone: ZONE, hour: "numeric", minute: "2-digit" });

/** A conversation: keeps history and the conversation id across turns, like the browser does. */
function conversation(c, group, agentId) {
  const messages = [];
  let conversationId;
  const traces = [];
  return {
    traces,
    get id() {
      return conversationId;
    },
    async say(text) {
      messages.push({ role: "user", content: text });
      let x = await c.call(group, "reply", { agentId, conversationId, speak: false, messages });
      // The widget is rate-limited per IP; every visitor here shares one.
      for (let i = 0; i < 3 && x.status === 429; i++) {
        await new Promise((res) => setTimeout(res, 61_000));
        x = await c.call(group, "reply", { agentId, conversationId, speak: false, messages });
      }
      const out = x.result;
      if (!out?.ok) return { error: x.error ?? out?.error ?? "no reply" };
      conversationId = out.conversationId;
      messages.push({ role: "assistant", content: out.text });
      traces.push(...out.traces.map((t) => t.name));
      return { text: out.text, traces: out.traces };
    },
  };
}

let agentId;
async function bookedSlots(owner) {
  const x = await owner.call("outcomes", "slots", agentId);
  return (x.result ?? []).filter((s) => s.status === "booked");
}

const stamp = Date.now();
const email = `booking${stamp}@example.com`;
const owner = client();

// ---------- workspace ----------
// Make sure an operator exists first, so this account is an ordinary tenant.
await client().req("/api/auth/sign-up", { method: "POST", body: JSON.stringify({ name: "Operator", email: `operator${stamp}@example.com`, password: "password123" }) });
let r = await owner.req("/api/auth/sign-up", { method: "POST", body: JSON.stringify({ name: "Booking Owner", email, password: "password123" }) });
ok("setup: sign up", r.status === 200, JSON.stringify(r.body));
let x = await owner.call("agents", "create", { templateKey: "salon" });
agentId = x.result?.id;
ok("setup: salon receptionist", agentId, JSON.stringify(x).slice(0, 200));
x = await owner.call("hours", "setTimeZone", { timeZone: ZONE });
ok("setup: time zone New York", !x.error, x.error);
const windows = [1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, startMin: 9 * 60, endMin: 17 * 60 }));
x = await owner.call("hours", "save", { agentId, windows, slotMinutes: 30, horizonDays: 14 });
ok("setup: opening hours", !x.error, x.error);
x = await owner.call("agents", "get", agentId);
const tools = (x.result?.tools ?? []).filter((t) => t.enabled).map((t) => t.toolKey);
ok("setup: list_slots and book_appointment enabled", tools.includes("list_slots") && tools.includes("book_appointment"), tools.join(","));
x = await owner.call("agents", "update", { id: agentId, status: "live" });
ok("setup: go live", !x.error, x.error);

// ---------- diary ----------
x = await owner.call("outcomes", "slots", agentId);
const diary = x.result ?? [];
ok("diary: generated", diary.length > 20, `slots ${diary.length}`);
const localHours = new Set(
  diary.map((s) => Number(new Date(s.startsAt).toLocaleString("en-US", { timeZone: ZONE, hour: "numeric", hourCycle: "h23" }))),
);
ok("diary: every time is 9:00–16:30 New York time", [...localHours].every((h) => h >= 9 && h <= 16), [...localHours].join(","));
const firstOpen = diary.filter((s) => s.status === "open").sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];

// ---------- 1. studio booking ----------
const studio = conversation(owner, "chat", agentId);
let t = await studio.say("Hi, what are the earliest times you have for a haircut?");
ok("studio: model answers", t.text, t.error);
ok("studio: model checked the diary (list_slots)", studio.traces.includes("list_slots"), studio.traces.join(","));
t = await studio.say("I'll take the very earliest one you have. My name is Sam Lee, my number is +1 415 555 0123, it's for a haircut. Please book it.");
for (let i = 0; i < 2 && !studio.traces.includes("book_appointment"); i++) t = await studio.say("Yes, that's right — please book it now.");
ok("studio: model called book_appointment", studio.traces.includes("book_appointment"), `${studio.traces.join(",")} | ${t.text ?? t.error}`);
let booked = await bookedSlots(owner);
const sam = booked.find((s) => /sam lee/i.test(s.bookedName));
ok("studio: slot is booked for Sam Lee", sam, JSON.stringify(booked).slice(0, 300));
if (sam) {
  ok("studio: booked the earliest open time", sam.startsAt === firstOpen?.startsAt, `${sam.startsAt} vs ${firstOpen?.startsAt}`);
  ok("studio: contact stored", sam.bookedContact.replace(/\D/g, "").endsWith("4155550123"), sam.bookedContact);
  const said = (t.text ?? "").replace(/\s|\./g, "").toLowerCase();
  ok("studio: reply states the New York time", said.includes(clock(sam.startsAt).replace(/\s/g, "").toLowerCase()), `${clock(sam.startsAt)} not in: ${t.text}`);
}
x = await owner.call("agents", "conversations");
const studioConv = (x.result ?? []).find((c) => c.id === studio.id);
ok("studio: conversation outcome is appointment", studioConv?.outcome?.kind === "appointment" || JSON.stringify(studioConv ?? {}).includes("appointment"), JSON.stringify(studioConv ?? x).slice(0, 300));

// ---------- 2. public widget: the same time is taken ----------
const visitor = client();
const widget = conversation(visitor, "demo", agentId);
if (sam) {
  t = await widget.say(`Hi, can I book a haircut on ${spoken(sam.startsAt)}? My name is Jo Park, phone +1 212 555 0188.`);
  for (let i = 0; i < 2 && !/taken|booked|not available|unavailable|isn.t available|no longer/i.test(t.text ?? ""); i++) {
    if (widget.traces.includes("book_appointment")) break;
    t = await widget.say("Yes, please book exactly that time.");
  }
  booked = await bookedSlots(owner);
  const atSamTime = booked.filter((s) => s.startsAt === sam.startsAt);
  ok("double booking: the taken time still has exactly one booking", atSamTime.length === 1, JSON.stringify(atSamTime));
  ok("double booking: it is still Sam's", atSamTime[0]?.bookedName && /sam lee/i.test(atSamTime[0].bookedName), JSON.stringify(atSamTime[0]));
  ok("double booking: Jo was not booked into Sam's time", !booked.some((s) => /jo park/i.test(s.bookedName) && s.startsAt === sam.startsAt), "");
}

// ---------- 3. public widget books a free time ----------
// Usually the model already offered and booked the next free time above; if not, ask for it.
if (!(await bookedSlots(owner)).some((s) => /jo park/i.test(s.bookedName))) {
  t = await widget.say("OK, then please book me the earliest other time you have. Same details: Jo Park, +1 212 555 0188, haircut.");
  for (let i = 0; i < 2 && !(await bookedSlots(owner)).some((s) => /jo park/i.test(s.bookedName)); i++) t = await widget.say("Yes, book it.");
}
booked = await bookedSlots(owner);
const jo = booked.find((s) => /jo park/i.test(s.bookedName));
ok("widget: visitor booked a free time", jo, `${widget.traces.join(",")} | ${t.text ?? t.error}`);
ok("widget: Jo's time differs from Sam's", jo && sam && jo.startsAt !== sam.startsAt, `${jo?.startsAt} ${sam?.startsAt}`);

// Callers often confirm twice; that must not take a second time.
t = await widget.say("Yes, book it.");
t = await widget.say("Great, yes please book it for me.");
booked = await bookedSlots(owner);
ok("widget: repeated 'yes, book it' keeps one booking", booked.filter((s) => /jo park/i.test(s.bookedName)).length === 1, JSON.stringify(booked.filter((s) => /jo park/i.test(s.bookedName))));

// ---------- 3b. reschedule ----------
x = await owner.call("outcomes", "slots", agentId);
const joBefore = (x.result ?? []).find((s) => s.status === "booked" && /jo park/i.test(s.bookedName));
ok("widget: Jo's booking did not move on its own", joBefore && jo && joBefore.startsAt === jo.startsAt, `${joBefore?.startsAt} vs ${jo?.startsAt}`);
const later = (x.result ?? []).filter((s) => s.status === "open" && joBefore && s.startsAt > joBefore.startsAt).sort((a, b) => a.startsAt.localeCompare(b.startsAt))[6];
if (joBefore && later) {
  t = await widget.say(`Actually, could you move my appointment to ${spoken(later.startsAt)} instead?`);
  for (let i = 0; i < 2 && !(await bookedSlots(owner)).some((s) => /jo park/i.test(s.bookedName) && s.startsAt === later.startsAt); i++) {
    t = await widget.say("Yes, please move it to that time.");
  }
  booked = await bookedSlots(owner);
  const joNow = booked.filter((s) => /jo park/i.test(s.bookedName));
  ok("reschedule: Jo has exactly one booking, at the new time", joNow.length === 1 && joNow[0].startsAt === later.startsAt, `${JSON.stringify(joNow)} | ${t.text ?? t.error}`);
  x = await owner.call("outcomes", "slots", agentId);
  const atOld = (x.result ?? []).filter((s) => s.startsAt === joBefore.startsAt);
  ok("reschedule: the old time is open again (once)", atOld.length === 1 && atOld[0].status === "open", JSON.stringify(atOld));
}

// ---------- 4. two visitors race for the same time ----------
x = await owner.call("outcomes", "slots", agentId);
const target = (x.result ?? []).filter((s) => s.status === "open").sort((a, b) => a.startsAt.localeCompare(b.startsAt))[3];
if (target) {
  const racers = ["Riley Chen", "Morgan Diaz"].map((name, i) => {
    const conv = conversation(client(), "demo", agentId);
    return conv.say(`Book a haircut for ${spoken(target.startsAt)} please. Name ${name}, phone +1 646 555 01${10 + i}. Yes, book it straight away.`).then(async (first) => {
      if (!conv.traces.includes("book_appointment")) await conv.say("Yes, please go ahead and book that exact time.");
      return first;
    });
  });
  await Promise.all(racers);
  booked = await bookedSlots(owner);
  const atTarget = booked.filter((s) => s.startsAt === target.startsAt);
  ok("race: at most one booking for the contested time", atTarget.length <= 1, JSON.stringify(atTarget.map((s) => s.bookedName)));
  ok("race: someone got the time", atTarget.length === 1, `bookings at that time: ${atTarget.length}`);
}

// ---------- 5. diary invariants ----------
x = await owner.call("outcomes", "slots", agentId);
const live = x.result ?? [];
const dupes = live.filter((s, i) => live.findIndex((o) => o.startsAt === s.startsAt) !== i);
ok("diary: no time appears twice", live.length > 0 && dupes.length === 0, JSON.stringify(dupes.map((s) => s.startsAt)));
ok("diary: no booking in the past", live.filter((s) => s.status === "booked").every((s) => new Date(s.startsAt).getTime() > Date.now()), "");

// ---------- 6. owner cancels, time frees up ----------
if (sam) {
  x = await owner.call("tools", "setSlotStatus", { id: sam.id, status: "cancelled" });
  ok("cancel: owner cancels Sam's booking", !x.error, x.error);
  x = await owner.call("outcomes", "slots", agentId);
  ok("cancel: the time is open again", (x.result ?? []).some((s) => s.startsAt === sam.startsAt && s.status === "open"), "");
  x = await owner.call("hours", "save", { agentId, windows, slotMinutes: 30, horizonDays: 14 });
  x = await owner.call("outcomes", "slots", agentId);
  const atTime = (x.result ?? []).filter((s) => s.startsAt === sam.startsAt && s.status !== "cancelled");
  // The diary never regenerates times less than 30 minutes away.
  if (new Date(sam.startsAt).getTime() > Date.now() + 31 * 60_000) {
    ok("cancel: re-saving hours keeps exactly one open copy", atTime.length === 1 && atTime[0].status === "open", JSON.stringify(atTime));
  }
}

// ---------- 7. reporting ----------
x = await owner.call("setup", "dashboard");
ok("reporting: dashboard loads", x.result && !x.error, x.error);
x = await owner.call("agents", "analytics", { days: 14 });
ok("reporting: analytics counts bookings", x.result && !x.error && JSON.stringify(x.result).length > 2, x.error);

console.log(`\nworkspace: ${email}  agent: ${agentId}`);
if (!process.env.KEEP) {
  x = await owner.call("account", "deleteWorkspace", { confirmEmail: email });
  ok("cleanup: delete workspace", !x.error, x.error);
}

const failed = results.filter((t) => !t.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.log("\nFAILURES:");
  for (const f of failed) console.log(` - ${f.name}: ${f.detail}`);
  process.exitCode = 1;
}
