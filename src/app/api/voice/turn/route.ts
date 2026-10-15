import { db } from "@/server/db";
import { runTurn } from "@/server/engine";
import { gather, say, sayAndHangUp } from "@/server/telephony/twiml";
import { formParams, phoneCreds, signaturesRequired, twilioValid, xml } from "@/server/telephony/voice";

/** Twilio fallback: one spoken turn — speech in, reply out, listen again. */
export async function POST(req: Request) {
  const p = await formParams(req);
  const url = new URL(req.url);
  const data = db();
  const call = data.calls.find((c) => c.id === url.searchParams.get("call"));
  if (!call || !call.live) return sayAndHangUp("Goodbye.");
  const phone = data.phoneNumbers.find((n) => n.id === call.phoneId);
  if (signaturesRequired() && !twilioValid(req, p, phoneCreds(phone)?.token)) return new Response("Invalid signature", { status: 403 });
  if (p.CallSid && call.providerSid && p.CallSid !== call.providerSid) return new Response("Wrong call", { status: 403 });
  const agent = data.agents.find((a) => a.id === call.agentId);
  if (!agent) return sayAndHangUp("Goodbye.");

  const heard = (p.SpeechResult ?? "").trim();
  if (!heard) return xml(await gather(agent, call, url.searchParams.get("silent") === "1" ? "Are you still there?" : ""));

  const history = data.messages
    .filter((m) => m.conversationId === call.conversationId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
  if (!history.length && agent.greeting) history.push({ role: "assistant", content: agent.greeting });

  const out = await runTurn({
    agent,
    conversationId: call.conversationId ?? undefined,
    messages: [...history, { role: "user", content: heard }],
    channel: "phone",
    speak: false,
    persist: true,
    callerContact: call.direction === "inbound" ? call.fromE164 : call.toE164,
  });
  if (!out.ok) {
    return xml(`${await say(agent, "Sorry, I had trouble with that. Please leave your name and number after the tone and we will call you back.")}<Record maxLength="120"/>`);
  }
  if (!call.conversationId) call.conversationId = out.conversationId;
  const conversation = data.conversations.find((c) => c.id === out.conversationId);
  if (conversation?.outcome?.kind === "transfer" && agent.callConfig.transferNumber) {
    return xml(`${await say(agent, out.text)}<Dial>${agent.callConfig.transferNumber.replace(/[^\d+]/g, "")}</Dial>`);
  }
  return xml(await gather(agent, call, out.text));
}
