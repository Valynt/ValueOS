import { initTRPC, TRPCError } from "@trpc/server";
import { CreateHTTPContextOptions } from "@trpc/server/adapters/standalone";

import type { User } from "../../drizzle/schema";
import { getAuditRequestContext, logAuditEvent } from "../../lib/auditLogger";

import { applyRateLimitHeaders, buildRateLimitKey, checkRateLimit, getRateLimitIdentifiers, type RateLimitIdentityUser, throwRateLimitExceeded } from "./error-handling";
import { getSessionFromRequest, validateSessionToken } from "./session";

export const createContext = async (opts: CreateHTTPContextOptions) => {
  const sessionToken = getSessionFromRequest(opts.req);
  const normalizedToken = sessionToken?.trim();
  let user: User | null = null;

  if (normalizedToken) {
    try {
      user = await validateSessionToken(normalizedToken, getAuditRequestContext(opts.req));
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
    const requestContext = getAuditRequestContext(ctx.req);
    await logAuditEvent({
      actor: "anonymous",
      tenantId: process.env.SESSION_JWT_TENANT || process.env.VITE_APP_ID || undefined,
      action: "trpc.authorization",
      result: "failure",
      ipAddress: requestContext.ipAddress,
      userAgent: requestContext.userAgent,
      details: { reason: "missing_session", procedurePath: ctx.req.url || undefined },
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

export type RateLimitOptions = {
  keyPrefix: string;
  maxRequests?: number;
  windowMs?: number;
  userOverride?: RateLimitIdentityUser | null;
};

export const rateLimitMiddleware = ({ keyPrefix, maxRequests, windowMs, userOverride }: RateLimitOptions) =>
  t.middleware(async ({ ctx, next }) => {
    try {
      const identifiers = getRateLimitIdentifiers(ctx.req, userOverride ?? ctx.user);
      const key = buildRateLimitKey(keyPrefix, identifiers);
      const result = await checkRateLimit(key, maxRequests, windowMs);

      applyRateLimitHeaders(ctx.res, result);

      if (!result.allowed) {
        throwRateLimitExceeded();
      }
    } catch (error) {
      if (error instanceof TRPCError && error.code === "TOO_MANY_REQUESTS") {
        throw error;
      }

      console.error('[tRPC] Rate limit check failed:', error);
      // Allow the request to proceed if rate limiting infrastructure fails
      // This prevents a Redis outage from taking down the API
    }

    return next();
  });
