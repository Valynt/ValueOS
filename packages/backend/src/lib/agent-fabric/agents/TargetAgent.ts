/**
 * TargetAgent Implementation
 */

import { BaseAgent } from './BaseAgent.js';
import type { AgentOutput, LifecycleContext } from '../../../types/agent.js';
import { z } from 'zod';
import { getAdvancedCausalEngine } from '../../../services/reasoning/AdvancedCausalEngine.js';

// Minimal target input schema
const TargetAgentInputSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  category: z.string().optional(),
  currentValue: z.number().optional(),
  targetValue: z.number().optional(),
  unit: z.string().optional(),
  timeframe: z.any().optional(),
  owner: z.any().optional(),
});

export class TargetAgent extends BaseAgent {
  private causalEngine = getAdvancedCausalEngine();

  async execute(context: LifecycleContext): Promise<AgentOutput> {
    const isValid = await this.validateInput(context);
    if (!isValid) {
      throw new Error('Invalid input context');
    }

    // Parse and validate input
    const inputData = { ...(context.parameters || {}), ...(context.context || {}), query: context.query };
    let validatedInput: z.infer<typeof TargetAgentInputSchema>;
    try {
      validatedInput = TargetAgentInputSchema.parse(inputData as any);
    } catch (err) {
      return this.prepareOutput({ error: 'Invalid input', details: (err as Error).message }, 'warning');
    }

    // Analyze causal trace
    const causalTrace = await this.validateCausalTrace(validatedInput);

    if (!causalTrace.verified) {
      return this.prepareOutput({
        validated: false,
        message: `Target rejected: No verified causal link to business opportunities. Causal confidence: ${causalTrace.confidence || 0}`,
        causalTrace,
      }, 'warning');
    }

    const result = {
      validated: true,
      causalTrace,
      message: 'Target validated and causal trace verified',
    };

    return this.prepareOutput(result, 'success');
  }

  private async validateCausalTrace(input: any): Promise<{ impactCascade: any[]; verified: boolean; confidence: number }> {
    try {
      const action = this.inferActionFromTarget(input);
      const targetKpi = this.extractTargetKpi(input);

      const causalInference = await this.causalEngine.inferCausalRelationship(action, targetKpi, {
        category: input.category,
        timeframe: input.timeframe,
        currentValue: input.currentValue,
        targetValue: input.targetValue,
      });

      // Find a linked verified opportunity from memory
      const opportunities = await this.memorySystem.retrieve({
        agent_id: 'opportunity',
        memory_type: 'semantic',
        limit: 5,
        organization_id: input.organizationId || undefined,
      });

      const linked = opportunities.find((o) => {
        const meta = o.metadata || {};
        const relatedActions = meta.relatedActions || meta.related_actions || [];
        const targetKpis = meta.targetKpis || meta.target_kpis || [];
        const verified = meta.verified === true || meta.verified === 'true';
        return verified && relatedActions.includes(action) && targetKpis.includes(targetKpi);
      });

      const impactCascade = [
        {
          action,
          targetKpi,
          effect: {
            direction: causalInference.effect.direction,
            magnitude: causalInference.effect.magnitude,
            confidence: causalInference.confidence,
          },
          linkedOpportunity: linked?.id,
        },
      ];

      return {
        impactCascade,
        verified: !!linked,
        confidence: causalInference.confidence,
      };
    } catch (err) {
      return { impactCascade: [], verified: false, confidence: 0 };
    }
  }

  private inferActionFromTarget(input: any): string {
    const categoryActions: Record<string, string> = {
      revenue: 'increase_revenue',
      cost: 'reduce_costs',
      efficiency: 'improve_efficiency',
      strategic: 'strategic_initiative',
      compliance: 'ensure_compliance',
    };

    return categoryActions[input.category] || 'business_improvement';
  }

  private extractTargetKpi(input: any): string {
    const kpiKeywords = ['revenue', 'cost', 'efficiency', 'productivity', 'satisfaction', 'retention'];
    const text = `${input.title} ${input.description || ''}`.toLowerCase();

    for (const keyword of kpiKeywords) {
      if (text.includes(keyword)) return keyword;
    }

    return 'business_metric';
  }
}
