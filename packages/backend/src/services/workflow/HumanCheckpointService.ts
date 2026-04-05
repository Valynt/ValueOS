import { randomUUID } from 'node:crypto'

import { logger } from '../../lib/logger.js'
import { supabase } from '../../lib/supabase.js'

export interface CheckpointRequest {
  executionId: string;
  stageId: string;
  agentId: string;
  action: string;
  riskLevel: 'low' | 'medium' | 'high';
  confidence?: number;
  reasoning?: string;
  organizationId: string;
}

export interface CheckpointDecision {
  approved: boolean;
  userId: string;
  reasoning?: string;
  timestamp: Date;
}

interface WorkflowCheckpointRow {
  execution_id: string;
}

export interface PendingCheckpoint {
  id: string;
  execution_id: string;
  stage_id: string;
  agent_id: string;
  action: string;
  risk_level: 'low' | 'medium' | 'high';
  confidence: number | null;
  reasoning: string | null;
  status: 'pending';
  created_at: string;
}

interface PendingCheckpointRow extends PendingCheckpoint {
  workflow_executions: {
    organization_id: string;
  };
}

export class HumanCheckpointService {
  /**
   * Request human approval for a workflow stage
   */
  async requestApproval(request: CheckpointRequest): Promise<string> {
    const checkpointId = `checkpoint_${randomUUID()}`;

    const { error } = await supabase
      .from('workflow_checkpoints')
      .insert({
        id: checkpointId,
        execution_id: request.executionId,
        stage_id: request.stageId,
        agent_id: request.agentId,
        action: request.action,
        risk_level: request.riskLevel,
        confidence: request.confidence,
        reasoning: request.reasoning,
        organization_id: request.organizationId,
        status: 'pending',
        created_at: new Date().toISOString(),
      });

    if (error) {
      logger.error('Failed to create checkpoint', error);
      throw new Error('Failed to create human checkpoint');
    }

    // Pause workflow execution
    const { error: pauseError } = await supabase
      .from('workflow_executions')
      .update({
        status: 'waiting_approval',
        context: {
          pending_checkpoint: checkpointId,
          paused_at: request.stageId,
        },
      })
      .eq('id', request.executionId);

    if (pauseError) {
      logger.error('Failed to pause workflow for checkpoint', pauseError);
      throw new Error('Failed to pause workflow after creating human checkpoint');
    }

    logger.info('Human checkpoint created', { checkpointId, executionId: request.executionId });
    return checkpointId;
  }

  /**
   * Approve or reject a checkpoint
   */
  async decideCheckpoint(
    checkpointId: string,
    decision: CheckpointDecision
  ): Promise<void> {
    const { data: checkpoint, error: fetchError } = await supabase
      .from('workflow_checkpoints')
      .select('execution_id')
      .eq('id', checkpointId)
      .single<WorkflowCheckpointRow>();

    if (fetchError || !checkpoint) {
      throw new Error('Checkpoint not found');
    }

    // Record decision
    const { error: updateError } = await supabase
      .from('workflow_checkpoints')
      .update({
        status: decision.approved ? 'approved' : 'rejected',
        decided_by: decision.userId,
        decision_reasoning: decision.reasoning,
        decided_at: decision.timestamp.toISOString(),
      })
      .eq('id', checkpointId);

    if (updateError) {
      logger.error('Failed to update checkpoint', updateError);
      throw new Error('Failed to record checkpoint decision');
    }

    // Resume or fail workflow
    const newStatus = decision.approved ? 'in_progress' : 'failed';
    const contextUpdate = decision.approved
      ? { pending_checkpoint: null, approval_granted: true }
      : { pending_checkpoint: null, rejection_reason: decision.reasoning };

    const { error: resumeError } = await supabase
      .from('workflow_executions')
      .update({
        status: newStatus,
        context: contextUpdate,
      })
      .eq('id', checkpoint.execution_id);

    if (resumeError) {
      logger.error('Failed to update workflow execution after checkpoint decision', resumeError);
      throw new Error('Failed to update workflow state after checkpoint decision');
    }

    logger.info('Checkpoint decision recorded', {
      checkpointId,
      approved: decision.approved,
      executionId: checkpoint.execution_id
    });
  }

  /**
   * Get pending checkpoints for an organization
   */
  async getPendingCheckpoints(organizationId: string): Promise<PendingCheckpoint[]> {
    const { data, error } = await supabase
      .from('workflow_checkpoints')
      .select(`
        id,
        execution_id,
        stage_id,
        agent_id,
        action,
        risk_level,
        confidence,
        reasoning,
        status,
        created_at,
        workflow_executions!inner(organization_id)
      `)
      .eq('status', 'pending')
      .eq('workflow_executions.organization_id', organizationId)
      .returns<PendingCheckpointRow[]>();

    if (error) {
      logger.error('Failed to fetch pending checkpoints', error);
      return [];
    }

    if (!data) {
      return [];
    }

    return data.map(({ workflow_executions: _workflowExecutions, ...checkpoint }) => ({
      ...checkpoint,
      status: 'pending',
    }));
  }

  /**
   * Check if a stage requires human approval based on risk level
   */
  shouldRequireApproval(riskLevel: string, confidence?: number): boolean {
    // High risk always requires approval
    if (riskLevel === 'high') return true;

    // Medium risk requires approval if confidence is low
    if (riskLevel === 'medium' && confidence && confidence < 0.7) return true;

    // Low risk or high confidence: no approval needed
    return false;
  }
}

export const humanCheckpointService = new HumanCheckpointService();
