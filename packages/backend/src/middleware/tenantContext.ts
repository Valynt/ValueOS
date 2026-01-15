import { NextFunction, Request, Response } from 'express';
import { createLogger } from '../lib/logger';
import { getUserTenantId, verifyTenantExists, verifyTenantMembership } from '../lib/tenantVerification';

type TenantCandidateSource = 'service-header' | 'user-claim' | 'request' | 'none';

const logger = createLogger({ component: 'TenantContextMiddleware' });

export function resolveTenantCandidate(req: Request): { tenantId: string | null; source: TenantCandidateSource } {
  const tenantHeader = req.header('x-tenant-id');
  if (tenantHeader) {
    return { tenantId: tenantHeader, source: 'service-header' };
  }

  const user = (req as any).user;
  const userTenantId = user?.tenant_id || user?.organization_id;
  if (userTenantId) {
    return { tenantId: userTenantId, source: 'user-claim' };
  }

  const routeTenantId = (req.params as { tenantId?: string } | undefined)?.tenantId;
  if (routeTenantId) {
    return { tenantId: routeTenantId, source: 'request' };
  }

  return { tenantId: null, source: 'none' };
}

export function tenantContextMiddleware() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as any).user?.id;
    const { tenantId: candidateTenantId, source } = resolveTenantCandidate(req);

    if (source === 'service-header' && !(req as any).serviceIdentityVerified) {
      logger.warn('Blocked external tenant header usage', {
        userId,
        path: req.path,
      });
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Tenant header is restricted to internal service requests.',
      });
    }

    let resolvedTenantId = candidateTenantId;

    if (!resolvedTenantId && userId) {
      resolvedTenantId = await getUserTenantId(userId);
      if (!resolvedTenantId) {
        return next();
      }

      (req as any).tenantId = resolvedTenantId;
      (req as any).tenantSource = 'user-lookup';
      return next();
    }

    if (!resolvedTenantId) {
      return next();
    }

    const tenantExists = await verifyTenantExists(resolvedTenantId);
    if (!tenantExists) {
      logger.warn('Tenant context resolved to inactive or unknown tenant', {
        userId,
        tenantId: resolvedTenantId,
        source,
      });
      return res.status(404).json({
        error: 'Not Found',
        message: 'Tenant not found or inactive.',
      });
    }

    if (userId) {
      const isMember = await verifyTenantMembership(userId, resolvedTenantId);
      if (!isMember) {
        logger.warn('Tenant membership verification failed', {
          userId,
          tenantId: resolvedTenantId,
          source,
        });
        return res.status(403).json({
          error: 'Forbidden',
          message: 'User does not belong to tenant.',
        });
      }
    }

    (req as any).tenantId = resolvedTenantId;
    (req as any).tenantSource = source;
    return next();
  };
}
