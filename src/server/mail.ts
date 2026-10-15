import "server-only";
import { recordProviderEvent } from "./ai";
import { getSetting, numberSetting } from "./settings";

/**
 * Transactional mail over SMTP. Without SMTP_HOST the message is printed to the server log
 * instead, prefixed so it is easy to find (e.g. "[admin]").
 */
export async function sendMail(input: { to: string; subject: string; text: string; logPrefix: string }) {
  const host = getSetting("SMTP_HOST");
  if (!host) {
    console.log(`${input.logPrefix} Email to ${input.to} (SMTP is not configured, so it is printed here):\n${input.logPrefix} ${input.subject}\n${input.text
      .split("\n")
      .map((l) => `${input.logPrefix} ${l}`)
      .join("\n")}`);
    return { sent: false as const, logged: true as const };
  }
  const port = numberSetting("SMTP_PORT", 587);
  const { default: nodemailer } = await import("nodemailer");
  const transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // 465 is implicit TLS; anything else upgrades with STARTTLS
    auth: getSetting("SMTP_USER") ? { user: getSetting("SMTP_USER"), pass: getSetting("SMTP_PASS") } : undefined,
  });
  const started = Date.now();
  try {
    await transport.sendMail({
      from: getSetting("SMTP_FROM") || getSetting("SMTP_USER") || `no-reply@${host}`,
      to: input.to,
      subject: input.subject,
      text: input.text,
    });
    recordProviderEvent("smtp", "send", true, Date.now() - started, null);
    return { sent: true as const, logged: false as const };
  } catch (err) {
    recordProviderEvent("smtp", "send", false, Date.now() - started, err instanceof Error ? err.message : "send failed");
    console.error(`${input.logPrefix} SMTP send failed; the message follows.\n${input.text}`);
    return { sent: false as const, logged: true as const };
  }
}
