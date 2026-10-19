import { pingDb, usingPostgres } from "@/server/db";
import { getSetting } from "@/server/settings";

export const dynamic = "force-dynamic";

async function probeDatabase() {
  const t = Date.now();
  await pingDb();
  return Date.now() - t;
}

/** Liveness + config probe. A real database round trip; 503 only when the store is unreachable. */
export async function GET() {
  const started = Date.now();
  let database = "ok";
  let databaseMs = 0;
  try {
    databaseMs = await probeDatabase();
  } catch {
    database = "error";
  }
  const openaiKey = Boolean(getSetting("OPENAI_API_KEY"));
  const body = {
    status: database !== "ok" ? "error" : openaiKey ? "ok" : "degraded",
    database,
    databaseMs,
    store: usingPostgres() ? "postgres" : "file",
    openaiKey,
    voiceRelay: Boolean(process.env.VOICE_RELAY_SECRET),
    uptimeSec: Math.round(process.uptime()),
    checkedInMs: Date.now() - started,
  };
  return Response.json(body, { status: database === "ok" ? 200 : 503, headers: { "cache-control": "no-store" } });
}
