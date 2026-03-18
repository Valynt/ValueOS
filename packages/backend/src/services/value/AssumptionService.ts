import { logger } from '../../lib/logger.js'
import { supabase } from '../../lib/supabase.js'
import { vetoController } from '../integrity/VetoController.js';
import { DomainSagaEventEmitter } from '../workflows/SagaAdapters.js';

import { AuditLogService } from './AuditLogService.js';

export interface AssumptionUpdateContext {
  userId?: string;
  externalSub?: string;
  sessionId?: string;
  valueCaseId?: string;
  organizationId?: string;
}

export interface AssumptionCreateInput {
  organizationId: string;
  caseId: string;
  name: string;
  value: number;
  unit: string;
  sourceType: string;
  confidenceScore: number;
  benchmarkReferenceId?: string;
  createdBy: string;
}

export interface Assumption {
  id: string;
  organizationId: string;
  caseId: string;
  name: string;
  value: number;
  unit: string;
  sourceType: string;
  confidenceScore: number;
  benchmarkReferenceId?: string;
  originalValue?: number;
  overriddenByUserId?: string;
  isUnsupported: boolean;
  createdAt: string;
  updatedAt: string;
}

export class AssumptionService {
  private readonly sagaEventEmitter = new DomainSagaEventEmitter();
  private readonly auditLogService = new AuditLogService();

  /**
   * Create a new assumption with source tag validation
   */
  async createAssumption(
    input: AssumptionCreateInput
  ): Promise<{ assumptionId: string; data: Assumption }> {
    logger.info('Creating assumption', { name: input.name, caseId: input.caseId });

    // Validate source tag is present
    if (!input.sourceType) {
      throw new Error('Assumption MUST have a source_type on creation');
    }

    // Flag as unsupported if no evidence or benchmark
    const isUnsupported = !input.benchmarkReferenceId &&
      ['inferred', 'manually-overridden'].includes(input.sourceType);

    const now = new Date().toISOString();
    const assumptionId = `asm_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    const { data, error } = await supabase
      .from('assumptions')
      .insert({
        id: assumptionId,
        organization_id: input.organizationId,
        case_id: input.caseId,
        name: input.name,
        value: input.value,
        unit: input.unit,
        source_type: input.sourceType,
        confidence_score: input.confidenceScore,
        benchmark_reference_id: input.benchmarkReferenceId,
        is_unsupported: isUnsupported,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (error) {
      logger.error('Failed to create assumption', { error, input });
      throw new Error(`Failed to create assumption: ${error.message}`);
    }

    // Log audit trail for creation
    await this.auditLogService.logAudit({
      userId: input.createdBy,
      userName: 'Unknown',
      userEmail: 'unknown@valueos.com',
      action: 'create',
      resourceType: 'assumption',
      resourceId: assumptionId,
      details: {
        case_id: input.caseId,
        name: input.name,
        value: input.value,
        source_type: input.sourceType,
      },
      status: 'success',
    });

    return {
      assumptionId,
      data: this.mapToAssumption(data),
    };
  }

  /**
   * Get assumptions for a case (API endpoint support)
   */
  async getAssumptionsByCase(
    organizationId: string,
    caseId: string
  ): Promise<Assumption[]> {
    const { data, error } = await supabase
      .from('assumptions')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('case_id', caseId)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Failed to fetch assumptions', { organizationId, caseId, error });
      throw new Error(`Failed to fetch assumptions: ${error.message}`);
    }

    return (data || []).map(row => this.mapToAssumption(row));
  }

  /**
   * Delete an assumption
   */
  async deleteAssumption(
    assumptionId: string,
    deletedBy: string
  ): Promise<{ deleted: boolean }> {
    logger.info('Deleting assumption', { assumptionId });

    const { error } = await supabase
      .from('assumptions')
      .delete()
      .eq('id', assumptionId);

    if (error) {
      logger.error('Failed to delete assumption', { assumptionId, error });
      throw new Error(`Failed to delete assumption: ${error.message}`);
    }

    await this.auditLogService.logAudit({
      userId: deletedBy,
      userName: 'Unknown',
      userEmail: 'unknown@valueos.com',
      action: 'delete',
      resourceType: 'assumption',
      resourceId: assumptionId,
      details: { deleted_at: new Date().toISOString() },
      status: 'success',
    });

    return { deleted: true };
  }

  /**
   * Override an assumption - changes source to manually-overridden with audit
   */
  async overrideAssumption(
    assumptionId: string,
    newValue: number,
    reason: string,
    overriddenBy: string
  ): Promise<{ assumptionId: string; data: Assumption }> {
    logger.info('Overriding assumption', { assumptionId, newValue, overriddenBy });

    // Get current value for audit trail
    const current = await this.getAssumption(assumptionId);
    if (!current) {
      throw new Error(`Assumption not found: ${assumptionId}`);
    }

    const originalValue = (current as Record<string, unknown>).value as number;

    const { data, error } = await supabase
      .from('assumptions')
      .update({
        value: newValue,
        source_type: 'manually-overridden',
        original_value: originalValue,
        overridden_by_user_id: overriddenBy,
        updated_at: new Date().toISOString(),
      })
      .eq('id', assumptionId)
      .select()
      .single();

    if (error) {
      logger.error('Failed to override assumption', { assumptionId, error });
      throw new Error(`Failed to override assumption: ${error.message}`);
    }

    // Log audit trail with original value preserved
    await this.auditLogService.logAudit({
      userId: overriddenBy,
      userName: 'Unknown',
      userEmail: 'unknown@valueos.com',
      action: 'override',
      resourceType: 'assumption',
      resourceId: assumptionId,
      details: {
        original_value: originalValue,
        new_value: newValue,
        override_reason: reason,
        source_changed_to: 'manually-overridden',
      },
      status: 'success',
    });

    return {
      assumptionId,
      data: this.mapToAssumption(data),
    };
  }

  /**
   * Map database row to Assumption interface
   */
  private mapToAssumption(row: Record<string, unknown>): Assumption {
    return {
      id: row.id as string,
      organizationId: row.organization_id as string,
      caseId: row.case_id as string,
      name: row.name as string,
      value: row.value as number,
      unit: row.unit as string,
      sourceType: row.source_type as string,
      confidenceScore: row.confidence_score as number,
      benchmarkReferenceId: row.benchmark_reference_id as string | undefined,
      originalValue: row.original_value as number | undefined,
      overriddenByUserId: row.overridden_by_user_id as string | undefined,
      isUnsupported: row.is_unsupported as boolean || false,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }

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
      proposedPayload: proposedPayload as Record<string, unknown>,
      previousPayload: previous as Record<string, unknown> | undefined,
      stageFlags: {
        allowHighIrrException: Boolean((safeUpdates.allowHighIrrException as boolean | undefined) ?? (safeUpdates.stageFlags as Record<string, unknown> | undefined)?.allowHighIrrException),
      },
      justificationText: String((safeUpdates.justificationText as string | undefined) ?? (safeUpdates.justification as string | undefined) ?? ''),
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
