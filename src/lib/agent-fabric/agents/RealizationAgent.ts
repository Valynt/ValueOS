/**
 * Realization Agent
 *
 * VOS Lifecycle Stage: REALIZATION
 *
 * Tracks value realization through telemetry and generates value proof reports.
 *
 * Responsibilities:
 * - Ingest telemetry events from customer systems
 * - Compare actual performance vs committed targets
 * - Calculate variance and confidence levels
 * - Generate realization reports with insights
 * - Identify at-risk commitments
 * - Provide recommendations for course correction
 */

import { BaseAgent } from './BaseAgent';
import type {
  TelemetryEvent,
  RealizationReport,
  RealizationResult,
  KPITarget,
  RealizationAgentInput,
  RealizationAgentOutput,
  ResultStatus
} from '../../../types/vos';

export class RealizationAgent extends BaseAgent {
  async execute(
    sessionId: string,
    input: RealizationAgentInput
  ): Promise<RealizationAgentOutput> {
    const startTime = Date.now();

    const targets = await this.getKPITargets(input.valueCommitId);

    const aggregatedMetrics = await this.aggregateTelemetryByKPI(
      input.telemetryEvents,
      input.reportPeriod
    );

    const results: RealizationResult[] = [];

    for (const target of targets) {
      const actualData = aggregatedMetrics.find(m => m.kpi_name === target.kpi_name);

      const actualValue = actualData?.avg_value || target.baseline_value || 0;

      const variance = actualValue - target.target_value;
      const variancePercentage = (variance / target.target_value) * 100;

      const status = this.determineResultStatus(
        actualValue,
        target.target_value,
        target.baseline_value || 0
      );

      results.push({
        id: '',
        realization_report_id: '',
        kpi_target_id: target.id,
        kpi_name: target.kpi_name,
        actual_value: actualValue,
        target_value: target.target_value,
        baseline_value: target.baseline_value,
        unit: target.unit,
        variance,
        variance_percentage: variancePercentage,
        status,
        confidence_level: actualData ? 'high' : 'low',
        created_at: new Date().toISOString()
      });
    }

    const overallStatus = this.calculateOverallStatus(results);

    const analysisPrompt = `You are a value realization analyst reviewing performance against commitments.

REPORT PERIOD: ${input.reportPeriod.start} to ${input.reportPeriod.end}

REALIZATION RESULTS:
${JSON.stringify(results.map(r => ({
  kpi: r.kpi_name,
  baseline: r.baseline_value,
  target: r.target_value,
  actual: r.actual_value,
  variance_pct: r.variance_percentage?.toFixed(1),
  status: r.status
})), null, 2)}

Analyze the results and provide:
1. **Executive Summary**: High-level assessment of value realization
2. **Insights**: Key findings from the data (3-5 insights)
3. **Recommendations**: Actionable next steps for any at-risk KPIs
4. **Root Causes**: For underperforming KPIs, identify likely causes

Return ONLY valid JSON:
{
  "executive_summary": "<concise executive summary>",
  "insights": [
    "<insight 1 about performance trends>",
    "<insight 2 about areas of success>",
    "<insight 3 about areas needing attention>"
  ],
  "recommendations": [
    "<recommendation 1 for improvement>",
    "<recommendation 2 for reinforcing success>"
  ],
  "root_causes": {
    "<kpi_name>": "<root cause analysis if underperforming>"
  },
  "confidence_level": "<high|medium|low>",
  "reasoning": "<your analytical process>"
}`;

    const response = await this.llmGateway.complete([
      {
        role: 'system',
        content: 'You are a value realization analyst. You analyze telemetry data against commitments and provide actionable insights for driving value outcomes.'
      },
      {
        role: 'user',
        content: analysisPrompt
      }
    ], {
      temperature: 0.4,
      max_tokens: 2000
    });

    const analysis = this.extractJSON(response.content);

    const realizationReport: Omit<RealizationReport, 'id' | 'generated_at'> = {
      value_commit_id: input.valueCommitId,
      value_case_id: input.valueCaseId,
      report_period_start: input.reportPeriod.start,
      report_period_end: input.reportPeriod.end,
      overall_status: overallStatus,
      executive_summary: analysis.executive_summary,
      generated_by: undefined,
      metadata: {
        insights: analysis.insights,
        recommendations: analysis.recommendations,
        root_causes: analysis.root_causes
      }
    };

    await this.logMetric(sessionId, 'tokens_used', response.tokens_used, 'tokens');
    await this.logMetric(sessionId, 'latency_ms', Date.now() - startTime, 'ms');
    await this.logMetric(sessionId, 'kpis_tracked', results.length, 'count');
    await this.logMetric(sessionId, 'kpis_achieved', results.filter(r => r.status === 'achieved' || r.status === 'exceeded').length, 'count');
    await this.logMetric(sessionId, 'kpis_at_risk', results.filter(r => r.status === 'at_risk' || r.status === 'missed').length, 'count');

    await this.logExecution(
      sessionId,
      'realization_analysis',
      input,
      {
        overall_status: overallStatus,
        kpis_tracked: results.length,
        insights_count: analysis.insights.length
      },
      analysis.reasoning,
      analysis.confidence_level,
      [{
        type: 'telemetry_analysis',
        model: response.model,
        tokens: response.tokens_used
      }]
    );

    await this.memorySystem.storeSemanticMemory(
      sessionId,
      this.agent.id,
      `Realization Report: ${overallStatus.toUpperCase()} - ${analysis.executive_summary}`,
      {
        overall_status: overallStatus,
        kpis_achieved: results.filter(r => r.status === 'achieved').length,
        kpis_at_risk: results.filter(r => r.status === 'at_risk').length
      }
    );

    return {
      realizationReport: realizationReport as RealizationReport,
      realizationResults: results,
      insights: analysis.insights,
      recommendations: analysis.recommendations
    };
  }

  private async getKPITargets(valueCommitId: string): Promise<KPITarget[]> {
    const { data, error } = await this.supabase
      .from('kpi_targets')
      .select('*')
      .eq('value_commit_id', valueCommitId);

    if (error) throw error;
    return data || [];
  }

  private async aggregateTelemetryByKPI(
    events: TelemetryEvent[],
    period: { start: string; end: string }
  ): Promise<Array<{ kpi_name: string; avg_value: number; count: number }>> {
    const kpiMap = new Map<string, { total: number; count: number; name: string }>();

    const periodStart = new Date(period.start);
    const periodEnd = new Date(period.end);

    for (const event of events) {
      const eventDate = new Date(event.event_timestamp);
      if (eventDate < periodStart || eventDate > periodEnd) continue;

      const existing = kpiMap.get(event.kpi_hypothesis_id) || { total: 0, count: 0, name: '' };
      existing.total += event.value;
      existing.count += 1;
      kpiMap.set(event.kpi_hypothesis_id, existing);
    }

    const results: Array<{ kpi_name: string; avg_value: number; count: number }> = [];

    for (const [kpiId, stats] of kpiMap.entries()) {
      const { data } = await this.supabase
        .from('kpi_hypotheses')
        .select('kpi_name')
        .eq('id', kpiId)
        .maybeSingle();

      results.push({
        kpi_name: data?.kpi_name || 'Unknown',
        avg_value: stats.total / stats.count,
        count: stats.count
      });
    }

    return results;
  }

  private determineResultStatus(
    actual: number,
    target: number,
    baseline: number
  ): ResultStatus {
    const progressToTarget = actual >= baseline
      ? ((actual - baseline) / (target - baseline)) * 100
      : 0;

    if (actual >= target) return 'achieved';
    if (progressToTarget >= 90) return 'on_track';
    if (progressToTarget >= 70) return 'at_risk';
    return 'missed';
  }

  private calculateOverallStatus(results: RealizationResult[]): 'on_track' | 'at_risk' | 'achieved' | 'missed' {
    if (results.length === 0) return 'on_track';

    const achievedCount = results.filter(r => r.status === 'achieved' || r.status === 'exceeded').length;
    const onTrackCount = results.filter(r => r.status === 'on_track').length;
    const atRiskCount = results.filter(r => r.status === 'at_risk').length;
    const missedCount = results.filter(r => r.status === 'missed').length;

    const achievedPercentage = (achievedCount / results.length) * 100;
    const problemPercentage = ((atRiskCount + missedCount) / results.length) * 100;

    if (achievedPercentage >= 80) return 'achieved';
    if (problemPercentage >= 50) return 'at_risk';
    if (problemPercentage >= 30) return 'at_risk';
    return 'on_track';
  }

  /**
   * Persist realization report and results
   */
  async persistRealizationReport(
    output: RealizationAgentOutput,
    valueCommitId: string,
    sessionId?: string
  ): Promise<string> {
    const { data: reportData, error: reportError } = await this.supabase
      .from('realization_reports')
      .insert(output.realizationReport)
      .select()
      .single();

    if (reportError) throw new Error(`Failed to create realization report: ${reportError.message}`);

    const reportId = reportData.id;

    if (sessionId) {
      await this.logArtifactProvenance(sessionId, 'realization_report', reportId, 'artifact_created', {
        artifact_data: {
          report_period: output.realizationReport.report_period_start,
          overall_status: output.realizationReport.overall_status,
          insights: output.insights,
        },
        reasoning_trace: output.recommendations.join('; '),
      });

      await this.recordLifecycleLink(sessionId, {
        source_type: 'value_commit',
        source_id: valueCommitId,
        target_type: 'realization_report',
        target_id: reportId,
        relationship_type: 'realization',
        reasoning_trace: 'Realization report generated from KPI telemetry',
        chain_depth: 3,
        metadata: { stage: 'realization' }
      });
    }

    for (const result of output.realizationResults) {
      await this.supabase
        .from('realization_results')
        .insert({
          ...result,
          realization_report_id: reportId
        });

      if (sessionId) {
        await this.logArtifactProvenance(sessionId, 'realization_result', reportId, 'result_recorded', {
          artifact_data: {
            kpi_name: result.kpi_name,
            actual_value: result.actual_value,
            target_value: result.target_value,
          },
        });
      }
    }

    return reportId;
  }
}
