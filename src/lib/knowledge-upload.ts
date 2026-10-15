import { api } from "./api";

export const KNOWLEDGE_ACCEPT = ".pdf,.docx,.txt,.md,.csv,.json,.html,.htm,.xml,.log,text/plain,application/pdf";
export const KNOWLEDGE_TYPES = ".pdf .docx .txt .md .csv .json .html";

const ALLOWED = /\.(txt|md|markdown|csv|tsv|json|html?|xml|log|pdf|docx)$/i;
const BINARY = /\.(pdf|docx)$/i;

function toBase64(buf: ArrayBuffer) {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(s);
}

/** Upload files into the knowledge library (optionally straight onto one receptionist). */
export async function uploadKnowledgeFiles(files: FileList | File[], opts: { agentId?: string } = {}) {
  const result = { added: 0, errors: [] as string[] };
  for (const file of Array.from(files)) {
    const textual = file.type.startsWith("text/") || file.type === "application/json";
    if (!ALLOWED.test(file.name) && !textual) {
      result.errors.push(`${file.name}: use ${KNOWLEDGE_TYPES}`);
      continue;
    }
    const binary = BINARY.test(file.name) || file.type === "application/pdf";
    const max = binary ? 12e6 : 15e5;
    if (file.size > max) {
      result.errors.push(`${file.name} is over ${Math.round(max / 1e6)}MB`);
      continue;
    }
    try {
      await api.knowledge.add({
        source: "file",
        filename: file.name,
        mime: file.type,
        agentId: opts.agentId,
        title: file.name.replace(/\.[^.]+$/, ""),
        ...(binary ? { bytes: toBase64(await file.arrayBuffer()) } : { content: await file.text() }),
      });
      result.added += 1;
    } catch (err) {
      result.errors.push(err instanceof Error ? err.message : `Could not read ${file.name}`);
    }
  }
  return result;
}
