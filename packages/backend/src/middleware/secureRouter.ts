import { Router } from 'express';

import { rateLimiters, RateLimitTier, type RateLimitTierValue } from './rateLimiter.js'
import { requestAuditMiddleware } from './requestAuditMiddleware.js'
import { cspNonceMiddleware, securityHeadersMiddleware } from './securityHeaders.js';
import {
  csrfProtectionMiddleware,
  csrfTokenMiddleware,
} from './securityMiddleware';
import { serviceIdentityMiddleware } from './serviceIdentityMiddleware.js'
import { sessionTimeoutMiddleware } from './sessionTimeoutMiddleware.js'

/**
 * Factory for new routers with standard security middlewares pre-applied.
 * Use for future auth/state-changing routes to ensure consistent protections.
 */
export function createSecureRouter(
  tier: RateLimitTierValue = RateLimitTier.STANDARD
): ReturnType<typeof Router> {
  const router = Router();
  router.use(requestAuditMiddleware());
  router.use(cspNonceMiddleware);
  router.use(securityHeadersMiddleware);
  router.use(serviceIdentityMiddleware);
  router.use(csrfTokenMiddleware);
  router.use(csrfProtectionMiddleware);
  router.use(sessionTimeoutMiddleware);
  router.use(rateLimiters[tier]);
  return router;
}
