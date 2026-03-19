/**
 * Workflow State Repository
 *
 * Repository pattern for workflow state persistence and retrieval.
 *
 * Tenant isolation: every method that reads or writes rows requires an
 * explicit organizationId parameter. The ambient getCurrentTenantContext()
 * pattern has been removed — it silently produced unscoped queries when
 * called from background workers or any code path that bypasses
 * tenantContextMiddleware.
 */

import { randomUUID } from 'node:crypto';

import { logger } from '../lib/logger.js';
import { createServiceRoleSupabaseClient } from '../lib/supabase.js';

export interface WorkflowState {
  id: string;
  workflow_id: string;
  execution_id: string;
  workspace_id: string;
  organization_id: string;
  lifecycle_stage: string;
  status: WorkflowStatus;
  current_step: string;
  currentStage?: string;
  completed_steps: string[];
  state_data: Record<string, unknown>;
  context?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type WorkflowStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'paused'
  | 'rolled_back'
  | 'waiting_approval';

export interface WorkflowStateFilter {
  organization_id: string;
  workspace_id?: string;
  workflow_id?: string;
  execution_id?: string;
  status?: WorkflowStatus;
  lifecycle_stage?: string;
}

export class WorkflowStateRepository {
  private supabase: ReturnType<typeof createServiceRoleSupabaseClient>;

  constructor() {
    this.supabase = createServiceRoleSupabaseClient();
  }

  private assertOrganizationId(organizationId: string, method: string): void {
    if (!organizationId) {
      throw new Error(`WorkflowStateRepository.${method}: organizationId is required`);
    }
  }

  async create(state: Omit<WorkflowState, 'id' | 'created_at' | 'updated_at'>): Promise<WorkflowState> {
    this.assertOrganizationId(state.organization_id, 'create');
    const now = new Date().toISOString();
    const newState: WorkflowState = {
      ...state,
      id: randomUUID(),
      created_at: now,
      updated_at: now,
    };

    const { data, error } = await this.supabase
      .from('workflow_states')
      .insert(newState)
      .select()
      .single();

    if (error) {
      logger.error('Failed to create workflow state', { error });
      throw new Error(`Failed to create workflow state: ${error.message}`);
    }

    return data as WorkflowState;
  }

  async findById(id: string, organizationId: string): Promise<WorkflowState | null> {
    this.assertOrganizationId(organizationId, 'findById');
    const { data, error } = await this.supabase
      .from('workflow_states')
      .select('*')
      .eq('id', id)
      .eq('organization_id', organizationId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      logger.error('Failed to find workflow state', { error, id });
      throw new Error(`Failed to find workflow state: ${error.message}`);
    }

    return data as WorkflowState;
  }

  async findByExecutionId(executionId: string, organizationId: string): Promise<WorkflowState | null> {
    this.assertOrganizationId(organizationId, 'findByExecutionId');
    const { data, error } = await this.supabase
      .from('workflow_states')
      .select('*')
      .eq('execution_id', executionId)
      .eq('organization_id', organizationId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      logger.error('Failed to find workflow state by execution', { error, executionId });
      throw new Error(`Failed to find workflow state: ${error.message}`);
    }

    return data as WorkflowState;
  }

  async find(filter: WorkflowStateFilter): Promise<WorkflowState[]> {
    this.assertOrganizationId(filter.organization_id, 'find');
    let query = this.supabase
      .from('workflow_states')
      .select('*')
      .eq('organization_id', filter.organization_id);

    if (filter.workspace_id) query = query.eq('workspace_id', filter.workspace_id);
    if (filter.workflow_id) query = query.eq('workflow_id', filter.workflow_id);
    if (filter.execution_id) query = query.eq('execution_id', filter.execution_id);
    if (filter.status) query = query.eq('status', filter.status);
    if (filter.lifecycle_stage) query = query.eq('lifecycle_stage', filter.lifecycle_stage);

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      logger.error('Failed to find workflow states', { error, filter });
      throw new Error(`Failed to find workflow states: ${error.message}`);
    }

    return (data as WorkflowState[]) || [];
  }

  async update(
    id: string,
    organizationId: string,
    updates: Partial<Omit<WorkflowState, 'id' | 'created_at'>>,
  ): Promise<WorkflowState> {
    this.assertOrganizationId(organizationId, 'update');
    const { data, error } = await this.supabase
      .from('workflow_states')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('organization_id', organizationId)
      .select()
      .single();

    if (error) {
      logger.error('Failed to update workflow state', { error, id });
      throw new Error(`Failed to update workflow state: ${error.message}`);
    }

    return data as WorkflowState;
  }

  async updateStatus(id: string, organizationId: string, status: WorkflowStatus): Promise<WorkflowState> {
    return this.update(id, organizationId, { status });
  }

  async updateProgress(
    id: string,
    organizationId: string,
    currentStep: string,
    completedSteps: string[],
  ): Promise<WorkflowState> {
    return this.update(id, organizationId, {
      current_step: currentStep,
      completed_steps: completedSteps,
    });
  }

  async delete(id: string, organizationId: string): Promise<boolean> {
    this.assertOrganizationId(organizationId, 'delete');
    const { error } = await this.supabase
      .from('workflow_states')
      .delete()
      .eq('id', id)
      .eq('organization_id', organizationId);

    if (error) {
      logger.error('Failed to delete workflow state', { error, id });
      throw new Error(`Failed to delete workflow state: ${error.message}`);
    }

    return true;
  }

  // --------------------------------------------------------------------------
  // Session management helpers (used by AgentQueryService)
  // --------------------------------------------------------------------------

  async getState(sessionId: string, organizationId: string): Promise<WorkflowState | null> {
    return this.findById(sessionId, organizationId);
  }

  async saveState(state: WorkflowState): Promise<WorkflowState> {
    return this.update(state.id, state.organization_id, state);
  }

  async createSession(params: {
    userId: string;
    organizationId: string;
    workspaceId?: string;
    initialStage?: string;
  }): Promise<WorkflowState> {
    return this.create({
      workflow_id: '',
      execution_id: '',
      workspace_id: params.workspaceId ?? '',
      organization_id: params.organizationId,
      lifecycle_stage: params.initialStage ?? 'discovery',
      status: 'pending',
      current_step: params.initialStage ?? 'discovery',
      completed_steps: [],
      state_data: { userId: params.userId },
      context: {},
    });
  }

  async getSession(sessionId: string, organizationId: string): Promise<WorkflowState | null> {
    return this.findById(sessionId, organizationId);
  }

  async getActiveSessions(organizationId: string): Promise<WorkflowState[]> {
    return this.find({ organization_id: organizationId });
  }

  async getActiveSessionForCase(caseId: string, organizationId: string): Promise<WorkflowState | null> {
    const results = await this.find({ organization_id: organizationId, workflow_id: caseId });
    return results[0] ?? null;
  }

  async updateSessionStatus(
    sessionId: string,
    status: WorkflowStatus,
    organizationId: string,
  ): Promise<WorkflowState> {
    return this.updateStatus(sessionId, organizationId, status);
  }

  async incrementErrorCount(sessionId: string, organizationId: string): Promise<void> {
    const state = await this.findById(sessionId, organizationId);
    if (state) {
      const errorCount = ((state.state_data?.errorCount as number) ?? 0) + 1;
      await this.update(sessionId, organizationId, { state_data: { ...state.state_data, errorCount } });
    }
  }

  async cleanupOldSessions(olderThanDays: number, organizationId: string): Promise<number> {
    this.assertOrganizationId(organizationId, 'cleanupOldSessions');
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString();
    const { data } = await this.supabase
      .from('workflow_states')
      .delete()
      .eq('organization_id', organizationId)
      .lt('updated_at', cutoff)
      .select('id');
    return data?.length ?? 0;
  }
}

export const workflowStateRepository = new WorkflowStateRepository();
