import "server-only";
import { chatComplete } from "../ai";
import { designTurn } from "../design";
import { mutation } from "../rpc";

export const design = {
  /** One turn of the "tell us about your business" conversation on /app/new. */
  turn: mutation((input: { messages: { role: "user" | "assistant"; content: string }[] }) => designTurn(input.messages), {
    demoWritable: true,
  }),

  /** Rewrite a receptionist's instructions into a clearer prompt. */
  rewrite: mutation(async (input: { name: string; instructions: string; job: string }) => {
    let out;
    try {
      out = await chatComplete({
        temperature: 0.4,
        messages: [
          {
            role: "system",
            content:
              "Rewrite these instructions for an AI phone receptionist so they are clear, specific and short. Keep every fact (hours, prices, policies) exactly. Use second person, plain sentences, no markdown headings. Include: what it does, what to collect, which tools to use and when, and when to hand over to a person. Return only the rewritten instructions.",
          },
          { role: "user", content: `Receptionist: ${input.name}\nJob: ${input.job}\n\nInstructions:\n${input.instructions || "(empty)"}` },
        ],
      });
    } catch (err) {
      return { ok: false as const, error: err instanceof Error ? err.message : "Could not rewrite." };
    }
    if (!out) return { ok: false as const, error: "Rewriting needs an xAI or OpenAI key in platform settings." };
    return { ok: true as const, text: out.content.trim() };
  }),
};
