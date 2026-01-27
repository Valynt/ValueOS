/**
 * Workflow State Repository
 * 
 * Repository pattern for workflow state persistence and retrieval
 */

import { createServerSupabaseClient } from '../lib/supabase.js';
import { logger } from '../lib/logger.js';

export interface WorkflowState {
  id: string;
  workflow_id: string;
  execution_id: string;
  workspace_id: string;
  organization_id: string;
  lifecycle_stage: string;
  status: WorkflowStatus;
  current_step: string;
  completed_steps: string[];
  state_data: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export type WorkflowStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'paused';

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

  async create(state: Omit<WorkflowState, 'id' | 'created_at' | 'updated_at'>): Promise<WorkflowState> {
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
    const { data, error } = await this.supabase
      .from('workflow_states')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      logger.error('Failed to find workflow state', { error, id });
      throw new Error(`Failed to find workflow state: ${error.message}`);
    }

    return data as WorkflowState;
  }

  async findByExecutionId(executionId: string): Promise<WorkflowState | null> {
    const { data, error } = await this.supabase
      .from('workflow_states')
      .select('*')
      .eq('execution_id', executionId)
      .single();

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
    if (filter.organization_id) query = query.eq('organization_id', filter.organization_id);
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
    const { data, error } = await this.supabase
      .from('workflow_states')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

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
    const { error } = await this.supabase
      .from('workflow_states')
      .delete()
      .eq('id', id);

    if (error) {
      logger.error('Failed to delete workflow state', { error, id });
      throw new Error(`Failed to delete workflow state: ${error.message}`);
    }

    return true;
  }
}

export const workflowStateRepository = new WorkflowStateRepository();
