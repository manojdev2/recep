// Promote an existing account to platform admin.
// Usage: npm run admin:grant -- you@example.com [super|support]
// Works with the file store (stop the server first: it keeps data in memory and would overwrite
// this change) and with Postgres when DATABASE_URL is set (restart the server afterwards).
import fs from "node:fs";
import path from "node:path";

const [email, level = "super"] = process.argv.slice(2);
if (!email || !["super", "support"].includes(level)) {
  console.error("Usage: npm run admin:grant -- <email> [super|support]");
  process.exit(1);
}

function promote(users, admins, audit) {
  const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (!user) {
    console.error(`No account for ${email}. Sign up first, then run this again.`);
    process.exit(1);
  }
  const existing = admins.find((a) => a.userId === user.id);
  if (existing) existing.level = level;
  else admins.push({ userId: user.id, level, createdAt: new Date().toISOString() });
  audit.push({
    id: `aud_${Math.random().toString(16).slice(2, 18)}`,
    at: new Date().toISOString(),
    actorId: "cli",
    actor: "command line",
    action: "admin.grant",
    target: email,
    detail: level,
  });
}

if (process.env.DATABASE_URL) {
  const { default: pg } = await import("pg");
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const { rows } = await client.query("select collection, data from reception_store where collection in ('users','admins','audit')");
  const get = (k) => rows.find((r) => r.collection === k)?.data ?? [];
  const users = get("users");
  const admins = get("admins");
  const audit = get("audit");
  promote(users, admins, audit);
  for (const [k, v] of [["admins", admins], ["audit", audit]]) {
    await client.query(
      "insert into reception_store (collection, data, updated_at) values ($1, $2::jsonb, now()) on conflict (collection) do update set data = excluded.data, updated_at = now()",
      [k, JSON.stringify(v)],
    );
  }
  await client.end();
  console.log(`${email} is now a ${level} admin. Restart the server so it reloads.`);
} else {
  const file = path.join(process.env.DATA_DIR || path.join(process.cwd(), "data"), "db.json");
  if (!fs.existsSync(file)) {
    console.error(`No data at ${file}. Start the app and sign up first.`);
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  promote(data.users, data.admins, data.audit);
  fs.writeFileSync(file, JSON.stringify(data));
  console.log(`${email} is now a ${level} admin.`);
}
