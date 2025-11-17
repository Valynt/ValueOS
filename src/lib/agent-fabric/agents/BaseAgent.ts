import { LLMGateway } from '../LLMGateway';
import { MemorySystem } from '../MemorySystem';
import { AuditLogger } from '../AuditLogger';
import { Agent, ConfidenceLevel } from '../types';

interface LifecycleProvenanceLink {
  source_type: string;
  source_id: string;
  target_type: string;
  target_id: string;
  relationship_type?: string;
  reasoning_trace?: string;
  chain_depth?: number;
}

interface ProvenanceAuditEntry {
  session_id: string;
  agent_id: string;
  artifact_type: string;
  artifact_id: string;
  action: string;
  reasoning_trace?: string;
  artifact_data?: Record<string, any>;
  input_variables?: Record<string, any>;
  output_snapshot?: Record<string, any>;
  metadata?: Record<string, any>;
}

export abstract class BaseAgent {
  protected supabase: any;

  constructor(
    protected agent: Agent,
    protected llmGateway: LLMGateway,
    protected memorySystem: MemorySystem,
    protected auditLogger: AuditLogger,
    supabase?: any
  ) {
    this.supabase = supabase;
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
    await this.auditLogger.logAction(sessionId, this.agent.id, action, {
      reasoning,
      inputData,
      outputData,
      confidenceLevel: confidence,
      evidence
    });

    await this.memorySystem.storeEpisodicMemory(
      sessionId,
      this.agent.id,
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
    await this.auditLogger.logMetric(sessionId, this.agent.id, metricType, value, unit);
  }

  protected extractJSON(content: string): any {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }
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
    link: LifecycleProvenanceLink
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
      reasoning_trace: link.reasoning_trace,
      chain_depth: link.chain_depth,
      metadata: {}
    };

    await this.supabase.from('lifecycle_artifact_links').insert(payload);

    await this.logProvenanceAudit(
      {
        session_id: sessionId,
        agent_id: this.agent.id,
        artifact_type: link.target_type,
        artifact_id: link.target_id,
        action: 'lifecycle_link_created',
        reasoning_trace: link.reasoning_trace,
        metadata: {
          source_type: link.source_type,
          source_id: link.source_id,
          relationship_type: link.relationship_type || 'derived_from'
        }
      }
    );
  }

  protected async logProvenanceAudit(entry: ProvenanceAuditEntry): Promise<void> {
    if (!this.supabase) return;

    await this.supabase.from('provenance_audit_log').insert({
      ...entry,
      created_at: new Date().toISOString(),
      metadata: entry.metadata || {}
    });
  }
}
