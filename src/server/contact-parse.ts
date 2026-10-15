import "server-only";

export type ParsedContact = { name: string; e164: string; email: string; company: string; notes: string; tags: string };

export const CONTACT_COLUMNS = ["Name", "Phone", "Email", "Company", "Notes"];

/** Split one CSV/TSV line, honouring quotes. */
function splitLine(line: string, sep: string) {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

const PHONE_HEADER = /^(phone|mobile|number|tel|telephone|cell|e164|whatsapp)/i;

function cleanPhone(raw: string) {
  const s = raw.replace(/[^\d+]/g, "");
  if (s.length < 7) return { e164: "", reason: "none" as const };
  if (!s.startsWith("+")) {
    // 00 international prefix → +
    if (s.startsWith("00")) return { e164: `+${s.slice(2)}`, reason: "" as const };
    return { e164: "", reason: "country" as const };
  }
  return { e164: s, reason: "" as const };
}

/**
 * Accepts a spreadsheet export (with a header row) or free lines like
 * "Alex Rivera, +14155550114, alex@x.com, North Clinic".
 */
export function parseContactRows(rows: string[][]) {
  const contacts: ParsedContact[] = [];
  let skipped = 0;
  let missingCountryCode = 0;
  if (!rows.length) return { contacts, skipped, missingCountryCode };
  const header = rows[0].map((h) => h.toLowerCase().trim());
  const hasHeader = header.some((h) => PHONE_HEADER.test(h)) && !header.some((h) => /\d{6,}/.test(h));
  const idx = (re: RegExp) => header.findIndex((h) => re.test(h));
  const map = hasHeader
    ? {
        name: idx(/^(name|full name|contact|first)/),
        phone: idx(PHONE_HEADER),
        email: idx(/mail/),
        company: idx(/(company|organisation|organization|business)/),
        notes: idx(/(note|comment)/),
        tags: idx(/tag/),
      }
    : null;
  for (const row of hasHeader ? rows.slice(1) : rows) {
    if (!row.some((c) => c.trim())) continue;
    let name = "";
    let phone = "";
    let email = "";
    let company = "";
    let notes = "";
    let tags = "";
    if (map) {
      const at = (i: number) => (i >= 0 ? (row[i] ?? "").trim() : "");
      name = at(map.name);
      phone = at(map.phone);
      email = at(map.email);
      company = at(map.company);
      notes = at(map.notes);
      tags = at(map.tags);
    } else {
      const rest: string[] = [];
      for (const cell of row) {
        const c = cell.trim();
        if (!c) continue;
        if (!phone && /^[+\d][\d\s().-]{6,}$/.test(c)) phone = c;
        else if (!email && /@/.test(c)) email = c;
        else rest.push(c);
      }
      name = rest[0] ?? "";
      company = rest[1] ?? "";
      notes = rest.slice(2).join(", ");
    }
    const { e164, reason } = cleanPhone(phone);
    if (!e164) {
      if (reason === "country") missingCountryCode++;
      else skipped++;
      continue;
    }
    contacts.push({ name, e164, email, company, notes, tags });
  }
  return { contacts, skipped, missingCountryCode };
}

export function parseContactText(text: string) {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  const sep = lines[0]?.includes("\t") ? "\t" : lines[0]?.includes(";") && !lines[0].includes(",") ? ";" : ",";
  return parseContactRows(lines.map((l) => splitLine(l, sep)));
}
