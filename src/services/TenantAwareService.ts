/**
 * Tenant-Aware Service Base Class
 * 
 * CRITICAL: All services handling multi-tenant data MUST extend this class.
 * Provides defense-in-depth tenant isolation even if RLS fails.
 */

import { logger } from '../lib/logger';
import { BaseService } from './BaseService';
import { AuthorizationError, ValidationError } from './errors';
import { createLogger } from '../lib/logger';

const logger = createLogger({ component: 'TenantAwareService' });

export interface TenantContext {
  userId: string;
  tenantId: string;
  tenantIds: string[]; // User may belong to multiple tenants
}

export class TenantAwareService extends BaseService {
  /**
   * Get all tenants a user belongs to
   * CRITICAL: This is the source of truth for tenant access
   */
  protected async getUserTenants(userId: string): Promise<string[]> {
    const { data, error } = await this.supabase
      .from('user_tenants')
      .select('tenant_id')
      .eq('user_id', userId)
      .eq('status', 'active');

    if (error) {
      logger.error('Failed to fetch user tenants', error, { userId });
      throw error;
    }

    if (!data || data.length === 0) {
      logger.warn('User has no active tenants', { userId });
      throw new AuthorizationError('No active tenant membership', { userId });
    }

    return data.map(row => row.tenant_id);
  }

  /**
   * Validate that a user has access to a specific tenant
   * CRITICAL: Call this before ANY tenant-scoped operation
   */
  protected async validateTenantAccess(
    userId: string,
    resourceTenantId: string
  ): Promise<void> {
    const userTenants = await this.getUserTenants(userId);
    
    if (!userTenants.includes(resourceTenantId)) {
      logger.error('Cross-tenant access attempt blocked', undefined, {
        userId,
        attemptedTenant: resourceTenantId,
        userTenants,
        severity: 'CRITICAL'
      });

      // Log to audit trail
      await this.auditCrossTenantAttempt(userId, resourceTenantId);

      throw new AuthorizationError(
        'Access denied: Resource belongs to different tenant',
        { 
          userId, 
          attemptedTenant: resourceTenantId,
          // DO NOT expose user's actual tenants in error
        }
      );
    }
  }

  /**
   * Query with automatic tenant filtering
   * CRITICAL: Use this instead of raw Supabase queries
   */
  protected async queryWithTenantCheck<T>(
    table: string,
    userId: string,
    filters: Record<string, unknown> = {}
  ): Promise<T[]> {
    // Get user's tenants
    const tenants = await this.getUserTenants(userId);
    
    logger.debug('Querying with tenant check', {
      table,
      userId,
      tenantCount: tenants.length
    });

    // ALWAYS add tenant filter - defense in depth
    const { data, error } = await this.supabase
      .from(table)
      .select('*')
      .in('tenant_id', tenants)
      .match(filters);
      
    if (error) {
      logger.error('Tenant-aware query failed', error, { table, userId });
      throw error;
    }

    return data as T[];
  }

  /**
   * Insert with automatic tenant assignment
   * CRITICAL: Prevents inserting data into wrong tenant
   */
  protected async insertWithTenantCheck<T>(
    table: string,
    userId: string,
    tenantId: string,
    data: Record<string, unknown>
  ): Promise<T> {
    // Validate user has access to this tenant
    await this.validateTenantAccess(userId, tenantId);

    // Force tenant_id in data (prevent override)
    const safeData = {
      ...data,
      tenant_id: tenantId, // ALWAYS override
      created_by: userId,
      created_at: new Date().toISOString(),
    };

    logger.debug('Inserting with tenant check', {
      table,
      userId,
      tenantId
    });

    const { data: result, error } = await this.supabase
      .from(table)
      .insert(safeData)
      .select()
      .single();

    if (error) {
      logger.error('Tenant-aware insert failed', error, { table, userId, tenantId });
      throw error;
    }

    return result as T;
  }

  /**
   * Update with tenant validation
   * CRITICAL: Prevents updating data in wrong tenant
   */
  protected async updateWithTenantCheck<T>(
    table: string,
    userId: string,
    resourceId: string,
    updates: Record<string, unknown>
  ): Promise<T> {
    // First, fetch the resource to get its tenant_id
    const { data: existing, error: fetchError } = await this.supabase
      .from(table)
      .select('tenant_id')
      .eq('id', resourceId)
      .single();

    if (fetchError || !existing) {
      throw new ValidationError('Resource not found', { resourceId });
    }

    // Validate user has access to this tenant
    await this.validateTenantAccess(userId, existing.tenant_id);

    // Prevent tenant_id override
    const safeUpdates = {
      ...updates,
      tenant_id: existing.tenant_id, // NEVER allow changing tenant
      updated_by: userId,
      updated_at: new Date().toISOString(),
    };

    logger.debug('Updating with tenant check', {
      table,
      userId,
      resourceId,
      tenantId: existing.tenant_id
    });

    const { data: result, error } = await this.supabase
      .from(table)
      .update(safeUpdates)
      .eq('id', resourceId)
      .select()
      .single();

    if (error) {
      logger.error('Tenant-aware update failed', error, { table, userId, resourceId });
      throw error;
    }

    return result as T;
  }

  /**
   * Delete with tenant validation
   * CRITICAL: Prevents deleting data from wrong tenant
   */
  protected async deleteWithTenantCheck(
    table: string,
    userId: string,
    resourceId: string
  ): Promise<void> {
    // First, fetch the resource to get its tenant_id
    const { data: existing, error: fetchError } = await this.supabase
      .from(table)
      .select('tenant_id')
      .eq('id', resourceId)
      .single();

    if (fetchError || !existing) {
      throw new ValidationError('Resource not found', { resourceId });
    }

    // Validate user has access to this tenant
    await this.validateTenantAccess(userId, existing.tenant_id);

    logger.warn('Deleting with tenant check', {
      table,
      userId,
      resourceId,
      tenantId: existing.tenant_id
    });

    const { error } = await this.supabase
      .from(table)
      .delete()
      .eq('id', resourceId);

    if (error) {
      logger.error('Tenant-aware delete failed', error, { table, userId, resourceId });
      throw error;
    }
  }

  /**
   * Audit cross-tenant access attempts
   * CRITICAL: Log all blocked attempts for security monitoring
   */
  private async auditCrossTenantAttempt(
    userId: string,
    attemptedTenantId: string
  ): Promise<void> {
    try {
      await this.supabase
        .from('security_events')
        .insert({
          event_type: 'cross_tenant_access_attempt',
          user_id: userId,
          severity: 'critical',
          details: {
            attempted_tenant: attemptedTenantId,
            timestamp: new Date().toISOString(),
            blocked: true
          }
        });
    } catch (error) {
      // Don't fail the request if audit fails, but log it
      logger.error('Failed to audit cross-tenant attempt', error as Error, {
        userId,
        attemptedTenantId
      });
    }
  }

  /**
   * Get tenant context for current user
   * CRITICAL: Use this to establish tenant context at request start
   */
  protected async getTenantContext(userId: string): Promise<TenantContext> {
    const tenantIds = await this.getUserTenants(userId);
    
    // Default to first tenant if user has multiple
    const tenantId = tenantIds[0];

    return {
      userId,
      tenantId,
      tenantIds
    };
  }
}
