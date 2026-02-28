/**
 * Workflow State Repository
 * 
 * Repository pattern for workflow state persistence and retrieval
 */

import { logger } from '../lib/logger.js';
import { createServerSupabaseClient } from '../lib/supabase.js';
import { getCurrentTenantContext } from '../middleware/tenantContext.js'

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
  | 'error'
  | 'in_progress'
  | 'initiated'
  | 'rolled_back';

export interface WorkflowStateFilter {
  workspace_id?: string;
  organization_id?: string;
  workflow_id?: string;
  execution_id?: string;
  status?: WorkflowStatus;
  lifecycle_stage?: string;
}

export class WorkflowStateRepository {
  private supabase: ReturnType<typeof createServerSupabaseClient>;

  constructor() {
    this.supabase = createServerSupabaseClient();
  }

  private resolveTenantId(): string | undefined {
    return getCurrentTenantContext()?.tid;
  }

  async create(state: Omit<WorkflowState, 'id' | 'created_at' | 'updated_at'>): Promise<WorkflowState> {
    const tenantId = this.resolveTenantId();
    if (tenantId && state.organization_id !== tenantId) {
      throw new Error("Tenant context mismatch for workflow state creation");
    }
    const now = new Date().toISOString();
    const newState: WorkflowState = {
      ...state,
      id: `wfs_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
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

  async findById(id: string): Promise<WorkflowState | null> {
    const tenantId = this.resolveTenantId();
    let query = this.supabase.from('workflow_states').select('*').eq('id', id);
    if (tenantId) {
      query = query.eq('organization_id', tenantId);
    }
    const { data, error } = await query.single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      logger.error('Failed to find workflow state', { error, id });
      throw new Error(`Failed to find workflow state: ${error.message}`);
    }

    return data as WorkflowState;
  }

  async findByExecutionId(executionId: string): Promise<WorkflowState | null> {
    const tenantId = this.resolveTenantId();
    let query = this.supabase.from('workflow_states').select('*').eq('execution_id', executionId);
    if (tenantId) {
      query = query.eq('organization_id', tenantId);
    }
    const { data, error } = await query.single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      logger.error('Failed to find workflow state by execution', { error, executionId });
      throw new Error(`Failed to find workflow state: ${error.message}`);
    }

    return data as WorkflowState;
  }

  async find(filter: WorkflowStateFilter): Promise<WorkflowState[]> {
    let query = this.supabase.from('workflow_states').select('*');

    if (filter.workspace_id) query = query.eq('workspace_id', filter.workspace_id);
    const tenantId = this.resolveTenantId();
    if (filter.organization_id) {
      query = query.eq('organization_id', filter.organization_id);
    } else if (tenantId) {
      query = query.eq('organization_id', tenantId);
    }
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

  async update(id: string, updates: Partial<Omit<WorkflowState, 'id' | 'created_at'>>): Promise<WorkflowState> {
    const tenantId = this.resolveTenantId();
    let updateQuery = this.supabase
      .from('workflow_states')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    if (tenantId) {
      updateQuery = updateQuery.eq('organization_id', tenantId);
    }
    const { data, error } = await updateQuery.select().single();

    if (error) {
      logger.error('Failed to update workflow state', { error, id });
      throw new Error(`Failed to update workflow state: ${error.message}`);
    }

    return data as WorkflowState;
  }

  async updateStatus(id: string, status: WorkflowStatus): Promise<WorkflowState> {
    return this.update(id, { status });
  }

  async updateProgress(id: string, currentStep: string, completedSteps: string[]): Promise<WorkflowState> {
    return this.update(id, {
      current_step: currentStep,
      completed_steps: completedSteps,
    });
  }

  async delete(id: string): Promise<boolean> {
    const tenantId = this.resolveTenantId();
    let deleteQuery = this.supabase.from('workflow_states').delete().eq('id', id);
    if (tenantId) {
      deleteQuery = deleteQuery.eq('organization_id', tenantId);
    }
    const { error } = await deleteQuery;

    if (error) {
      logger.error('Failed to delete workflow state', { error, id });
      throw new Error(`Failed to delete workflow state: ${error.message}`);
    }

    return true;
  }

  // Session management methods used by AgentQueryService
  async getState(sessionId: string): Promise<WorkflowState | null> {
    return this.findById(sessionId);
  }

  async saveState(state: WorkflowState): Promise<WorkflowState> {
    return this.update(state.id, state);
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

  async getSession(sessionId: string): Promise<WorkflowState | null> {
    return this.findById(sessionId);
  }

  async getActiveSessions(organizationId: string): Promise<WorkflowState[]> {
    return this.find({ organization_id: organizationId });
  }

  async getActiveSessionForCase(caseId: string): Promise<WorkflowState | null> {
    const results = await this.find({ workflow_id: caseId });
    return results[0] ?? null;
  }

  async updateSessionStatus(sessionId: string, status: WorkflowStatus): Promise<WorkflowState> {
    return this.updateStatus(sessionId, status);
  }

  async incrementErrorCount(sessionId: string): Promise<void> {
    const state = await this.findById(sessionId);
    if (state) {
      const errorCount = ((state.state_data?.errorCount as number) ?? 0) + 1;
      await this.update(sessionId, { state_data: { ...state.state_data, errorCount } });
    }
  }

  async cleanupOldSessions(maxAgeMs: number): Promise<number> {
    const cutoff = new Date(Date.now() - maxAgeMs).toISOString();
    const { data } = await this.supabase
      .from('workflow_states')
      .delete()
      .lt('updated_at', cutoff)
      .select('id');
    return data?.length ?? 0;
  }
}

export const workflowStateRepository = new WorkflowStateRepository();
