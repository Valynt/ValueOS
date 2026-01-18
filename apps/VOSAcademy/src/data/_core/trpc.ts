import { initTRPC, TRPCError } from "@trpc/server";
import { CreateHTTPContextOptions } from "@trpc/server/adapters/standalone";
import { getSessionFromRequest, validateSessionToken } from "./session";
import type { User } from "../../drizzle/schema";
import { getAuditContextFromRequest, logAuditEvent } from "../../lib/auditLogger";

export const createContext = async (opts: CreateHTTPContextOptions) => {
  const sessionToken = getSessionFromRequest(opts.req);
  let user: User | null = null;

  if (sessionToken) {
    try {
      user = await validateSessionToken(sessionToken, opts.req);
    } catch (error) {
      console.error('[tRPC] Session validation failed:', error);
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
};

export type Context = Awaited<ReturnType<typeof createContext>>;

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    const { ipAddress, userAgent, tenant } = getAuditContextFromRequest(ctx.req);
    await logAuditEvent({
      actor: "anonymous",
      action: "authorization.protected",
      result: "failure",
      tenant,
      ipAddress,
      userAgent,
      metadata: { path: ctx.req?.url },
    });
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be logged in to access this resource",
    });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user, // Type narrowing: user is guaranteed non-null
    },
  });
});
