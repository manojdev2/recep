/** Runs once when the server process starts. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { initDb, flushOnShutdown } = await import("./server/db");
  await initDb();
  flushOnShutdown();
  const { startScheduler } = await import("./server/jobs");
  startScheduler();
}
