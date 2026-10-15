import type { Api } from "@/server/api";
import type { Fn } from "@/server/rpc";

type Caller<F> = F extends Fn<infer I, infer O>
  ? [I] extends [void]
    ? () => Promise<Awaited<O>>
    : (input: I) => Promise<Awaited<O>>
  : never;

type Client = { [G in keyof Api]: { [N in keyof Api[G]]: Caller<Api[G][N]> } };

/** Exported for API result typing in components: `ApiResult<"agents", "list">`. */
export type ApiResult<G extends keyof Api, N extends keyof Api[G]> =
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  Api[G][N] extends Fn<infer _I, infer O> ? Awaited<O> : never;

async function call(group: string, name: string, input: unknown) {
  const res = await fetch(`/api/fn/${group}/${name}`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: input === undefined ? "" : JSON.stringify(input),
  });
  let body: { result?: unknown; error?: string; errorId?: string } = {};
  try {
    body = await res.json();
  } catch {
    throw new Error("The server did not answer. Please try again.");
  }
  if (body.errorId) {
    // Shown as the reference on the error page, so support can find it in the server log.
    try {
      window.sessionStorage.setItem("aether.lastErrorId", body.errorId);
    } catch {}
  }
  if (!res.ok || body.error) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body.result;
}

/** Typed client for the server functions in `src/server/api`. */
export const api = new Proxy({} as Client, {
  get(_, group: string) {
    return new Proxy(
      {},
      {
        get(_, name: string) {
          return (input?: unknown) => call(group, name, input);
        },
      },
    );
  },
});
