/**
 * ExpansionAgent
 *
 * Final stage of the value lifecycle. Retrieves realization data
 * (from RealizationAgent) and the original financial model, then uses the
 * LLM to identify replication opportunities: which interventions can scale
 * to new contexts, what adaptations are needed, and a prioritised expansion
 * roadmap.
 *
 * Produces SDUI sections for the Expansion Planning page (context comparison,
 * scaling factors, replication playbook).
 */

import { BaseAgent } from './BaseAgent.js';
import { z } from 'zod';
import { logger } from '../../logger.js';
import type {
  AgentOutput,
  AgentOutputMetadata,
  ConfidenceLevel,
  LifecycleContext,
} from '../../../types/agent.js';

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const TargetContextSchema = z.object({
  context_name: z.string().min(1),
  similarity_score: z.number().min(0).max(1),
  transferable_elements: z.array(z.string()),
  adaptation_requirements: z.array(z.string()),
  estimated_value: z.number(),
  estimated_effort: z.string(),
  risk_level: z.enum(['low', 'medium', 'high']),
});

type TargetContext = z.infer<typeof TargetContextSchema>;

const ScalingFactorSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['enabler', 'constraint']),
  impact: z.enum(['low', 'medium', 'high']),
  description: z.string(),
  mitigation: z.string().optional(),
});

const ExpansionAnalysisSchema = z.object({
  target_contexts: z.array(TargetContextSchema).min(1),
  scaling_factors: z.array(ScalingFactorSchema).min(1),
  replication_readiness_percent: z.number().min(0).max(100),
  total_expansion_value: z.number(),
  recommended_sequence: z.array(z.string()),
  key_risks: z.array(z.string()),
  playbook_summary: z.string(),
  confidence: z.number().min(0).max(1),
});

type ExpansionAnalysis = z.infer<typeof ExpansionAnalysisSchema>;

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

export class ExpansionAgent extends BaseAgent {
  async execute(context: LifecycleContext): Promise<AgentOutput> {
    const startTime = Date.now();
    const isValid = await this.validateInput(context);
    if (!isValid) {
      throw new Error('Invalid input context');
    }

    // Step 1: Retrieve realization data from RealizationAgent
    const realizationData = await this.retrieveRealizationData(context);
    if (!realizationData) {
      return this.buildOutput(
        { error: 'No realization data found in memory. Run RealizationAgent first.' },
        'failure',
        'low',
        startTime,
      );
    }

    // Step 2: Retrieve financial model for value context
    const financialModel = await this.retrieveFinancialModel(context);

    // Step 3: Generate expansion analysis via LLM
    const query = context.user_inputs?.query as string | undefined;
    const analysis = await this.generateExpansionAnalysis(
      context,
      realizationData,
      financialModel,
      query,
    );
    if (!analysis) {
      return this.buildOutput(
        { error: 'Expansion analysis generation failed. Retry or provide more context.' },
        'failure',
        'low',
        startTime,
      );
    }

    // Step 4: Store results in memory
    await this.storeExpansionInMemory(context, analysis);

    // Step 5: Build SDUI sections
    const sduiSections = this.buildSDUISections(analysis);

    // Step 6: Determine confidence
    const confidenceLevel = this.toConfidenceLevel(analysis.confidence);

    const result = {
      target_contexts: analysis.target_contexts,
      scaling_factors: analysis.scaling_factors,
      replication_readiness_percent: analysis.replication_readiness_percent,
      total_expansion_value: analysis.total_expansion_value,
      recommended_sequence: analysis.recommended_sequence,
      key_risks: analysis.key_risks,
      playbook_summary: analysis.playbook_summary,
      context_count: analysis.target_contexts.length,
      sdui_sections: sduiSections,
    };

    return this.buildOutput(result, 'success', confidenceLevel, startTime, {
      reasoning:
        `Identified ${analysis.target_contexts.length} expansion contexts. ` +
        `Replication readiness: ${analysis.replication_readiness_percent}%. ` +
        `Total expansion value: $${analysis.total_expansion_value.toLocaleString()}.`,
      suggested_next_actions: [
        'Review target contexts with business development team',
        'Validate adaptation requirements for top-priority contexts',
        'Create detailed expansion plan for first target context',
      ],
    });
  }

  // -------------------------------------------------------------------------
  // Memory Retrieval
  // -------------------------------------------------------------------------

  private async retrieveRealizationData(context: LifecycleContext): Promise<{
    content: string;
    metadata: Record<string, unknown>;
  } | null> {
    try {
      const memories = await this.memorySystem.retrieve({
        agent_id: 'realization',
        memory_type: 'semantic',
        limit: 5,
        organization_id: context.organization_id,
      });

      if (memories.length === 0) return null;

      const latest = memories.find(
        m => (m.metadata as Record<string, unknown>)?.realization_data === true,
      ) || memories[0];

      return {
        content: latest.content,
        metadata: (latest.metadata || {}) as Record<string, unknown>,
      };
    } catch (err) {
      logger.warn('Failed to retrieve realization data from memory', {
        error: (err as Error).message,
      });
      return null;
    }
  }

  private async retrieveFinancialModel(context: LifecycleContext): Promise<{
    content: string;
    metadata: Record<string, unknown>;
  } | null> {
    try {
      const memories = await this.memorySystem.retrieve({
        agent_id: 'financial-modeling',
        memory_type: 'semantic',
        limit: 5,
        organization_id: context.organization_id,
      });

      if (memories.length === 0) return null;

      return {
        content: memories[0].content,
        metadata: (memories[0].metadata || {}) as Record<string, unknown>,
      };
    } catch (err) {
      logger.warn('Failed to retrieve financial model from memory', {
        error: (err as Error).message,
      });
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // LLM Analysis
  // -------------------------------------------------------------------------

  private async generateExpansionAnalysis(
    context: LifecycleContext,
    realizationData: { content: string; metadata: Record<string, unknown> },
    financialModel: { content: string; metadata: Record<string, unknown> } | null,
    query?: string,
  ): Promise<ExpansionAnalysis | null> {
    const financialContext = financialModel
      ? `\nFinancial Model:\n${financialModel.content}`
      : '';

    const systemPrompt = `You are an Expansion Planning agent for a Value Engineering platform. Analyze realization results and identify opportunities to replicate successful interventions in new contexts.

Rules:
- Identify at least 2 target contexts where the intervention could be replicated.
- Assess similarity to the original context (0-1 score).
- List transferable elements and adaptation requirements for each context.
- Identify scaling factors (enablers and constraints).
- Provide a recommended expansion sequence (prioritised by value and feasibility).
- replication_readiness_percent reflects how ready the intervention is for scaling.
- Respond with valid JSON matching the schema. No markdown fences.

Realization Results:
${realizationData.content}
Overall Achievement: ${realizationData.metadata.overall_realization_percent ?? 'N/A'}%
Implementation Status: ${realizationData.metadata.implementation_status ?? 'N/A'}
KPIs Tracked: ${realizationData.metadata.kpi_count ?? 'N/A'}
Off-Track: ${realizationData.metadata.off_track_count ?? 'N/A'}
${financialContext}`;

    const userPrompt = `Identify expansion opportunities based on these realization results.

${query ? `Additional context: ${query}` : ''}

Generate a JSON object with:
- target_contexts: Potential contexts for replication with similarity scores and adaptation needs
- scaling_factors: Enablers and constraints for scaling
- replication_readiness_percent: How ready the intervention is for replication (0-100)
- total_expansion_value: Estimated total value across all target contexts
- recommended_sequence: Ordered list of context names to expand into
- key_risks: Top risks for expansion
- playbook_summary: Brief replication playbook
- confidence: Your confidence in this analysis (0-1)`;

    try {
      const result = await this.secureInvoke<ExpansionAnalysis>(
        context.workspace_id,
        `${systemPrompt}\n\n${userPrompt}`,
        ExpansionAnalysisSchema as z.ZodType<ExpansionAnalysis>,
        {
          trackPrediction: true,
          // Expansion is strategic — commitment-level thresholds
          confidenceThresholds: { low: 0.6, high: 0.85 },
          context: {
            agent: 'expansion',
            organization_id: context.organization_id,
          },
        },
      );

      return result;
    } catch (err) {
      logger.error('Expansion analysis generation failed', {
        error: (err as Error).message,
        workspace_id: context.workspace_id,
      });
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // Memory Storage
  // -------------------------------------------------------------------------

  private async storeExpansionInMemory(
    context: LifecycleContext,
    analysis: ExpansionAnalysis,
  ): Promise<void> {
    try {
      await this.memorySystem.storeSemanticMemory(
        context.workspace_id,
        'expansion',
        'semantic',
        `Expansion Plan: ${analysis.target_contexts.length} target contexts identified. ` +
        `Replication readiness: ${analysis.replication_readiness_percent}%. ` +
        `Total expansion value: $${analysis.total_expansion_value.toLocaleString()}.`,
        {
          context_count: analysis.target_contexts.length,
          replication_readiness_percent: analysis.replication_readiness_percent,
          total_expansion_value: analysis.total_expansion_value,
          recommended_sequence: analysis.recommended_sequence,
          expansion_data: true,
          organization_id: context.organization_id,
          importance: analysis.confidence,
        },
        context.organization_id,
      );
    } catch (err) {
      logger.warn('Failed to store expansion data in memory', {
        error: (err as Error).message,
      });
    }
  }

  // -------------------------------------------------------------------------
  // SDUI Output
  // -------------------------------------------------------------------------

  private buildSDUISections(
    analysis: ExpansionAnalysis,
  ): Array<Record<string, unknown>> {
    const sections: Array<Record<string, unknown>> = [];

    // Expansion summary card
    sections.push({
      type: 'component',
      component: 'AgentResponseCard',
      version: 1,
      props: {
        response: {
          agentId: 'expansion',
          agentName: 'Expansion Agent',
          timestamp: new Date().toISOString(),
          content:
            `**Expansion Plan**\n` +
            `Target Contexts: ${analysis.target_contexts.length}\n` +
            `Replication Readiness: ${analysis.replication_readiness_percent}%\n` +
            `Total Expansion Value: $${analysis.total_expansion_value.toLocaleString()}\n` +
            `Recommended Sequence: ${analysis.recommended_sequence.join(' → ')}`,
          confidence: analysis.confidence,
          status: 'completed',
        },
        showReasoning: false,
        showActions: true,
        stage: 'expansion',
      },
    });

    // Target contexts comparison
    const contextKPIs = analysis.target_contexts.map(tc => ({
      name: tc.context_name,
      value: tc.estimated_value,
      unit: 'usd',
      source: `Similarity: ${(tc.similarity_score * 100).toFixed(0)}% | Risk: ${tc.risk_level} | Effort: ${tc.estimated_effort}`,
    }));

    sections.push({
      type: 'component',
      component: 'KPIForm',
      version: 1,
      props: {
        kpis: contextKPIs,
        title: 'Target Contexts',
        readonly: true,
      },
    });

    // Scaling factors
    const enablers = analysis.scaling_factors.filter(sf => sf.type === 'enabler');
    const constraints = analysis.scaling_factors.filter(sf => sf.type === 'constraint');

    if (analysis.scaling_factors.length > 0) {
      sections.push({
        type: 'component',
        component: 'ScalingFactorAnalysis',
        version: 1,
        props: {
          enablers,
          constraints,
          title: 'Scaling Factors',
        },
      });
    }

    return sections;
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private toConfidenceLevel(score: number): ConfidenceLevel {
    if (score >= 0.85) return 'very_high';
    if (score >= 0.7) return 'high';
    if (score >= 0.5) return 'medium';
    if (score >= 0.3) return 'low';
    return 'very_low';
  }

  private buildOutput(
    result: Record<string, unknown>,
    status: AgentOutput['status'],
    confidence: ConfidenceLevel,
    startTime: number,
    extra?: { reasoning?: string; suggested_next_actions?: string[] },
  ): AgentOutput {
    const metadata: AgentOutputMetadata = {
      execution_time_ms: Date.now() - startTime,
      model_version: this.version,
      timestamp: new Date().toISOString(),
    };

    return {
      agent_id: this.name,
      agent_type: 'expansion',
      lifecycle_stage: 'expansion',
      status,
      result,
      confidence,
      reasoning: extra?.reasoning,
      suggested_next_actions: extra?.suggested_next_actions,
      metadata,
    };
  }
}
