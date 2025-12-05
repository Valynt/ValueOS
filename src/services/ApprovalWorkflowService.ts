/**
 * Approval Workflow Service
 * Multi-level approval system for sensitive configuration changes
 */

import { logger } from '../lib/logger';
import { BaseService } from './BaseService';
import { NotFoundError, AuthorizationError } from './errors';

export interface ApprovalWorkflow {
  id: string;
  name: string;
  description?: string;
  scope: 'organization' | 'team' | 'all';
  scopeId?: string;
  triggerConditions: Record<string, any>;
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
  workflowId: string;
  requestedBy: string;
  changeType: string;
  changeData: Record<string, any>;
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
    input: Omit<ApprovalWorkflow, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<ApprovalWorkflow> {
    this.validateRequired(input, ['name', 'scope', 'approvalLevels', 'createdBy']);

    this.log('info', 'Creating approval workflow', { name: input.name });

    return this.executeRequest(
      async () => {
        const { data, error } = await this.supabase
          .from('approval_workflows')
          .insert({
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
  async createRequest(input: {
    workflowId: string;
    requestedBy: string;
    changeType: string;
    changeData: Record<string, any>;
    justification?: string;
  }): Promise<ApprovalRequest> {
    this.validateRequired(input, ['workflowId', 'requestedBy', 'changeType', 'changeData']);

    this.log('info', 'Creating approval request', { workflowId: input.workflowId });

    return this.executeRequest(
      async () => {
        // Get workflow to determine timeout
        const { data: workflow, error: workflowError } = await this.supabase
          .from('approval_workflows')
          .select('*')
          .eq('id', input.workflowId)
          .single();

        if (workflowError) throw workflowError;
        if (!workflow) throw new NotFoundError('Workflow');

        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + workflow.timeout_hours);

        const { data, error } = await this.supabase
          .from('approval_requests')
          .insert({
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
    requestId: string,
    approverId: string,
    comment?: string
  ): Promise<ApprovalRequest> {
    this.log('info', 'Approving request', { requestId, approverId });

    return this.executeRequest(
      async () => {
        // Get current request
        const { data: request, error: requestError } = await this.supabase
          .from('approval_requests')
          .select('*')
          .eq('id', requestId)
          .single();

        if (requestError) throw requestError;
        if (!request) throw new NotFoundError('Approval request');

        if (request.status !== 'pending') {
          throw new AuthorizationError('Request is not pending');
        }

        // Check if approver is authorized
        const { data: workflow } = await this.supabase
          .from('approval_workflows')
          .select('*')
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

        const updates: any = {
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
    requestId: string,
    rejectorId: string,
    reason: string
  ): Promise<ApprovalRequest> {
    this.log('info', 'Rejecting request', { requestId, rejectorId });

    return this.executeRequest(
      async () => {
        const { data: request } = await this.supabase
          .from('approval_requests')
          .select('*')
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
   * Get pending requests for a user
   */
  async getPendingRequests(userId: string): Promise<ApprovalRequest[]> {
    return this.executeRequest(
      async () => {
        const { data, error } = await this.supabase
          .from('approval_requests')
          .select('*, approval_workflows(*)')
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
        deduplicationKey: `pending-requests-${userId}`,
      }
    );
  }

  /**
   * Cancel request
   */
  async cancelRequest(requestId: string, userId: string): Promise<void> {
    return this.executeRequest(
      async () => {
        const { data: request } = await this.supabase
          .from('approval_requests')
          .select('*')
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
          .eq('id', requestId);

        if (error) throw error;
        this.clearCache();
      },
      { skipCache: true }
    );
  }

  /**
   * Check for expired requests and auto-approve if configured
   */
  async processExpiredRequests(): Promise<number> {
    this.log('info', 'Processing expired requests');

    return this.executeRequest(
      async () => {
        const now = new Date().toISOString();

        const { data: expiredRequests, error } = await this.supabase
          .from('approval_requests')
          .select('*, approval_workflows(*)')
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
              .eq('id', request.id);
          } else {
            await this.supabase
              .from('approval_requests')
              .update({
                status: 'expired',
                resolved_at: new Date().toISOString(),
              })
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

  private mapWorkflow(data: any): ApprovalWorkflow {
    return {
      id: data.id,
      name: data.name,
      description: data.description,
      scope: data.scope,
      scopeId: data.scope_id,
      triggerConditions: data.trigger_conditions,
      approvalLevels: data.approval_levels,
      requiredApprovers: data.required_approvers,
      timeoutHours: data.timeout_hours,
      autoApproveAfterTimeout: data.auto_approve_after_timeout,
      enabled: data.enabled,
      createdBy: data.created_by,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  private mapRequest(data: any): ApprovalRequest {
    return {
      id: data.id,
      workflowId: data.workflow_id,
      requestedBy: data.requested_by,
      changeType: data.change_type,
      changeData: data.change_data,
      justification: data.justification,
      status: data.status,
      currentLevel: data.current_level,
      approvals: data.approvals || [],
      rejections: data.rejections || [],
      expiresAt: data.expires_at,
      resolvedAt: data.resolved_at,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }
}

export const approvalWorkflowService = new ApprovalWorkflowService();
