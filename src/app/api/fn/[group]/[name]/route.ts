import { registry } from "@/server/api";
import { claimAdmin, isListedAdmin } from "@/server/admin-claim";
import { userFromRequest } from "@/server/auth";
import { db } from "@/server/db";
import { RpcError, type Fn } from "@/server/rpc";
import { DEMO_REFUSAL, isDemoMode, requestOrigin } from "@/server/settings";

type Params = { params: Promise<{ group: string; name: string }> };

function lookup(group: string, name: string): Fn<unknown, unknown> | null {
  const g = (registry as unknown as Record<string, Record<string, Fn<unknown, unknown>>>)[group];
  if (!g || !Object.prototype.hasOwnProperty.call(g, name)) return null;
  return g[name];
}

/**
 * The browser always POSTs (JSON body). Read functions also answer GET with
 * `?input=<json>` for curl and scripts. Demo mode refuses write functions.
 */
async function run(req: Request, { params }: Params, method: "GET" | "POST") {
  const { group, name } = await params;
  const fn = lookup(group, name);
  if (!fn || (method === "GET" && fn.method !== "GET")) return Response.json({ error: "Not found" }, { status: 404 });

  let user = userFromRequest(req);
  if (fn.access !== "public" && !user) return Response.json({ error: "Please sign in again." }, { status: 401 });
  // ADMIN_EMAILS: opening the admin panel promotes a listed, verified address (or sends its confirmation link).
  if (fn.access === "admin" && user && !user.adminLevel && isListedAdmin(user.email)) {
    const row = db().users.find((u) => u.id === user!.id);
    if (row && (await claimAdmin(row, requestOrigin(req))) === "granted") user = userFromRequest(req);
  }
  if (fn.access === "admin" && !user?.adminLevel) return Response.json({ error: "Not found" }, { status: 404 });
  if (fn.method === "POST" && isDemoMode() && !fn.demoWritable) {
    return Response.json({ error: DEMO_REFUSAL }, { status: 403 });
  }

  let input: unknown = undefined;
  try {
    if (method === "GET") {
      const raw = new URL(req.url).searchParams.get("input");
      input = raw ? JSON.parse(raw) : undefined;
    } else {
      const text = await req.text();
      input = text ? JSON.parse(text) : undefined;
    }
  } catch {
    return Response.json({ error: "That request could not be read." }, { status: 400 });
  }

  try {
    const result = await fn.handler(input, { user, req });
    return Response.json({ result: result ?? null });
  } catch (err) {
    if (err instanceof RpcError) return Response.json({ error: err.message }, { status: err.status });
    const errorId = `err_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
    console.error(`[api] ${errorId} ${group}.${name} failed`, err);
    // Unexpected failures never leak internals to the browser; the reference ties the report to this log line.
    return Response.json({ error: "Something went wrong. Please try again.", errorId }, { status: 500 });
  }
}

export function GET(req: Request, ctx: Params) {
  return run(req, ctx, "GET");
}

export function POST(req: Request, ctx: Params) {
  return run(req, ctx, "POST");
}
