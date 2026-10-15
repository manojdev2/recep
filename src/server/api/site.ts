import "server-only";
import { publicQuery } from "../rpc";
import { branding, siteMeta } from "../settings";

export const site = {
  branding: publicQuery(() => branding()),
  meta: publicQuery(() => siteMeta()),
  sessionUser: publicQuery((_: void, ctx) => (ctx.user ? { id: ctx.user.id, email: ctx.user.email } : null)),
};
