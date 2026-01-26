import { supabase } from '../lib/supabase.js'
import { logger } from '../lib/logger.js'

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

export class HumanCheckpointService {
  /**
   * Request human approval for a workflow stage
   */
  async requestApproval(request: CheckpointRequest): Promise<string> {
    const checkpointId = `checkpoint_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

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
    await supabase
      .from('workflow_executions')
      .update({
        status: 'waiting_approval',
        context: {
          pending_checkpoint: checkpointId,
          paused_at: request.stageId,
        },
      })
      .eq('id', request.executionId);

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
      .select('*')
      .eq('id', checkpointId)
      .single();

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

    await supabase
      .from('workflow_executions')
      .update({
        status: newStatus,
        context: contextUpdate,
      })
      .eq('id', checkpoint.execution_id);

    logger.info('Checkpoint decision recorded', {
      checkpointId,
      approved: decision.approved,
      executionId: checkpoint.execution_id
    });
  }

  /**
   * Get pending checkpoints for an organization
   */
  async getPendingCheckpoints(organizationId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('workflow_checkpoints')
      .select(`
        *,
        workflow_executions!inner(organization_id)
      `)
      .eq('status', 'pending')
      .eq('workflow_executions.organization_id', organizationId);

    if (error) {
      logger.error('Failed to fetch pending checkpoints', error);
      return [];
    }

    return data || [];
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
