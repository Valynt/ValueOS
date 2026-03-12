/**
 * Approval Workflow Service
 * Multi-level approval system for sensitive configuration changes
 */

import { BaseService } from '../BaseService.js'
import { AuthorizationError, NotFoundError } from './errors.js'

export interface ApprovalWorkflow {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  scope: 'organization' | 'team' | 'all';
  scopeId?: string;
  triggerConditions: Record<string, unknown>;
  approvalLevels: number;
  requiredApprovers: string[];
  timeoutHours: number;
  autoApproveAfterTimeout: boolean;
  enabled: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalRequest {
  id: string;
  organizationId: string;
  workflowId: string;
  requestedBy: string;
  changeType: string;
  changeData: Record<string, unknown>;
  justification?: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'cancelled';
  currentLevel: number;
  approvals: Array<{ userId: string; timestamp: string; comment?: string }>;
  rejections: Array<{ userId: string; timestamp: string; reason: string }>;
  expiresAt?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export class ApprovalWorkflowService extends BaseService {
  constructor() {
    super('ApprovalWorkflowService');
  }

  /**
   * Create approval workflow
   */
  async createWorkflow(
    organizationId: string,
    input: Omit<ApprovalWorkflow, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>
  ): Promise<ApprovalWorkflow> {
    this.validateRequired(input, ['name', 'scope', 'approvalLevels', 'createdBy']);

    this.log('info', 'Creating approval workflow', { organizationId, name: input.name });

    return this.executeRequest(
      async () => {
        const { data, error } = await this.supabase
          .from('approval_workflows')
          .insert({
            organization_id: organizationId,
            name: input.name,
            description: input.description,
            scope: input.scope,
            scope_id: input.scopeId,
            trigger_conditions: input.triggerConditions,
            approval_levels: input.approvalLevels,
            required_approvers: input.requiredApprovers,
            timeout_hours: input.timeoutHours,
            auto_approve_after_timeout: input.autoApproveAfterTimeout,
            enabled: input.enabled,
            created_by: input.createdBy,
          })
          .select()
          .single();

        if (error) throw error;
        return this.mapWorkflow(data);
      },
      { skipCache: true }
    );
  }

  /**
   * Create approval request
   */
  async createRequest(
    organizationId: string,
    input: {
      workflowId: string;
      requestedBy: string;
      changeType: string;
      changeData: Record<string, unknown>;
      justification?: string;
    }
  ): Promise<ApprovalRequest> {
    this.validateRequired(input, ['workflowId', 'requestedBy', 'changeType', 'changeData']);

    this.log('info', 'Creating approval request', { organizationId, workflowId: input.workflowId });

    return this.executeRequest(
      async () => {
        // Get workflow — scoped to tenant to prevent cross-tenant workflow hijacking
        const { data: workflow, error: workflowError } = await this.supabase
          .from('approval_workflows')
          .select('*')
          .eq('organization_id', organizationId)
          .eq('id', input.workflowId)
          .single();

        if (workflowError) throw workflowError;
        if (!workflow) throw new NotFoundError('Workflow');

        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + workflow.timeout_hours);

        const { data, error } = await this.supabase
          .from('approval_requests')
          .insert({
            organization_id: organizationId,
            workflow_id: input.workflowId,
            requested_by: input.requestedBy,
            change_type: input.changeType,
            change_data: input.changeData,
            justification: input.justification,
            expires_at: expiresAt.toISOString(),
          })
          .select()
          .single();

        if (error) throw error;
        return this.mapRequest(data);
      },
      { skipCache: true }
    );
  }

  /**
   * Approve request
   */
  async approveRequest(
    organizationId: string,
    requestId: string,
    approverId: string,
    comment?: string
  ): Promise<ApprovalRequest> {
    this.log('info', 'Approving request', { organizationId, requestId, approverId });

    return this.executeRequest(
      async () => {
        // Get current request — scoped to tenant
        const { data: request, error: requestError } = await this.supabase
          .from('approval_requests')
          .select('*')
          .eq('organization_id', organizationId)
          .eq('id', requestId)
          .single();

        if (requestError) throw requestError;
        if (!request) throw new NotFoundError('Approval request');

        if (request.status !== 'pending') {
          throw new AuthorizationError('Request is not pending');
        }

        // Check if approver is authorized — workflow also scoped to tenant
        const { data: workflow } = await this.supabase
          .from('approval_workflows')
          .select('*')
          .eq('organization_id', organizationId)
          .eq('id', request.workflow_id)
          .single();

        if (
          workflow &&
          workflow.required_approvers.length > 0 &&
          !workflow.required_approvers.includes(approverId)
        ) {
          throw new AuthorizationError('User not authorized to approve');
        }

        // Add approval
        const approvals = request.approvals || [];
        approvals.push({
          userId: approverId,
          timestamp: new Date().toISOString(),
          comment,
        });

        const currentLevel = request.current_level || 1;
        const nextLevel = currentLevel + 1;
        const isFullyApproved = nextLevel > (workflow?.approval_levels || 1);

        const updates: Record<string, unknown> = {
          approvals,
          current_level: isFullyApproved ? currentLevel : nextLevel,
          updated_at: new Date().toISOString(),
        };

        if (isFullyApproved) {
          updates.status = 'approved';
          updates.resolved_at = new Date().toISOString();
        }

        const { data, error } = await this.supabase
          .from('approval_requests')
          .update(updates)
          .eq('organization_id', organizationId)
          .eq('id', requestId)
          .select()
          .single();

        if (error) throw error;

        this.clearCache();
        return this.mapRequest(data);
      },
      { skipCache: true }
    );
  }

  /**
   * Reject request
   */
  async rejectRequest(
    organizationId: string,
    requestId: string,
    rejectorId: string,
    reason: string
  ): Promise<ApprovalRequest> {
    this.log('info', 'Rejecting request', { organizationId, requestId, rejectorId });

    return this.executeRequest(
      async () => {
        const { data: request } = await this.supabase
          .from('approval_requests')
          .select('*')
          .eq('organization_id', organizationId)
          .eq('id', requestId)
          .single();

        if (!request) throw new NotFoundError('Approval request');

        if (request.status !== 'pending') {
          throw new AuthorizationError('Request is not pending');
        }

        const rejections = request.rejections || [];
        rejections.push({
          userId: rejectorId,
          timestamp: new Date().toISOString(),
          reason,
        });

        const { data, error } = await this.supabase
          .from('approval_requests')
          .update({
            rejections,
            status: 'rejected',
            resolved_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('organization_id', organizationId)
          .eq('id', requestId)
          .select()
          .single();

        if (error) throw error;

        this.clearCache();
        return this.mapRequest(data);
      },
      { skipCache: true }
    );
  }

  /**
   * Get pending requests for a user within an organization
   */
  async getPendingRequests(organizationId: string, userId: string): Promise<ApprovalRequest[]> {
    return this.executeRequest(
      async () => {
        const { data, error } = await this.supabase
          .from('approval_requests')
          .select('*, approval_workflows(*)')
          .eq('organization_id', organizationId)
          .eq('status', 'pending')
          .filter(
            'approval_workflows.required_approvers',
            'cs',
            `{${userId}}`
          );

        if (error) throw error;
        return (data || []).map(this.mapRequest);
      },
      {
        deduplicationKey: `pending-requests-${organizationId}-${userId}`,
      }
    );
  }

  /**
   * Cancel request
   */
  async cancelRequest(organizationId: string, requestId: string, userId: string): Promise<void> {
    return this.executeRequest(
      async () => {
        const { data: request } = await this.supabase
          .from('approval_requests')
          .select('*')
          .eq('organization_id', organizationId)
          .eq('id', requestId)
          .single();

        if (!request) throw new NotFoundError('Approval request');

        if (request.requested_by !== userId) {
          throw new AuthorizationError('Only requester can cancel');
        }

        const { error } = await this.supabase
          .from('approval_requests')
          .update({
            status: 'cancelled',
            resolved_at: new Date().toISOString(),
          })
          .eq('organization_id', organizationId)
          .eq('id', requestId);

        if (error) throw error;
        this.clearCache();
      },
      { skipCache: true }
    );
  }

  /**
   * Check for expired requests and auto-approve if configured.
   * Must be called with an organizationId — this job must never run globally
   * across all tenants, as it would auto-approve or expire requests for orgs
   * the caller has no authority over.
   */
  async processExpiredRequests(organizationId: string): Promise<number> {
    this.log('info', 'Processing expired requests', { organizationId });

    return this.executeRequest(
      async () => {
        const now = new Date().toISOString();

        const { data: expiredRequests, error } = await this.supabase
          .from('approval_requests')
          .select('*, approval_workflows(*)')
          .eq('organization_id', organizationId)
          .eq('status', 'pending')
          .lt('expires_at', now);

        if (error) throw error;

        let processedCount = 0;

        for (const request of expiredRequests || []) {
          const workflow = request.approval_workflows;

          if (workflow?.auto_approve_after_timeout) {
            await this.supabase
              .from('approval_requests')
              .update({
                status: 'approved',
                resolved_at: new Date().toISOString(),
              })
              .eq('organization_id', organizationId)
              .eq('id', request.id);
          } else {
            await this.supabase
              .from('approval_requests')
              .update({
                status: 'expired',
                resolved_at: new Date().toISOString(),
              })
              .eq('organization_id', organizationId)
              .eq('id', request.id);
          }

          processedCount++;
        }

        this.clearCache();
        return processedCount;
      },
      { skipCache: true }
    );
  }

  private mapWorkflow(data: Record<string, unknown>): ApprovalWorkflow {
    return {
      id: data.id as string,
      organizationId: data.organization_id as string,
      name: data.name as string,
      description: data.description as string | undefined,
      scope: data.scope as ApprovalWorkflow['scope'],
      scopeId: data.scope_id as string | undefined,
      triggerConditions: data.trigger_conditions as Record<string, unknown>,
      approvalLevels: data.approval_levels as number,
      requiredApprovers: data.required_approvers as string[],
      timeoutHours: data.timeout_hours as number,
      autoApproveAfterTimeout: data.auto_approve_after_timeout as boolean,
      enabled: data.enabled as boolean,
      createdBy: data.created_by as string,
      createdAt: data.created_at as string,
      updatedAt: data.updated_at as string,
    };
  }

  private mapRequest(data: Record<string, unknown>): ApprovalRequest {
    return {
      id: data.id as string,
      organizationId: data.organization_id as string,
      workflowId: data.workflow_id as string,
      requestedBy: data.requested_by as string,
      changeType: data.change_type as string,
      changeData: data.change_data as Record<string, unknown>,
      justification: data.justification as string | undefined,
      status: data.status as ApprovalRequest['status'],
      currentLevel: data.current_level as number,
      approvals: (data.approvals as ApprovalRequest['approvals']) || [],
      rejections: (data.rejections as ApprovalRequest['rejections']) || [],
      expiresAt: data.expires_at as string | undefined,
      resolvedAt: data.resolved_at as string | undefined,
      createdAt: data.created_at as string,
      updatedAt: data.updated_at as string,
    };
  }
}

export const approvalWorkflowService = new ApprovalWorkflowService();
