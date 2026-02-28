import { createHash, randomUUID } from 'crypto';

import { supabase } from '../lib/supabase.js';

export interface ComplianceEvidenceInput {
  tenantId: string;
  actorPrincipal: string;
  actorType: 'system' | 'user' | 'service';
  triggerType: 'scheduled' | 'event';
  triggerSource: string;
  collectedAt?: string;
  evidence: Record<string, unknown>;
}

export interface ComplianceEvidenceRecord {
  id: string;
  tenant_id: string;
  actor_principal: string;
  actor_type: 'system' | 'user' | 'service';
  trigger_type: 'scheduled' | 'event';
  trigger_source: string;
  timestamp: string;
  previous_hash: string | null;
  integrity_hash: string;
  evidence: Record<string, unknown>;
}

export interface EvidenceVerificationResult {
  valid: boolean;
  checked: number;
  errors: string[];
}

export class ComplianceEvidenceService {
  private readonly resourceType = 'compliance_evidence';

  async appendEvidence(input: ComplianceEvidenceInput): Promise<ComplianceEvidenceRecord> {
    if (!input.tenantId) {
      throw new Error('tenantId is required');
    }

    const previous = await this.getLatestEvidence(input.tenantId);
    const timestamp = input.collectedAt ?? new Date().toISOString();
    const canonicalEvidence = this.canonicalize(input.evidence);

    const integrityHash = this.calculateHash({
      tenantId: input.tenantId,
      actorPrincipal: input.actorPrincipal,
      actorType: input.actorType,
      triggerType: input.triggerType,
      triggerSource: input.triggerSource,
      timestamp,
      evidence: canonicalEvidence,
      previousHash: previous?.integrity_hash ?? null,
    });

    const row = {
      tenant_id: input.tenantId,
      user_id: input.actorPrincipal,
      user_name: input.actorPrincipal,
      user_email: `${input.actorPrincipal}@audit.local`,
      action: 'compliance:evidence_collected',
      resource_type: this.resourceType,
      resource_id: randomUUID(),
      status: 'success',
      timestamp,
      previous_hash: previous?.integrity_hash ?? null,
      integrity_hash: integrityHash,
      details: {
        actor_principal: input.actorPrincipal,
        actor_type: input.actorType,
        trigger_type: input.triggerType,
        trigger_source: input.triggerSource,
        evidence: canonicalEvidence,
      },
    };

    const { data, error } = await supabase
      .from('audit_logs' as never)
      .insert(row as never)
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to persist compliance evidence: ${error.message}`);
    }

    return this.toEvidenceRecord(data as Record<string, unknown>);
  }

  async verifyEvidenceChain(tenantId: string): Promise<EvidenceVerificationResult> {
    if (!tenantId) {
      throw new Error('tenantId is required');
    }

    const records = await this.getEvidenceByTenant(tenantId);
    const errors: string[] = [];
    let previousHash: string | null = null;

    for (const record of records) {
      if (record.previous_hash !== previousHash) {
        errors.push(`Hash chain mismatch at ${record.id}`);
      }

      const recalculated = this.calculateHash({
        tenantId: record.tenant_id,
        actorPrincipal: record.actor_principal,
        actorType: record.actor_type,
        triggerType: record.trigger_type,
        triggerSource: record.trigger_source,
        timestamp: record.timestamp,
        evidence: this.canonicalize(record.evidence),
        previousHash: record.previous_hash,
      });

      if (recalculated !== record.integrity_hash) {
        errors.push(`Integrity hash mismatch at ${record.id}`);
      }

      previousHash = record.integrity_hash;
    }

    return {
      valid: errors.length === 0,
      checked: records.length,
      errors,
    };
  }

  async exportEvidence(tenantId: string, format: 'json' | 'csv' = 'json'): Promise<string> {
    const records = await this.getEvidenceByTenant(tenantId);

    if (format === 'json') {
      return JSON.stringify(records, null, 2);
    }

    const header = [
      'id',
      'tenant_id',
      'actor_principal',
      'actor_type',
      'trigger_type',
      'trigger_source',
      'timestamp',
      'previous_hash',
      'integrity_hash',
    ];

    const rows = records.map((record) => [
      record.id,
      record.tenant_id,
      record.actor_principal,
      record.actor_type,
      record.trigger_type,
      record.trigger_source,
      record.timestamp,
      record.previous_hash ?? '',
      record.integrity_hash,
    ]);

    return [header, ...rows].map((row) => row.map((cell) => this.escapeCsv(cell)).join(',')).join('\n');
  }

  private async getLatestEvidence(tenantId: string): Promise<ComplianceEvidenceRecord | null> {
    const { data, error } = await supabase
      .from('audit_logs' as never)
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('resource_type', this.resourceType)
      .order('timestamp', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to read latest evidence: ${error.message}`);
    }

    return data ? this.toEvidenceRecord(data as Record<string, unknown>) : null;
  }

  async getEvidenceByTenant(tenantId: string): Promise<ComplianceEvidenceRecord[]> {
    const { data, error } = await supabase
      .from('audit_logs' as never)
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('resource_type', this.resourceType)
      .order('timestamp', { ascending: true });

    if (error) {
      throw new Error(`Failed to read evidence: ${error.message}`);
    }

    return (data ?? []).map((row) => this.toEvidenceRecord(row as Record<string, unknown>));
  }

  private toEvidenceRecord(row: Record<string, unknown>): ComplianceEvidenceRecord {
    const details = (row.details ?? {}) as Record<string, unknown>;

    return {
      id: String(row.id),
      tenant_id: String(row.tenant_id),
      actor_principal: String(details.actor_principal ?? row.user_id ?? 'system'),
      actor_type: (details.actor_type as ComplianceEvidenceRecord['actor_type']) ?? 'system',
      trigger_type: (details.trigger_type as ComplianceEvidenceRecord['trigger_type']) ?? 'scheduled',
      trigger_source: String(details.trigger_source ?? 'unknown'),
      timestamp: String(row.timestamp),
      previous_hash: (row.previous_hash as string | null) ?? null,
      integrity_hash: String(row.integrity_hash),
      evidence: (details.evidence as Record<string, unknown>) ?? {},
    };
  }

  private calculateHash(payload: Record<string, unknown>): string {
    return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  }

  private canonicalize(input: Record<string, unknown>): Record<string, unknown> {
    const sortedEntries = Object.entries(input).sort(([left], [right]) => left.localeCompare(right));
    const canonical: Record<string, unknown> = {};

    for (const [key, value] of sortedEntries) {
      canonical[key] = this.normalizeValue(value);
    }

    return canonical;
  }

  private normalizeValue(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.normalizeValue(item));
    }

    if (value && typeof value === 'object') {
      return this.canonicalize(value as Record<string, unknown>);
    }

    return value;
  }

  private escapeCsv(value: unknown): string {
const text = String(value ?? '').replace(/^\s*([=+\-@])/, "'$1");
    if (text.includes(',') || text.includes('"') || text.includes('\n')) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  }
}

export const complianceEvidenceService = new ComplianceEvidenceService();
