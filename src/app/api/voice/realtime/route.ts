import { handleIncoming, openaiWebhookValid } from "@/server/telephony/sip";

/** OpenAI webhook for SIP calls (realtime.call.incoming). Verified with OPENAI_WEBHOOK_SECRET. */
export async function POST(req: Request) {
  const body = await req.text();
  if (!openaiWebhookValid(req.headers, body)) return new Response("Invalid signature", { status: 400 });
  let event: { type?: string };
  try {
    event = JSON.parse(body);
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  if (event.type === "realtime.call.incoming") {
    // Accept quickly; the sideband connection keeps running in this (always-on) process.
    await handleIncoming(event as Parameters<typeof handleIncoming>[0]);
  }
  return new Response(null, { status: 200 });
}
