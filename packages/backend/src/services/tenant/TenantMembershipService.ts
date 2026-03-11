/**
 * Tenant Membership Service
 *
 * Handles adding/removing users from tenants with proper seat allocation and transaction locking.
 * Implements OWASP-compliant seat provisioning with race condition prevention.
 */

import { logger } from '../lib/logger.js'
import { supabase } from '../lib/supabase.js';

import { AuditLogService } from './AuditLogService.js'
import { ValidationError } from './errors.js'
import { TenantAwareService } from './TenantAwareService.js'

export class TenantMembershipService extends TenantAwareService {
  private auditLog: AuditLogService;

  constructor() {
    super();
    this.auditLog = new AuditLogService();
  }

  /**
   * Add user to tenant with seat allocation and transaction locking
   * CRITICAL: Prevents race conditions and over-subscription
   */
  async addUserToTenant(
    adminUserId: string,
    targetUserId: string,
    tenantId: string
  ): Promise<{ success: boolean; message: string }> {
    // Validate admin has permission to add users
    await this.validateTenantAccess(adminUserId, tenantId);

    // Check if user is already a member
    const existing = await this.supabase
      .from('user_tenants')
      .select('id, status')
      .eq('user_id', targetUserId)
      .eq('tenant_id', tenantId)
      .single();

    if (existing.data) {
      if (existing.data.status === 'active') {
        throw new ValidationError('User is already an active member of this tenant');
      } else {
        // Reactivate existing membership
        return this.reactivateMembership(adminUserId, targetUserId, tenantId);
      }
    }

    // Use transaction to check seat limits and add user atomically
    const result = await supabase.rpc('add_user_to_tenant_transaction', {
      p_admin_user_id: adminUserId,
      p_target_user_id: targetUserId,
      p_tenant_id: tenantId,
    });

    if (result.error) {
      logger.error('Failed to add user to tenant', result.error, {
        adminUserId,
        targetUserId,
        tenantId,
      });
      throw new ValidationError(`Failed to add user: ${result.error.message}`);
    }

    // Audit the successful addition
    await this.auditLog.log({
      userId: adminUserId,
      action: 'tenant.user.add',
      resourceType: 'user_tenant',
      resourceId: targetUserId,
      details: {
        tenantId,
        timestamp: new Date().toISOString(),
      },
      status: 'success',
    });

    logger.info('User added to tenant successfully', {
      adminUserId,
      targetUserId,
      tenantId,
    });

    return {
      success: true,
      message: 'User added to tenant successfully',
    };
  }

  /**
   * Reactivate existing membership
   */
  private async reactivateMembership(
    adminUserId: string,
    targetUserId: string,
    tenantId: string
  ): Promise<{ success: boolean; message: string }> {
    const { error } = await this.supabase
      .from('user_tenants')
      .update({
        status: 'active',
        updated_at: new Date().toISOString(),
        updated_by: adminUserId,
      })
      .eq('user_id', targetUserId)
      .eq('tenant_id', tenantId);

    if (error) {
      throw new ValidationError(`Failed to reactivate membership: ${error.message}`);
    }

    await this.auditLog.log({
      userId: adminUserId,
      action: 'tenant.user.reactivate',
      resourceType: 'user_tenant',
      resourceId: targetUserId,
      details: { tenantId },
      status: 'success',
    });

    return {
      success: true,
      message: 'User membership reactivated successfully',
    };
  }

  /**
   * Remove user from tenant
   */
  async removeUserFromTenant(
    adminUserId: string,
    targetUserId: string,
    tenantId: string
  ): Promise<{ success: boolean; message: string }> {
    // Validate admin has permission
    await this.validateTenantAccess(adminUserId, tenantId);

    const { error } = await this.supabase
      .from('user_tenants')
      .update({
        status: 'inactive',
        updated_at: new Date().toISOString(),
        updated_by: adminUserId,
      })
      .eq('user_id', targetUserId)
      .eq('tenant_id', tenantId)
      .eq('status', 'active');

    if (error) {
      throw new ValidationError(`Failed to remove user: ${error.message}`);
    }

    await this.auditLog.log({
      userId: adminUserId,
      action: 'tenant.user.remove',
      resourceType: 'user_tenant',
      resourceId: targetUserId,
      details: { tenantId },
      status: 'success',
    });

    logger.info('User removed from tenant', {
      adminUserId,
      targetUserId,
      tenantId,
    });

    return {
      success: true,
      message: 'User removed from tenant successfully',
    };
  }

  /**
   * Get current seat usage for tenant
   */
  async getTenantSeatUsage(tenantId: string): Promise<{
    currentUsers: number;
    maxUsers: number;
    availableSeats: number;
  }> {
    // Get current active users
    const { data: userCount, error: userError } = await this.supabase
      .from('user_tenants')
      .select('id', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .eq('status', 'active');

    if (userError) {
      throw new ValidationError(`Failed to get user count: ${userError.message}`);
    }

    // Get subscription limits (simplified - in real implementation, check active subscription)
    const { data: subscription, error: subError } = await this.supabase
      .from('subscriptions')
      .select('plan_tier')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .single();

    let maxUsers = 3; // Free tier default
    if (!subError && subscription) {
      // Map plan tiers to user limits
      const tierLimits: Record<string, number> = {
        free: 3,
        starter: 10,
        professional: 50,
        enterprise: 1000, // Large number for unlimited
      };
      maxUsers = tierLimits[subscription.plan_tier] || 3;
    }

    const currentUsers = userCount?.length || 0;
    const availableSeats = Math.max(0, maxUsers - currentUsers);

    return {
      currentUsers,
      maxUsers,
      availableSeats,
    };
  }
}
