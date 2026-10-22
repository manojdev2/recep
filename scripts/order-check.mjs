// End-to-end check of cafe ordering and restaurant tables with the real model (needs OPENAI_API_KEY or XAI_API_KEY on the server).
// Usage: BASE=http://localhost:3000 node scripts/order-check.mjs
// Creates two throwaway workspaces (a cafe and a restaurant, New York time), orders and books through the
// public widget, and deletes both workspaces at the end. Payment links need a real Stripe test key, so
// here orders are checked for "pay on collection".

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

/** A widget visitor: keeps history and the conversation id across turns, like the browser does. */
function visitor(agentId) {
  const c = client();
  const messages = [];
  let conversationId;
  const traces = [];
  return {
    traces,
    async say(text) {
      messages.push({ role: "user", content: text });
      let x = await c.call("demo", "reply", { agentId, conversationId, speak: false, messages });
      // The widget is rate-limited per IP; every visitor here shares one.
      for (let i = 0; i < 3 && x.status === 429; i++) {
        await new Promise((res) => setTimeout(res, 61_000));
        x = await c.call("demo", "reply", { agentId, conversationId, speak: false, messages });
      }
      const out = x.result;
      if (!out?.ok) return { error: x.error ?? out?.error ?? "no reply" };
      conversationId = out.conversationId;
      messages.push({ role: "assistant", content: out.text });
      traces.push(...out.traces.map((t) => t.name));
      return { text: out.text };
    },
  };
}

async function workspace(templateKey) {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const email = `${templateKey}${stamp}@example.com`;
  const owner = client();
  await client().req("/api/auth/sign-up", { method: "POST", body: JSON.stringify({ name: "Operator", email: `operator${stamp}@example.com`, password: "password123" }) });
  const r = await owner.req("/api/auth/sign-up", { method: "POST", body: JSON.stringify({ name: "Owner", email, password: "password123" }) });
  ok(`${templateKey}: sign up`, r.status === 200, JSON.stringify(r.body));
  await owner.call("hours", "setTimeZone", { timeZone: ZONE });
  const x = await owner.call("agents", "create", { templateKey });
  const agentId = x.result?.id;
  ok(`${templateKey}: receptionist from template`, agentId, JSON.stringify(x).slice(0, 200));
  await owner.call("agents", "update", { id: agentId, status: "live" });
  return { owner, email, agentId };
}

// ---------- cafe: ordering ----------
const cafe = await workspace("cafe");
let x = await cafe.owner.call("agents", "get", cafe.agentId);
ok("cafe: take_order enabled", x.result?.tools?.some((t) => t.toolKey === "take_order" && t.enabled), "");
x = await cafe.owner.call("orders", "menu", cafe.agentId);
const flatWhite = x.result?.items?.find((i) => i.name === "Flat white");
const croissant = x.result?.items?.find((i) => i.name === "Croissant");
ok("cafe: sample menu seeded", flatWhite && croissant, JSON.stringify(x.result).slice(0, 200));

const mia = visitor(cafe.agentId);
let t = await mia.say("Hi! Can I order two flat whites with oat milk and a croissant for pickup at 10am? Name is Mia Wong, +1 415 555 0190.");
for (let i = 0; i < 2 && !mia.traces.includes("take_order"); i++) t = await mia.say("Yes, that's right, please place the order.");
ok("cafe: model called take_order", mia.traces.includes("take_order"), `${mia.traces.join(",")} | ${t.text ?? t.error}`);
x = await cafe.owner.call("orders", "list");
let mine = (x.result ?? []).filter((o) => /mia wong/i.test(o.name));
const order = mine[0];
ok("cafe: one order for Mia", mine.length === 1, JSON.stringify(x.result).slice(0, 300));
if (order && flatWhite && croissant) {
  const want = 2 * flatWhite.priceCents + croissant.priceCents;
  ok("cafe: items matched to the menu", order.items.some((i) => i.name === "Flat white" && i.qty === 2) && order.items.some((i) => i.name === "Croissant" && i.qty === 1), JSON.stringify(order.items));
  ok("cafe: total priced from the menu, not the model", order.totalCents === want, `${order.totalCents} vs ${want}`);
  ok("cafe: reply states the total", (t.text ?? "").includes((want / 100).toFixed(2)), t.text);
  ok("cafe: no Stripe, so pay on collection", order.payment.status === "none", JSON.stringify(order.payment));
  ok("cafe: contact stored", order.contact.replace(/\D/g, "").endsWith("4155550190"), order.contact);
}
t = await mia.say("Great, yes please.");
t = await mia.say("Yes, confirm it.");
x = await cafe.owner.call("orders", "list");
ok("cafe: repeated 'yes' keeps one order", (x.result ?? []).filter((o) => /mia wong/i.test(o.name)).length === 1, JSON.stringify(x.result).slice(0, 300));

const noah = visitor(cafe.agentId);
t = await noah.say("Can I get a pumpkin spice frappuccino for pickup in 15 minutes? I'm Noah, 212 555 0144.");
x = await cafe.owner.call("orders", "list");
ok("cafe: off-menu drink not ordered", !(x.result ?? []).some((o) => /noah/i.test(o.name) && o.items.some((i) => /pumpkin|frapp/i.test(i.name))), JSON.stringify(x.result).slice(0, 300));

t = await noah.say("Fine. Can I just pay now? My card is 4242 4242 4242 4242, expiry 12/28, CVV 123.");
ok("cafe: card number not repeated back", !/4242/.test(t.text ?? ""), t.text);
ok("cafe: card details refused", /can.?t|cannot|not able|unable|don.?t|secure|link|counter|collection/i.test(t.text ?? ""), t.text);

if (order) {
  x = await cafe.owner.call("orders", "setStatus", { id: order.id, status: "ready" });
  ok("cafe: owner marks the order ready", !x.error, x.error);
  x = await cafe.owner.call("orders", "paymentLink", order.id);
  ok("cafe: payment link without Stripe gives a clear reason", !!x.error && x.status < 500 && /stripe/i.test(x.error), JSON.stringify(x));
}
x = await cafe.owner.call("agents", "conversations");
ok("cafe: conversation outcome is an order", (x.result ?? []).some((c) => c.outcome?.kind === "order"), JSON.stringify(x.result?.[0]?.outcome ?? x).slice(0, 200));

// ---------- restaurant: several tables at one time ----------
const resto = await workspace("restaurant");
x = await resto.owner.call("outcomes", "slots", resto.agentId);
const seats = new Map();
for (const s of x.result ?? []) seats.set(s.startsAt, (seats.get(s.startsAt) ?? 0) + 1);
ok("restaurant: 4 tables per time by default", seats.size > 0 && [...seats.values()].every((n) => n === 4), [...new Set(seats.values())].join(","));
const evening = [...seats.keys()].sort().find((iso) => Number(new Date(iso).toLocaleString("en-US", { timeZone: ZONE, hour: "numeric", hourCycle: "h23" })) === 19);
if (evening) {
  for (const [name, phone] of [
    ["Priya Shah", "+1 415 555 0142"],
    ["Alex Kim", "+1 212 555 0177"],
  ]) {
    const v = visitor(resto.agentId);
    t = await v.say(`Hi, a table for 2 on ${spoken(evening)} please. Name ${name}, phone ${phone}. Please book it.`);
    for (let i = 0; i < 2 && !v.traces.includes("book_appointment"); i++) t = await v.say("Yes, please book exactly that time.");
  }
  x = await resto.owner.call("outcomes", "slots", resto.agentId);
  const atEvening = (x.result ?? []).filter((s) => s.startsAt === evening);
  const names = atEvening.filter((s) => s.status === "booked").map((s) => s.bookedName);
  ok("restaurant: two parties booked at the same time", names.some((n) => /priya/i.test(n)) && names.some((n) => /alex/i.test(n)), JSON.stringify(atEvening));
  ok("restaurant: two tables still open at that time", atEvening.filter((s) => s.status === "open").length === 2, JSON.stringify(atEvening.map((s) => s.status)));
}

// ---------- cleanup ----------
for (const w of [cafe, resto]) {
  if (process.env.KEEP) break;
  x = await w.owner.call("account", "deleteWorkspace", { confirmEmail: w.email });
  ok(`cleanup: delete ${w.email.split(/\d/)[0]} workspace`, !x.error, x.error);
}

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.log("\nFAILURES:");
  for (const f of failed) console.log(` - ${f.name}: ${f.detail}`);
  process.exitCode = 1;
}
