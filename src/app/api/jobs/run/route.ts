import { drain, queueStats } from "@/server/jobs";
import { getSetting } from "@/server/settings";

/** Drain due jobs by hand or from an external cron: Bearer JOBS_SECRET (open in development). */
async function run(req: Request) {
  const secret = getSetting("JOBS_SECRET");
  const auth = req.headers.get("authorization") ?? "";
  // Route handlers cannot see the socket address, so without a secret only development is open.
  const allowed = secret ? auth === `Bearer ${secret}` : process.env.NODE_ENV !== "production";
  if (!allowed) return new Response("Not found", { status: 404 });
  const { ran } = await drain(10, 20_000);
  return Response.json({ ran, ...queueStats() });
}

export const GET = run;
export const POST = run;
