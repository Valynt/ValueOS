import { Router } from 'express';
import {
  csrfProtectionMiddleware,
  securityHeadersMiddleware,
  sessionTimeoutMiddleware,
} from './securityMiddleware';
import { serviceIdentityMiddleware } from './serviceIdentityMiddleware';
import { rateLimiters, RateLimitTier } from './rateLimiter';

/**
 * Factory for new routers with standard security middlewares pre-applied.
 * Use for future auth/state-changing routes to ensure consistent protections.
 */
export function createSecureRouter(tier: RateLimitTier = 'standard'): ReturnType<typeof Router> {
  const router = Router();
  router.use(securityHeadersMiddleware);
  router.use(serviceIdentityMiddleware);
  router.use(csrfProtectionMiddleware);
  router.use(sessionTimeoutMiddleware);
  router.use(rateLimiters[tier]);
  return router;
}

