/**
 * Auth API Endpoints
 *
 * Wrapped with standard security middlewares:
 * - Security headers
 * - Service identity + nonce/timestamp
 * - CSRF protection
 * - Session idle/absolute timeout enforcement
 * - Rate limiting (strict by default)
 */

import { Request, Response } from 'express';
import { createSecureRouter } from '../middleware/secureRouter';
import { requireAuth } from '../middleware/auth';
import { validateRequest, ValidationSchemas } from '../middleware/inputValidation';
import { authService } from '../services/AuthService';
import { AuthenticationError, ValidationError } from '../services/errors';
import { createLogger } from '../lib/logger';
import { sanitizeForLogging } from '../lib/piiFilter';

const logger = createLogger({ component: 'AuthAPI' });
const router = createSecureRouter('strict');

router.post('/login', validateRequest(ValidationSchemas.login), async (req: Request, res: Response) => {
  try {
    const { email, password, otpCode } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required'
      });
    }

    const result = await authService.login({ email, password, otpCode });

    logger.info('User login successful', {
      userId: sanitizeForLogging(result.user.id),
      email: sanitizeForLogging(email)
    });

    // Return session info (client will handle token storage)
    res.json({
      user: {
        id: result.user.id,
        email: result.user.email,
        user_metadata: result.user.user_metadata
      },
      session: {
        access_token: result.session.access_token,
        refresh_token: result.session.refresh_token,
        expires_at: result.session.expires_at
      }
    });
  } catch (error) {
    logger.error('Login failed', sanitizeForLogging(error));

    if (error instanceof AuthenticationError) {
      return res.status(401).json({ error: error.message });
    }
    if (error instanceof ValidationError) {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/signup', validateRequest(ValidationSchemas.signup), async (req: Request, res: Response) => {
  try {
    const { email, password, fullName } = req.body;

    if (!email || !password || !fullName) {
      return res.status(400).json({
        error: 'Email, password, and full name are required'
      });
    }

    const result = await authService.signup({ email, password, fullName });

    logger.info('User signup successful', {
      userId: sanitizeForLogging(result.user.id),
      email: sanitizeForLogging(email)
    });

    res.status(201).json({
      user: {
        id: result.user.id,
        email: result.user.email,
        user_metadata: result.user.user_metadata
      },
      session: {
        access_token: result.session.access_token,
        refresh_token: result.session.refresh_token,
        expires_at: result.session.expires_at
      }
    });
  } catch (error) {
    logger.error('Signup failed', sanitizeForLogging(error));

    if (error instanceof ValidationError) {
      return res.status(400).json({ error: error.message });
    }
    if (error instanceof AuthenticationError) {
      return res.status(409).json({ error: error.message });
    }

    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/password/reset', validateRequest({
  email: { type: 'email' as const, required: true }
}), async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: 'Email is required'
      });
    }

    await authService.requestPasswordReset(email);

    logger.info('Password reset requested', {
      email: sanitizeForLogging(email)
    });

    // Always return success to prevent email enumeration
    res.json({
      message: 'If an account with that email exists, a password reset link has been sent.'
    });
  } catch (error) {
    logger.error('Password reset request failed', sanitizeForLogging(error));
    // Don't expose internal errors for security
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/password/update', requireAuth, async (req: Request, res: Response) => {
  try {
    const { newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({
        error: 'New password is required'
      });
    }

    await authService.updatePassword(newPassword);

    logger.info('Password updated successfully', {
      userId: sanitizeForLogging((req as any).user.id)
    });

    res.json({
      message: 'Password updated successfully'
    });
  } catch (error) {
    logger.error('Password update failed', sanitizeForLogging(error));

    if (error instanceof ValidationError) {
      return res.status(400).json({ error: error.message });
    }
    if (error instanceof AuthenticationError) {
      return res.status(401).json({ error: error.message });
    }

    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/logout', async (req: Request, res: Response) => {
  try {
    await authService.logout();

    logger.info('User logout successful');

    res.json({
      message: 'Logged out successfully'
    });
  } catch (error) {
    logger.error('Logout failed', sanitizeForLogging(error));
    // Logout should always succeed on client side
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/session', async (req: Request, res: Response) => {
  try {
    const session = await authService.getSession();

    if (!session) {
      return res.status(401).json({ error: 'No active session' });
    }

    res.json({
      user: {
        id: session.user.id,
        email: session.user.email,
        user_metadata: session.user.user_metadata
      },
      session: {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: session.expires_at
      }
    });
  } catch (error) {
    logger.error('Session retrieval failed', sanitizeForLogging(error));
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const result = await authService.refreshSession();

    logger.info('Session refresh successful', {
      userId: sanitizeForLogging(result.user.id)
    });

    res.json({
      user: {
        id: result.user.id,
        email: result.user.email,
        user_metadata: result.user.user_metadata
      },
      session: {
        access_token: result.session.access_token,
        refresh_token: result.session.refresh_token,
        expires_at: result.session.expires_at
      }
    });
  } catch (error) {
    logger.error('Session refresh failed', sanitizeForLogging(error));

    if (error instanceof AuthenticationError) {
      return res.status(401).json({ error: error.message });
    }

    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

