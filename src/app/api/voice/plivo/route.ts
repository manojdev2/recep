import { getSetting } from "@/server/settings";
import {
  beginInbound,
  formParams,
  hasMinutes,
  lineFor,
  phoneCreds,
  plivoValid,
  relayAvailable,
  signaturesRequired,
  streamUrl,
  xml,
  xmlEscape,
} from "@/server/telephony/voice";

const speak = (text: string) => xml(`<Speak>${xmlEscape(text)}</Speak><Hangup/>`);

/** Plivo: answer URL for an imported number. Streams straight into the realtime relay. */
async function handle(req: Request) {
  const posted = req.method === "POST" ? await formParams(req) : {};
  const p = { ...Object.fromEntries(new URL(req.url).searchParams), ...posted };
  const { phone, agent } = lineFor(p.To ?? "", "plivo");
  if (!phone) return speak("This number is not connected to a receptionist.");
  if (signaturesRequired() && !plivoValid(req, posted, phoneCreds(phone)?.authToken || getSetting("PLIVO_AUTH_TOKEN"))) return new Response("Invalid signature", { status: 403 });
  if (!agent || agent.status !== "live") return speak("This line is not taking calls right now. Please try again later.");
  if (!hasMinutes(agent.userId)) return speak("Sorry, this line cannot take calls right now. Please try again later.");
  if (!relayAvailable()) return speak("Sorry, this line is not fully set up yet. Please try again later.");
  const call = beginInbound({ phone, agent, from: p.From ?? "", to: p.To ?? "", providerSid: p.CallUUID ?? null });
  return xml(`<Stream bidirectional="true" keepCallAlive="true" contentType="audio/x-mulaw;rate=8000">${xmlEscape(streamUrl(call, "plivo"))}</Stream>`);
}

export const GET = handle;
export const POST = handle;
