import "server-only";
import type { SessionUser } from "./auth";

export type Access = "public" | "user" | "admin";

export type Ctx = {
  user: SessionUser | null;
  req: Request;
};

export type UserCtx = Ctx & { user: SessionUser };

export type Fn<I, O> = {
  method: "GET" | "POST";
  access: Access;
  /** In demo mode, POST functions are refused unless they opt in. */
  demoWritable: boolean;
  handler: (input: I, ctx: Ctx) => Promise<O> | O;
  /** Phantom fields carry the types to the client. */
  __in?: I;
  __out?: O;
};

export class RpcError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

type Handler<I, O, C> = (input: I, ctx: C) => Promise<O> | O;

function make<I, O>(method: "GET" | "POST", access: Access, handler: Handler<I, O, Ctx>, demoWritable = false): Fn<I, O> {
  return { method, access, handler, demoWritable };
}

/** Read-only call for a signed-in workspace owner. */
export function query<I = void, O = unknown>(handler: Handler<I, O, UserCtx>): Fn<I, O> {
  return make("GET", "user", handler as Handler<I, O, Ctx>);
}

/** Write call for a signed-in workspace owner. */
export function mutation<I = void, O = unknown>(handler: Handler<I, O, UserCtx>, opts?: { demoWritable?: boolean }): Fn<I, O> {
  return make("POST", "user", handler as Handler<I, O, Ctx>, opts?.demoWritable);
}

export function adminQuery<I = void, O = unknown>(handler: Handler<I, O, UserCtx>): Fn<I, O> {
  return make("GET", "admin", handler as Handler<I, O, Ctx>);
}

export function adminMutation<I = void, O = unknown>(handler: Handler<I, O, UserCtx>): Fn<I, O> {
  return make("POST", "admin", handler as Handler<I, O, Ctx>);
}

export function publicQuery<I = void, O = unknown>(handler: Handler<I, O, Ctx>): Fn<I, O> {
  return make("GET", "public", handler);
}

export function publicMutation<I = void, O = unknown>(handler: Handler<I, O, Ctx>, opts?: { demoWritable?: boolean }): Fn<I, O> {
  return make("POST", "public", handler, opts?.demoWritable ?? true);
}
