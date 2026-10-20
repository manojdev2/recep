import "server-only";
import { strFromU8, unzipSync } from "fflate";
import { RpcError } from "./rpc";

const ENTITY: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export function decodeEntities(s: string) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITY[n.toLowerCase()] ?? m);
}

export function htmlToText(html: string) {
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.trim() ?? "";
  const body = html
    .replace(/<(script|style|noscript|svg|nav|footer|header|form)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  const text = decodeEntities(body)
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
  return { title: decodeEntities(title), text };
}

export async function fetchPage(url: string) {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    throw new RpcError("That does not look like a web address.");
  }
  if (!/^https?:$/.test(parsed.protocol)) throw new RpcError("Use an http or https address.");
  if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|\[::1\])/i.test(parsed.hostname)) {
    throw new RpcError("That address is not reachable from the internet.");
  }
  let res: Response;
  try {
    res = await fetch(parsed, {
      headers: { "user-agent": "Azentoo/1.0 (+knowledge fetch)", accept: "text/html,text/plain;q=0.9,*/*;q=0.5" },
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new RpcError("Could not reach that page.");
  }
  if (!res.ok) throw new RpcError(`That page answered ${res.status}.`);
  const type = res.headers.get("content-type") ?? "";
  const raw = await res.text();
  if (type.includes("html") || /<html/i.test(raw.slice(0, 500))) {
    const { title, text } = htmlToText(raw);
    return { title: title || parsed.hostname, text: text.slice(0, 200_000) };
  }
  return { title: parsed.pathname.split("/").pop() || parsed.hostname, text: raw.slice(0, 200_000) };
}

export async function pdfToText(bytes: Uint8Array) {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: true });
  return (Array.isArray(text) ? text.join("\n") : text).trim();
}

export function docxToText(bytes: Uint8Array) {
  const files = unzipSync(bytes, { filter: (f) => f.name === "word/document.xml" });
  const xml = files["word/document.xml"];
  if (!xml) throw new RpcError("That .docx has no document body.");
  const s = strFromU8(xml)
    .replace(/<w:tab\/>/g, "\t")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "");
  return decodeEntities(s).replace(/\n{3,}/g, "\n\n").trim();
}

/** First sheet of an .xlsx as rows of cells. */
export function xlsxRows(bytes: Uint8Array): string[][] {
  const files = unzipSync(bytes);
  const shared: string[] = [];
  const sst = files["xl/sharedStrings.xml"];
  if (sst) {
    for (const si of strFromU8(sst).match(/<si>[\s\S]*?<\/si>/g) ?? []) {
      shared.push(decodeEntities((si.match(/<t[^>]*>([\s\S]*?)<\/t>/g) ?? []).map((t) => t.replace(/<[^>]+>/g, "")).join("")));
    }
  }
  const sheetName = Object.keys(files).filter((f) => /^xl\/worksheets\/sheet\d+\.xml$/.test(f)).sort()[0];
  if (!sheetName) return [];
  const xml = strFromU8(files[sheetName]);
  const rows: string[][] = [];
  for (const row of xml.match(/<row[^>]*>[\s\S]*?<\/row>/g) ?? []) {
    const cells: string[] = [];
    for (const c of row.match(/<c [^>]*?(\/>|>[\s\S]*?<\/c>)/g) ?? []) {
      const ref = /r="([A-Z]+)\d+"/.exec(c)?.[1] ?? "";
      const col = ref.split("").reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
      const t = /t="(\w+)"/.exec(c)?.[1];
      const v = /<v>([\s\S]*?)<\/v>/.exec(c)?.[1] ?? /<t[^>]*>([\s\S]*?)<\/t>/.exec(c)?.[1] ?? "";
      cells[col >= 0 ? col : cells.length] = t === "s" ? (shared[Number(v)] ?? "") : decodeEntities(v);
    }
    rows.push(Array.from(cells, (x) => x ?? ""));
  }
  return rows;
}

// ---- Retrieval ----------------------------------------------------------------------

const STOP = new Set(
  "a an and are as at be by can do does for from have how i in is it me my of on or our please the their there they this to us was we what when where which who why will with you your".split(
    " ",
  ),
);

export function terms(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9À-ɏऀ-ॿ\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP.has(t));
}

export function chunk(text: string, size = 700) {
  const parts: string[] = [];
  const paras = text.split(/\n+/);
  let cur = "";
  for (const p of paras) {
    if ((cur + "\n" + p).length > size && cur) {
      parts.push(cur.trim());
      cur = p;
    } else cur = cur ? `${cur}\n${p}` : p;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts.flatMap((p) => (p.length > size * 2 ? p.match(new RegExp(`[\\s\\S]{1,${size}}`, "g")) ?? [] : [p]));
}

/** Rank passages from the given documents against a question (simple BM25). */
export function searchPassages(docs: { id: string; title: string; content: string }[], query: string, limit = 4) {
  const q = terms(query);
  if (!q.length) return [];
  const passages = docs.flatMap((d) => chunk(d.content).map((text) => ({ docId: d.id, title: d.title, text, t: terms(`${d.title} ${text}`) })));
  if (!passages.length) return [];
  const avg = passages.reduce((s, p) => s + p.t.length, 0) / passages.length || 1;
  const df = new Map<string, number>();
  for (const term of new Set(q)) df.set(term, passages.filter((p) => p.t.includes(term)).length);
  const scored = passages.map((p) => {
    let score = 0;
    for (const term of q) {
      const n = df.get(term) ?? 0;
      if (!n) continue;
      const tf = p.t.filter((x) => x === term).length;
      if (!tf) continue;
      const idf = Math.log(1 + (passages.length - n + 0.5) / (n + 0.5));
      score += (idf * tf * 2.2) / (tf + 1.2 * (0.25 + 0.75 * (p.t.length / avg)));
    }
    return { ...p, score };
  });
  return scored
    .filter((p) => p.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ docId, title, text, score }) => ({ docId, title, text, score }));
}
