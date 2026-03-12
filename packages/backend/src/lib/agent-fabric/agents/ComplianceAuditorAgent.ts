import { z } from 'zod';

import type { AgentOutput, LifecycleContext } from '../../../types/agent.js';

import { BaseAgent } from './BaseAgent.js';
import { renderTemplate } from '../promptUtils.js';
import { resolvePromptTemplate } from '../promptRegistry.js';

const ComplianceSummarySchema = z.object({
  summary: z.string(),
  control_gaps: z.array(z.string()),
  control_coverage_score: z.number().min(0).max(1),
  recommended_actions: z.array(z.string()),
  hallucination_check: z.boolean().optional(),
});

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

    const promptTemplate = resolvePromptTemplate('compliance_auditor_system');
    this.setPromptVersionReferences([{ key: promptTemplate.key, version: promptTemplate.version }], [promptTemplate.approval]);

    const prompt = renderTemplate(
      promptTemplate.template,
      {
        tenantId: this.organizationId,
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
        control_coverage_score: llmResult.control_coverage_score,
        tenant_id: this.organizationId,
      },
      this.organizationId,
    );

    return this.buildOutput(
      {
        summary: llmResult.summary,
        control_gaps: llmResult.control_gaps,
        control_coverage_score: llmResult.control_coverage_score,
        recommended_actions: llmResult.recommended_actions,
        evidence_by_source: evidenceBySource,
      },
      'success',
      this.toConfidenceLevel(llmResult.control_coverage_score),
      start,
    );
  }
}
