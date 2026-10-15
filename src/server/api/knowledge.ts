import "server-only";
import { newId } from "@/lib/utils";
import { db, nowIso, save } from "../db";
import { docxToText, fetchPage, pdfToText, searchPassages } from "../extract";
import { mutation, query, RpcError } from "../rpc";
import type { KnowledgeDoc } from "../types";

type AddInput =
  | { source: "url"; url: string; agentId?: string }
  | { source: "paste" | "note"; title: string; content: string; agentId?: string }
  | { source: "file"; filename: string; mime: string; title: string; agentId?: string; bytes?: string; content?: string };

function stale(d: KnowledgeDoc) {
  return d.source === "url" && !!d.fetchedAt && Date.now() - new Date(d.fetchedAt).getTime() > 30 * 864e5;
}

export const knowledge = {
  library: query((_: void, { user }) =>
    db()
      .knowledge.filter((k) => k.userId === user.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((d) => ({ ...d, stale: stale(d) })),
  ),

  add: mutation(async (input: AddInput, { user }) => {
    const data = db();
    if (input.agentId && !data.agents.some((a) => a.id === input.agentId && a.userId === user.id)) {
      throw new RpcError("That receptionist is gone.");
    }
    let title = "";
    let content = "";
    let sourceUrl: string | null = null;
    let filename: string | null = null;
    let mime: string | null = null;
    if (input.source === "url") {
      const page = await fetchPage(input.url);
      title = page.title;
      content = page.text;
      sourceUrl = input.url.trim();
    } else if (input.source === "file") {
      filename = input.filename;
      mime = input.mime || null;
      title = input.title || input.filename;
      if (input.bytes) {
        const bytes = new Uint8Array(Buffer.from(input.bytes, "base64"));
        try {
          if (/\.pdf$/i.test(input.filename) || input.mime === "application/pdf") content = await pdfToText(bytes);
          else if (/\.docx$/i.test(input.filename)) content = docxToText(bytes);
          else content = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
        } catch {
          throw new RpcError(`${input.filename}: could not read the text in that file.`);
        }
      } else content = input.content ?? "";
      if (/\.html?$/i.test(input.filename)) content = content.replace(/<[^>]+>/g, " ");
    } else {
      title = input.title;
      content = input.content;
    }
    content = content.trim();
    if (!content) throw new RpcError(filename ? `${filename}: no readable text found.` : "There is nothing to save.");
    const now = nowIso();
    const doc: KnowledgeDoc = {
      id: newId("doc"),
      userId: user.id,
      title: (title || "Untitled").trim().slice(0, 200),
      source: input.source === "paste" ? "paste" : input.source,
      sourceUrl,
      filename,
      mime,
      content: content.slice(0, 300_000),
      agentIds: input.agentId ? [input.agentId] : [],
      isSample: false,
      fetchedAt: input.source === "url" ? now : null,
      createdAt: now,
      updatedAt: now,
    };
    data.knowledge.push(doc);
    save();
    return { id: doc.id, title: doc.title };
  }),

  attach: mutation((input: { docId: string; agentId: string; attached: boolean }, { user }) => {
    const data = db();
    const doc = data.knowledge.find((k) => k.id === input.docId && k.userId === user.id);
    if (!doc) throw new RpcError("That document is gone.", 404);
    if (!data.agents.some((a) => a.id === input.agentId && a.userId === user.id)) throw new RpcError("That receptionist is gone.");
    doc.agentIds = input.attached ? [...new Set([...doc.agentIds, input.agentId])] : doc.agentIds.filter((a) => a !== input.agentId);
    doc.updatedAt = nowIso();
    save();
    return { ok: true };
  }),

  remove: mutation((id: string, { user }) => {
    const data = db();
    data.knowledge = data.knowledge.filter((k) => !(k.id === id && k.userId === user.id));
    save();
    return { ok: true };
  }),

  search: query((input: { query: string }, { user }) => {
    const docs = db().knowledge.filter((k) => k.userId === user.id);
    const hits = searchPassages(docs, input.query, 5);
    return { hits: hits.map((h) => ({ title: h.title, snippet: h.text.length > 320 ? `${h.text.slice(0, 320)}…` : h.text })) };
  }),
};
