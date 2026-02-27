import { 
  OpportunityAgentInterface, 
  FinancialModelingAgentInterface, 
  GroundTruthAgentInterface, 
  NarrativeAgentInterface,
  RedTeamLLMGateway
} from "@valueos/agents";
import { LLMGateway } from "../../lib/agent-fabric/LLMGateway.js";
import { logger } from "../../lib/logger.js";
import { z } from "zod";

/**
 * Adapter for RedTeamAgent to use the core LLMGateway.
 */
export class RedTeamLLMAdapter implements RedTeamLLMGateway {
  constructor(private llmGateway: LLMGateway) {}

  async complete(request: {
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
    metadata: { tenantId: string; [key: string]: unknown };
  }): Promise<{
    content: string;
    usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  }> {
    const response = await this.llmGateway.complete({
      messages: request.messages as any,
      metadata: request.metadata as any,
    });

    return {
      content: response.content,
      usage: response.usage,
    };
  }
}

<<<<<<< HEAD
// Shared LLM adapter used by all agent adapters below
class LLMAdapter {
  constructor(private llmGateway: LLMGateway) {}

  async complete(systemPrompt: string, userPrompt: string, metadata: Record<string, unknown>): Promise<string> {
    const response = await this.llmGateway.complete({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ] as any,
      metadata: metadata as any,
    });
    return response.content;
  }
}

function parseJsonResponse(content: string): unknown {
  let jsonStr = content;
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1]!;
  }
  return JSON.parse(jsonStr);
}

// ---- Zod schemas for adapter responses ----
=======
// ============================================================================
// System Prompts
// ============================================================================

const OPPORTUNITY_SYSTEM_PROMPT = `You are an Opportunity Discovery agent for a Value Engineering platform. Identify value drivers and opportunities from discovery signals.

You MUST respond with valid JSON matching this schema:
{
  "opportunities": [
    {
      "title": "<opportunity title>",
      "description": "<opportunity description>",
      "confidence": <0.0-1.0>,
      "category": "<Cost Reduction|Revenue Growth|Risk Mitigation|Efficiency|General>",
      "estimatedValue": <optional numeric estimate>
    }
  ],
  "analysis": "<summary analysis>"
}`;

const FINANCIAL_MODELING_SYSTEM_PROMPT = `You are a Financial Modeling agent for a Value Engineering platform. Build value trees and financial models from confirmed hypotheses.

You MUST respond with valid JSON matching this schema:
{
  "financial_models": [
    {
      "title": "<model title>",
      "description": "<model description>",
      "confidence": <0.0-1.0>,
      "category": "<Investment Analysis|Valuation|Forecasting|Risk Analysis|General>",
      "model_type": "<Cash Flow Model|DCF Model|Budget Model|Monte Carlo Model|Financial Statement Model>",
      "priority": "<High|Medium|Low>"
    }
  ],
  "analysis": "<summary analysis>"
}`;

const GROUNDTRUTH_SYSTEM_PROMPT = `You are a Ground Truth agent for a Value Engineering platform. Retrieve and verify evidence for value claims. Classify evidence into tiers.

Evidence tiers:
- Tier 1: EDGAR filings, 10-K/Q, customer-provided data (highest reliability)
- Tier 2: Gartner/Forrester, industry benchmarks (moderate reliability)
- Tier 3: Internal historical data, anonymized aggregates (lower reliability)

You MUST respond with valid JSON matching this schema:
{
  "groundtruths": [
    {
      "title": "<verification title>",
      "description": "<findings and evidence>",
      "confidence": <0.0-1.0>,
      "category": "<Verification|Truth|Source|Claim|General>",
      "verification_type": "<Fact Checking|Accuracy Assessment|Reliability Check|Validation Framework|Multi-method>",
      "priority": "<High|Medium|Low>"
    }
  ],
  "analysis": "<overall evidence assessment>"
}`;

const NARRATIVE_SYSTEM_PROMPT = `You are a Narrative Construction agent for a Value Engineering platform. Translate financial models and evidence into executive-ready business narratives.

You MUST respond with valid JSON matching this schema:
{
  "narratives": [
    {
      "title": "<narrative title>",
      "description": "<narrative content>",
      "confidence": <0.0-1.0>,
      "category": "<Storytelling|Content|Persuasive|Educational|General>",
      "narrative_type": "<Journey Framework|Brand Strategy|Argument Framework|Learning Framework|Multi-purpose>",
      "priority": "<High|Medium|Low>"
    }
  ],
  "analysis": "<summary of narrative strategy>"
}`;

// ============================================================================
// Response Schemas
// ============================================================================
>>>>>>> 607db465 (Co-authored-by: Ona <no-reply@ona.com>)

const OpportunityResponseSchema = z.object({
  opportunities: z.array(z.object({
    title: z.string(),
    description: z.string(),
    confidence: z.number().min(0).max(1),
    category: z.string(),
    estimatedValue: z.number().optional(),
  })),
  analysis: z.string(),
});

const FinancialModelResponseSchema = z.object({
  financial_models: z.array(z.object({
    title: z.string(),
    description: z.string(),
    confidence: z.number().min(0).max(1),
    category: z.string(),
    model_type: z.string(),
    priority: z.string(),
  })),
  analysis: z.string(),
});

const GroundtruthResponseSchema = z.object({
  groundtruths: z.array(z.object({
    title: z.string(),
    description: z.string(),
    confidence: z.number().min(0).max(1),
    category: z.string(),
    verification_type: z.string(),
    priority: z.string(),
  })),
  analysis: z.string(),
});

const NarrativeResponseSchema = z.object({
  narratives: z.array(z.object({
    title: z.string(),
    description: z.string(),
    confidence: z.number().min(0).max(1),
    category: z.string(),
    narrative_type: z.string(),
    priority: z.string(),
  })),
  analysis: z.string(),
});

<<<<<<< HEAD
/**
 * Adapter that routes HypothesisLoop agent calls through the backend LLMGateway.
 * Each method sends a domain-specific system prompt and Zod-validates the response.
=======
// ============================================================================
// Helpers
// ============================================================================

function parseJSON(content: string): unknown {
  let jsonStr = content;
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1]!;
  }
  return JSON.parse(jsonStr);
}

// ============================================================================
// AgentServiceAdapter
// ============================================================================

/**
 * Routes HypothesisLoop agent calls through the backend LLMGateway.
 * Each method sends a typed system prompt and Zod-validates the response.
>>>>>>> 607db465 (Co-authored-by: Ona <no-reply@ona.com>)
 */
export class AgentServiceAdapter implements 
  OpportunityAgentInterface, 
  FinancialModelingAgentInterface, 
  GroundTruthAgentInterface, 
  NarrativeAgentInterface {
  
  private llm: LLMAdapter;

<<<<<<< HEAD
  constructor(private llmGateway: LLMGateway) {
    this.llm = new LLMAdapter(llmGateway);
  }

  async analyzeOpportunities(
    query: string,
    context?: { organizationId?: string; userId?: string; sessionId?: string }
  ) {
    const tenantId = context?.organizationId ?? 'system';
    logger.info('AgentServiceAdapter: analyzeOpportunities', { query, tenantId });

    const content = await this.llm.complete(
      OPPORTUNITY_SYSTEM_PROMPT,
      `Identify value drivers and opportunities for: ${query}`,
      { tenantId, agentType: 'opportunity', userId: context?.userId ?? 'system' }
    );

    const parsed = OpportunityResponseSchema.parse(parseJsonResponse(content));
    return parsed;
  }

  async analyzeFinancialModels(
=======
  async analyzeOpportunities(
    query: string,
    context?: { organizationId?: string; userId?: string; sessionId?: string }
  ) {
    const tenantId = context?.organizationId ?? 'system';
    logger.info('AgentServiceAdapter: analyzeOpportunities', { query, tenantId });

    const response = await this.llmGateway.complete({
      messages: [
        { role: 'system', content: OPPORTUNITY_SYSTEM_PROMPT },
        { role: 'user', content: `Identify value drivers and opportunities for: ${query}` },
      ],
      metadata: {
        tenantId,
        agentType: 'opportunity',
        userId: context?.userId ?? 'system',
        sessionId: context?.sessionId,
      },
    });

    return OpportunityResponseSchema.parse(parseJSON(response.content));
  }

  async analyzeFinancialModels(
    query: string,
    context?: { organizationId?: string; userId?: string; sessionId?: string },
    idempotencyKey?: string
  ) {
    const tenantId = context?.organizationId ?? 'system';
    logger.info('AgentServiceAdapter: analyzeFinancialModels', { query, tenantId });

    const response = await this.llmGateway.complete({
      messages: [
        { role: 'system', content: FINANCIAL_MODELING_SYSTEM_PROMPT },
        { role: 'user', content: `Build financial models for: ${query}` },
      ],
      metadata: {
        tenantId,
        agentType: 'financial-modeling',
        userId: context?.userId ?? 'system',
        sessionId: context?.sessionId,
        idempotencyKey,
      },
    });

    return FinancialModelResponseSchema.parse(parseJSON(response.content));
  }

  async analyzeGroundtruth(
>>>>>>> 607db465 (Co-authored-by: Ona <no-reply@ona.com>)
    query: string,
    context?: { organizationId?: string; userId?: string; sessionId?: string },
    idempotencyKey?: string
  ) {
    const tenantId = context?.organizationId ?? 'system';
<<<<<<< HEAD
    logger.info('AgentServiceAdapter: analyzeFinancialModels', { query, tenantId });

    const content = await this.llm.complete(
      FINANCIAL_MODELING_SYSTEM_PROMPT,
      `Build financial models for: ${query}`,
      { tenantId, agentType: 'financial-modeling', userId: context?.userId ?? 'system', idempotencyKey }
    );

    const parsed = FinancialModelResponseSchema.parse(parseJsonResponse(content));
    return parsed;
  }

  async analyzeGroundtruth(
    query: string,
    context?: { organizationId?: string; userId?: string; sessionId?: string },
    idempotencyKey?: string
  ) {
    const tenantId = context?.organizationId ?? 'system';
    logger.info('AgentServiceAdapter: analyzeGroundtruth', { query, tenantId });

    const content = await this.llm.complete(
      GROUNDTRUTH_SYSTEM_PROMPT,
      `Retrieve and verify evidence for: ${query}`,
      { tenantId, agentType: 'groundtruth', userId: context?.userId ?? 'system', idempotencyKey }
    );

    const parsed = GroundtruthResponseSchema.parse(parseJsonResponse(content));
    return parsed;
  }

=======
    logger.info('AgentServiceAdapter: analyzeGroundtruth', { query, tenantId });

    const response = await this.llmGateway.complete({
      messages: [
        { role: 'system', content: GROUNDTRUTH_SYSTEM_PROMPT },
        { role: 'user', content: `Retrieve and verify evidence for: ${query}` },
      ],
      metadata: {
        tenantId,
        agentType: 'groundtruth',
        userId: context?.userId ?? 'system',
        sessionId: context?.sessionId,
        idempotencyKey,
      },
    });

    return GroundtruthResponseSchema.parse(parseJSON(response.content));
  }

>>>>>>> 607db465 (Co-authored-by: Ona <no-reply@ona.com>)
  async analyzeNarrative(
    query: string,
    context?: { organizationId?: string; userId?: string; sessionId?: string },
    idempotencyKey?: string
  ) {
    const tenantId = context?.organizationId ?? 'system';
    logger.info('AgentServiceAdapter: analyzeNarrative', { query, tenantId });

<<<<<<< HEAD
    const content = await this.llm.complete(
      NARRATIVE_SYSTEM_PROMPT,
      `Construct a business narrative for: ${query}`,
      { tenantId, agentType: 'narrative', userId: context?.userId ?? 'system', idempotencyKey }
    );

    const parsed = NarrativeResponseSchema.parse(parseJsonResponse(content));
    return parsed;
=======
    const response = await this.llmGateway.complete({
      messages: [
        { role: 'system', content: NARRATIVE_SYSTEM_PROMPT },
        { role: 'user', content: `Construct a business narrative for: ${query}` },
      ],
      metadata: {
        tenantId,
        agentType: 'narrative',
        userId: context?.userId ?? 'system',
        sessionId: context?.sessionId,
        idempotencyKey,
      },
    });

    return NarrativeResponseSchema.parse(parseJSON(response.content));
>>>>>>> 607db465 (Co-authored-by: Ona <no-reply@ona.com>)
  }
}

// ---- System prompts (matching the standalone agent prompts in packages/agents/) ----

const OPPORTUNITY_SYSTEM_PROMPT = `You are an Opportunity Discovery agent for a Value Engineering platform. Identify value drivers from discovery signals.

You MUST respond with valid JSON:
{
  "opportunities": [
    {
      "title": "<opportunity title>",
      "description": "<description>",
      "confidence": <0.0-1.0>,
      "category": "<category>",
      "estimatedValue": <optional number>
    }
  ],
  "analysis": "<summary>"
}`;

const FINANCIAL_MODELING_SYSTEM_PROMPT = `You are a Financial Modeling agent for a Value Engineering platform. Build Value Trees from confirmed hypotheses.

You MUST respond with valid JSON:
{
  "financial_models": [
    {
      "title": "<model title>",
      "description": "<description>",
      "confidence": <0.0-1.0>,
      "category": "<Investment Analysis|Valuation|Forecasting|Risk Analysis|General>",
      "model_type": "<Cash Flow Model|DCF Model|Budget Model|Monte Carlo Model|Financial Statement Model>",
      "priority": "<High|Medium|Low>"
    }
  ],
  "analysis": "<summary>"
}`;

const GROUNDTRUTH_SYSTEM_PROMPT = `You are a Ground Truth agent for a Value Engineering platform. Verify facts and retrieve evidence.

Evidence tiers:
- Tier 1: EDGAR filings, 10-K/Q, customer-provided data
- Tier 2: Gartner/Forrester, industry benchmarks
- Tier 3: Internal historical data, anonymized aggregates

You MUST respond with valid JSON:
{
  "groundtruths": [
    {
      "title": "<verification title>",
      "description": "<findings>",
      "confidence": <0.0-1.0>,
      "category": "<Verification|Truth|Source|Claim|General>",
      "verification_type": "<Fact Checking|Accuracy Assessment|Reliability Check|Validation Framework|Multi-method>",
      "priority": "<High|Medium|Low>"
    }
  ],
  "analysis": "<overall assessment>"
}`;

const NARRATIVE_SYSTEM_PROMPT = `You are a Narrative Construction agent for a Value Engineering platform. Translate financial models and evidence into executive-ready business narratives.

You MUST respond with valid JSON:
{
  "narratives": [
    {
      "title": "<narrative title>",
      "description": "<narrative content>",
      "confidence": <0.0-1.0>,
      "category": "<Storytelling|Content|Persuasive|Educational|General>",
      "narrative_type": "<Journey Framework|Brand Strategy|Argument Framework|Learning Framework|Multi-purpose>",
      "priority": "<High|Medium|Low>"
    }
  ],
  "analysis": "<summary>"
}`;
