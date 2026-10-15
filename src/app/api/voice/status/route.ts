import { db } from "@/server/db";
import { applyCallStatus } from "@/server/telephony/calls";
import { formParams, phoneCreds, signaturesRequired, twilioValid } from "@/server/telephony/voice";

/** Twilio: call progress (ringing, answered, completed…). */
export async function POST(req: Request) {
  const p = await formParams(req);
  const data = db();
  const id = new URL(req.url).searchParams.get("call");
  const call = data.calls.find((c) => (id ? c.id === id : c.providerSid === p.CallSid));
  if (!call) return new Response(null, { status: 204 });
  const phone = data.phoneNumbers.find((n) => n.id === call.phoneId);
  if (signaturesRequired() && !twilioValid(req, p, phoneCreds(phone)?.token)) return new Response("Invalid signature", { status: 403 });
  if (p.CallSid && !call.providerSid) call.providerSid = p.CallSid;
  applyCallStatus(call, p.CallStatus ?? "", p.CallDuration ? Number(p.CallDuration) : undefined, p.AnsweredBy);
  return new Response(null, { status: 204 });
}
