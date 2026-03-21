import { z } from 'zod';

import type { AgentOutput, LifecycleContext } from '../../../types/agent.js';
import { logger } from '../../logger.js';
import { renderTemplate } from '../promptUtils.js';

import { BaseAgent } from './BaseAgent.js';
import { BaseGraphWriter } from '../BaseGraphWriter.js';

const ComplianceSummarySchema = z.object({
  summary: z.string(),
  control_gaps: z.array(z.string()),
  recommended_actions: z.array(z.string()),
  hallucination_check: z.boolean().optional(),
});

interface DeterministicCoverage {
  controlCoverageScore: number;
  controlGaps: string[];
  coverageBySource: Record<string, { evidence_count: number; covered: boolean }>;
}

export class ComplianceAuditorAgent extends BaseAgent {
  public override readonly lifecycleStage = 'validating';
  public override readonly version = '1.0.0';
  public override readonly name = 'compliance-auditor';

  private readonly graphWriter = new BaseGraphWriter();

  async execute(context: LifecycleContext): Promise<AgentOutput> {
    const start = Date.now();
    const valid = await this.validateInput(context);
    if (!valid) {
      throw new Error('Invalid compliance auditor context');
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

    const deterministicCoverage = this.deriveDeterministicCoverage(evidenceBySource);

    const prompt = renderTemplate(
      `You are a compliance auditor. Summarize deterministic coverage metrics for tenant {{tenantId}}.\nDeterministic coverage score: {{score}}\nDeterministic control gaps: {{gaps}}\nEvidence counts: {{counts}}\nObservations: {{observations}}\nReturn JSON with summary, control_gaps, recommended_actions.`,
      {
        tenantId: this.organizationId,
        score: deterministicCoverage.controlCoverageScore.toFixed(3),
        gaps: JSON.stringify(deterministicCoverage.controlGaps),
        counts: JSON.stringify(evidenceBySource),
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
        userId: context.user_id,
        context: {
          agent: this.name,
          tenant_id: this.organizationId,
        },
      },
    );

    // Write Value Graph nodes — VgValueDriver (compliance risk) + hypothesis_claims_metric edges
    try {
      const writes: Array<() => Promise<unknown>> = [];
      for (const gap of deterministicCoverage.controlGaps) {
        const driverId = this.graphWriter.generateNodeId();
        writes.push(() =>
          this.graphWriter.writeValueDriver(context, {
            id: driverId,
            name: gap,
            description: `Compliance risk driver: ${gap}`,
            category: 'risk',
          })
        );
        // Write a metric node representing the compliance gap measurement so
        // the hypothesis_claims_metric edge has a valid target node.
        const metricId = this.graphWriter.generateNodeId();
        writes.push(() =>
          this.graphWriter.writeMetric(context, {
            id: metricId,
            name: `${gap} (metric)`,
            description: `Compliance gap metric for: ${gap}`,
          })
        );
        writes.push(() =>
          this.graphWriter.writeEdge(context, {
            from_entity_id: metricId,
            from_entity_type: 'vg_metric',
            to_entity_id: driverId,
            to_entity_type: 'vg_value_driver',
            edge_type: 'metric_maps_to_value_driver',
            created_by_agent: 'ComplianceAuditorAgent',
            confidence_score: deterministicCoverage.controlCoverageScore,
          })
        );
      }
      if (writes.length > 0) {
        const { succeeded, failed } = await this.graphWriter.safeWriteBatch(writes);
        logger.info('ComplianceAuditorAgent: graph write complete', { succeeded, failed });
      }
    } catch (err) {
      logger.warn('ComplianceAuditorAgent: graph write skipped', { reason: (err as Error).message });
    }

    await this.memorySystem.storeSemanticMemory(
      context.workspace_id,
      this.name,
      'episodic',
      `Compliance evidence summary: ${llmResult.summary}`,
      {
        source_counts: evidenceBySource,
        control_coverage_score: deterministicCoverage.controlCoverageScore,
        control_gaps: deterministicCoverage.controlGaps,
        coverage_by_source: deterministicCoverage.coverageBySource,
        tenant_id: this.organizationId,
      },
      this.organizationId,
    );

    return this.buildOutput(
      {
        summary: llmResult.summary,
        control_gaps: deterministicCoverage.controlGaps,
        control_coverage_score: deterministicCoverage.controlCoverageScore,
        recommended_actions: llmResult.recommended_actions,
        evidence_by_source: evidenceBySource,
        coverage_by_source: deterministicCoverage.coverageBySource,
      },
      'success',
      this.toConfidenceLevel(deterministicCoverage.controlCoverageScore),
      start,
    );
  }

  private deriveDeterministicCoverage(evidenceBySource: Record<string, number>): DeterministicCoverage {
    const sources = Object.entries(evidenceBySource);
    const coverageBySource: DeterministicCoverage['coverageBySource'] = {};

    for (const [source, count] of sources) {
      coverageBySource[source] = {
        evidence_count: count,
        covered: count > 0,
      };
    }

    const coveredSources = sources.filter(([, count]) => count > 0).length;
    const controlCoverageScore = sources.length === 0 ? 0 : Number((coveredSources / sources.length).toFixed(3));
    const controlGaps = sources
      .filter(([, count]) => count === 0)
      .map(([source]) => `Missing deterministic evidence for ${source}`);

    return {
      controlCoverageScore,
      controlGaps,
      coverageBySource,
    };
  }
}
