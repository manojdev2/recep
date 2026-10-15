import { db } from "@/server/db";
import { connectCall, sayAndHangUp } from "@/server/telephony/twiml";
import { answerOutbound, formParams, phoneCreds, signaturesRequired, twilioValid } from "@/server/telephony/voice";

/** Twilio: the person we called picked up. */
export async function POST(req: Request) {
  const p = await formParams(req);
  const call = db().calls.find((c) => c.id === new URL(req.url).searchParams.get("call"));
  if (!call) return sayAndHangUp("Goodbye.");
  const phone = db().phoneNumbers.find((n) => n.id === call.phoneId);
  if (signaturesRequired() && !twilioValid(req, p, phoneCreds(phone)?.token)) return new Response("Invalid signature", { status: 403 });
  const agent = answerOutbound(call);
  if (!agent) return sayAndHangUp("Goodbye.");
  if (p.AnsweredBy && /machine/.test(p.AnsweredBy)) {
    const vm = agent.callConfig.outboundVoicemail === "hangup" ? "" : agent.callConfig.voicemailMessage;
    return sayAndHangUp(vm);
  }
  return connectCall(agent, call, agent.callConfig.outboundFirstMessage || agent.greeting || `Hi, this is ${agent.name}.`);
}
