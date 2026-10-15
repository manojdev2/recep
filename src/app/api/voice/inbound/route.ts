import { connectCall, sayAndHangUp } from "@/server/telephony/twiml";
import { beginInbound, formParams, hasMinutes, lineFor, phoneCreds, signaturesRequired, twilioValid } from "@/server/telephony/voice";

/** Twilio: a call arrived on an imported number. */
export async function POST(req: Request) {
  const p = await formParams(req);
  const { phone, agent } = lineFor(p.To ?? "", "twilio");
  if (!phone) return sayAndHangUp("This number is not connected to a receptionist.");
  if (signaturesRequired() && !twilioValid(req, p, phoneCreds(phone)?.token)) return new Response("Invalid signature", { status: 403 });
  if (!agent) return sayAndHangUp("This number is not connected to a receptionist yet. Please try again later.");
  if (agent.status !== "live") return sayAndHangUp(`${agent.name} is not taking calls right now. Please try again later.`);
  if (agent.direction === "outbound") return sayAndHangUp("This line only places calls. Goodbye.");
  if (!hasMinutes(agent.userId)) return sayAndHangUp("Sorry, this line cannot take calls right now. Please try again later.");
  const call = beginInbound({ phone, agent, from: p.From ?? "", to: p.To ?? "", providerSid: p.CallSid ?? null });
  return connectCall(agent, call, agent.greeting || `Hi, this is ${agent.name}. How can I help?`);
}
