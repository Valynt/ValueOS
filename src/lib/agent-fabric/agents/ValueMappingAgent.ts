import { BaseAgent } from './BaseAgent';
import { ValueMap } from '../types';

export interface ValueMappingInput {
  user_input: string;
  company_profile: any;
  value_case_id: string;
}

export interface ValueMappingOutput {
  value_maps: Omit<ValueMap, 'id' | 'created_at'>[];
}

export class ValueMappingAgent extends BaseAgent {
  async execute(
    sessionId: string,
    input: ValueMappingInput
  ): Promise<ValueMappingOutput> {
    const startTime = Date.now();

    const prompt = `You are a value mapping specialist. Create feature-to-outcome value chains.

USER INPUT:
${input.user_input}

COMPANY CONTEXT:
${JSON.stringify(input.company_profile, null, 2)}

Create at least 3-5 value chains that show how product features lead to business outcomes.
Each value chain should follow: Feature → Capability → Business Outcome → Value Driver

Return ONLY valid JSON in this format:
{
  "value_maps": [
    {
      "feature": "<specific product feature>",
      "capability": "<what this enables the user to do>",
      "business_outcome": "<measurable business result>",
      "value_driver": "<ultimate value category: cost_reduction, revenue_growth, risk_mitigation, or productivity_gain>",
      "confidence_level": "<high|medium|low>",
      "supporting_evidence": ["<evidence1>", "<evidence2>"]
    }
  ],
  "reasoning": "<explanation of value chain logic>"
}`;

    // SECURITY FIX: Use secureInvoke() for hallucination detection and circuit breaker
    const valueMappingSchema = z.object({
      value_mapping: z.any(),
      capability_impact: z.array(z.any()),
      outcome_correlations: z.any(),
      confidence_level: z.enum(['high', 'medium', 'low']),
      reasoning: z.string(),
      hallucination_check: z.boolean().optional()
    });

    const secureResult = await this.secureInvoke(
      sessionId,
      prompt,
      valueMappingSchema,
      {
        trackPrediction: true,
        confidenceThresholds: { low: 0.6, high: 0.85 },
        context: {
          agent: 'ValueMappingAgent',
          capabilities: input.capabilities?.length || 0
        }
      }
    );

    const parsed = secureResult.result;
    const response = { content: JSON.stringify(parsed), tokens_used: 0, model: 'gpt-4' };

    const durationMs = Date.now() - startTime;

    await this.logMetric(sessionId, 'tokens_used', response.tokens_used, 'tokens');
    await this.logMetric(sessionId, 'latency_ms', durationMs, 'ms');
    await this.logPerformanceMetric(sessionId, 'value_mapping_execute', durationMs, {
      value_maps: parsed.value_maps.length,
    });

    await this.logExecution(
      sessionId,
      'value_mapping',
      input,
      parsed,
      parsed.reasoning,
      'high',
      [{
        type: 'value_chain_analysis',
        chain_count: parsed.value_maps.length
      }]
    );

    for (const vm of parsed.value_maps) {
      await this.memorySystem.storeSemanticMemory(
        sessionId,
        this.agentId,
        `${vm.feature} drives ${vm.business_outcome}`,
        { value_map: vm },
        this.organizationId // SECURITY: Tenant isolation
      );
    }

    return {
      value_maps: parsed.value_maps.map((vm: any) => ({
        value_case_id: input.value_case_id,
        ...vm
      }))
    };
  }
}
