import "server-only";
import { newId } from "@/lib/utils";
import { recordProviderEvent } from "./ai";
import { db, nowIso, save } from "./db";
import { appUrl, getSetting } from "./settings";
import type { Job } from "./types";

type Handler = (payload: Record<string, unknown>) => Promise<void>;
const handlers = new Map<string, Handler>();

export function registerJob(kind: string, handler: Handler) {
  handlers.set(kind, handler);
}

export function enqueue(kind: string, payload: Record<string, unknown>, delayMs = 0) {
  const job: Job = {
    id: newId("job"),
    kind,
    payload,
    status: "queued",
    attempts: 0,
    runAt: new Date(Date.now() + delayMs).toISOString(),
    lastError: "",
    createdAt: nowIso(),
  };
  db().jobs.push(job);
  save();
  queueMicrotask(() => void drain(5).catch(() => {}));
  void nudgeQstash(delayMs);
  return job;
}

/**
 * On hosts that sleep between requests, ask QStash to call /api/jobs/run when this job is due.
 * An always-on process drains itself every minute, so this is only a backstop.
 */
async function nudgeQstash(delayMs: number) {
  const token = getSetting("QSTASH_TOKEN");
  const base = appUrl();
  if (!token || /localhost|127\.0\.0\.1/.test(base)) return;
  const headers: Record<string, string> = { authorization: `Bearer ${token}` };
  if (delayMs > 0) headers["upstash-delay"] = `${Math.ceil(delayMs / 1000)}s`;
  const secret = getSetting("JOBS_SECRET");
  if (secret) headers["upstash-forward-authorization"] = `Bearer ${secret}`;
  const started = Date.now();
  try {
    const res = await fetch(`https://qstash.upstash.io/v2/publish/${base}/api/jobs/run`, {
      method: "POST",
      headers,
      signal: AbortSignal.timeout(10_000),
    });
    recordProviderEvent("qstash", "publish", res.ok, Date.now() - started, res.ok ? null : String(res.status));
  } catch (err) {
    recordProviderEvent("qstash", "publish", false, Date.now() - started, err instanceof Error ? err.message : "network");
  }
}

export function queueStats() {
  const jobs = db().jobs;
  const count = (s: Job["status"]) => jobs.filter((j) => j.status === s).length;
  return { queued: count("queued"), running: count("running"), done: count("done"), failed: count("failed") };
}

const g = globalThis as unknown as { __jobsDraining?: boolean; __jobsTimer?: NodeJS.Timeout };

/** Run due jobs. At-least-once: handlers must be idempotent. */
export async function drain(limit = 10, budgetMs = 20_000) {
  if (g.__jobsDraining) return { ran: 0 };
  g.__jobsDraining = true;
  const started = Date.now();
  let ran = 0;
  try {
    // Lazy-load handlers so registering them does not create import cycles.
    await import("./job-handlers");
    while (ran < limit && Date.now() - started < budgetMs) {
      const now = Date.now();
      const job = db().jobs.find((j) => j.status === "queued" && new Date(j.runAt).getTime() <= now);
      if (!job) break;
      const handler = handlers.get(job.kind);
      job.status = "running";
      job.attempts += 1;
      save();
      try {
        if (!handler) throw new Error(`No handler for ${job.kind}`);
        await handler(job.payload);
        job.status = "done";
      } catch (err) {
        job.lastError = err instanceof Error ? err.message : String(err);
        if (job.attempts >= 5) job.status = "failed";
        else {
          job.status = "queued";
          job.runAt = new Date(Date.now() + 2 ** job.attempts * 30_000).toISOString();
        }
      }
      save();
      ran += 1;
    }
    // Keep the table small: forget finished jobs after a week.
    const cutoff = Date.now() - 7 * 864e5;
    const data = db();
    data.jobs = data.jobs.filter((j) => j.status === "queued" || j.status === "running" || new Date(j.createdAt).getTime() > cutoff);
  } finally {
    g.__jobsDraining = false;
  }
  return { ran };
}

/** In-process scheduler: drains the queue every minute (an always-on process needs nothing else). */
export function startScheduler() {
  if (g.__jobsTimer) return;
  // Jobs left "running" by a crash go back on the queue.
  for (const j of db().jobs) if (j.status === "running") j.status = "queued";
  const diaries = () => import("./slots").then((m) => m.refreshDiaries()).catch((e) => console.error("[slots]", e));
  void diaries();
  let ticks = 0;
  g.__jobsTimer = setInterval(() => {
    void drain().catch((e) => console.error("[jobs]", e));
    if (++ticks % 60 === 0) void diaries();
  }, 60_000);
  g.__jobsTimer.unref?.();
}

export function schedulerRunning() {
  return !!g.__jobsTimer;
}
