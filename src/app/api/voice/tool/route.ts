import { relayAuthorized, relayTool } from "@/server/telephony/voice";

/** Internal: the model asked for a tool during a live call. */
export async function POST(req: Request) {
  if (!relayAuthorized(req)) return new Response("Not found", { status: 404 });
  const { call, name, args, said } = (await req.json()) as { call: string; name: string; args?: Record<string, unknown>; said?: string[] };
  return Response.json(await relayTool(call, name, args ?? {}, Array.isArray(said) ? said.map(String) : undefined));
}
