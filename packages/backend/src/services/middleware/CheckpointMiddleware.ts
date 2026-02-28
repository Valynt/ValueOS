/**
 * CheckpointMiddleware — HITL approval gate for high-risk agent actions.
 */

import { v4 as uuidv4 } from 'uuid';

import { logger } from '../../lib/logger.js';
import {
  AgentMiddleware,
  AgentMiddlewareContext,
  AgentResponse,
} from '../UnifiedAgentOrchestrator.js';

import { RiskClassifier } from './RiskClassifier.js';
import {
  CheckpointConfig,
  CheckpointRecord,
  CheckpointRejectedError,
  CheckpointTimeoutError,
  DEFAULT_CHECKPOINT_CONFIG,
} from './types.js';

export interface PendingCheckpoint {
  resolve: (decision: 'approved') => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
  record: CheckpointRecord;
}

export interface CheckpointDeps {
  workspaceStateService: {
    updateState(workspaceId: string, updates: Record<string, unknown>): Promise<unknown>;
  };
  realtimeUpdateService: {
    pushUpdate(workspaceId: string, update: Record<string, unknown>): Promise<void>;
  };
  approvalNotifier?: {
    notifyApprovalRequested(input: {
      checkpointId: string;
      approvalRequestId: string;
      tenantId: string;
      agentName: string;
      action: string;
      description: string;
      actorId?: string;
    }): Promise<void>;
  };
  onAuditEvent?: (event: string, details: Record<string, unknown>) => Promise<void>;
}

export class CheckpointMiddleware implements AgentMiddleware {
  public readonly name = 'checkpoint';

  private config: CheckpointConfig;
  private riskClassifier: RiskClassifier;
  private deps: CheckpointDeps;

  readonly pending = new Map<string, PendingCheckpoint>();

  constructor(
    deps: CheckpointDeps,
    config: Partial<CheckpointConfig> = {},
    riskClassifier?: RiskClassifier,
  ) {
    this.config = { ...DEFAULT_CHECKPOINT_CONFIG, ...config };
    this.deps = deps;
    this.riskClassifier = riskClassifier ?? new RiskClassifier(this.config);
  }

  async execute(
    context: AgentMiddlewareContext,
    next: () => Promise<AgentResponse>,
  ): Promise<AgentResponse> {
    if (!this.config.enabled) {
      return next();
    }

    const roles = context.envelope?.actor?.roles;
    if (this.riskClassifier.canBypass(roles)) {
      return next();
    }

    const classification = this.riskClassifier.classify(context);
    if (!classification.requiresApproval) {
      return next();
    }

    const checkpointId = uuidv4();
    const record: CheckpointRecord = {
      checkpointId,
      agentType: context.agentType,
      intent: context.envelope?.intent ?? '',
      riskLevel: classification.riskLevel as 'medium' | 'high' | 'critical',
      riskReason: classification.reason,
      serializedContext: JSON.stringify(context),
      status: 'pending',
      createdAt: new Date().toISOString(),
      timeoutMs: this.config.defaultTimeoutMs,
    };

    await this.persistCheckpoint(record, context);
    await this.notifyUI(record, context);
    await this.notifyApprovalChannel(record, context);

    try {
      await this.awaitApproval(checkpointId, record);
    } catch (err) {
      if (err instanceof CheckpointTimeoutError) {
        record.status = 'timeout';
        await this.persistCheckpoint(record, context);
        return {
          type: 'message',
          payload: {
            message: `Action timed out waiting for approval (checkpoint ${checkpointId}).`,
            error: true,
          },
        };
      }
      if (err instanceof CheckpointRejectedError) {
        record.status = 'rejected';
        record.resolvedAt = new Date().toISOString();
        record.resolvedBy = err.rejectedBy;
        await this.persistCheckpoint(record, context);
        return {
          type: 'message',
          payload: {
            message: `Action rejected: ${err.reason}`,
            error: true,
          },
        };
      }
      throw err;
    }

    record.status = 'approved';
    record.resolvedAt = new Date().toISOString();
    await this.persistCheckpoint(record, context);

    logger.info('Checkpoint approved, resuming execution', { checkpointId });

    return next();
  }

  resolveCheckpoint(
    checkpointId: string,
    decision: 'approved' | 'rejected',
    opts?: { reason?: string; resolvedBy?: string },
  ): boolean {
    const entry = this.pending.get(checkpointId);
    if (!entry) return false;

    clearTimeout(entry.timeout);
    this.pending.delete(checkpointId);

    if (decision === 'approved') {
      entry.resolve('approved');
    } else {
      entry.reject(
        new CheckpointRejectedError(
          checkpointId,
          opts?.reason ?? 'Rejected by reviewer',
          opts?.resolvedBy,
        ),
      );
    }

    return true;
  }

  getCheckpoint(checkpointId: string): CheckpointRecord | undefined {
    return this.pending.get(checkpointId)?.record;
  }

  private async notifyApprovalChannel(
    record: CheckpointRecord,
    context: AgentMiddlewareContext,
  ): Promise<void> {
    if (!this.deps.approvalNotifier) {
      return;
    }

    const tenantId = context.envelope?.organizationId ?? 'default';
    try {
      await this.deps.approvalNotifier.notifyApprovalRequested({
        checkpointId: record.checkpointId,
        approvalRequestId: record.checkpointId,
        tenantId,
        agentName: context.agentType,
        action: context.envelope?.intent ?? 'unknown',
        description: `Human approval required for ${context.agentType} action ${context.envelope?.intent ?? 'unknown'}.`,
        actorId: context.userId,
      });

      if (this.deps.onAuditEvent) {
        await this.deps.onAuditEvent('approval_request_sent', {
          checkpointId: record.checkpointId,
          tenantId,
          agentType: context.agentType,
        });
      }
    } catch (err) {
      logger.error('Failed to send approval notification', {
        checkpointId: record.checkpointId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private awaitApproval(
    checkpointId: string,
    record: CheckpointRecord,
  ): Promise<'approved'> {
    return new Promise<'approved'>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(checkpointId);
        reject(new CheckpointTimeoutError(checkpointId, record.timeoutMs));
      }, record.timeoutMs);

      this.pending.set(checkpointId, { resolve, reject, timeout, record });
    });
  }

  private async persistCheckpoint(record: CheckpointRecord, context: AgentMiddlewareContext): Promise<void> {
    try {
      const workspaceId = context.envelope?.organizationId ?? 'default';
      await this.deps.workspaceStateService.updateState(workspaceId, {
        [`checkpoint:${record.checkpointId}`]: record,
      });
    } catch (err) {
      logger.error('Failed to persist checkpoint', {
        checkpointId: record.checkpointId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private async notifyUI(record: CheckpointRecord, context: AgentMiddlewareContext): Promise<void> {
    try {
      const workspaceId = context.envelope?.organizationId ?? 'default';
      await this.deps.realtimeUpdateService.pushUpdate(workspaceId, {
        type: 'human_intervention_required',
        source: 'checkpoint_middleware',
        payload: {
          checkpointId: record.checkpointId,
          agentType: record.agentType,
          intent: record.intent,
          riskLevel: record.riskLevel,
          riskReason: record.riskReason,
          requestingUser: context.userId,
        },
      });
    } catch (err) {
      logger.error('Failed to push checkpoint notification', {
        checkpointId: record.checkpointId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
