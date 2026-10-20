/** Runs once when the server process starts. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // Frontend-only deploy: the backend owns the store and the scheduler.
  if (process.env.API_ORIGIN) return;
  const { initDb, flushOnShutdown } = await import("./server/db");
  await initDb();
  flushOnShutdown();
  const { startScheduler } = await import("./server/jobs");
  startScheduler();
}
