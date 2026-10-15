import "server-only";

const g = globalThis as unknown as { __rateBuckets?: Map<string, number[]> };
const buckets: Map<string, number[]> = (g.__rateBuckets ??= new Map<string, number[]>());

/** Sliding-window limiter: at most `limit` hits per `windowMs` for a key. */
export function allow(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    return false;
  }
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 20_000) {
    for (const [k, v] of buckets) if (!v.some((t) => now - t < windowMs)) buckets.delete(k);
  }
  return true;
}

export function clientIp(req: Request) {
  return (
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-real-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "local"
  );
}
