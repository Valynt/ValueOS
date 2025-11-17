import { SupabaseClient } from '@supabase/supabase-js';
import { LLMGateway } from '../LLMGateway';
import { MemorySystem } from '../MemorySystem';
import { AuditLogger } from '../AuditLogger';
import { ConfidenceLevel } from '../types';

export abstract class BaseAgent {
  protected supabase: SupabaseClient;
  protected agentId: string;

  constructor(
    agentId: string,
    protected llmGateway: LLMGateway,
    protected memorySystem: MemorySystem,
    protected auditLogger: AuditLogger,
    supabase: SupabaseClient
  ) {
    this.agentId = agentId;
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
}
