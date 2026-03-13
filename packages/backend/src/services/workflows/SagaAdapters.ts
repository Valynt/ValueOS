import { createClient } from "@supabase/supabase-js";
import {
  SagaAuditLogger,
  SagaEventEmitter,
  SagaPersistence,
  SagaSnapshot,
  SagaStateType,
  SagaTransitionRecord
} from "../../lib/agents/core/index.js";

import { logger } from "../../lib/logger.js";
import { evidenceTierToLabel, evidenceTierToNumeric } from "../../types/evidence.js";
import { AuditEventType, getAuditTrailService } from "../security/AuditTrailService.js";

/**
 * Supabase implementation of SagaPersistence.
 * Uses the workflow_states table for state and a new saga_transitions table for history.
 */
export class SupabaseSagaPersistence implements SagaPersistence {
  constructor(private supabase: ReturnType<typeof createClient>) {}

  async saveState(snapshot: SagaSnapshot): Promise<void> {
    const { error } = await this.supabase
      .from('workflow_states')
      .upsert({
        case_id: snapshot.valueCaseId,
        organization_id: snapshot.tenantId,
        current_stage: snapshot.state,
        state_data: {
          ...snapshot.data,
          _saga: {
            previousState: snapshot.previousState,
            version: snapshot.version,
            updatedAt: snapshot.updatedAt,
          }
        },
        status: snapshot.state === 'FINALIZED' ? 'completed' : 'running',
        updated_at: snapshot.updatedAt,
      }, {
        onConflict: 'case_id,organization_id'
      });

    if (error) {
      logger.error('Failed to save saga state to Supabase', { error, valueCaseId: snapshot.valueCaseId });
      throw new Error(`Saga persistence error: ${error.message}`);
    }
  }

  async loadState(valueCaseId: string): Promise<SagaSnapshot | null> {
    const { data, error } = await this.supabase
      .from('workflow_states')
      .select('*')
      .eq('case_id', valueCaseId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      logger.error('Failed to load saga state from Supabase', { error, valueCaseId });
      throw new Error(`Saga loading error: ${error.message}`);
    }

    if (!data) return null;

    const sagaData = data.state_data?._saga || {};

    return {
      valueCaseId: data.case_id,
      tenantId: data.organization_id,
      state: data.current_stage as SagaStateType,
      previousState: sagaData.previousState,
      data: data.state_data || {},
      version: sagaData.version || 1,
      createdAt: data.started_at,
      updatedAt: data.updated_at || data.started_at,
    };
  }

  async recordTransition(record: SagaTransitionRecord): Promise<void> {
    // Load organization_id from the workflow_states row for tenant isolation.
    // Falls back to a no-op warn if the case isn't found rather than crashing.
    let organizationId: string | null = null;
    try {
      const { data } = await this.supabase
        .from('workflow_states')
        .select('organization_id')
        .eq('case_id', record.valueCaseId)
        .maybeSingle();
      organizationId = data?.organization_id ?? null;
    } catch {
      // Non-fatal — proceed without org scoping
    }

    if (!organizationId) {
      logger.warn('saga_transitions: could not resolve organization_id — transition not persisted', {
        valueCaseId: record.valueCaseId,
        correlationId: record.correlationId,
      });
      return;
    }

    const { error } = await this.supabase
      .from('saga_transitions')
      .insert({
        value_case_id: record.valueCaseId,
        organization_id: organizationId,
        from_state: record.fromState,
        to_state: record.toState,
        trigger: record.trigger,
        agent_id: record.agentId ?? null,
        correlation_id: record.correlationId,
        metadata: { timestamp: record.timestamp },
      });

    if (error) {
      logger.warn('Could not record saga transition to saga_transitions table', {
        error: error.message,
        valueCaseId: record.valueCaseId,
      });
    }
  }
}

interface ProvenanceRecord {
  id: string;
  valueCaseId: string;
  claimId: string;
  dataSource: string;
  evidenceTier: string | number;
  sourceProvenance?: string;
  formula?: string;
  agentId?: string;
  agentVersion?: string;
  confidenceScore?: number;
  parentRecordId?: string;
  createdAt: string;
}

/**
 * Supabase implementation of ProvenanceStore (R8).
 */
export class SupabaseProvenanceStore {
  constructor(private supabase: ReturnType<typeof createClient>) {}

  async insert(record: ProvenanceRecord): Promise<void> {
    const { error } = await this.supabase
      .from('provenance_records')
      .insert({
        id: record.id,
        value_case_id: record.valueCaseId,
        claim_id: record.claimId,
        data_source: record.dataSource,
        evidence_tier: typeof record.evidenceTier === 'number'
          ? evidenceTierToLabel(record.evidenceTier)
          : record.evidenceTier,
        source_provenance: record.sourceProvenance || 'agent_inference',
        formula: record.formula,
        agent_id: record.agentId,
        agent_version: record.agentVersion,
        confidence_score: record.confidenceScore,
        parent_record_id: record.parentRecordId,
        created_at: record.createdAt,
      });

    if (error) {
      logger.error('Failed to insert provenance record', { error, record });
      throw new Error(`Provenance store error: ${error.message}`);
    }
  }

  async findByClaimId(valueCaseId: string, claimId: string): Promise<ProvenanceRecord[]> {
    const { data, error } = await this.supabase
      .from('provenance_records')
      .select('*')
      .eq('value_case_id', valueCaseId)
      .eq('claim_id', claimId);

    if (error) throw new Error(`Provenance lookup error: ${error.message}`);
    return (data || []).map(this.mapToRecord);
  }

  async findById(id: string): Promise<ProvenanceRecord | null> {
    const { data, error } = await this.supabase
      .from('provenance_records')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return this.mapToRecord(data);
  }

  async findByValueCaseId(valueCaseId: string): Promise<ProvenanceRecord[]> {
    const { data, error } = await this.supabase
      .from('provenance_records')
      .select('*')
      .eq('value_case_id', valueCaseId);

    if (error) throw new Error(`Provenance search error: ${error.message}`);
    return (data || []).map(this.mapToRecord);
  }

  private mapToRecord(data: Record<string, unknown>): ProvenanceRecord {
    return {
      id: data.id as string,
      valueCaseId: data.value_case_id as string,
      claimId: data.claim_id as string,
      dataSource: data.data_source as string,
      evidenceTier: typeof data.evidence_tier === 'string'
        ? evidenceTierToNumeric(data.evidence_tier)
        : (data.evidence_tier as number),
      sourceProvenance: data.source_provenance as string | undefined,
      formula: data.formula as string | undefined,
      agentId: data.agent_id as string | undefined,
      agentVersion: data.agent_version as string | undefined,
      confidenceScore: data.confidence_score as number | undefined,
      parentRecordId: data.parent_record_id as string | undefined,
      createdAt: data.created_at as string,
    };
  }
}

/**
 * Implementation of SagaEventEmitter using the internal event system or Kafka.
 */
export class DomainSagaEventEmitter implements SagaEventEmitter {
  emit(event: {
    type: string;
    payload: Record<string, unknown>;
    meta: { correlationId: string; timestamp: string; source: string };
  }): void {
    // In a real system, this would push to Kafka or an internal EventEmitter.
    // For now, we log it.
    logger.info(`Saga Event Emitted: ${event.type}`, event);
  }
}

/**
 * Implementation of SagaAuditLogger using the existing AuditTrailService.
 */
export class SagaAuditTrailLogger implements SagaAuditLogger {
  private auditTrail = getAuditTrailService();

  async log(entry: {
    eventType: string;
    action: string;
    resourceId: string;
    details: Record<string, unknown>;
    correlationId: string;
  }): Promise<void> {
    await this.auditTrail.logImmediate({
      eventType: entry.eventType as AuditEventType,
      actorId: 'system',
      externalSub: 'system',
      actorType: 'service',
      resourceId: entry.resourceId,
      resourceType: 'case',
      action: entry.action,
      outcome: 'success',
      details: entry.details,
      ipAddress: 'system',
      userAgent: 'system',
      timestamp: Date.now(),
      sessionId: entry.correlationId,
      correlationId: entry.correlationId,
      riskScore: 0,
      complianceFlags: [],
    });
  }
}
