import { z } from 'zod';

import type { AgentOutput, LifecycleContext } from '../../../types/agent.js';

import { BaseAgent } from './BaseAgent.js';
import { renderTemplate } from '../promptUtils.js';

const ComplianceSummarySchema = z.object({
  summary: z.string(),
  recommended_actions: z.array(z.string()),
  hallucination_check: z.boolean().optional(),
});

interface DeterministicCoverage {
  coverageScore: number;
  controlGaps: string[];
  traces: Array<{
    control: string;
    observed_count: number;
    required_minimum: number;
    outcome: 'pass' | 'refine' | 'veto';
    message: string;
  }>;
}

export class ComplianceAuditorAgent extends BaseAgent {
  public readonly lifecycleStage = 'integrity';
  public readonly version = '1.0.0';
  public readonly name = 'ComplianceAuditorAgent';

  async execute(context: LifecycleContext): Promise<AgentOutput> {
    const start = Date.now();
    const valid = await this.validateInput(context);
    if (!valid) {
      throw new Error('Invalid compliance auditor context');
    }

    if (context.organization_id !== this.organizationId) {
      throw new Error('Tenant mismatch for ComplianceAuditorAgent execution');
    }

    const sources = ['opportunity', 'target', 'financial-modeling', 'integrity', 'realization', 'expansion'];
    const evidenceBySource: Record<string, number> = {};
    const sampleObservations: string[] = [];

    for (const source of sources) {
      const evidence = await this.memorySystem.retrieve({
        agent_id: source,
        memory_type: 'semantic',
        limit: 5,
        organization_id: this.organizationId,
      });

      evidenceBySource[source] = evidence.length;
      if (evidence.length > 0) {
        sampleObservations.push(`${source}: ${evidence[0].content.slice(0, 180)}`);
      }
    }

    const deterministicCoverage = this.computeDeterministicCoverage(evidenceBySource);

    const prompt = renderTemplate(
      `You are a compliance auditor. Summarize deterministic compliance evidence results for tenant {{tenantId}}.\nEvidence counts: {{counts}}\nDeterministic control coverage score: {{coverageScore}}\nControl gaps: {{gaps}}\nPolicy traces: {{traces}}\nObservations: {{observations}}\nReturn JSON with summary and recommended_actions only.`,
      {
        tenantId: this.organizationId,
        counts: JSON.stringify(evidenceBySource),
        coverageScore: deterministicCoverage.coverageScore.toFixed(2),
        gaps: JSON.stringify(deterministicCoverage.controlGaps),
        traces: JSON.stringify(deterministicCoverage.traces),
        observations: JSON.stringify(sampleObservations),
      },
    );

    const llmResult = await this.secureInvoke(
      context.workspace_id,
      prompt,
      ComplianceSummarySchema,
      {
        trackPrediction: true,
        confidenceThresholds: { low: 0.7, high: 0.9 },
        context: {
          agent: this.name,
          tenant_id: this.organizationId,
        },
      },
    );

    await this.memorySystem.storeSemanticMemory(
      context.workspace_id,
      this.name,
      'episodic',
      `Compliance evidence summary: ${llmResult.summary}`,
      {
        source_counts: evidenceBySource,
        control_coverage_score: deterministicCoverage.coverageScore,
        control_gaps: deterministicCoverage.controlGaps,
        policy_traces: deterministicCoverage.traces,
        tenant_id: this.organizationId,
      },
      this.organizationId,
    );

    return this.buildOutput(
      {
        summary: llmResult.summary,
        control_gaps: deterministicCoverage.controlGaps,
        control_coverage_score: deterministicCoverage.coverageScore,
        recommended_actions: llmResult.recommended_actions,
        evidence_by_source: evidenceBySource,
        policy_traces: deterministicCoverage.traces,
      },
      'success',
      this.toConfidenceLevel(deterministicCoverage.coverageScore),
      start,
    );
  }

  private computeDeterministicCoverage(evidenceBySource: Record<string, number>): DeterministicCoverage {
    const traces = Object.entries(evidenceBySource).map(([control, observed]) => {
      const requiredMinimum = control === 'integrity' || control === 'financial-modeling' ? 2 : 1;
      const outcome: 'pass' | 'refine' | 'veto' = observed >= requiredMinimum
        ? 'pass'
        : observed === 0
          ? 'veto'
          : 'refine';
      return {
        control,
        observed_count: observed,
        required_minimum: requiredMinimum,
        outcome,
        message: observed >= requiredMinimum
          ? 'Deterministic coverage threshold met.'
          : `Control evidence below deterministic threshold (${observed}/${requiredMinimum}).`,
      };
    });

    const passCount = traces.filter(trace => trace.outcome === 'pass').length;
    const coverageScore = traces.length === 0 ? 0 : passCount / traces.length;
    const controlGaps = traces
      .filter(trace => trace.outcome !== 'pass')
      .map(trace => `${trace.control}: ${trace.message}`);

    return {
      coverageScore,
      controlGaps,
      traces,
    };
  }
}
