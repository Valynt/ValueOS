/**
 * Benchmark Agent
 *
 * VOS Lifecycle Stage: TARGET
 *
 * Provides industry benchmarking, comparative analysis, and status updates during processing.
 * Enables transparent reasoning with visible progress updates.
 *
 * Responsibilities:
 * - Industry benchmark retrieval and comparison
 * - Competitive analysis against peer companies
 * - KPI target validation against industry standards
 * - Real-time status updates during processing
 * - Best-in-class gap analysis
 */

import { z } from 'zod';
import { logger } from '../../../lib/logger';
import { BaseAgent } from './BaseAgent';
import { ValueFabricService } from '../../../services/ValueFabricService';
import type { AgentConfig, ConfidenceLevel } from '../../../types/agent';
import type { Benchmark } from '../../../types/vos';

// ============================================================================
// Input/Output Types
// ============================================================================

export interface BenchmarkAgentInput {
  /** Industry vertical for benchmarks */
  industry: string;
  /** Company size segment */
  companySize?: 'small' | 'medium' | 'large' | 'enterprise';
  /** Geographic region */
  region?: string;
  /** KPIs to benchmark */
  kpis: Array<{
    name: string;
    currentValue: number;
    unit: string;
    targetDirection?: 'increase' | 'decrease';
  }>;
  /** Optional company-specific context */
  companyContext?: Record<string, any>;
  /** Callback for status updates */
  onStatusUpdate?: (status: BenchmarkStatus) => void;
}

export interface BenchmarkStatus {
  stage: 'initializing' | 'fetching_benchmarks' | 'analyzing' | 'comparing' | 'complete';
  progress: number; // 0-100
  message: string;
  currentKpi?: string;
}

export interface BenchmarkComparison {
  kpiName: string;
  currentValue: number;
  unit: string;
  benchmarks: {
    median: number;
    p25: number;
    p75: number;
    bestInClass: number;
  };
  percentile: number;
  gapToMedian: number;
  gapToBestInClass: number;
  status: 'leading' | 'competitive' | 'lagging' | 'critical';
  improvement_opportunity: number;
  recommendations: string[];
}

export interface IndustryInsight {
  trend: string;
  impact: 'positive' | 'negative' | 'neutral';
  relevance: number;
  source?: string;
}

export interface BenchmarkAgentOutput {
  comparisons: BenchmarkComparison[];
  industryInsights: IndustryInsight[];
  overallPosition: 'leader' | 'competitive' | 'lagging';
  prioritizedImprovements: Array<{
    kpiName: string;
    priority: number;
    estimatedImpact: number;
    effort: 'low' | 'medium' | 'high';
    recommendation: string;
  }>;
  executiveSummary: string;
  reasoning: string;
  confidenceLevel: ConfidenceLevel;
  dataSources: string[];
  limitations: string[];
}

// ============================================================================
// Zod Schema for Structured Output
// ============================================================================

const BenchmarkOutputSchema = z.object({
  comparisons: z.array(z.object({
    kpi_name: z.string(),
    current_value: z.number(),
    unit: z.string(),
    benchmarks: z.object({
      median: z.number(),
      p25: z.number(),
      p75: z.number(),
      best_in_class: z.number(),
    }),
    percentile: z.number(),
    gap_to_median: z.number(),
    gap_to_best_in_class: z.number(),
    status: z.enum(['leading', 'competitive', 'lagging', 'critical']),
    improvement_opportunity: z.number(),
    recommendations: z.array(z.string()),
  })),
  industry_insights: z.array(z.object({
    trend: z.string(),
    impact: z.enum(['positive', 'negative', 'neutral']),
    relevance: z.number(),
    source: z.string().optional(),
  })),
  overall_position: z.enum(['leader', 'competitive', 'lagging']),
  prioritized_improvements: z.array(z.object({
    kpi_name: z.string(),
    priority: z.number(),
    estimated_impact: z.number(),
    effort: z.enum(['low', 'medium', 'high']),
    recommendation: z.string(),
  })),
  executive_summary: z.string(),
  reasoning: z.string(),
  confidence_level: z.enum(['high', 'medium', 'low']),
  data_sources: z.array(z.string()),
  limitations: z.array(z.string()),
});

// ============================================================================
// Benchmark Agent Implementation
// ============================================================================

export class BenchmarkAgent extends BaseAgent {
  private valueFabricService: ValueFabricService;

  public lifecycleStage = 'target';
  public version = '1.0';
  public name = 'Benchmark Agent';

  constructor(config: AgentConfig) {
    super(config);
    if (!config.supabase) {
      throw new Error('Supabase client is required for BenchmarkAgent');
    }
    this.valueFabricService = new ValueFabricService(config.supabase);
  }

  async execute(
    sessionId: string,
    input: BenchmarkAgentInput
  ): Promise<BenchmarkAgentOutput> {
    const startTime = Date.now();

    // Send status update: Initializing
    await this.sendStatusUpdate(input, {
      stage: 'initializing',
      progress: 0,
      message: 'Starting benchmark analysis...',
    });

    // Fetch existing benchmarks from Value Fabric
    await this.sendStatusUpdate(input, {
      stage: 'fetching_benchmarks',
      progress: 20,
      message: 'Retrieving industry benchmarks...',
    });

    const existingBenchmarks = await this.fetchExistingBenchmarks(input);

    // Build analysis context
    await this.sendStatusUpdate(input, {
      stage: 'analyzing',
      progress: 40,
      message: 'Analyzing KPI performance...',
    });

    const analysisContext = this.buildAnalysisContext(input, existingBenchmarks);

    const prompt = `You are a B2B benchmarking specialist analyzing KPI performance against industry standards.

ANALYSIS CONTEXT:
${analysisContext}

Your task is to provide comprehensive benchmark analysis:

1. **KPI Comparisons**: For each KPI, compare against industry benchmarks (median, quartiles, best-in-class). Calculate percentile position and gap analysis.

2. **Industry Insights**: Identify relevant industry trends affecting these KPIs.

3. **Improvement Prioritization**: Rank improvement opportunities by impact and effort.

4. **Executive Summary**: Provide a clear summary of competitive position.

IMPORTANT:
- Use conservative estimates when benchmark data is limited
- Be transparent about data limitations
- Provide actionable recommendations
- Status should be: 'leading' (top 25%), 'competitive' (25-75%), 'lagging' (bottom 25%), 'critical' (significantly below bottom 25%)

Return ONLY valid JSON in this exact format:
{
  "comparisons": [
    {
      "kpi_name": "<KPI name>",
      "current_value": 100,
      "unit": "<unit>",
      "benchmarks": {
        "median": 80,
        "p25": 60,
        "p75": 95,
        "best_in_class": 120
      },
      "percentile": 75,
      "gap_to_median": 20,
      "gap_to_best_in_class": -20,
      "status": "<leading|competitive|lagging|critical>",
      "improvement_opportunity": 20,
      "recommendations": ["<recommendation 1>"]
    }
  ],
  "industry_insights": [
    {
      "trend": "<trend description>",
      "impact": "<positive|negative|neutral>",
      "relevance": 0.8,
      "source": "<data source>"
    }
  ],
  "overall_position": "<leader|competitive|lagging>",
  "prioritized_improvements": [
    {
      "kpi_name": "<KPI name>",
      "priority": 1,
      "estimated_impact": 50000,
      "effort": "<low|medium|high>",
      "recommendation": "<specific recommendation>"
    }
  ],
  "executive_summary": "<2-3 sentence summary of competitive position>",
  "reasoning": "<your analysis methodology and key findings>",
  "confidence_level": "<high|medium|low>",
  "data_sources": ["<source 1>", "<source 2>"],
  "limitations": ["<limitation 1>", "<limitation 2>"]
}`;

    // Send status update: Comparing
    await this.sendStatusUpdate(input, {
      stage: 'comparing',
      progress: 60,
      message: 'Generating benchmark comparisons...',
    });

    // Use secure invocation with structured output
    const secureResult = await this.secureInvoke(
      sessionId,
      prompt,
      BenchmarkOutputSchema,
      {
        trackPrediction: true,
        confidenceThresholds: { low: 0.5, high: 0.8 },
        context: {
          agent: 'BenchmarkAgent',
          industry: input.industry,
          kpiCount: input.kpis.length,
        },
      }
    );

    const parsed = secureResult.result;
    const durationMs = Date.now() - startTime;

    // Send status update: Complete
    await this.sendStatusUpdate(input, {
      stage: 'complete',
      progress: 100,
      message: 'Benchmark analysis complete.',
    });

    // Log metrics
    await this.logMetric(sessionId, 'latency_ms', durationMs, 'ms');
    await this.logMetric(sessionId, 'kpis_analyzed', input.kpis.length, 'count');
    await this.logMetric(sessionId, 'improvements_identified', parsed.prioritized_improvements?.length || 0, 'count');
    await this.logPerformanceMetric(sessionId, 'benchmark_execute', durationMs, {
      industry: input.industry,
      kpiCount: input.kpis.length,
    });

    // Log execution for audit trail
    await this.logExecution(
      sessionId,
      'benchmark_analysis',
      input,
      parsed,
      parsed.reasoning,
      parsed.confidence_level,
      parsed.data_sources?.map((source: string) => ({
        type: 'benchmark_source',
        source,
        confidence: 0.7,
      })) || []
    );

    // Store in semantic memory
    await this.memorySystem.storeSemanticMemory(
      sessionId,
      this.agentId,
      `Benchmark: ${input.industry} - ${parsed.executive_summary}`,
      {
        comparisons: parsed.comparisons,
        overall_position: parsed.overall_position,
        improvements: parsed.prioritized_improvements,
      },
      this.organizationId
    );

    // Transform to output format
    return this.transformOutput(parsed);
  }

  /**
   * Send status update callback
   */
  private async sendStatusUpdate(
    input: BenchmarkAgentInput,
    status: BenchmarkStatus
  ): Promise<void> {
    if (input.onStatusUpdate) {
      try {
        input.onStatusUpdate(status);
      } catch (error) {
        logger.warn('Status update callback failed', { error });
      }
    }
  }

  /**
   * Fetch existing benchmarks from Value Fabric
   */
  private async fetchExistingBenchmarks(
    input: BenchmarkAgentInput
  ): Promise<Benchmark[]> {
    try {
      const benchmarks: Benchmark[] = [];

      for (const kpi of input.kpis) {
        const kpiBenchmarks = await this.valueFabricService.getBenchmarks({
          kpiName: kpi.name,
          industry: input.industry,
          companySize: input.companySize,
          region: input.region,
        });
        benchmarks.push(...kpiBenchmarks);
      }

      return benchmarks;
    } catch (error) {
      logger.warn('Failed to fetch existing benchmarks', { error });
      return [];
    }
  }

  /**
   * Build analysis context from input and existing benchmarks
   */
  private buildAnalysisContext(
    input: BenchmarkAgentInput,
    existingBenchmarks: Benchmark[]
  ): string {
    const parts: string[] = [];

    parts.push(`Industry: ${input.industry}`);
    if (input.companySize) parts.push(`Company Size: ${input.companySize}`);
    if (input.region) parts.push(`Region: ${input.region}`);

    parts.push('\nKPIs to Benchmark:');
    input.kpis.forEach((kpi, i) => {
      parts.push(`${i + 1}. ${kpi.name}: ${kpi.currentValue} ${kpi.unit}${kpi.targetDirection ? ` (target: ${kpi.targetDirection})` : ''}`);
    });

    if (existingBenchmarks.length > 0) {
      parts.push('\nExisting Benchmark Data:');
      existingBenchmarks.forEach(b => {
        parts.push(`- ${b.kpi_name}: ${b.value} ${b.unit} (${b.percentile ? `P${b.percentile}` : 'median'}, source: ${b.source || 'internal'})`);
      });
    }

    if (input.companyContext) {
      parts.push(`\nCompany Context: ${JSON.stringify(input.companyContext, null, 2)}`);
    }

    return parts.join('\n');
  }

  /**
   * Transform parsed output to typed output
   */
  private transformOutput(parsed: any): BenchmarkAgentOutput {
    return {
      comparisons: parsed.comparisons.map((c: any) => ({
        kpiName: c.kpi_name,
        currentValue: c.current_value,
        unit: c.unit,
        benchmarks: {
          median: c.benchmarks.median,
          p25: c.benchmarks.p25,
          p75: c.benchmarks.p75,
          bestInClass: c.benchmarks.best_in_class,
        },
        percentile: c.percentile,
        gapToMedian: c.gap_to_median,
        gapToBestInClass: c.gap_to_best_in_class,
        status: c.status,
        improvement_opportunity: c.improvement_opportunity,
        recommendations: c.recommendations,
      })),
      industryInsights: parsed.industry_insights.map((i: any) => ({
        trend: i.trend,
        impact: i.impact,
        relevance: i.relevance,
        source: i.source,
      })),
      overallPosition: parsed.overall_position,
      prioritizedImprovements: parsed.prioritized_improvements.map((p: any) => ({
        kpiName: p.kpi_name,
        priority: p.priority,
        estimatedImpact: p.estimated_impact,
        effort: p.effort,
        recommendation: p.recommendation,
      })),
      executiveSummary: parsed.executive_summary,
      reasoning: parsed.reasoning,
      confidenceLevel: parsed.confidence_level,
      dataSources: parsed.data_sources,
      limitations: parsed.limitations,
    };
  }
}
