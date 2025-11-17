import { SupabaseClient } from '@supabase/supabase-js';
import { LLMGateway } from '../LLMGateway';
import { MemorySystem } from '../MemorySystem';
import { AuditLogger } from '../AuditLogger';
import { Agent, ConfidenceLevel } from '../types';

export abstract class BaseAgent {
  constructor(
    protected agent: Agent,
    protected llmGateway: LLMGateway,
    protected memorySystem: MemorySystem,
    protected auditLogger: AuditLogger,
    protected supabase: SupabaseClient
  ) {}

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
}
