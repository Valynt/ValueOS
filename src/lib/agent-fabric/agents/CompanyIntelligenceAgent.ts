import { BaseAgent } from './BaseAgent';
import { CompanyProfile } from '../types';

export interface CompanyIntelligenceInput {
  user_input: string;
  value_case_id: string;
}

export interface CompanyIntelligenceOutput {
  company_profile: Omit<CompanyProfile, 'id' | 'created_at' | 'updated_at'>;
}

export class CompanyIntelligenceAgent extends BaseAgent {
  async execute(
    sessionId: string,
    input: CompanyIntelligenceInput
  ): Promise<CompanyIntelligenceOutput> {
    const startTime = Date.now();

    const prompt = `You are a company intelligence analyst. Analyze the following user input and extract comprehensive company information.

USER INPUT:
${input.user_input}

Extract and structure the following information:
1. Company name
2. Industry and vertical
3. Company size (employees, revenue tier if mentioned)
4. Buyer persona (role, responsibilities, goals, challenges)
5. Pain points (current problems they're trying to solve)
6. Current state (existing tools, processes, challenges)

Return ONLY valid JSON in this exact format:
{
  "company_name": "<name>",
  "industry": "<industry>",
  "vertical": "<specific vertical>",
  "company_size": "<size description>",
  "buyer_persona": {
    "role": "<role>",
    "level": "<level>",
    "responsibilities": ["<resp1>", "<resp2>"],
    "goals": ["<goal1>", "<goal2>"],
    "challenges": ["<challenge1>", "<challenge2>"]
  },
  "pain_points": [
    {
      "category": "<category>",
      "description": "<description>",
      "severity": "<high|medium|low>",
      "impact": "<impact description>"
    }
  ],
  "current_state": {
    "existing_tools": ["<tool1>", "<tool2>"],
    "processes": ["<process1>", "<process2>"],
    "gaps": ["<gap1>", "<gap2>"]
  },
  "confidence_level": "<high|medium|low>",
  "reasoning": "<why you chose this classification and confidence level>"
}`;

    // SECURITY FIX: Use secureInvoke() for hallucination detection and circuit breaker
    const intelligenceSchema = z.object({
      company_profile: z.any(),
      key_stakeholders: z.array(z.any()),
      strategic_priorities: z.array(z.any()),
      decision_patterns: z.any(),
      confidence_level: z.enum(['high', 'medium', 'low']),
      reasoning: z.string(),
      hallucination_check: z.boolean().optional()
    });

    const secureResult = await this.secureInvoke(
      sessionId,
      prompt,
      intelligenceSchema,
      {
        trackPrediction: true,
        confidenceThresholds: { low: 0.5, high: 0.8 },
        context: {
          agent: 'CompanyIntelligenceAgent',
          companyId: input.companyId
        }
      }
    );

    const parsed = secureResult.result;
    const response = { content: JSON.stringify(parsed), tokens_used: 0, model: 'gpt-4' };

    const durationMs = Date.now() - startTime;

    await this.logMetric(sessionId, 'tokens_used', response.tokens_used, 'tokens');
    await this.logMetric(sessionId, 'latency_ms', durationMs, 'ms');
    await this.logPerformanceMetric(sessionId, 'company_intelligence_execute', durationMs, {
      fields_returned: Object.keys(parsed || {}).length,
    });

    await this.logExecution(
      sessionId,
      'company_intelligence_analysis',
      input,
      parsed,
      parsed.reasoning,
      parsed.confidence_level,
      [{
        type: 'llm_analysis',
        model: response.model,
        tokens: response.tokens_used
      }]
    );

    await this.memorySystem.storeSemanticMemory(
      sessionId,
      this.agentId,
      `Company: ${parsed.company_name} in ${parsed.industry} (${parsed.vertical})`,
      { company_profile: parsed },
      this.organizationId // SECURITY: Tenant isolation
    );

    return {
      company_profile: {
        value_case_id: input.value_case_id,
        company_name: parsed.company_name,
        industry: parsed.industry,
        vertical: parsed.vertical,
        company_size: parsed.company_size,
        buyer_persona: parsed.buyer_persona,
        pain_points: parsed.pain_points,
        current_state: parsed.current_state,
        confidence_level: parsed.confidence_level
      }
    };
  }
}
