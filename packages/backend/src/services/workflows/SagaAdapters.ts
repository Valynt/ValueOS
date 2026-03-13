import { createClient } from "@supabase/supabase-js";
import {
  SagaAuditLogger,
  SagaEventEmitter,
  SagaPersistence,
  SagaSnapshot,
  SagaTransitionRecord
} from "../../lib/agents/core/index.js";
import type { SagaStateType } from "../../lib/agents/core/ValueCaseSaga.js";

import { logger } from "../../lib/logger.js";
import { evidenceTierToLabel, evidenceTierToNumeric } from "../../types/evidence.js";
import type { ProvenanceRecord, ProvenanceStore } from "@memory/provenance/index.js";
import { getAuditTrailService } from "../security/AuditTrailService.js";
import type { AuditEventType } from "../security/AuditTrailService.js";

/**
 * Supabase implementation of SagaPersistence.
 * Uses the workflow_states table for state and a new saga_transitions table for history.
 */
export class SupabaseSagaPersistence implements SagaPersistence {
  constructor(private supabase: ReturnType<typeof createClient>) {}

  async saveState(snapshot: SagaSnapshot): Promise<void> {
    const { error } = await (this.supabase
      .from('workflow_states') as unknown)
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
    const { data, error } = await (this.supabase
      .from('workflow_states') as unknown)
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
      const { data } = await (this.supabase
        .from('workflow_states') as unknown)
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

    const { error } = await (this.supabase
      .from('saga_transitions') as unknown)
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

/**
 * Supabase implementation of ProvenanceStore.
 *
 * Implements the canonical ProvenanceStore interface from packages/memory so
 * callers can use it without type casts. The DB column evidence_tier stores a
 * label string ('silver'|'gold'|'platinum'); evidenceTierToLabel/Numeric
 * convert between that and the numeric 1|2|3 used in ProvenanceRecord.
 */
export class SupabaseProvenanceStore implements ProvenanceStore {
  constructor(private supabase: ReturnType<typeof createClient>) {}

  async insert(record: ProvenanceRecord): Promise<void> {
    const { error } = await (this.supabase
      .from('provenance_records') as unknown as {
        insert: (row: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
      })
      .insert({
        id: record.id,
        value_case_id: record.valueCaseId,
        claim_id: record.claimId,
        data_source: record.dataSource,
        evidence_tier: evidenceTierToLabel(record.evidenceTier),
        formula: record.formula ?? null,
        agent_id: record.agentId,
        agent_version: record.agentVersion,
        confidence_score: record.confidenceScore,
        parent_record_id: record.parentRecordId ?? null,
        created_at: record.createdAt,
      });

    if (error) {
      logger.error('Failed to insert provenance record', { error, record });
      throw new Error(`Provenance store error: ${error.message}`);
    }
  }

  async findByClaimId(valueCaseId: string, claimId: string): Promise<ProvenanceRecord[]> {
    const { data, error } = await (this.supabase
      .from('provenance_records') as unknown as {
        select: (cols: string) => {
          eq: (col: string, val: string) => {
            eq: (col: string, val: string) => Promise<{ data: Record<string, unknown>[] | null; error: { message: string } | null }>;
          };
        };
      })
      .select('*')
      .eq('value_case_id', valueCaseId)
      .eq('claim_id', claimId);

    if (error) throw new Error(`Provenance lookup error: ${error.message}`);
    return (data ?? []).map((row) => this.mapToRecord(row));
  }

  async findById(id: string): Promise<ProvenanceRecord | null> {
    const { data, error } = await (this.supabase
      .from('provenance_records') as unknown as {
        select: (cols: string) => {
          eq: (col: string, val: string) => {
            single: () => Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
          };
        };
      })
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return this.mapToRecord(data);
  }

  async findByValueCaseId(valueCaseId: string): Promise<ProvenanceRecord[]> {
    const { data, error } = await (this.supabase
      .from('provenance_records') as unknown as {
        select: (cols: string) => {
          eq: (col: string, val: string) => Promise<{ data: Record<string, unknown>[] | null; error: { message: string } | null }>;
        };
      })
      .select('*')
      .eq('value_case_id', valueCaseId);

    if (error) throw new Error(`Provenance search error: ${error.message}`);
    return (data ?? []).map((row) => this.mapToRecord(row));
  }

  private mapToRecord(data: Record<string, unknown>): ProvenanceRecord {
    const getRequiredString = (field: string): string => {
      const value = data[field];
      if (value === null || value === undefined) {
        throw new Error(`ProvenanceRecord mapping error: required field "${field}" is null or undefined`);
      }
      if (typeof value === "string") {
        return value;
      }
      if (typeof value === "number" || typeof value === "boolean") {
        return String(value);
      }
      throw new Error(`ProvenanceRecord mapping error: field "${field}" has invalid type ${typeof value}`);
    };

    const getOptionalString = (field: string): string | undefined => {
      const value = data[field];
      if (value === null || value === undefined) {
        return undefined;
      }
      if (typeof value === "string") {
        return value;
      }
      if (typeof value === "number" || typeof value === "boolean") {
        return String(value);
      }
      throw new Error(`ProvenanceRecord mapping error: optional field "${field}" has invalid type ${typeof value}`);
    };

    const rawEvidenceTier = data["evidence_tier"];
    let evidenceTier: 1 | 2 | 3;
    if (typeof rawEvidenceTier === "string") {
      // Convert known string labels to numeric tiers.
      evidenceTier = evidenceTierToNumeric(rawEvidenceTier as "silver" | "gold" | "platinum");
    } else if (typeof rawEvidenceTier === "number") {
      if (rawEvidenceTier === 1 || rawEvidenceTier === 2 || rawEvidenceTier === 3) {
        evidenceTier = rawEvidenceTier;
      } else {
        throw new Error(`ProvenanceRecord mapping error: numeric evidence_tier "${rawEvidenceTier}" is out of allowed range (1|2|3)`);
      }
    } else {
      throw new Error(`ProvenanceRecord mapping error: evidence_tier is missing or has invalid type ${typeof rawEvidenceTier}`);
    }

    const rawConfidence = data["confidence_score"];
    if (typeof rawConfidence !== "number" || !Number.isFinite(rawConfidence)) {
      throw new Error(`ProvenanceRecord mapping error: confidence_score must be a finite number, got ${String(rawConfidence)}`);
    }
    if (rawConfidence < 0 || rawConfidence > 1) {
      throw new Error(`ProvenanceRecord mapping error: confidence_score ${rawConfidence} is out of range [0, 1]`);
    }

    const createdAtValue = data["created_at"];
    if (createdAtValue === null || createdAtValue === undefined || typeof createdAtValue !== "string") {
      throw new Error(`ProvenanceRecord mapping error: created_at must be a non-null string`);
    }

    return {
      id: getRequiredString("id"),
      valueCaseId: getRequiredString("value_case_id"),
      claimId: getRequiredString("claim_id"),
      dataSource: getRequiredString("data_source"),
      evidenceTier,
      formula: getOptionalString("formula"),
      agentId: getRequiredString("agent_id"),
      agentVersion: getRequiredString("agent_version"),
      confidenceScore: rawConfidence,
      parentRecordId: getOptionalString("parent_record_id"),
      createdAt: createdAtValue,
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
