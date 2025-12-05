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

    const response = await this.llmGateway.complete([
      {
        role: 'system',
        content: 'You are an expert at mapping product features to business value. Create clear, logical value chains.'
      },
      {
        role: 'user',
        content: prompt
      }
    ], {
      temperature: 0.4,
      max_tokens: 2000
    });

    const parsed = this.extractJSON(response.content);

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
        { value_map: vm }
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
