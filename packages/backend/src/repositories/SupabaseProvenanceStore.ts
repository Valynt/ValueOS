/**
 * SupabaseProvenanceStore
 *
 * Persists provenance records to the `provenance_records` table.
 * All queries are scoped to organization_id (tenant isolation).
 *
 * The table is append-only: no UPDATE or DELETE policies are granted.
 */

import { createLogger } from '@shared/lib/logger';

import type { ProvenanceRecord, ProvenanceStore } from '@valueos/memory/provenance';
import { createServerSupabaseClient } from '../lib/supabase.js';

const logger = createLogger({ component: 'SupabaseProvenanceStore' });

export class SupabaseProvenanceStore implements ProvenanceStore {
  private organizationId: string;

  constructor(organizationId: string) {
    this.organizationId = organizationId;
  }

  async insert(record: ProvenanceRecord): Promise<void> {
    const client = createServerSupabaseClient();
    const { error } = await client.from('provenance_records').insert({
      id: record.id,
      value_case_id: record.valueCaseId,
      claim_id: record.claimId,
      organization_id: this.organizationId,
      data_source: record.dataSource,
      evidence_tier: record.evidenceTier,
      formula: record.formula ?? null,
      agent_id: record.agentId,
      agent_version: record.agentVersion,
      confidence_score: record.confidenceScore,
      parent_record_id: record.parentRecordId ?? null,
      created_at: record.createdAt,
    });

    if (error) {
      logger.error('SupabaseProvenanceStore: insert failed', { error: error.message, claimId: record.claimId });
      throw new Error(`Provenance insert failed: ${error.message}`);
    }
  }

  async findByClaimId(valueCaseId: string, claimId: string): Promise<ProvenanceRecord[]> {
    const client = createServerSupabaseClient();
    const { data, error } = await client
      .from('provenance_records')
      .select('*')
      .eq('value_case_id', valueCaseId)
      .eq('claim_id', claimId)
      .eq('organization_id', this.organizationId)
      .order('created_at', { ascending: true });

    if (error) {
      logger.error('SupabaseProvenanceStore: findByClaimId failed', { error: error.message });
      return [];
    }

    return (data ?? []).map(this.mapRow);
  }

  async findById(id: string): Promise<ProvenanceRecord | null> {
    const client = createServerSupabaseClient();
    const { data, error } = await client
      .from('provenance_records')
      .select('*')
      .eq('id', id)
      .eq('organization_id', this.organizationId)
      .single();

    if (error || !data) return null;
    return this.mapRow(data);
  }

  async findByValueCaseId(valueCaseId: string): Promise<ProvenanceRecord[]> {
    const client = createServerSupabaseClient();
    const { data, error } = await client
      .from('provenance_records')
      .select('*')
      .eq('value_case_id', valueCaseId)
      .eq('organization_id', this.organizationId)
      .order('created_at', { ascending: true });

    if (error) {
      logger.error('SupabaseProvenanceStore: findByValueCaseId failed', { error: error.message });
      return [];
    }

    return (data ?? []).map(this.mapRow);
  }

  private mapRow(row: Record<string, unknown>): ProvenanceRecord {
    return {
      id: row['id'] as string,
      valueCaseId: row['value_case_id'] as string,
      claimId: row['claim_id'] as string,
      dataSource: row['data_source'] as string,
      evidenceTier: row['evidence_tier'] as 1 | 2 | 3,
      formula: row['formula'] as string | undefined,
      agentId: row['agent_id'] as string,
      agentVersion: row['agent_version'] as string,
      confidenceScore: row['confidence_score'] as number,
      createdAt: row['created_at'] as string,
      parentRecordId: row['parent_record_id'] as string | undefined,
    };
  }
}
