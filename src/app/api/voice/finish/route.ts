import { relayAuthorized, relayFinish } from "@/server/telephony/voice";

/** Internal: the call ended; store its transcript and bill it. */
export async function POST(req: Request) {
  if (!relayAuthorized(req)) return new Response("Not found", { status: 404 });
  const body = (await req.json()) as { call: string; transcript?: { role: "user" | "assistant"; content: string }[]; durationSec?: number };
  relayFinish(body.call, body.transcript ?? [], Number(body.durationSec) || 0);
  return new Response(null, { status: 204 });
}
