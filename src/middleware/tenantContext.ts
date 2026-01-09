/**
 * Tenant Context Middleware
 *
 * Resolves and validates tenant context for authenticated requests.
 */

import { NextFunction, Request, Response } from 'express';
import { createLogger } from '../lib/logger';
import { getUserTenantId, verifyTenantMembership } from '../lib/tenantVerification';
import { TenantAwareService } from '../services/TenantAwareService';

type TenantResolutionResult = {
  tenantId?: string;
  source?: 'service-header' | 'user' | 'lookup';
};

const logger = createLogger({ component: 'tenant-context' });

class TenantContextResolver extends TenantAwareService {
  constructor() {
    super('TenantContextResolver');
  }

  async hasTenantAccess(userId: string, tenantId: string): Promise<boolean> {
    try {
      const tenants = await this.getUserTenants(userId);
      return tenants.includes(tenantId);
    } catch (error) {
      logger.warn('Tenant access lookup failed', {
        userId,
        tenantId,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }
}

const tenantContextResolver = new TenantContextResolver();

/**
 * Extend Express Request to include tenant context.
 */
declare global {
  namespace Express {
    interface Request {
      tenantId?: string;
      serviceIdentityVerified?: boolean;
    }
  }
}

function resolveTenantCandidate(req: Request): TenantResolutionResult {
  const headerTenantId = req.header('x-tenant-id');
  if (headerTenantId) {
    return { tenantId: headerTenantId, source: 'service-header' };
  }

  const user = req.user as any;
  const userTenantId = user?.tenant_id || user?.organizationId || user?.organization_id;
  if (userTenantId) {
    return { tenantId: userTenantId, source: 'user' };
  }

  return {};
}

export function tenantContextMiddleware() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?.id;
    const { tenantId: candidateTenantId, source } = resolveTenantCandidate(req);

    if (source === 'service-header' && !req.serviceIdentityVerified) {
      logger.warn('Blocked external tenant header usage', {
        userId,
        path: req.path,
      });
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Tenant header is restricted to internal service requests.',
      });
    }

    if (!candidateTenantId && !userId) {
      return next();
    }

    let resolvedTenantId = candidateTenantId;

    if (!resolvedTenantId && userId) {
      resolvedTenantId = await getUserTenantId(userId) || undefined;
    }

    if (!resolvedTenantId) {
      return next();
    }

    if (userId) {
      const hasAccess = await tenantContextResolver.hasTenantAccess(userId, resolvedTenantId);
      if (!hasAccess) {
        const verified = await verifyTenantMembership(userId, resolvedTenantId);
        if (!verified) {
          logger.warn('Tenant membership verification failed', {
            userId,
            tenantId: resolvedTenantId,
            path: req.path,
          });
          return res.status(403).json({
            error: 'Forbidden',
            message: 'Tenant access denied.',
          });
        }
      }
    }

    req.tenantId = resolvedTenantId;

    return next();
  };
}
