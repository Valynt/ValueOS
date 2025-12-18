/**
 * Authentication middleware for Express routes
 * Verifies user sessions using Supabase auth
 */

import { NextFunction, Request, Response } from 'express';
import { authService } from '../services/AuthService';
import { AuthenticationError } from '../services/errors';
import { createLogger } from '../lib/logger';
import { sanitizeForLogging } from '../lib/piiFilter';

const logger = createLogger({ component: 'AuthMiddleware' });

/**
 * Middleware to require authentication for protected routes
 * Adds user and session to request object if authenticated
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    const sessionCookie = req.cookies?.sb_access_token;

    let session = null;

    // Try to get session from various sources
    if (authHeader?.startsWith('Bearer ')) {
      // Bearer token in header - this would need custom implementation
      // For now, rely on Supabase client session
      session = await authService.getSession();
    } else if (sessionCookie) {
      // Session cookie - Supabase handles this automatically
      session = await authService.getSession();
    } else {
      // Try to get current session from Supabase (may be from cookies)
      session = await authService.getSession();
    }

    if (!session || !session.user) {
      logger.warn('Authentication required but no valid session found', {
        path: sanitizeForLogging(req.path),
        method: req.method,
        ip: sanitizeForLogging(req.ip)
      });

      throw new AuthenticationError('Authentication required');
    }

    // Add user and session to request for use in handlers
    (req as any).user = session.user;
    (req as any).session = session;

    logger.debug('Authentication successful', {
      userId: sanitizeForLogging(session.user.id),
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
    const session = await authService.getSession();

    if (session?.user) {
      (req as any).user = session.user;
      (req as any).session = session;

      logger.debug('Optional authentication successful', {
        userId: sanitizeForLogging(session.user.id),
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
