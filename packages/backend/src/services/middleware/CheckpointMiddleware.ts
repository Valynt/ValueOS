/**
 * CheckpointMiddleware — HITL approval gate for high-risk agent actions.
 *
 * When the RiskClassifier flags an action, execution pauses and a checkpoint
 * is created. A human must approve or reject via the REST API before the
 * pipeline continues.
 *
 * In-memory Promise map provides the fast path for single-node setups.
 * Checkpoint state is also persisted to WorkspaceStateService for
 * restartability and UI querying.
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
  CheckpointTimeoutError,
  CheckpointRejectedError,
  DEFAULT_CHECKPOINT_CONFIG,
} from './types.js';

// ---------------------------------------------------------------------------
// Pending checkpoint waiter stored in-memory
// ---------------------------------------------------------------------------

export interface PendingCheckpoint {
  resolve: (decision: 'approved') => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
  record: CheckpointRecord;
}

// ---------------------------------------------------------------------------
// Dependencies injected into the middleware
// ---------------------------------------------------------------------------

export interface CheckpointDeps {
  /** Persist / retrieve checkpoint state */
  workspaceStateService: {
    updateState(workspaceId: string, updates: Record<string, unknown>): Promise<unknown>;
  };
  /** Push real-time notification to the UI */
  realtimeUpdateService: {
    pushUpdate(workspaceId: string, update: Record<string, unknown>): Promise<void>;
  };
}

// ---------------------------------------------------------------------------
// CheckpointMiddleware
// ---------------------------------------------------------------------------

export class CheckpointMiddleware implements AgentMiddleware {
  public readonly name = 'checkpoint';

  private config: CheckpointConfig;
  private riskClassifier: RiskClassifier;
  private deps: CheckpointDeps;

  /**
   * In-memory map of pending checkpoints.
   * Exposed as `readonly` so the REST endpoint can resolve/reject them.
   */
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

    // Bypass for privileged roles
    const roles = context.envelope?.actor?.roles;
    if (this.riskClassifier.canBypass(roles)) {
      return next();
    }

    const classification = this.riskClassifier.classify(context);

    if (!classification.requiresApproval) {
      return next();
    }

    // --- High-risk path: create checkpoint and wait ---
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

    // Persist checkpoint state
    await this.persistCheckpoint(record, context);

    // Push notification to UI
    await this.notifyUI(record, context);

    logger.info('Checkpoint created, awaiting human approval', {
      checkpointId,
      riskLevel: classification.riskLevel,
      agentType: context.agentType,
    });

    // Await approval via in-memory Promise
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

    // Approved — update record and continue
    record.status = 'approved';
    record.resolvedAt = new Date().toISOString();
    await this.persistCheckpoint(record, context);

    logger.info('Checkpoint approved, resuming execution', { checkpointId });

    return next();
  }

  // ---------------------------------------------------------------------------
  // Public API used by the REST endpoint
  // ---------------------------------------------------------------------------

  /**
   * Resolve a pending checkpoint (approve or reject).
   * Returns `true` if the checkpoint was found and resolved.
   */
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

  /**
   * Get a pending checkpoint record by ID (for the REST endpoint).
   */
  getCheckpoint(checkpointId: string): CheckpointRecord | undefined {
    return this.pending.get(checkpointId)?.record;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

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

  private async persistCheckpoint(
    record: CheckpointRecord,
    context: AgentMiddlewareContext,
  ): Promise<void> {
    try {
      const workspaceId =
        context.envelope?.organizationId ?? 'default';
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

  private async notifyUI(
    record: CheckpointRecord,
    context: AgentMiddlewareContext,
  ): Promise<void> {
    try {
      const workspaceId =
        context.envelope?.organizationId ?? 'default';
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
