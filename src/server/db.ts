import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { Pool } from "pg";
import type { Database } from "./types";
import { seedDatabase } from "./seed";

/**
 * A small document store. Every collection is an array held in memory; writes are flushed
 * shortly after they happen, to one of two places:
 *
 * - `DATABASE_URL` set: Postgres, one JSONB row per collection (only changed collections are written).
 *   Use this on hosts whose disk is wiped on redeploy (Railway, Render, Fly without a volume).
 * - otherwise: `data/db.json` (or `DATA_DIR`).
 *
 * The rest of the server only talks to `db()` and `save()`.
 */

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "db.json");
const TABLE = "reception_store";

type Store = {
  data: Database;
  timer: NodeJS.Timeout | null;
  pg?: { pool: Pool; written: Map<string, string>; chain: Promise<void> };
};

const g = globalThis as unknown as { __receptionDb?: Store; __receptionDbInit?: Promise<void> };

/** Fill collections added after the data was first created. */
function withDefaults(parsed: Partial<Database>): Database {
  const fresh = seedDatabase();
  for (const key of Object.keys(fresh) as (keyof Database)[]) {
    if (parsed[key] === undefined) (parsed as Record<string, unknown>)[key] = fresh[key];
  }
  return parsed as Database;
}

function loadFile(): Database {
  try {
    return withDefaults(JSON.parse(fs.readFileSync(FILE, "utf8")) as Database);
  } catch {
    const seeded = seedDatabase();
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(seeded, null, 1));
    return seeded;
  }
}

export const usingPostgres = () => Boolean(process.env.DATABASE_URL);

/**
 * Load the store from Postgres before the first request. Called from instrumentation;
 * a no-op for the file store.
 */
export async function initDb() {
  if (!usingPostgres() || g.__receptionDb) return;
  g.__receptionDbInit ??= (async () => {
    const { default: pg } = await import("pg");
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 4 });
    await pool.query(
      `create table if not exists ${TABLE} (collection text primary key, data jsonb not null, updated_at timestamptz not null default now())`,
    );
    const { rows } = await pool.query<{ collection: string; data: unknown }>(`select collection, data from ${TABLE}`);
    const written = new Map<string, string>();
    let data: Database;
    if (rows.length) {
      const parsed: Record<string, unknown> = {};
      for (const r of rows) {
        parsed[r.collection] = r.data;
        written.set(r.collection, JSON.stringify(r.data));
      }
      data = withDefaults(parsed as Partial<Database>);
    } else {
      data = seedDatabase();
    }
    g.__receptionDb = { data, timer: null, pg: { pool, written, chain: Promise.resolve() } };
    // Write the seed (or any collections that were filled in) straight away.
    await flushPostgres(g.__receptionDb);
    console.log(`[db] Postgres store ready (${Object.keys(data).length} collections)`);
  })();
  await g.__receptionDbInit;
}

function store(): Store {
  if (!g.__receptionDb) {
    if (usingPostgres()) throw new Error("The Postgres store is not loaded yet. initDb() must run at startup.");
    g.__receptionDb = { data: loadFile(), timer: null };
  }
  return g.__receptionDb;
}

export function db(): Database {
  return store().data;
}

function flushPostgres(s: Store) {
  const pgs = s.pg!;
  pgs.chain = pgs.chain.then(async () => {
    const changed: [string, string][] = [];
    for (const [key, value] of Object.entries(s.data)) {
      const json = JSON.stringify(value);
      if (pgs.written.get(key) !== json) changed.push([key, json]);
    }
    if (!changed.length) return;
    const client = await pgs.pool.connect();
    try {
      await client.query("begin");
      for (const [key, json] of changed) {
        await client.query(
          `insert into ${TABLE} (collection, data, updated_at) values ($1, $2::jsonb, now())
           on conflict (collection) do update set data = excluded.data, updated_at = now()`,
          [key, json],
        );
      }
      await client.query("commit");
      for (const [key, json] of changed) pgs.written.set(key, json);
    } catch (err) {
      await client.query("rollback").catch(() => {});
      console.error("[db] Postgres write failed; will retry on the next change", err);
    } finally {
      client.release();
    }
  });
  return pgs.chain;
}

function flushFile(s: Store) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(s.data, null, 1));
  fs.renameSync(tmp, FILE);
}

export function save() {
  const s = store();
  if (s.timer) return;
  s.timer = setTimeout(() => {
    s.timer = null;
    if (s.pg) void flushPostgres(s);
    else flushFile(s);
  }, 150);
}

/** Write anything pending now (used on shutdown). */
export async function flush() {
  const s = g.__receptionDb;
  if (!s) return;
  if (s.timer) {
    clearTimeout(s.timer);
    s.timer = null;
  }
  if (s.pg) await flushPostgres(s);
  else flushFile(s);
}

export function nowIso() {
  return new Date().toISOString();
}

/** Write anything pending before the host stops the process. */
export function flushOnShutdown() {
  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    process.once(signal, () => {
      void flush().finally(() => process.exit(0));
    });
  }
}
