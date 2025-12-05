/**
 * Audit Hooks Middleware
 * 
 * AUD-302: Automatic audit logging for critical operations
 * 
 * Hooks into:
 * - Data exports
 * - API key views/rotations
 * - Bulk deletions
 * - Permission changes
 * - Role assignments
 * - Tenant provisioning
 */

import { Request, Response, NextFunction } from 'express';
import { auditLogService } from '../services/AuditLogService';
import { logger } from '../lib/logger';

/**
 * Extract user info from request
 */
function getUserInfo(req: Request): {
  userId: string;
  userName: string;
  userEmail: string;
} {
  const user = req.user as any;
  return {
    userId: user?.id || 'anonymous',
    userName: user?.name || user?.email || 'Anonymous',
    userEmail: user?.email || 'unknown@example.com',
  };
}

/**
 * Extract request metadata
 */
function getRequestMetadata(req: Request): {
  ipAddress: string;
  userAgent: string;
} {
  return {
    ipAddress: req.ip || req.socket.remoteAddress || 'unknown',
    userAgent: req.get('user-agent') || 'unknown',
  };
}

/**
 * Audit data export operations
 */
export function auditDataExport(resourceType: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = getUserInfo(req);
    const metadata = getRequestMetadata(req);
    const startTime = Date.now();

    // Store original send function
    const originalSend = res.send;
    const originalJson = res.json;

    // Intercept response to log after completion
    const logExport = async (success: boolean, recordCount?: number) => {
      try {
        await auditLogService.log({
          ...user,
          ...metadata,
          action: 'data_export',
          resourceType,
          resourceId: req.params.id || 'bulk',
          status: success ? 'success' : 'failed',
          details: {
            recordCount,
            duration: Date.now() - startTime,
            format: req.query.format || 'json',
          },
        });
      } catch (error) {
        logger.error('Failed to log data export audit', error instanceof Error ? error : undefined);
      }
    };

    // Override send
    res.send = function (data: any) {
      logExport(res.statusCode < 400, data?.length);
      return originalSend.call(this, data);
    };

    // Override json
    res.json = function (data: any) {
      logExport(res.statusCode < 400, data?.length || data?.count);
      return originalJson.call(this, data);
    };

    next();
  };
}

/**
 * Audit API key operations
 */
export function auditAPIKeyOperation(operation: 'view' | 'create' | 'rotate' | 'revoke') {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = getUserInfo(req);
    const metadata = getRequestMetadata(req);

    // Store original send function
    const originalJson = res.json;

    // Intercept response
    res.json = function (data: any) {
      // Log after response
      setImmediate(async () => {
        try {
          await auditLogService.log({
            ...user,
            ...metadata,
            action: `api_key_${operation}`,
            resourceType: 'api_key',
            resourceId: req.params.keyId || data?.id || 'unknown',
            status: res.statusCode < 400 ? 'success' : 'failed',
            details: {
              operation,
            },
          });
        } catch (error) {
          logger.error('Failed to log API key audit', error instanceof Error ? error : undefined);
        }
      });

      return originalJson.call(this, data);
    };

    next();
  };
}

/**
 * Audit bulk deletion operations
 */
export function auditBulkDelete(resourceType: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = getUserInfo(req);
    const metadata = getRequestMetadata(req);
    const recordIds = req.body.ids || req.body.records || [];

    // Store original json function
    const originalJson = res.json;

    // Intercept response
    res.json = function (data: any) {
      // Log after response
      setImmediate(async () => {
        try {
          await auditLogService.log({
            ...user,
            ...metadata,
            action: 'bulk_delete',
            resourceType,
            resourceId: 'bulk',
            status: res.statusCode < 400 ? 'success' : 'failed',
            details: {
              recordCount: recordIds.length,
              deletedCount: data?.deletedCount || data?.count,
            },
          });
        } catch (error) {
          logger.error('Failed to log bulk delete audit', error instanceof Error ? error : undefined);
        }
      });

      return originalJson.call(this, data);
    };

    next();
  };
}

/**
 * Audit permission changes
 */
export function auditPermissionChange() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = getUserInfo(req);
    const metadata = getRequestMetadata(req);
    const targetUserId = req.params.userId || req.body.userId;
    const permission = req.body.permission;
    const granted = req.method === 'POST' || req.body.granted;

    // Store original json function
    const originalJson = res.json;

    // Intercept response
    res.json = function (data: any) {
      // Log after response
      setImmediate(async () => {
        try {
          await auditLogService.log({
            ...user,
            ...metadata,
            action: granted ? 'permission_grant' : 'permission_revoke',
            resourceType: 'user_permission',
            resourceId: targetUserId,
            status: res.statusCode < 400 ? 'success' : 'failed',
            details: {
              permission,
              granted,
            },
          });
        } catch (error) {
          logger.error('Failed to log permission change audit', error instanceof Error ? error : undefined);
        }
      });

      return originalJson.call(this, data);
    };

    next();
  };
}

/**
 * Audit role assignments
 */
export function auditRoleAssignment() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = getUserInfo(req);
    const metadata = getRequestMetadata(req);
    const targetUserId = req.params.userId || req.body.userId;
    const role = req.body.role;
    const assigned = req.method === 'POST' || req.body.assigned;

    // Store original json function
    const originalJson = res.json;

    // Intercept response
    res.json = function (data: any) {
      // Log after response
      setImmediate(async () => {
        try {
          await auditLogService.log({
            ...user,
            ...metadata,
            action: assigned ? 'role_assign' : 'role_remove',
            resourceType: 'user_role',
            resourceId: targetUserId,
            status: res.statusCode < 400 ? 'success' : 'failed',
            details: {
              role,
              assigned,
            },
          });
        } catch (error) {
          logger.error('Failed to log role assignment audit', error instanceof Error ? error : undefined);
        }
      });

      return originalJson.call(this, data);
    };

    next();
  };
}

/**
 * Audit tenant provisioning
 */
export function auditTenantProvisioning(operation: 'provision' | 'deprovision' | 'suspend' | 'reactivate') {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = getUserInfo(req);
    const metadata = getRequestMetadata(req);
    const tenantId = req.params.tenantId || req.body.organizationId;

    // Store original json function
    const originalJson = res.json;

    // Intercept response
    res.json = function (data: any) {
      // Log after response
      setImmediate(async () => {
        try {
          await auditLogService.log({
            ...user,
            ...metadata,
            action: `tenant_${operation}`,
            resourceType: 'tenant',
            resourceId: tenantId,
            status: res.statusCode < 400 ? 'success' : 'failed',
            details: {
              operation,
              tenantName: req.body.name || data?.name,
              tier: req.body.tier || data?.tier,
            },
          });
        } catch (error) {
          logger.error('Failed to log tenant provisioning audit', error instanceof Error ? error : undefined);
        }
      });

      return originalJson.call(this, data);
    };

    next();
  };
}

/**
 * Audit settings changes
 */
export function auditSettingsChange(settingsType: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = getUserInfo(req);
    const metadata = getRequestMetadata(req);

    // Store original json function
    const originalJson = res.json;

    // Intercept response
    res.json = function (data: any) {
      // Log after response
      setImmediate(async () => {
        try {
          await auditLogService.log({
            ...user,
            ...metadata,
            action: 'settings_change',
            resourceType: settingsType,
            resourceId: req.params.id || 'global',
            status: res.statusCode < 400 ? 'success' : 'failed',
            details: {
              changedFields: Object.keys(req.body),
            },
          });
        } catch (error) {
          logger.error('Failed to log settings change audit', error instanceof Error ? error : undefined);
        }
      });

      return originalJson.call(this, data);
    };

    next();
  };
}

/**
 * Generic audit middleware
 */
export function auditOperation(
  action: string,
  resourceType: string,
  getResourceId?: (req: Request) => string
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = getUserInfo(req);
    const metadata = getRequestMetadata(req);
    const resourceId = getResourceId ? getResourceId(req) : req.params.id || 'unknown';

    // Store original json function
    const originalJson = res.json;

    // Intercept response
    res.json = function (data: any) {
      // Log after response
      setImmediate(async () => {
        try {
          await auditLogService.log({
            ...user,
            ...metadata,
            action,
            resourceType,
            resourceId,
            status: res.statusCode < 400 ? 'success' : 'failed',
            details: {
              method: req.method,
              path: req.path,
            },
          });
        } catch (error) {
          logger.error('Failed to log audit', error instanceof Error ? error : undefined);
        }
      });

      return originalJson.call(this, data);
    };

    next();
  };
}
