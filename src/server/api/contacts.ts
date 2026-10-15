import "server-only";
import { newId } from "@/lib/utils";
import { CONTACT_COLUMNS, parseContactRows, parseContactText } from "../contact-parse";
import { db, nowIso, save } from "../db";
import { xlsxRows } from "../extract";
import { mutation, query, RpcError } from "../rpc";

export const contacts = {
  list: query((_: void, { user }) =>
    db()
      .contacts.filter((c) => c.userId === user.id)
      .sort((a, b) => (a.name || a.e164).localeCompare(b.name || b.e164))
      .map(({ id, name, e164, email, company, notes, tags }) => ({ id, name, e164, email, company, notes, tags })),
  ),

  columns: query(() => CONTACT_COLUMNS),

  save: mutation(
    (input: { id?: string; name: string; e164: string; email?: string; company?: string; notes?: string; tags?: string }, { user }) => {
      const e164 = input.e164.replace(/[^\d+]/g, "");
      if (!/^\+\d{7,15}$/.test(e164)) throw new RpcError("Write the number with its country code, like +14155550114.");
      const data = db();
      const clash = data.contacts.find((c) => c.userId === user.id && c.e164 === e164 && c.id !== input.id);
      if (clash) throw new RpcError(`${e164} is already in your book as ${clash.name || "a contact"}.`);
      if (input.id) {
        const c = data.contacts.find((x) => x.id === input.id && x.userId === user.id);
        if (!c) throw new RpcError("That contact is gone.", 404);
        Object.assign(c, {
          name: input.name.trim(),
          e164,
          email: (input.email ?? "").trim(),
          company: (input.company ?? "").trim(),
          notes: (input.notes ?? "").trim(),
          tags: (input.tags ?? "").trim(),
        });
        save();
        return { id: c.id };
      }
      const c = {
        id: newId("ctc"),
        userId: user.id,
        name: input.name.trim(),
        e164,
        email: (input.email ?? "").trim(),
        company: (input.company ?? "").trim(),
        notes: (input.notes ?? "").trim(),
        tags: (input.tags ?? "").trim(),
        dnc: false,
        isSample: false,
        createdAt: nowIso(),
      };
      data.contacts.push(c);
      save();
      return { id: c.id };
    },
  ),

  import: mutation((input: { text?: string; xlsxBase64?: string }, { user }) => {
    let parsed;
    if (input.xlsxBase64) {
      try {
        parsed = parseContactRows(xlsxRows(new Uint8Array(Buffer.from(input.xlsxBase64, "base64"))));
      } catch {
        throw new RpcError("Could not read that spreadsheet. Save it as .xlsx or .csv and try again.");
      }
    } else parsed = parseContactText(input.text ?? "");
    const data = db();
    let added = 0;
    for (const row of parsed.contacts) {
      const existing = data.contacts.find((c) => c.userId === user.id && c.e164 === row.e164);
      if (existing) {
        existing.name = existing.name || row.name;
        existing.email = existing.email || row.email;
        existing.company = existing.company || row.company;
        continue;
      }
      data.contacts.push({ id: newId("ctc"), userId: user.id, ...row, dnc: false, isSample: false, createdAt: nowIso() });
      added++;
    }
    save();
    return { added, skipped: parsed.skipped, missingCountryCode: parsed.missingCountryCode };
  }),

  remove: mutation((id: string, { user }) => {
    const data = db();
    data.contacts = data.contacts.filter((c) => !(c.id === id && c.userId === user.id));
    save();
    return { ok: true };
  }),
};
