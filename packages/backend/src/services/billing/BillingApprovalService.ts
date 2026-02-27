/**
 * Billing Approval Service
 * Manages approval workflows for billing operations (Enterprise tier)
 */

import { createLogger } from '../../lib/logger.js';
import { BaseService } from '../BaseService.js';
import { supabase } from '../../lib/supabase.js';

const logger = createLogger({ component: 'BillingApprovalService' });

export interface BillingApprovalRequest {
  id: string;
  tenant_id: string;
  request_type: 'plan_upgrade' | 'cap_increase' | 'custom_pricing' | 'overage_allowance';
  request_data: Record<string, any>;
  estimated_cost?: number;
  justification?: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'cancelled';
  requested_by: string;
  approved_by?: string;
  approved_at?: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface BillingApprovalPolicy {
  id: string;
  tenant_id: string;
  request_type: string;
  requires_approval: boolean;
  approval_threshold?: number;
  auto_approve_below?: number;
  requires_dual_control: boolean;
  approver_roles: string[];
  created_at: string;
  updated_at: string;
}

export class BillingApprovalService extends BaseService {
  constructor() {
    super('BillingApprovalService');
  }

  /**
   * Create approval request for billing operation
   */
  async createApprovalRequest(
    tenantId: string,
    requestType: BillingApprovalRequest['request_type'],
    requestData: Record<string, any>,
    requestedBy: string,
    justification?: string,
    estimatedCost?: number
  ): Promise<BillingApprovalRequest> {
    logger.info('Creating billing approval request', {
      tenantId,
      requestType,
      requestedBy
    });

    // Check if approval is required
    const policy = await this.getApprovalPolicy(tenantId, requestType);

    if (!policy?.requires_approval) {
      throw new Error('Approval not required for this request type');
    }

    // Check auto-approval threshold
    if (policy.auto_approve_below && estimatedCost && estimatedCost <= policy.auto_approve_below) {
      // Auto-approve
      return this.createAutoApprovedRequest(
        tenantId,
        requestType,
        requestData,
        requestedBy,
        justification,
        estimatedCost
      );
    }

    // Create pending approval request
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour expiry

    const { data, error } = await supabase
      .from('billing_approval_requests')
      .insert({
        tenant_id: tenantId,
        request_type: requestType,
        request_data: requestData,
        estimated_cost: estimatedCost,
        justification,
        status: 'pending',
        requested_by: requestedBy,
        expires_at: expiresAt.toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      logger.error('Failed to create approval request', error);
      throw new Error('Failed to create approval request');
    }

    logger.info('Created approval request', { requestId: data.id });
    return data;
  }

  /**
   * Approve billing request
   */
  async approveRequest(
    requestId: string,
    approvedBy: string,
    notes?: string
  ): Promise<BillingApprovalRequest> {
    logger.info('Approving billing request', { requestId, approvedBy });

    const { data, error } = await supabase
      .from('billing_approval_requests')
      .update({
        status: 'approved',
        approved_by: approvedBy,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', requestId)
      .eq('status', 'pending')
      .select()
      .single();

    if (error) {
      logger.error('Failed to approve request', error);
      throw new Error('Failed to approve request');
    }

    logger.info('Approved billing request', { requestId });
    return data;
  }

  /**
   * Reject billing request
   */
  async rejectRequest(
    requestId: string,
    rejectedBy: string,
    reason: string
  ): Promise<BillingApprovalRequest> {
    logger.info('Rejecting billing request', { requestId, rejectedBy, reason });

    const { data, error } = await supabase
      .from('billing_approval_requests')
      .update({
        status: 'rejected',
        approved_by: rejectedBy, // Using approved_by field for consistency
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        request_data: supabase.sql`request_data || ${JSON.stringify({ rejection_reason: reason })}`
      })
      .eq('id', requestId)
      .eq('status', 'pending')
      .select()
      .single();

    if (error) {
      logger.error('Failed to reject request', error);
      throw new Error('Failed to reject request');
    }

    logger.info('Rejected billing request', { requestId });
    return data;
  }

  /**
   * Get approval policy for tenant and request type
   */
  async getApprovalPolicy(
    tenantId: string,
    requestType: string
  ): Promise<BillingApprovalPolicy | null> {
    const { data, error } = await supabase
      .from('billing_approval_policies')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('request_type', requestType)
      .single();

    if (error && error.code !== 'PGRST116') { // Not found error
      logger.error('Failed to get approval policy', error);
      throw new Error('Failed to get approval policy');
    }

    return data || null;
  }

  /**
   * Set approval policy for tenant
   */
  async setApprovalPolicy(
    tenantId: string,
    requestType: string,
    policy: Partial<BillingApprovalPolicy>
  ): Promise<BillingApprovalPolicy> {
    const { data, error } = await supabase
      .from('billing_approval_policies')
      .upsert({
        tenant_id: tenantId,
        request_type: requestType,
        ...policy,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      logger.error('Failed to set approval policy', error);
      throw new Error('Failed to set approval policy');
    }

    return data;
  }

  /**
   * Get pending approval requests for tenant
   */
  async getPendingRequests(tenantId: string): Promise<BillingApprovalRequest[]> {
    const { data, error } = await supabase
      .from('billing_approval_requests')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Failed to get pending requests', error);
      throw new Error('Failed to get pending requests');
    }

    return data || [];
  }

  /**
   * Check if user can approve request
   */
  async canApproveRequest(requestId: string, userId: string): Promise<boolean> {
    // Get request details
    const { data: request, error: requestError } = await supabase
      .from('billing_approval_requests')
      .select('tenant_id, request_type, estimated_cost')
      .eq('id', requestId)
      .single();

    if (requestError) {
      logger.error('Failed to get request for approval check', requestError);
      return false;
    }

    // Get approval policy
    const policy = await this.getApprovalPolicy(request.tenant_id, request.request_type);
    if (!policy) return false;

    // Check if user has required role (simplified - in real implementation check user roles)
    // For now, assume admin users can approve
    const { data: userRole, error: roleError } = await supabase
      .from('user_tenants')
      .select('role')
      .eq('user_id', userId)
      .eq('tenant_id', request.tenant_id)
      .single();

    if (roleError) {
      logger.error('Failed to get user role', roleError);
      return false;
    }

    return userRole.role === 'admin' || userRole.role === 'owner';
  }

  /**
   * Auto-approve request (internal method)
   */
  private async createAutoApprovedRequest(
    tenantId: string,
    requestType: BillingApprovalRequest['request_type'],
    requestData: Record<string, any>,
    requestedBy: string,
    justification?: string,
    estimatedCost?: number
  ): Promise<BillingApprovalRequest> {
    const { data, error } = await supabase
      .from('billing_approval_requests')
      .insert({
        tenant_id: tenantId,
        request_type: requestType,
        request_data: requestData,
        estimated_cost: estimatedCost,
        justification,
        status: 'approved',
        requested_by: requestedBy,
        approved_by: 'auto',
        approved_at: new Date().toISOString(),
        expires_at: new Date().toISOString(), // Already approved
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      logger.error('Failed to create auto-approved request', error);
      throw new Error('Failed to create auto-approved request');
    }

    return data;
  }

  /**
   * Clean up expired requests (should be called by cron job)
   */
  async cleanupExpiredRequests(): Promise<number> {
    const { data, error } = await supabase
      .from('billing_approval_requests')
      .update({ status: 'expired', updated_at: new Date().toISOString() })
      .eq('status', 'pending')
      .lt('expires_at', new Date().toISOString())
      .select('id');

    if (error) {
      logger.error('Failed to cleanup expired requests', error);
      throw new Error('Failed to cleanup expired requests');
    }

    return data?.length || 0;
  }
}
