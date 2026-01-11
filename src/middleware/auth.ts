/**
 * Authentication middleware for Express routes
 * Verifies user sessions using Supabase auth
 */

import { type IncomingHttpHeaders } from 'http';
import { NextFunction, Request, Response } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { authService } from '../services/AuthService';
import { AuthenticationError } from '../services/errors';
import { createLogger } from '../lib/logger';
import { sanitizeForLogging } from '../lib/piiFilter';
import { getSupabaseClient } from '../lib/supabase';
import { getEnvVar } from '../lib/env';

const logger = createLogger({ component: 'AuthMiddleware' });

const SUPABASE_TOKEN_PREFIX = 'Bearer ';
const SUPABASE_COOKIE_NAMES = ['sb-access-token', 'sb_access_token'];

function parseBearerToken(header?: string): string | null {
  if (!header) return null;
  if (!header.startsWith(SUPABASE_TOKEN_PREFIX)) return null;
  const token = header.slice(SUPABASE_TOKEN_PREFIX.length).trim();
  return token.length > 0 ? token : null;
}

function parseCookieHeader(raw?: string): Record<string, string> {
  if (!raw) return {};
  return raw.split(';').reduce<Record<string, string>>((cookies, part) => {
    const [key, ...rest] = part.trim().split('=');
    if (!key) return cookies;
    cookies[key] = decodeURIComponent(rest.join('=') || '');
    return cookies;
  }, {});
}

export function getCookieTokenFromHeader(raw?: string): string | null {
  const cookies = parseCookieHeader(raw);
  for (const name of SUPABASE_COOKIE_NAMES) {
    const value = cookies?.[name];
    if (value) return value;
  }
  return null;
}

function getCookieToken(req: Request): string | null {
  const cookies = (req as any).cookies;
  if (cookies) {
    for (const name of SUPABASE_COOKIE_NAMES) {
      const value = cookies?.[name];
      if (value) return value;
    }
  }
  return getCookieTokenFromHeader(req.headers.cookie);
}

function decodeClaims(token: string): JwtPayload | null {
  const decoded = jwt.decode(token);
  if (!decoded || typeof decoded === 'string') {
    return null;
  }
  return decoded as JwtPayload;
}

function buildSessionFromClaims(token: string, claims: JwtPayload) {
  const user = {
    id: claims.sub,
    email: claims.email,
    role: claims.role,
    tenant_id: claims.tenant_id ?? claims.organization_id,
    app_metadata: claims.app_metadata,
    user_metadata: claims.user_metadata,
  };

  return {
    access_token: token,
    token_type: 'bearer',
    expires_at: claims.exp,
    expires_in: claims.exp ? claims.exp - Math.floor(Date.now() / 1000) : undefined,
    user,
  };
}

export function extractTenantId(
  claims: JwtPayload | null,
  user?: any
): string | undefined {
  return (
    (claims?.tenant_id as string | undefined) ??
    (claims?.organization_id as string | undefined) ??
    (claims?.app_metadata as any)?.tenant_id ??
    (user?.user_metadata?.tenant_id as string | undefined) ??
    (user?.app_metadata?.tenant_id as string | undefined) ??
    (user?.tenant_id as string | undefined)
  );
}

function applyAuthContext(req: Request, user: any, session: any, claims: JwtPayload | null) {
  const tenantId = extractTenantId(claims, user);
  const userWithTenant = user ? { ...user, tenant_id: tenantId ?? user.tenant_id } : user;

  (req as any).user = userWithTenant;
  (req as any).session = session;
  (req as any).tenantId = tenantId;
}

async function verifyTokenWithSupabase(token: string) {
  try {
    const supabaseClient = getSupabaseClient();
    const { data, error } = await supabaseClient.auth.getUser(token);

    if (error || !data?.user) {
      return null;
    }

    let claims = decodeClaims(token) ?? {};
    if (!claims.sub && data.user.id) {
      claims = { ...claims, sub: data.user.id };
    }

    const session = buildSessionFromClaims(token, claims as JwtPayload);

    return {
      user: data.user,
      session,
      claims: claims as JwtPayload,
    };
  } catch (error) {
    logger.debug('Supabase token verification unavailable', sanitizeForLogging(error));
    return null;
  }
}

function verifyTokenLocally(token: string) {
  const secret = getEnvVar('SUPABASE_JWT_SECRET') || getEnvVar('JWT_SECRET');
  if (!secret) {
    logger.warn('JWT secret missing; local token verification disabled');
    return null;
  }

  try {
    const claims = jwt.verify(token, secret) as JwtPayload;
    if (!claims?.sub) {
      return null;
    }

    const session = buildSessionFromClaims(token, claims);
    return { user: session.user, session, claims };
  } catch (error) {
    logger.debug('Local token verification failed', sanitizeForLogging(error));
    return null;
  }
}

export async function verifyAccessToken(token: string) {
  const supabaseSession = await verifyTokenWithSupabase(token);
  if (supabaseSession) {
    return supabaseSession;
  }

  return verifyTokenLocally(token);
}

export function extractAccessTokenFromHeaders(
  headers: IncomingHttpHeaders
): string | null {
  const bearerToken = parseBearerToken(headers.authorization);
  if (bearerToken) {
    return bearerToken;
  }

  return getCookieTokenFromHeader(headers.cookie);
}

/**
 * Middleware to require authentication for protected routes
 * Adds user and session to request object if authenticated
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    const sessionCookie = getCookieToken(req);
    const bearerToken = parseBearerToken(authHeader);

    let session = null;
    let user = null;
    let claims: JwtPayload | null = null;

    // Try to get session from various sources
    if (bearerToken) {
      const verified = await verifyAccessToken(bearerToken);
      if (!verified) {
        throw new AuthenticationError('Invalid or expired token');
      }

      session = verified.session;
      user = verified.user;
      claims = verified.claims ?? null;
    } else if (sessionCookie) {
      const verified = await verifyAccessToken(sessionCookie);
      if (!verified) {
        throw new AuthenticationError('Invalid or expired token');
      }

      session = verified.session;
      user = verified.user;
      claims = verified.claims ?? null;
    } else {
      // Try to get current session from Supabase (may be from cookies)
      session = await authService.getSession();
      if (session?.access_token) {
        const verified = await verifyAccessToken(session.access_token);
        if (!verified) {
          throw new AuthenticationError('Invalid or expired token');
        }

        session = verified.session;
        user = verified.user;
        claims = verified.claims ?? null;
      } else {
        throw new AuthenticationError('Authentication required');
      }
    }

    if (!session || !user) {
      logger.warn('Authentication required but no valid session found', {
        path: sanitizeForLogging(req.path),
        method: req.method,
        ip: sanitizeForLogging(req.ip)
      });

      throw new AuthenticationError('Authentication required');
    }

    // Add user and session to request for use in handlers
    applyAuthContext(req, user, session, claims);

    logger.debug('Authentication successful', {
      userId: sanitizeForLogging(user.id),
      path: sanitizeForLogging(req.path),
      method: req.method
    });

    next();
  } catch (error) {
    logger.error('Authentication middleware error', sanitizeForLogging(error));

    if (error instanceof AuthenticationError) {
      res.status(401).json({ error: error.message });
      return;
    }

    res.status(500).json({ error: 'Authentication service error' });
  }
}

/**
 * Optional authentication middleware
 * Adds user/session to request if authenticated, but doesn't fail if not
 */
export async function optionalAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const bearerToken = parseBearerToken(req.headers.authorization);
    const sessionCookie = getCookieToken(req);
    let session = null;
    let user = null;
    let claims: JwtPayload | null = null;

    if (bearerToken) {
      const verified = await verifyAccessToken(bearerToken);
      session = verified?.session ?? null;
      user = verified?.user ?? null;
      claims = verified?.claims ?? null;
    } else if (sessionCookie) {
      const verified = await verifyAccessToken(sessionCookie);
      session = verified?.session ?? null;
      user = verified?.user ?? null;
      claims = verified?.claims ?? null;
    } else {
      session = await authService.getSession();
      if (session?.access_token) {
        const verified = await verifyAccessToken(session.access_token);
        session = verified?.session ?? null;
        user = verified?.user ?? null;
        claims = verified?.claims ?? null;
      } else {
        user = session?.user ?? null;
      }
    }

    if (user && session) {
      applyAuthContext(req, user, session, claims);

      logger.debug('Optional authentication successful', {
        userId: sanitizeForLogging(user.id),
        path: sanitizeForLogging(req.path)
      });
    }

    next();
  } catch (error) {
    // For optional auth, we don't fail on errors - just continue without auth
    logger.debug('Optional authentication failed, continuing without auth', {
      error: sanitizeForLogging(error),
      path: sanitizeForLogging(req.path)
    });

    next();
  }
}
