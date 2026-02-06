import { Router } from 'express';
import {
  csrfProtectionMiddleware,
  securityHeadersMiddleware,
} from './securityMiddleware';
import { sessionTimeoutMiddleware } from './sessionTimeoutMiddleware';
import { serviceIdentityMiddleware } from './serviceIdentityMiddleware';
import { rateLimiters, RateLimitTier } from './rateLimiter';
import { requestAuditMiddleware } from './requestAuditMiddleware';
import { requestSanitizationMiddleware } from './requestSanitizationMiddleware';

/**
 * Factory for new routers with standard security middlewares pre-applied.
 * Use for future auth/state-changing routes to ensure consistent protections.
 */
export function createSecureRouter(tier: RateLimitTier = 'standard'): ReturnType<typeof Router> {
  const router = Router();
  router.use(requestAuditMiddleware());
  router.use(securityHeadersMiddleware);
  router.use(serviceIdentityMiddleware);
  router.use(requestSanitizationMiddleware());
  router.use(csrfProtectionMiddleware);
  router.use(sessionTimeoutMiddleware);
  router.use(rateLimiters[tier]);
  return router;
}
