/**
 * Billing Approval Service
 *
 * Manages approval workflows for billing operations (Enterprise tier).
 * Column names align with the billing_approval_requests and
 * billing_approval_policies DB schema.
 */

import type { ApprovalActionType, ApprovalStatus } from '@shared/types/billing-events';

import { createLogger } from '../../lib/logger.js';
import { supabase as supabaseClient } from '../../lib/supabase.js';

const logger = createLogger({ component: 'BillingApprovalService' });

// ============================================================================
// Types — aligned with DB schema
// ============================================================================

export interface BillingApprovalRequest {
  approval_id: string;
  tenant_id: string;
  requested_by_user_id: string;
  action_type: ApprovalActionType;
  payload: Record<string, unknown>;
  computed_delta: Record<string, unknown>;
  status: ApprovalStatus;
  approved_by_user_id: string | null;
  decision_reason: string | null;
  effective_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BillingApprovalPolicy {
  id: string;
  tenant_id: string;
  action_type: ApprovalActionType;
  thresholds: Record<string, unknown>;
  required_approver_roles: string[];
  sla_hours: number | null;
  created_at: string;
}

// ============================================================================
// Service
// ============================================================================

const supabase = supabaseClient ?? null;

const DEFAULT_EXPIRY_HOURS = 24;

export class BillingApprovalService {
  // Singleton for static-style access used by tests and middleware.
  private static _instance: BillingApprovalService | null = null;

  private static getInstance(): BillingApprovalService {
    if (!BillingApprovalService._instance) {
      BillingApprovalService._instance = new BillingApprovalService();
    }
    return BillingApprovalService._instance;
  }

  static async setApprovalPolicy(
    tenantId: string,
    policy: Partial<BillingApprovalPolicy>
  ): Promise<void> {
    if (!policy.action_type) {
      throw new Error('setApprovalPolicy: action_type is required');
    }
    const svc = BillingApprovalService.getInstance();
    await svc.setApprovalPolicy(
      tenantId,
      policy.action_type,
      (policy.thresholds as Record<string, unknown>) ?? {},
      policy.required_approver_roles ?? [],
      policy.sla_hours ?? undefined,
    );
  }

  static async canApproveRequest(
    approvalId: string,
    userId: string
  ): Promise<boolean> {
    return BillingApprovalService.getInstance().canApproveRequest(approvalId, userId);
  }

  static async createApprovalRequest(
    tenantId: string,
    actionType: ApprovalActionType,
    payload: Record<string, unknown>,
    requestedByUserId: string,
    options: { computedDelta?: Record<string, unknown>; estimatedCost?: number } = {}
  ): Promise<BillingApprovalRequest> {
    return BillingApprovalService.getInstance().createApprovalRequest(tenantId, actionType, payload, requestedByUserId, options);
  }

  static async approveRequest(
    approvalId: string,
    approvedByUserId: string,
    reason?: string
  ): Promise<BillingApprovalRequest> {
    return BillingApprovalService.getInstance().approveRequest(approvalId, approvedByUserId, reason);
  }

  static async rejectRequest(
    approvalId: string,
    rejectedByUserId: string,
    reason: string
  ): Promise<BillingApprovalRequest> {
    return BillingApprovalService.getInstance().rejectRequest(approvalId, rejectedByUserId, reason);
  }

  private requireSupabase() {
    if (!supabase) {
      throw new Error('Supabase not configured for BillingApprovalService');
    }
    return supabase;
  }

  /**
   * Create an approval request. Auto-approves if the estimated cost is
   * below the policy's auto_approve_below threshold.
   */
  async createApprovalRequest(
    tenantId: string,
    actionType: ApprovalActionType,
    payload: Record<string, unknown>,
    requestedByUserId: string,
    options: {
      computedDelta?: Record<string, unknown>;
      estimatedCost?: number;
    } = {}
  ): Promise<BillingApprovalRequest> {
    const db = this.requireSupabase();

    logger.info('Creating billing approval request', {
      tenantId,
      actionType,
      requestedByUserId,
    });

    // Check policy for auto-approval
    const policy = await this.getApprovalPolicy(tenantId, actionType);
    const autoApproveBelow = (policy?.thresholds as Record<string, unknown> | undefined)?.auto_approve_below;

    if (
      typeof autoApproveBelow === 'number' &&
      typeof options.estimatedCost === 'number' &&
      options.estimatedCost <= autoApproveBelow
    ) {
      return this.insertRequest(db, {
        tenantId,
        actionType,
        payload,
        requestedByUserId,
        computedDelta: options.computedDelta ?? {},
        status: 'approved',
        approvedByUserId: 'auto',
        decisionReason: `Auto-approved: cost ${options.estimatedCost} <= threshold ${autoApproveBelow}`,
        effectiveAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
      });
    }

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + (policy?.sla_hours ?? DEFAULT_EXPIRY_HOURS));

    return this.insertRequest(db, {
      tenantId,
      actionType,
      payload,
      requestedByUserId,
      computedDelta: options.computedDelta ?? {},
      status: 'pending',
      approvedByUserId: null,
      decisionReason: null,
      effectiveAt: null,
      expiresAt: expiresAt.toISOString(),
    });
  }

  /**
   * Approve a pending request.
   */
  async approveRequest(
    approvalId: string,
    approvedByUserId: string,
    reason?: string
  ): Promise<BillingApprovalRequest> {
    const db = this.requireSupabase();

    const { data, error } = await db
      .from('billing_approval_requests')
      .update({
        status: 'approved',
        approved_by_user_id: approvedByUserId,
        decision_reason: reason ?? null,
        effective_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('approval_id', approvalId)
      .eq('status', 'pending')
      .select()
      .single();

    if (error) {
      logger.error('Failed to approve request', error);
      throw new Error(`Failed to approve request ${approvalId}`);
    }

    logger.info('Approved billing request', { approvalId });
    return data as BillingApprovalRequest;
  }

  /**
   * Reject a pending request.
   */
  async rejectRequest(
    approvalId: string,
    rejectedByUserId: string,
    reason: string
  ): Promise<BillingApprovalRequest> {
    const db = this.requireSupabase();

    const { data, error } = await db
      .from('billing_approval_requests')
      .update({
        status: 'rejected',
        approved_by_user_id: rejectedByUserId,
        decision_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq('approval_id', approvalId)
      .eq('status', 'pending')
      .select()
      .single();

    if (error) {
      logger.error('Failed to reject request', error);
      throw new Error(`Failed to reject request ${approvalId}`);
    }

    logger.info('Rejected billing request', { approvalId });
    return data as BillingApprovalRequest;
  }

  /**
   * Get approval policy for a tenant + action type.
   */
  async getApprovalPolicy(
    tenantId: string,
    actionType: ApprovalActionType
  ): Promise<BillingApprovalPolicy | null> {
    const db = this.requireSupabase();

    const { data, error } = await db
      .from('billing_approval_policies')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('action_type', actionType)
      .single();

    if (error && error.code !== 'PGRST116') {
      logger.error('Failed to get approval policy', error);
      throw error;
    }

    return (data as BillingApprovalPolicy) ?? null;
  }

  /**
   * Upsert an approval policy for a tenant + action type.
   */
  async setApprovalPolicy(
    tenantId: string,
    actionType: ApprovalActionType,
    thresholds: Record<string, unknown>,
    requiredApproverRoles: string[],
    slaHours?: number
  ): Promise<BillingApprovalPolicy> {
    const db = this.requireSupabase();

    const { data, error } = await db
      .from('billing_approval_policies')
      .upsert(
        {
          tenant_id: tenantId,
          action_type: actionType,
          thresholds,
          required_approver_roles: requiredApproverRoles,
          sla_hours: slaHours ?? null,
        },
        { onConflict: 'tenant_id,action_type' }
      )
      .select()
      .single();

    if (error) {
      logger.error('Failed to set approval policy', error);
      throw error;
    }

    return data as BillingApprovalPolicy;
  }

  /**
   * Get pending requests for a tenant.
   */
  /**
   * Returns true if the given user is permitted to approve the specified request.
   * A user cannot approve their own request.
   */
  async canApproveRequest(approvalId: string, userId: string): Promise<boolean> {
    const request = await this.getRequest(approvalId);
    if (!request) return false;
    if (request.requested_by_user_id === userId) return false;
    return request.status === 'pending';
  }

  async getPendingRequests(tenantId: string): Promise<BillingApprovalRequest[]> {
    const db = this.requireSupabase();

    const { data, error } = await db
      .from('billing_approval_requests')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Failed to get pending requests', error);
      throw error;
    }

    return (data ?? []) as BillingApprovalRequest[];
  }

  /**
   * Get a single request by ID.
   */
  async getRequest(approvalId: string): Promise<BillingApprovalRequest | null> {
    const db = this.requireSupabase();

    const { data, error } = await db
      .from('billing_approval_requests')
      .select('*')
      .eq('approval_id', approvalId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return (data as BillingApprovalRequest) ?? null;
  }

  /**
   * Expire all pending requests past their expires_at. Intended for cron.
   */
  async expirePendingRequests(): Promise<number> {
    const db = this.requireSupabase();

    const { data, error } = await db
      .from('billing_approval_requests')
      .update({ status: 'expired', updated_at: new Date().toISOString() })
      .eq('status', 'pending')
      .lt('expires_at', new Date().toISOString())
      .select('approval_id');

    if (error) {
      logger.error('Failed to expire pending requests', error);
      throw error;
    }

    const count = data?.length ?? 0;
    if (count > 0) {
      logger.info('Expired pending approval requests', { count });
    }
    return count;
  }

  // --------------------------------------------------------------------------
  // Private helpers
  // --------------------------------------------------------------------------

  private async insertRequest(
    db: NonNullable<typeof supabase>,
    params: {
      tenantId: string;
      actionType: ApprovalActionType;
      payload: Record<string, unknown>;
      requestedByUserId: string;
      computedDelta: Record<string, unknown>;
      status: ApprovalStatus;
      approvedByUserId: string | null;
      decisionReason: string | null;
      effectiveAt: string | null;
      expiresAt: string | null;
    }
  ): Promise<BillingApprovalRequest> {
    const now = new Date().toISOString();

    const { data, error } = await db
      .from('billing_approval_requests')
      .insert({
        tenant_id: params.tenantId,
        action_type: params.actionType,
        payload: params.payload,
        requested_by_user_id: params.requestedByUserId,
        computed_delta: params.computedDelta,
        status: params.status,
        approved_by_user_id: params.approvedByUserId,
        decision_reason: params.decisionReason,
        effective_at: params.effectiveAt,
        expires_at: params.expiresAt,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (error) {
      logger.error('Failed to insert approval request', error);
      throw new Error('Failed to create approval request');
    }

    logger.info('Created approval request', { approvalId: data.approval_id });
    return data as BillingApprovalRequest;
  }
}
