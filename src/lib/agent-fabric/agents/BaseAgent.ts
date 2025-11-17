import { SupabaseClient } from '@supabase/supabase-js';
import { LLMGateway } from '../LLMGateway';
import { MemorySystem } from '../MemorySystem';
import { AuditLogger } from '../AuditLogger';
import { Agent, ConfidenceLevel } from '../types'; // Kept from main
import type { LifecycleArtifactLink, ProvenanceAuditEntry } from '../../types/vos'; // Kept from main

export abstract class BaseAgent {
protected supabase: SupabaseClient | null; // From dev
  protected agentId: string; // From codex/optimize-database-query-performance

  constructor(
    agentId: string, // From codex/optimize-database-query-performance
    protected llmGateway: LLMGateway,
    protected memorySystem: MemorySystem,
    protected auditLogger: AuditLogger,
    supabase?: SupabaseClient | null // From dev
  ) {
    this.agentId = agentId; // From codex/optimize-database-query-performance
    this.supabase = supabase ?? null; // From dev
  }

  abstract execute(sessionId: string, input: any): Promise<any>;

  protected async logExecution(
    sessionId: string,
    action: string,
    inputData: any,
    outputData: any,
    reasoning: string,
    confidence: ConfidenceLevel,
    evidence: any[] = []
  ): Promise<void> {
    await this.auditLogger.logAction(sessionId, this.agentId, action, {
      reasoning,
      inputData,
      outputData,
      confidenceLevel: confidence,
      evidence
    });

    await this.memorySystem.storeEpisodicMemory(
      sessionId,
      this.agentId,
      `${action}: ${reasoning}`,
      { input: inputData, output: outputData }
    );
  }

  protected async logMetric(
    sessionId: string,
    metricType: string,
    value: number,
    unit?: string
  ): Promise<void> {
    await this.auditLogger.logMetric(sessionId, this.agentId, metricType, value, unit);
  }

  protected async logPerformanceMetric(
    sessionId: string,
    operation: string,
    durationMs: number,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    await this.auditLogger.logPerformanceMetric(
      sessionId,
      this.agentId,
      operation,
      durationMs,
      metadata
    );
  }

  protected extractJSON(content: string): any {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in LLM response');
    return JSON.parse(jsonMatch[0]);
  }

  protected determineConfidence(
    hasEvidence: boolean,
    dataQuality: 'high' | 'medium' | 'low'
  ): ConfidenceLevel {
    if (!hasEvidence || dataQuality === 'low') return 'low';
    if (dataQuality === 'medium') return 'medium';
    return 'high';
  }

  protected async recordLifecycleLink(
    sessionId: string,
    link: Omit<LifecycleArtifactLink, 'id' | 'created_at'>
  ): Promise<void> {
    if (!this.supabase) return;

    const payload = {
      session_id: sessionId,
      source_stage: link.source_type?.split('_')?.[0] || null,
      target_stage: link.target_type?.split('_')?.[0] || null,
      source_type: link.source_type,
      source_artifact_id: link.source_id,
      target_type: link.target_type,
      target_artifact_id: link.target_id,
      relationship_type: link.relationship_type || 'derived_from',
      reasoning_trace: link.reasoning_trace || null,
      chain_depth: link.chain_depth || null,
      metadata: link.metadata || {},
      created_by: this.agentId
    };

    await this.supabase.from('lifecycle_artifact_links').insert(payload);

    await this.logProvenanceAudit({
      session_id: sessionId,
      agent_id: this.agentId,
      artifact_type: link.target_type,
      artifact_id: link.target_id,
      action: 'lifecycle_link_created',
      reasoning_trace: link.reasoning_trace,
      artifact_data: {
        source: { type: link.source_type, id: link.source_id },
        target: { type: link.target_type, id: link.target_id },
      },
      metadata: {
        source_type: link.source_type,
        source_id: link.source_id,
        relationship_type: link.relationship_type || 'derived_from',
        chain_depth: link.chain_depth ?? undefined
      }
    });
  }

  protected async logProvenanceAudit(entry: ProvenanceAuditEntry): Promise<void> {
    if (!this.supabase) return;

    await this.supabase.from('provenance_audit_log').insert({
      ...entry,
      created_at: new Date().toISOString(),
      metadata: entry.metadata || {}
    });
  }

  protected async logArtifactProvenance(
    sessionId: string,
    artifactType: string,
    artifactId: string,
    action: string,
    options: {
      reasoning_trace?: string;
      artifact_data?: Record<string, any>;
      input_variables?: Record<string, any>;
      output_snapshot?: Record<string, any>;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<void> {
    await this.logProvenanceAudit({
      session_id: sessionId,
      agent_id: this.agentId,
      artifact_type: artifactType,
      artifact_id: artifactId,
      action,
      reasoning_trace: options.reasoning_trace,
      artifact_data: options.artifact_data,
      input_variables: options.input_variables,
      output_snapshot: options.output_snapshot,
      metadata: options.metadata,
    });
  }
}
