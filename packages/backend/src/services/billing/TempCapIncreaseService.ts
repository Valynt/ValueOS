/**
 * Temporary Cap Increase Service
 * Manages temporary quota increases for enterprise customers
 */

import { type SupabaseClient } from '@supabase/supabase-js';
import BillingApprovalService from './BillingApprovalService.js';
import { EntitlementsService } from './EntitlementsService.js';
import { createLogger } from '../../lib/logger.js';
import { BillingMetric } from '../../config/billing.js';

const logger = createLogger({ component: 'TempCapIncreaseService' });

export interface TempCapIncreaseRequest {
  id: string;
  tenant_id: string;
  requested_by: string;
  metric: BillingMetric;
  current_cap: number;
  requested_cap: number;
  increase_percentage: number;
  duration_hours: number;
  justification: string;
  business_impact: string;
  approval_status: 'pending' | 'approved' | 'rejected' | 'expired' | 'active' | 'expired_active';
  approved_by?: string;
  approved_at?: string;
  activated_at?: string;
  expires_at?: string;
  created_at: string;
  updated_at: string;
}

export interface TempCapIncrease {
  id: string;
  request_id: string;
  tenant_id: string;
  metric: BillingMetric;
  original_cap: number;
  increased_cap: number;
  effective_from: string;
  effective_until: string;
  status: 'active' | 'expired' | 'cancelled';
  created_at: string;
  updated_at: string;
}

export class TempCapIncreaseService {
  private supabase: SupabaseClient;
  private entitlementsService: EntitlementsService;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
    this.entitlementsService = new EntitlementsService(supabase);
  }
  /**
   * Request temporary cap increase
   */
  async requestTempIncrease(
    tenantId: string,
    userId: string,
    metric: BillingMetric,
    requestedCap: number,
    durationHours: number,
    justification: string,
    businessImpact: string
  ): Promise<TempCapIncreaseRequest> {
    try {
      // Get current entitlement
      const currentEntitlement = await this.entitlementsService.getEffectiveEntitlementSnapshot(tenantId);
      if (!currentEntitlement) {
        throw new Error('No active entitlement found for tenant');
      }

      const currentCap = currentEntitlement.quotas[metric];
      if (!currentCap) {
        throw new Error(`No quota defined for metric: ${metric}`);
      }

      const increasePercentage = ((requestedCap - currentCap) / currentCap) * 100;

      // Validate request
      if (requestedCap <= currentCap) {
        throw new Error('Requested cap must be higher than current cap');
      }

      if (increasePercentage > 200) { // Max 200% increase
        throw new Error('Maximum temporary increase is 200% of current cap');
      }

      if (durationHours > 168) { // Max 1 week
        throw new Error('Maximum duration is 168 hours (1 week)');
      }

      // Create approval request
      const approvalRequest = await BillingApprovalService.createApprovalRequest(
        tenantId,
        'cap_increase',
        {
          metric,
          current_cap: currentCap,
          requested_cap: requestedCap,
          increase_percentage: increasePercentage,
          duration_hours: durationHours,
          business_impact: businessImpact
        },
        userId,
        justification,
        0 // No cost for cap increases
      );

      // Create temp cap increase request record
      const { data, error } = await this.supabase
        .from('temp_cap_increase_requests')
        .insert({
          tenant_id: tenantId,
          requested_by: userId,
          metric,
          current_cap: currentCap,
          requested_cap: requestedCap,
          increase_percentage: increasePercentage,
          duration_hours: durationHours,
          justification,
          business_impact: businessImpact,
          approval_status: 'pending',
          approval_request_id: approvalRequest.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        logger.error('Error creating temp cap increase request', error);
        throw new Error('Failed to create temporary cap increase request');
      }

      logger.info('Created temp cap increase request', {
        requestId: data.id,
        tenantId,
        metric,
        requestedCap,
        durationHours
      });

      return data;
    } catch (error) {
      logger.error('Error in requestTempIncrease', error as Error);
      throw error;
    }
  }

  /**
   * Approve temporary cap increase request
   */
  async approveTempIncrease(
    requestId: string,
    approvedBy: string
  ): Promise<TempCapIncrease> {
    try {
      // Get the request
      const { data: request, error: requestError } = await this.supabase
        .from('temp_cap_increase_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      if (requestError || !request) {
        throw new Error('Temporary cap increase request not found');
      }

      if (request.approval_status !== 'pending') {
        throw new Error('Request is not in pending status');
      }

      // Approve the underlying approval request
      await BillingApprovalService.approveRequest(request.approval_request_id, approvedBy, 'Approved temporary cap increase');

      // Update request status
      const now = new Date();
      const expiresAt = new Date(now.getTime() + request.duration_hours * 60 * 60 * 1000);

      const { data: updatedRequest, error: updateError } = await this.supabase
        .from('temp_cap_increase_requests')
        .update({
          approval_status: 'approved',
          approved_by: approvedBy,
          approved_at: now.toISOString(),
          activated_at: now.toISOString(),
          expires_at: expiresAt.toISOString(),
          updated_at: now.toISOString()
        })
        .eq('id', requestId)
        .select()
        .single();

      if (updateError) {
        throw new Error('Failed to update request status');
      }

      // Create active temp cap increase record
      const { data: tempCap, error: tempCapError } = await this.supabase
        .from('temp_cap_increases')
        .insert({
          request_id: requestId,
          tenant_id: request.tenant_id,
          metric: request.metric,
          original_cap: request.current_cap,
          increased_cap: request.requested_cap,
          effective_from: now.toISOString(),
          effective_until: expiresAt.toISOString(),
          status: 'active',
          created_at: now.toISOString(),
          updated_at: now.toISOString()
        })
        .select()
        .single();

      if (tempCapError) {
        logger.error('Error creating temp cap increase record', tempCapError);
        throw new Error('Failed to activate temporary cap increase');
      }

      logger.info('Activated temporary cap increase', {
        requestId,
        tempCapId: tempCap.id,
        tenantId: request.tenant_id,
        metric: request.metric
      });

      return tempCap;
    } catch (error) {
      logger.error('Error approving temp increase', error as Error);
      throw error;
    }
  }

  /**
   * Get active temporary cap increases for tenant
   */
  async getActiveTempCaps(tenantId: string): Promise<TempCapIncrease[]> {
    try {
      const { data, error } = await this.supabase
        .from('temp_cap_increases')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('status', 'active')
        .gt('effective_until', new Date().toISOString())
        .order('effective_until', { ascending: true });

      if (error) {
        logger.error('Error getting active temp caps', error);
        throw new Error('Failed to get active temporary cap increases');
      }

      return data || [];
    } catch (error) {
      logger.error('Error in getActiveTempCaps', error as Error);
      return [];
    }
  }

  /**
   * Cancel temporary cap increase
   */
  async cancelTempIncrease(tempCapId: string, cancelledBy: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('temp_cap_increases')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('id', tempCapId);

      if (error) {
        throw new Error('Failed to cancel temporary cap increase');
      }

      logger.info('Cancelled temporary cap increase', { tempCapId, cancelledBy });
    } catch (error) {
      logger.error('Error cancelling temp increase', error as Error);
      throw error;
    }
  }

  /**
   * Clean up expired temporary cap increases (should be called by cron job)
   */
  async cleanupExpiredTempCaps(): Promise<number> {
    try {
      const now = new Date().toISOString();

      // Update expired temp caps
      const { data, error } = await this.supabase
        .from('temp_cap_increases')
        .update({
          status: 'expired',
          updated_at: now
        })
        .eq('status', 'active')
        .lt('effective_until', now)
        .select('id');

      if (error) {
        logger.error('Error cleaning up expired temp caps', error);
        throw new Error('Failed to cleanup expired temporary cap increases');
      }

      const expiredCount = data?.length || 0;

      // Update corresponding requests
      if (expiredCount > 0) {
        await this.supabase
          .from('temp_cap_increase_requests')
          .update({
            approval_status: 'expired_active',
            updated_at: now
          })
          .in('id', data.map(d => d.id));
      }

      logger.info('Cleaned up expired temporary cap increases', { count: expiredCount });

      return expiredCount;
    } catch (error) {
      logger.error('Error in cleanupExpiredTempCaps', error as Error);
      return 0;
    }
  }

  /**
   * Get temporary cap increase requests for tenant
   */
  async getTempCapRequests(
    tenantId: string,
    status?: string,
    limit: number = 50
  ): Promise<TempCapIncreaseRequest[]> {
    try {
      let query = this.supabase
        .from('temp_cap_increase_requests')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (status) {
        query = query.eq('approval_status', status);
      }

      const { data, error } = await query;

      if (error) {
        logger.error('Error getting temp cap requests', error);
        throw new Error('Failed to get temporary cap increase requests');
      }

      return data || [];
    } catch (error) {
      logger.error('Error in getTempCapRequests', error as Error);
      return [];
    }
  }
}
