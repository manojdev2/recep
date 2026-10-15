import { relayAuthorized, relaySession } from "@/server/telephony/voice";

/** Internal: the WebSocket relay asks how to run this call. */
export async function POST(req: Request) {
  if (!relayAuthorized(req)) return new Response("Not found", { status: 404 });
  const { call, token } = (await req.json()) as { call: string; token: string };
  const session = relaySession(call, token);
  return session ? Response.json(session) : new Response("Unknown call", { status: 403 });
}
