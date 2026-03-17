import { logger } from '../../lib/logger.js'
import { supabase } from '../../lib/supabase.js'

import { AuditLogService } from './AuditLogService.js';
import { vetoController } from './integrity/VetoController.js';
import { DomainSagaEventEmitter } from './workflows/SagaAdapters.js';

export interface AssumptionUpdateContext {
  userId?: string;
  externalSub?: string;
  sessionId?: string;
  valueCaseId?: string;
  organizationId?: string;
}

export class AssumptionService {
  private readonly sagaEventEmitter = new DomainSagaEventEmitter();
  private readonly auditLogService = new AuditLogService();

  /**
   * Update an assumption
   */
  async updateAssumption(
    assumptionId: string,
    updates: Record<string, any>,
    context: AssumptionUpdateContext = {}
  ): Promise<{ assumptionId: string; updated: boolean; data: unknown }> {
    logger.info('Updating assumption', { assumptionId });

    let previous: unknown = null;
    try {
      previous = await this.getAssumption(assumptionId);
    } catch (error) {
      logger.warn('Failed to fetch assumption before integrity validation', {
        assumptionId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Ensure we are not trying to update immutable fields or ID
    const { id, ...safeUpdates } = updates;
    const proposedPayload = { ...(previous || {}), ...safeUpdates };

    const evaluation = vetoController.evaluate({
      proposedPayload,
      previousPayload: previous || undefined,
      stageFlags: {
        allowHighIrrException: Boolean((safeUpdates as Record<string, unknown>).allowHighIrrException || (safeUpdates as Record<string, unknown>)?.stageFlags?.allowHighIrrException),
      },
      justificationText: String((safeUpdates as Record<string, unknown>)?.justificationText || (safeUpdates as Record<string, unknown>)?.justification || ''),
    });

    const actor = context.externalSub || context.userId || 'system';
    const valueCaseId = context.valueCaseId || (previous as Record<string, unknown>)?.value_case_id || (safeUpdates as Record<string, unknown>)?.value_case_id;
    const sessionId = context.sessionId || (safeUpdates as Record<string, unknown>)?.session_id || undefined;

    if (evaluation.vetoed) {
      this.sagaEventEmitter.emit({
        type: 'saga.integrity.vetoed',
        payload: {
          reasonCodes: evaluation.reasonCodes,
          remediation: evaluation.remediation,
          assumptionId,
          valueCaseId,
          sessionId,
          external_sub: actor,
          justificationPresent: evaluation.context.justificationPresent,
        },
        meta: {
          correlationId: sessionId || assumptionId,
          timestamp: new Date().toISOString(),
          source: 'AssumptionService.updateAssumption',
        },
      });

      await this.auditLogService.logAudit({
        userId: actor,
        userName: 'Unknown',
        userEmail: 'unknown@valueos.com',
        action: 'integrity_veto',
        resourceType: 'assumption',
        resourceId: assumptionId,
        details: {
          external_sub: actor,
          value_case_id: valueCaseId,
          session_id: sessionId,
          old_assumptions: previous,
          new_assumptions: safeUpdates,
          reason_codes: evaluation.reasonCodes,
          remediation: evaluation.remediation,
          justification_present: evaluation.context.justificationPresent,
        },
        status: 'failed',
      });

      throw new Error(`Integrity vetoed: ${evaluation.reasonCodes.join(', ')}`);
    }

    if (evaluation.overrideUsed) {
      await this.auditLogService.logAudit({
        userId: actor,
        userName: 'Unknown',
        userEmail: 'unknown@valueos.com',
        action: 'integrity_override',
        resourceType: 'assumption',
        resourceId: assumptionId,
        details: {
          external_sub: actor,
          value_case_id: valueCaseId,
          session_id: sessionId,
          old_assumptions: previous,
          new_assumptions: safeUpdates,
          reason_codes: ['irr_above_stage_limit'],
          remediation: evaluation.remediation,
          justification_present: evaluation.context.justificationPresent,
        },
        status: 'success',
      });
    }

    const { data, error } = await supabase
      .from('assumptions')
      .update(safeUpdates)
      .eq('id', assumptionId)
      .select()
      .single();

    if (error) {
      logger.error('Failed to update assumption', { assumptionId, error });
      throw new Error(`Failed to update assumption: ${error.message}`);
    }

    return {
      assumptionId,
      updated: true,
      data
    };
  }

  /**
   * Get an assumption by ID
   */
  async getAssumption(assumptionId: string): Promise<unknown> {
    const { data, error } = await supabase
      .from('assumptions')
      .select('*')
      .eq('id', assumptionId)
      .single();

    if (error) {
        logger.error('Failed to fetch assumption', { assumptionId, error });
        throw new Error(`Failed to fetch assumption: ${error.message}`);
    }

    return data;
  }
}

export const assumptionService = new AssumptionService();
