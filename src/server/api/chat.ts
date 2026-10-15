import "server-only";
import { speak, transcribe } from "../ai";
import { db } from "../db";
import { runTurn } from "../engine";
import { mutation, RpcError } from "../rpc";
import { meter } from "../usage";

type ReplyInput = {
  agentId: string;
  conversationId?: string;
  speak: boolean;
  messages: { role: "user" | "assistant"; content: string }[];
};

export const chat = {
  /** A turn in the studio's test conversation. Counts as a real conversation. */
  reply: mutation(
    async (input: ReplyInput, { user }) => {
      const agent = db().agents.find((a) => a.id === input.agentId && a.userId === user.id);
      if (!agent) throw new RpcError("This receptionist is gone.", 404);
      return runTurn({ agent, conversationId: input.conversationId, messages: input.messages, channel: "studio", speak: input.speak });
    },
    { demoWritable: true },
  ),

  transcribe: mutation(
    async (input: { audioBase64: string; mimeType: string; language: string }, { user }) => {
      const out = await transcribe(input.audioBase64, input.mimeType, input.language);
      if (out.ok) meter(user.id, null, [{ provider: "openai", operation: "transcribe", units: out.seconds / 60 }]);
      return out.ok ? { ok: true as const, text: out.text } : out;
    },
    { demoWritable: true },
  ),

  /** Voice preview: with text, speak it; without, play the voice's sample line. */
  speak: mutation(
    async (input: { voiceId: string; language?: string; text?: string }, { user }) => {
      const out = await speak(input.text, input.voiceId);
      if (out.ok && out.chars) meter(user.id, null, [{ provider: "openai", operation: "speech", units: out.chars / 1000 }]);
      return out.ok ? { ok: true as const, audioBase64: out.audioBase64 } : out;
    },
    { demoWritable: true },
  ),
};
