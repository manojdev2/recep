import "server-only";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/**
 * Seals carrier tokens and API keys before they are stored.
 * CREDENTIAL_ENCRYPTION_KEY (32 random bytes, base64) is the key. Without it, a key is
 * generated once into data/.credential-key so local installs work out of the box.
 */
function key(): Buffer {
  const env = process.env.CREDENTIAL_ENCRYPTION_KEY;
  if (env) {
    const buf = Buffer.from(env, "base64");
    if (buf.length === 32) return buf;
    return crypto.createHash("sha256").update(env).digest();
  }
  const dir = process.env.DATA_DIR || path.join(process.cwd(), "data");
  const file = path.join(dir, ".credential-key");
  try {
    return Buffer.from(fs.readFileSync(file, "utf8").trim(), "base64");
  } catch {
    const fresh = crypto.randomBytes(32);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, fresh.toString("base64"));
    return fresh;
  }
}

export function seal(value: unknown): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${data.toString("base64")}`;
}

export function unseal<T = Record<string, string>>(sealed: string | null | undefined): T | null {
  if (!sealed) return null;
  try {
    const [v, iv, tag, data] = sealed.split(":");
    if (v !== "v1") return null;
    const decipher = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    const out = Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]);
    return JSON.parse(out.toString("utf8")) as T;
  } catch {
    return null;
  }
}

/** "sk-p••••••••••••Bz0A" style display for secrets. */
export function mask(value: string) {
  if (!value) return "";
  if (value.length <= 8) return "••••••••";
  return `${value.slice(0, 4)}••••••••••••${value.slice(-4)}`;
}
