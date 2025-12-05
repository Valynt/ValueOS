/**
 * Phase 1: Session Timeout Middleware
 * 
 * Enforces:
 * - Absolute timeout: 1 hour (3600s)
 * - Idle timeout: 30 minutes (1800s)
 * - Token validation
 */

import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';

// Session configuration
const SESSION_CONFIG = {
  ABSOLUTE_TIMEOUT_MS: 60 * 60 * 1000,  // 1 hour
  IDLE_TIMEOUT_MS: 30 * 60 * 1000,      // 30 minutes
  CLOCK_SKEW_MS: 5 * 1000,              // 5 seconds tolerance
};

// Initialize Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
);

/**
 * Session metadata stored in Redis/memory
 */
interface SessionMetadata {
  userId: string;
  createdAt: number;
  lastActivityAt: number;
  absoluteExpiresAt: number;
  idleExpiresAt: number;
}

/**
 * In-memory session store (use Redis in production)
 */
class SessionStore {
  private sessions: Map<string, SessionMetadata> = new Map();

  set(sessionId: string, metadata: SessionMetadata): void {
    this.sessions.set(sessionId, metadata);
  }

  get(sessionId: string): SessionMetadata | undefined {
    return this.sessions.get(sessionId);
  }

  delete(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  updateActivity(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      const now = Date.now();
      session.lastActivityAt = now;
      session.idleExpiresAt = now + SESSION_CONFIG.IDLE_TIMEOUT_MS;
      this.sessions.set(sessionId, session);
    }
  }

  // Cleanup expired sessions periodically
  cleanup(): void {
    const now = Date.now();
    for (const [sessionId, metadata] of this.sessions.entries()) {
      if (metadata.absoluteExpiresAt < now || metadata.idleExpiresAt < now) {
        this.sessions.delete(sessionId);
      }
    }
  }
}

const sessionStore = new SessionStore();

// Cleanup expired sessions every 5 minutes
setInterval(() => {
  sessionStore.cleanup();
}, 5 * 60 * 1000);

/**
 * Extract JWT from Authorization header or cookie
 */
function extractToken(req: Request): string | null {
  // Check Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Check cookie
  const cookieToken = req.cookies?.['sb-access-token'];
  if (cookieToken) {
    return cookieToken;
  }

  return null;
}

/**
 * Decode JWT without verification (just to read claims)
 */
function decodeJWT(token: string): any {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const payload = parts[1];
    const decoded = Buffer.from(payload, 'base64').toString('utf-8');
    return JSON.parse(decoded);
  } catch (error) {
    return null;
  }
}

/**
 * Session timeout middleware
 */
export async function sessionTimeoutMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token = extractToken(req);

  // Skip if no token (public routes)
  if (!token) {
    return next();
  }

  try {
    // Decode JWT to get claims
    const payload = decodeJWT(token);
    if (!payload) {
      return res.status(401).json({
        error: 'Invalid token format',
        code: 'INVALID_TOKEN',
      });
    }

    const { sub: userId, iat, exp, session_id } = payload;
    const now = Math.floor(Date.now() / 1000);

    // ========================================================================
    // 1. Check JWT Expiry (with clock skew tolerance)
    // ========================================================================
    if (exp && exp + SESSION_CONFIG.CLOCK_SKEW_MS / 1000 < now) {
      return res.status(401).json({
        error: 'Token expired',
        code: 'TOKEN_EXPIRED',
        expiresAt: exp,
        currentTime: now,
      });
    }

    // ========================================================================
    // 2. Check Absolute Timeout (1 hour from iat)
    // ========================================================================
    const tokenAge = now - iat;
    const maxAge = SESSION_CONFIG.ABSOLUTE_TIMEOUT_MS / 1000;

    if (tokenAge > maxAge) {
      return res.status(401).json({
        error: 'Session expired due to absolute timeout (1 hour)',
        code: 'SESSION_ABSOLUTE_TIMEOUT',
        tokenAge,
        maxAge,
      });
    }

    // ========================================================================
    // 3. Check Idle Timeout (30 minutes)
    // ========================================================================
    const sessionId = session_id || `${userId}:${iat}`;
    let sessionMetadata = sessionStore.get(sessionId);

    if (!sessionMetadata) {
      // First request with this token - create session metadata
      const nowMs = Date.now();
      sessionMetadata = {
        userId,
        createdAt: iat * 1000,
        lastActivityAt: nowMs,
        absoluteExpiresAt: iat * 1000 + SESSION_CONFIG.ABSOLUTE_TIMEOUT_MS,
        idleExpiresAt: nowMs + SESSION_CONFIG.IDLE_TIMEOUT_MS,
      };
      sessionStore.set(sessionId, sessionMetadata);
    } else {
      // Check idle timeout
      const nowMs = Date.now();
      const idleTime = nowMs - sessionMetadata.lastActivityAt;

      if (idleTime > SESSION_CONFIG.IDLE_TIMEOUT_MS) {
        sessionStore.delete(sessionId);
        return res.status(440).json({
          error: 'Session expired due to inactivity (30 minutes idle)',
          code: 'SESSION_IDLE_TIMEOUT',
          idleTime: Math.floor(idleTime / 1000),
          maxIdle: SESSION_CONFIG.IDLE_TIMEOUT_MS / 1000,
        });
      }

      // Update last activity
      sessionStore.updateActivity(sessionId);
    }

    // ========================================================================
    // 4. Attach user info to request
    // ========================================================================
    (req as any).user = {
      id: userId,
      sessionId,
      tokenIssuedAt: iat,
      tokenExpiresAt: exp,
    };

    // Add session info to response headers
    res.setHeader('X-Session-Expires-In', String(exp - now));
    res.setHeader('X-Session-Idle-Timeout', String(SESSION_CONFIG.IDLE_TIMEOUT_MS / 1000));

    next();
  } catch (error) {
    console.error('Session timeout middleware error:', error);
    return res.status(500).json({
      error: 'Session validation failed',
      code: 'SESSION_VALIDATION_ERROR',
    });
  }
}

/**
 * Strict session timeout middleware (for sensitive routes)
 * Reduces idle timeout to 10 minutes
 */
export async function strictSessionTimeoutMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const STRICT_IDLE_TIMEOUT_MS = 10 * 60 * 1000;  // 10 minutes for sensitive routes

  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({
      error: 'Authentication required',
      code: 'AUTH_REQUIRED',
    });
  }

  try {
    const payload = decodeJWT(token);
    if (!payload) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { sub: userId, iat, session_id } = payload;
    const sessionId = session_id || `${userId}:${iat}`;
    const sessionMetadata = sessionStore.get(sessionId);

    if (sessionMetadata) {
      const nowMs = Date.now();
      const idleTime = nowMs - sessionMetadata.lastActivityAt;

      if (idleTime > STRICT_IDLE_TIMEOUT_MS) {
        sessionStore.delete(sessionId);
        return res.status(440).json({
          error: 'Sensitive operation timeout (10 minutes idle)',
          code: 'STRICT_SESSION_TIMEOUT',
          idleTime: Math.floor(idleTime / 1000),
        });
      }

      sessionStore.updateActivity(sessionId);
    }

    next();
  } catch (error) {
    console.error('Strict session timeout error:', error);
    return res.status(500).json({ error: 'Session validation failed' });
  }
}

/**
 * Helper: Invalidate session (logout)
 */
export function invalidateSession(req: Request): void {
  const token = extractToken(req);
  if (!token) return;

  const payload = decodeJWT(token);
  if (!payload) return;

  const { sub: userId, iat, session_id } = payload;
  const sessionId = session_id || `${userId}:${iat}`;
  sessionStore.delete(sessionId);
}

/**
 * Helper: Get remaining session time
 */
export function getSessionTimeRemaining(req: Request): {
  absoluteRemaining: number;
  idleRemaining: number;
} | null {
  const token = extractToken(req);
  if (!token) return null;

  const payload = decodeJWT(token);
  if (!payload) return null;

  const { sub: userId, iat, exp, session_id } = payload;
  const sessionId = session_id || `${userId}:${iat}`;
  const sessionMetadata = sessionStore.get(sessionId);

  if (!sessionMetadata) return null;

  const nowMs = Date.now();
  const now = Math.floor(nowMs / 1000);

  return {
    absoluteRemaining: exp - now,
    idleRemaining: Math.floor((sessionMetadata.idleExpiresAt - nowMs) / 1000),
  };
}

export default sessionTimeoutMiddleware;
