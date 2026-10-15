import { confirmAdmin } from "@/server/admin-claim";
import { userFromRequest } from "@/server/auth";
import { db } from "@/server/db";

const page = (title: string, body: string) =>
  new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<body style="font-family:system-ui,sans-serif;background:#16192b;color:#e9e7f5;display:grid;place-items:center;min-height:100vh;margin:0">
<main style="max-width:28rem;padding:2rem;text-align:center"><h1 style="font-weight:500">${title}</h1><p style="color:#a6a3bd">${body}</p></main></body>`,
    { status: 400, headers: { "content-type": "text/html; charset=utf-8" } },
  );

/** ADMIN_EMAILS confirmation link. Must be opened in the browser where that address is signed in. */
export function GET(req: Request) {
  const session = userFromRequest(req);
  if (!session) return page("Sign in first", `Sign in as the address the link was sent to, then open the link again. <a style="color:#b9a7ff" href="/login">Sign in</a>`);
  const user = db().users.find((u) => u.id === session.id);
  if (!user) return page("Sign in first", "This account no longer exists.");
  const out = confirmAdmin(user, new URL(req.url).searchParams.get("token") ?? "");
  if (!out.ok) return page("That did not work", out.error);
  return new Response(null, { status: 302, headers: { location: "/admin" } });
}
