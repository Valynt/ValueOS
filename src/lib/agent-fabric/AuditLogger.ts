import { SupabaseClient } from '@supabase/supabase-js';
import { ConfidenceLevel } from './types';

export class AuditLogger {
  constructor(private supabase: SupabaseClient) {}

  async logAction(
    sessionId: string,
    agentId: string,
    action: string,
    options: {
      reasoning?: string;
      inputData?: Record<string, any>;
      outputData?: Record<string, any>;
      confidenceLevel?: ConfidenceLevel;
      evidence?: any[];
      metadata?: Record<string, any>;
    } = {}
  ): Promise<void> {
    await this.supabase.from('agent_audit_log').insert({
      session_id: sessionId,
      agent_id: agentId,
      action,
      reasoning: options.reasoning,
      input_data: options.inputData,
      output_data: options.outputData,
      confidence_level: options.confidenceLevel,
      evidence: options.evidence || [],
      metadata: options.metadata || {}
    });
  }

  async logMetric(
    sessionId: string,
    agentId: string,
    metricType: string,
    metricValue: number,
    unit?: string,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    await this.supabase.from('agent_metrics').insert({
      session_id: sessionId,
      agent_id: agentId,
      metric_type: metricType,
      metric_value: metricValue,
      unit,
      metadata
    });
  }

  async logPerformanceMetric(
    sessionId: string,
    agentId: string,
    operation: string,
    durationMs: number,
    metadata: Record<string, any> = {},
    alertThresholdMs: number = 1000
  ): Promise<void> {
    await this.supabase.from('performance_metrics').insert({
      session_id: sessionId,
      agent_id: agentId,
      operation,
      duration_ms: durationMs,
      alert_threshold_ms: alertThresholdMs,
      metadata,
    });

    if (durationMs >= alertThresholdMs) {
      await this.logMetric(sessionId, agentId, 'performance_alert', durationMs, 'ms');
    }
  }

  async getSessionAuditLog(sessionId: string): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('agent_audit_log')
      .select('*')
      .eq('session_id', sessionId)
      .order('timestamp', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async getSessionMetrics(sessionId: string): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('agent_metrics')
      .select('*')
      .eq('session_id', sessionId)
      .order('timestamp', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async getTotalTokens(sessionId: string): Promise<number> {
    const { data, error } = await this.supabase
      .from('agent_metrics')
      .select('metric_value')
      .eq('session_id', sessionId)
      .eq('metric_type', 'tokens_used');

    if (error || !data) return 0;
    return data.reduce((sum, item) => sum + item.metric_value, 0);
  }

  async getTotalLatency(sessionId: string): Promise<number> {
    const { data, error } = await this.supabase
      .from('agent_metrics')
      .select('metric_value')
      .eq('session_id', sessionId)
      .eq('metric_type', 'latency_ms');

    if (error || !data) return 0;
    return data.reduce((sum, item) => sum + item.metric_value, 0);
  }
}
