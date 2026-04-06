import { NextFunction, Request, Response } from 'express';
import { JwtPayload } from 'jsonwebtoken';

import { auditLogService } from '../../services/AuditLogService.js';

import { createLogger } from '@shared/lib/logger';
import { sanitizeForLogging } from '@shared/lib/piiFilter';
import { AuthUser } from './types.js';

const logger = createLogger({ component: 'AuthMiddleware' });

/**
 * Extract the tenant ID from verified auth sources only.
 *
 * SECURITY (B-3): `claims?.organization_id` has been removed as a fallback.
 * `organization_id` is a legacy field that is NOT equivalent to `tenant_id`.
 * Because `decodeClaims()` uses `jwt.decode()` (no signature verification),
 * an attacker with a valid JWT could supply a tampered `organization_id` claim
 * and have it win over the Supabase-authoritative `tenant_id`, enabling
 * cross-tenant data access.
 *
 * Authoritative resolution order (all Supabase-verified):
 *   1. claims.tenant_id
 *   2. claims.app_metadata.tenant_id
 *   3. user.app_metadata.tenant_id  (from auth.getUser() response)
 *   4. user.tenant_id
 *
 * Do NOT re-add organization_id without a security review.
 */
export function extractTenantId(claims: JwtPayload | null, user?: AuthUser): string | undefined {
  return (
    (claims?.tenant_id as string | undefined) ??
    (claims?.app_metadata as { tenant_id?: string } | undefined)?.tenant_id ??
    (user?.app_metadata?.tenant_id as string | undefined) ??
    (user?.tenant_id as string | undefined)
  );
}

function readStringRecordValue(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function extractRequestedTenantId(req: Request): string | undefined {
  const params = req.params as Record<string, string | undefined>;
  const query = req.query as Record<string, string | string[] | undefined>;
  const body = (req.body ?? {}) as Record<string, unknown>;

  const queryValue = (key: string): string | undefined => {
    const value = query[key];
    if (typeof value === 'string' && value.length > 0) return value;
    if (Array.isArray(value)) {
      const first = value[0];
      return typeof first === 'string' && first.length > 0 ? first : undefined;
    }
    return undefined;
  };

  const context = body.context;
  const contextRecord = context && typeof context === 'object' ? (context as Record<string, unknown>) : undefined;

  return (
    params.tenantId ??
    params.tenant_id ??
    params.organizationId ??
    params.organization_id ??
    req.header('x-tenant-id') ??
    req.header('x-organization-id') ??
    queryValue('tenantId') ??
    queryValue('tenant_id') ??
    queryValue('organizationId') ??
    queryValue('organization_id') ??
    readStringRecordValue(body, 'tenantId') ??
    readStringRecordValue(body, 'tenant_id') ??
    readStringRecordValue(body, 'organizationId') ??
    readStringRecordValue(body, 'organization_id') ??
    (contextRecord ? readStringRecordValue(contextRecord, 'tenantId') : undefined) ??
    (contextRecord ? readStringRecordValue(contextRecord, 'tenant_id') : undefined) ??
    (contextRecord ? readStringRecordValue(contextRecord, 'organizationId') : undefined) ??
    (contextRecord ? readStringRecordValue(contextRecord, 'organization_id') : undefined)
  );
}

type TenantGuardRejectionReason = 'token_tenant_missing' | 'requested_tenant_missing' | 'tenant_mismatch';

async function logTenantGuardRejection(
  req: Request,
  reason: TenantGuardRejectionReason,
  details: Record<string, unknown>
): Promise<void> {
  try {
    await auditLogService.logAudit({
      userId: req.user?.id ?? 'unknown',
      userName: req.user?.email ?? 'Unknown User',
      userEmail: req.user?.email ?? 'unknown@valueos.local',
      action: 'auth.tenant_guard_rejected',
      resourceType: 'tenant_access',
      resourceId: req.path || 'unknown_path',
      status: 'failed',
      details: {
        reason,
        method: req.method,
        path: req.path,
        requestId: req.requestId,
        ...details,
      },
    });
  } catch (error) {
    logger.error('Failed to write tenant guard rejection audit log', error instanceof Error ? error : undefined, {
      reason,
      path: sanitizeForLogging(req.path),
    });
  }
}

export function requireTenantRequestAlignment() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const tokenTenantId =
      req.tenantId ||
      req.user?.tenant_id ||
      (req.user?.organization_id as string | undefined) ||
      req.organizationId;
    const requestedTenantId = extractRequestedTenantId(req);

    if (!tokenTenantId) {
      await logTenantGuardRejection(req, 'token_tenant_missing', {
        requestedTenantId,
      });
      res.status(403).json({
        error: 'tenant_forbidden',
        message: 'Authenticated token must include tenant context.',
      });
      return;
    }

    if (!requestedTenantId) {
      await logTenantGuardRejection(req, 'requested_tenant_missing', {
        tokenTenantId,
      });
      res.status(403).json({
        error: 'tenant_required',
        message: 'Requested tenant context is required.',
      });
      return;
    }

    if (tokenTenantId !== requestedTenantId) {
      await logTenantGuardRejection(req, 'tenant_mismatch', {
        tokenTenantId,
        requestedTenantId,
      });
      res.status(403).json({
        error: 'tenant_mismatch',
        message: 'Requested tenant does not match authenticated tenant.',
      });
      return;
    }

    next();
  };
}
