import { initTRPC, TRPCError } from "@trpc/server";
import { CreateHTTPContextOptions } from "@trpc/server/adapters/standalone";

import type { User } from "../../drizzle/schema";

import { applyRateLimitHeaders, buildRateLimitKey, checkRateLimit, getRateLimitIdentifiers, throwRateLimitExceeded } from "./error-handling";
import { getSessionFromRequest, validateSessionToken } from "./session";

export const createContext = async (opts: CreateHTTPContextOptions) => {
  const sessionToken = getSessionFromRequest(opts.req);
  const normalizedToken = sessionToken?.trim();
  let user: User | null = null;

  if (normalizedToken) {
    try {
      user = await validateSessionToken(normalizedToken);
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
};

export const rateLimitMiddleware = ({ keyPrefix, maxRequests, windowMs }: RateLimitOptions) =>
  t.middleware(async ({ ctx, next }) => {
    try {
      const identifiers = getRateLimitIdentifiers(ctx.req, ctx.user);
      const key = buildRateLimitKey(keyPrefix, identifiers);
      const result = await checkRateLimit(key, maxRequests, windowMs);

      applyRateLimitHeaders(ctx.res, result);

      if (!result.allowed) {
        throwRateLimitExceeded();
      }
    } catch (error) {
      console.error('[tRPC] Rate limit check failed:', error);
      // Allow the request to proceed if rate limiting fails
      // This prevents a Redis outage from taking down the API
    }

    return next();
  });
