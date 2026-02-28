/**
 * Lifecycle Compensation Handlers
 * 
 * Specific compensation logic for each lifecycle stage
 */

import { SupabaseClient } from '@supabase/supabase-js';

import { logger } from '../lib/logger';
import { CompensationEvent } from '../types/CompensationEvent';

/**
 * Compensation context for a stage
 */
export interface StageCompensationContext {
  stageId: string;
  stage: LifecycleStage;
  artifactsCreated: string[];
  stateChanges: Record<string, unknown>;
  executionId: string;
}

/**
 * Compensation handler function
 */
export type CompensationHandler = (context: StageCompensationContext) => Promise<void>;

/**
 * Lifecycle Compensation Handlers
 * 
 * Provides compensation logic for each lifecycle stage
 */
export class LifecycleCompensationHandlers {
  private handlers: Map<LifecycleStage, CompensationHandler> = new Map();

  private snapshotManager: SnapshotManager;

  constructor(private supabase: SupabaseClient, snapshotManager: SnapshotManager) {
    this.snapshotManager = snapshotManager;
    this.registerHandlers();
  }

  /**
   * Register all compensation handlers
   */
  private registerHandlers(): void {
    this.handlers.set('opportunity', this.compensateOpportunity.bind(this));
    this.handlers.set('target', this.compensateTarget.bind(this));
    this.handlers.set('expansion', this.compensateExpansion.bind(this));
    this.handlers.set('integrity', this.compensateIntegrity.bind(this));
    this.handlers.set('realization', this.compensateRealization.bind(this));
  }

  /**
   * Get compensation handler for a stage
   */
  getHandler(stage: LifecycleStage): CompensationHandler | null {
    return this.handlers.get(stage) || null;
  }

  /**
   * Compensate opportunity stage
   * 
   * Rollback:
   * - Delete created opportunities
   * - Remove discovery artifacts
   * - Clear cached analysis
   */
  private async compensateOpportunity(context: StageCompensationContext): Promise<void> {
    logger.info('Compensating opportunity stage', {
      stageId: context.stageId,
      artifactsCount: context.artifactsCreated.length
    });

    try {
      // Delete opportunities
      if (context.artifactsCreated.length > 0) {
        const { error: deleteError } = await this.supabase
          .from('opportunities')
          .delete()
          .in('id', context.artifactsCreated);

        if (deleteError) {
          logger.error('Failed to delete opportunities', deleteError);
        }
      }

      // Clear discovery cache
      if (context.stateChanges.cacheKeys) {
        for (const cacheKey of context.stateChanges.cacheKeys) {
          await this.clearCache(cacheKey);
        }
      }

      logger.info('Opportunity stage compensated successfully', {
        stageId: context.stageId
      });

    } catch (error) {
      logger.error('Opportunity compensation failed', error as Error, {
        stageId: context.stageId
      });
      throw error;
    }
  }

  /**
   * Compensate target stage
   * 
   * Rollback:
   * - Delete value trees
   * - Remove ROI models
   * - Delete value commits
   * - Clear KPI targets
   */
  private async compensateTarget(context: StageCompensationContext): Promise<void> {
    logger.info('Compensating target stage', {
      stageId: context.stageId,
      artifactsCount: context.artifactsCreated.length
    });

    try {
      // --- Formula Snapshotting (before modification) ---
      if (context.stateChanges.valueTreeId && context.stateChanges.formula) {
        await this.snapshotManager.createSnapshot({
          valueCaseId: context.stateChanges.valueCaseId,
          valueTreeId: context.stateChanges.valueTreeId,
          formula: context.stateChanges.formula,
          agent: 'TargetAgent',
          reason: 'Pre-modification snapshot before compensation',
        });
      }

      // --- Reasoned Rollback for IntegrityAgent Veto ---
      if (context.stateChanges.integrityVeto) {
        // Retrieve last verified formula snapshot
        const lastSnapshot = context.stateChanges.valueCaseId && context.stateChanges.valueTreeId
          ? await this.snapshotManager.getLastSnapshot(
              context.stateChanges.valueCaseId,
              context.stateChanges.valueTreeId
            )
          : null;

        const compensationEvent: CompensationEvent = {
          timestamp: new Date().toISOString(),
          reason: `ROI target rejected due to ${context.stateChanges.vetoReason || 'Rule Violation'}`,
          details: lastSnapshot
            ? `Reverting to last verified formula (snapshot ${lastSnapshot.id}) with a -15% confidence adjustment.`
            : 'No previous formula snapshot found. Manual review required.',
          confidenceAdjustment: -0.15,
          previousFormulaSnapshotId: lastSnapshot?.id,
          triggeredBy: 'IntegrityAgent',
        };
        // Append CompensationEvent to ValueCase (pseudo-code, replace with actual DB logic)
        if (context.stateChanges.valueCaseId) {
          await this.supabase.from('value_cases').update({
            compensation_events: this.supabase.fn('array_append', 'compensation_events', compensationEvent)
          }).eq('id', context.stateChanges.valueCaseId);
        }
      }

      // --- Fiscal Circuit Breaker: Emergency Compensation ---
      if (context.stateChanges.emergencyCompensation) {
        const compensationEvent: CompensationEvent = {
          timestamp: new Date().toISOString(),
          reason: 'EMERGENCY_COMPENSATION: Infinite loop or NaN detected in ROI calculation',
          details: 'Model locked and Value Engineer alerted.',
          triggeredBy: 'CircuitBreaker',
          emergency: true,
        };
        if (context.stateChanges.valueCaseId) {
          await this.supabase.from('value_cases').update({
            locked: true,
            status: 'LOCKED_INTEGRITY_FAILURE',
            compensation_events: this.supabase.fn('array_append', 'compensation_events', compensationEvent)
          }).eq('id', context.stateChanges.valueCaseId);
        }
        // Pseudo-code: Alert Value Engineer (replace with actual notification logic)
        logger.warn('EMERGENCY_COMPENSATION triggered: Value Engineer must be alerted.', {
          valueCaseId: context.stateChanges.valueCaseId
        });
      }

      // --- Standard Compensation Logic ---
      // Delete value trees
      if (context.stateChanges.valueTreeIds) {
        const { error: treeError } = await this.supabase
          .from('value_trees')
          .delete()
          .in('id', context.stateChanges.valueTreeIds);

        if (treeError) {
          logger.error('Failed to delete value trees', treeError);
        }
      }

      // Delete ROI models
      if (context.stateChanges.roiModelIds) {
        const { error: roiError } = await this.supabase
          .from('roi_models')
          .delete()
          .in('id', context.stateChanges.roiModelIds);

        if (roiError) {
          logger.error('Failed to delete ROI models', roiError);
        }
      }

      // Delete value commits
      if (context.stateChanges.valueCommitIds) {
        const { error: commitError } = await this.supabase
          .from('value_commits')
          .delete()
          .in('id', context.stateChanges.valueCommitIds);

        if (commitError) {
          logger.error('Failed to delete value commits', commitError);
        }
      }

      logger.info('Target stage compensated successfully', {
        stageId: context.stageId
      });

    } catch (error) {
      logger.error('Target compensation failed', error as Error, {
        stageId: context.stageId
      });
      throw error;
    }
  }

  /**
   * Compensate expansion stage
   * 
   * Rollback:
   * - Revert value tree expansions
   * - Delete expansion nodes
   * - Remove expansion links
   * - Clear expansion cache
   */
  private async compensateExpansion(context: StageCompensationContext): Promise<void> {
    logger.info('Compensating expansion stage', {
      stageId: context.stageId,
      artifactsCount: context.artifactsCreated.length
    });

    try {
      // Delete expansion nodes
      if (context.stateChanges.expansionNodeIds) {
        const { error: nodeError } = await this.supabase
          .from('value_tree_nodes')
          .delete()
          .in('id', context.stateChanges.expansionNodeIds);

        if (nodeError) {
          logger.error('Failed to delete expansion nodes', nodeError);
        }
      }

      // Delete expansion links
      if (context.stateChanges.expansionLinkIds) {
        const { error: linkError } = await this.supabase
          .from('value_tree_links')
          .delete()
          .in('id', context.stateChanges.expansionLinkIds);

        if (linkError) {
          logger.error('Failed to delete expansion links', linkError);
        }
      }

      // Revert value tree version
      if (context.stateChanges.valueTreeId && context.stateChanges.previousVersion) {
        await this.revertValueTreeVersion(
          context.stateChanges.valueTreeId,
          context.stateChanges.previousVersion
        );
      }

      logger.info('Expansion stage compensated successfully', {
        stageId: context.stageId
      });

    } catch (error) {
      logger.error('Expansion compensation failed', error as Error, {
        stageId: context.stageId
      });
      throw error;
    }
  }

  /**
   * Compensate integrity stage
   * 
   * Rollback:
   * - Remove integrity checks
   * - Delete validation results
   * - Clear integrity flags
   * - Revert approval status
   */
  private async compensateIntegrity(context: StageCompensationContext): Promise<void> {
    logger.info('Compensating integrity stage', {
      stageId: context.stageId,
      artifactsCount: context.artifactsCreated.length
    });

    try {
      // Delete integrity checks
      if (context.stateChanges.integrityCheckIds) {
        const { error: checkError } = await this.supabase
          .from('integrity_checks')
          .delete()
          .in('id', context.stateChanges.integrityCheckIds);

        if (checkError) {
          logger.error('Failed to delete integrity checks', checkError);
        }
      }

      // Revert approval status
      if (context.stateChanges.approvalIds) {
        const { error: approvalError } = await this.supabase
          .from('approvals')
          .update({ status: 'pending' })
          .in('id', context.stateChanges.approvalIds);

        if (approvalError) {
          logger.error('Failed to revert approval status', approvalError);
        }
      }

      logger.info('Integrity stage compensated successfully', {
        stageId: context.stageId
      });

    } catch (error) {
      logger.error('Integrity compensation failed', error as Error, {
        stageId: context.stageId
      });
      throw error;
    }
  }

  /**
   * Compensate realization stage
   * 
   * Rollback:
   * - Delete realization records
   * - Remove KPI measurements
   * - Clear realization dashboard
   * - Revert feedback loops
   */
  private async compensateRealization(context: StageCompensationContext): Promise<void> {
    logger.info('Compensating realization stage', {
      stageId: context.stageId,
      artifactsCount: context.artifactsCreated.length
    });

    try {
      // Delete realization records
      if (context.stateChanges.realizationIds) {
        const { error: realizationError } = await this.supabase
          .from('realizations')
          .delete()
          .in('id', context.stateChanges.realizationIds);

        if (realizationError) {
          logger.error('Failed to delete realizations', realizationError);
        }
      }

      // Delete KPI measurements
      if (context.stateChanges.measurementIds) {
        const { error: measurementError } = await this.supabase
          .from('kpi_measurements')
          .delete()
          .in('id', context.stateChanges.measurementIds);

        if (measurementError) {
          logger.error('Failed to delete KPI measurements', measurementError);
        }
      }

      // Clear feedback loops
      if (context.stateChanges.feedbackLoopIds) {
        const { error: feedbackError } = await this.supabase
          .from('feedback_loops')
          .update({ status: 'inactive' })
          .in('id', context.stateChanges.feedbackLoopIds);

        if (feedbackError) {
          logger.error('Failed to deactivate feedback loops', feedbackError);
        }
      }

      logger.info('Realization stage compensated successfully', {
        stageId: context.stageId
      });

    } catch (error) {
      logger.error('Realization compensation failed', error as Error, {
        stageId: context.stageId
      });
      throw error;
    }
  }

  /**
   * Helper: Clear cache entry
   */
  private async clearCache(cacheKey: string): Promise<void> {
    try {
      // Implementation would clear cache
      logger.debug('Clearing cache', { cacheKey });
    } catch (error) {
      logger.error('Failed to clear cache', error as Error, { cacheKey });
    }
  }

  /**
   * Helper: Revert value tree to previous version
   */
  private async revertValueTreeVersion(
    valueTreeId: string,
    previousVersion: number
  ): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('value_trees')
        .update({ version: previousVersion })
        .eq('id', valueTreeId);

      if (error) {
        throw error;
      }

      logger.debug('Reverted value tree version', {
        valueTreeId,
        version: previousVersion
      });

    } catch (error) {
      logger.error('Failed to revert value tree version', error as Error, {
        valueTreeId,
        previousVersion
      });
      throw error;
    }
  }
}

/**
 * Singleton instance
 */
let handlersInstance: LifecycleCompensationHandlers | null = null;

/**
 * Get or create handlers instance
 */
import { AuditTrailService } from './AuditTrailService';
import { SnapshotManager } from './SnapshotManager';
import { SnapshotManager } from './SnapshotManager';
import { LifecycleStage } from './ValueLifecycleOrchestrator';

export function getLifecycleCompensationHandlers(
  supabase: SupabaseClient,
  snapshotManager?: SnapshotManager,
  auditTrail?: AuditTrailService
): LifecycleCompensationHandlers {
  if (!handlersInstance) {
    // If not provided, create minimal stubs for snapshotManager and auditTrail
    const audit = auditTrail || new AuditTrailService();
    const snap = snapshotManager || new SnapshotManager(audit);
    handlersInstance = new LifecycleCompensationHandlers(supabase, snap);
  }
  return handlersInstance;
}

/**
 * Reset handlers (for testing)
 */
export function resetLifecycleCompensationHandlers(): void {
  handlersInstance = null;
}
