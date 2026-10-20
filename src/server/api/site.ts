import "server-only";
import { publicQuery } from "../rpc";
import { landingData } from "../landing";
import { branding, siteMeta } from "../settings";

export const site = {
  branding: publicQuery(() => branding()),
  meta: publicQuery(() => siteMeta()),
  /** What the server-rendered pages need; a frontend-only deploy fetches it from here. */
  landing: publicQuery(() => landingData()),
  sessionUser: publicQuery((_: void, ctx) => (ctx.user ? { id: ctx.user.id, email: ctx.user.email } : null)),
};
