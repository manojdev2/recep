import { takeClip } from "@/server/telephony/twiml";

/** Short-lived spoken clip for a fallback call's <Play>. The id is unguessable and expires in ten minutes. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const audio = takeClip(id);
  if (!audio) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(audio), { headers: { "content-type": "audio/mpeg", "cache-control": "private, max-age=600" } });
}
