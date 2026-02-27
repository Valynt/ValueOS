/**
 * Semantic Intent Middleware
 *
 * Replaces keyword-based agent routing with embedding-based intent classification.
 * Handles ambiguous intents by returning a clarification_needed response.
 * Stores successful classifications in semantic memory for future lookups.
 */

import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../lib/logger.js';
import type { AgentMiddleware, AgentMiddlewareContext, AgentResponse } from '../UnifiedAgentOrchestrator.js';
import type { AgentType } from '../agent-types.js';
import type { IntentCategory } from '../../types/intent.js';
import type {
  IntentGraph,
  IntentNode,
  IntentParameter,
  ClarificationPayload,
  HistoricalIntentMatch,
} from './types.js';
import type { EmbeddingService } from './EmbeddingService.js';
import type { VectorSearchService } from '../VectorSearchService.js';
import type { LLMGateway } from '../../lib/agent-fabric/LLMGateway.js';
import { supabase } from '../../lib/supabase.js';

// ============================================================================
// Configuration
// ============================================================================

export interface SemanticIntentConfig {
  /** Similarity threshold for historical match reuse. Default 0.85. */
  historicalMatchThreshold?: number;
  /** Ambiguity score above which clarification is requested. Default 0.4. */
  ambiguityThreshold?: number;
  /** Maximum historical matches to retrieve. Default 5. */
  maxHistoricalMatches?: number;
}

// ============================================================================
// Agent mapping from intent strings to AgentType
// ============================================================================

const INTENT_TO_AGENT: Record<string, AgentType> = {
  analyze_roi: 'financial-modeling',
  financial_modeling: 'financial-modeling',
  financial_analysis: 'financial-modeling',
  research_company: 'company-intelligence',
  company_intelligence: 'company-intelligence',
  research: 'research',
  benchmark: 'benchmark',
  industry_benchmark: 'benchmark',
  compare_industry: 'benchmark',
  system_mapping: 'system-mapper',
  map_system: 'system-mapper',
  design_intervention: 'intervention-designer',
  intervention: 'intervention-designer',
  outcome_engineering: 'outcome-engineer',
  predict_outcome: 'outcome-engineer',
  expansion: 'expansion',
  growth_strategy: 'expansion',
  opportunity: 'opportunity',
  value_opportunity: 'opportunity',
  narrative: 'narrative',
  create_narrative: 'narrative',
  present: 'narrative',
  coordinate: 'coordinator',
  value_evaluation: 'value-eval',
  integrity_check: 'integrity',
  target_definition: 'target',
  realization: 'realization',
};

function resolveAgentFromIntent(intent: string): AgentType | null {
  return INTENT_TO_AGENT[intent] ?? null;
}

// ============================================================================
// SemanticIntentMiddleware
// ============================================================================

export class SemanticIntentMiddleware implements AgentMiddleware {
  public readonly name = 'semantic_intent';

  private readonly embeddingService: EmbeddingService;
  private readonly vectorSearch: VectorSearchService;
  private readonly llmGateway: LLMGateway;
  private readonly config: Required<SemanticIntentConfig>;

  constructor(
    embeddingService: EmbeddingService,
    vectorSearch: VectorSearchService,
    llmGateway: LLMGateway,
    config: SemanticIntentConfig = {}
  ) {
    this.embeddingService = embeddingService;
    this.vectorSearch = vectorSearch;
    this.llmGateway = llmGateway;
    this.config = {
      historicalMatchThreshold: config.historicalMatchThreshold ?? 0.85,
      ambiguityThreshold: config.ambiguityThreshold ?? 0.4,
      maxHistoricalMatches: config.maxHistoricalMatches ?? 5,
    };
  }

  async execute(
    context: AgentMiddlewareContext,
    next: () => Promise<AgentResponse>
  ): Promise<AgentResponse> {
    // If the query includes clarification context, skip re-classification
    const clarificationCtx = (context.payload as Record<string, unknown> | undefined)?.clarification;
    if (clarificationCtx) {
      logger.info('SemanticIntentMiddleware: using clarification context, skipping classification', {
        traceId: context.traceId,
      });
      return next();
    }

    try {
      // 1. Generate embedding for the user query
      const embedding = await this.embeddingService.generateEmbedding(context.query);

      // 2. Query for historical intent matches
      const historicalResults = await this.vectorSearch.searchByEmbedding(embedding, {
        type: 'intent_classification' as any, // extended type
        threshold: this.config.historicalMatchThreshold,
        limit: this.config.maxHistoricalMatches,
        useCache: true,
      });

      // 3. If a high-confidence historical match exists, use it directly
      const topMatch = historicalResults[0];
      if (topMatch && topMatch.similarity >= this.config.historicalMatchThreshold) {
        const previousAgent = topMatch.memory.metadata?.agentType as AgentType | undefined;
        if (previousAgent) {
          logger.info('SemanticIntentMiddleware: using historical match', {
            traceId: context.traceId,
            agent: previousAgent,
            similarity: topMatch.similarity,
          });
          context.agentType = previousAgent;
          const response = await next();
          // Store successful execution
          void this.storeIntentClassification(embedding, previousAgent, context, true);
          return response;
        }
      }

      // 4. Classify via LLM
      const organizationId = context.envelope.organizationId;
      const intentGraph = await this.classifyIntent(context.query, embedding, historicalResults, organizationId);

      // 5. Check ambiguity
      if (
        intentGraph.ambiguityScore > this.config.ambiguityThreshold ||
        intentGraph.missingParameters.length > 0
      ) {
        logger.info('SemanticIntentMiddleware: requesting clarification', {
          traceId: context.traceId,
          ambiguityScore: intentGraph.ambiguityScore,
          missingParams: intentGraph.missingParameters.length,
        });

        const clarificationPayload: ClarificationPayload = {
          message: `I need a bit more information to help you effectively. Could you clarify the following?`,
          missingParameters: intentGraph.missingParameters,
          suggestedIntent: intentGraph.root.intent,
          confidence: intentGraph.root.confidence,
          originalQuery: context.query,
        };

        return {
          type: 'clarification_needed' as AgentResponse['type'],
          payload: clarificationPayload,
        };
      }

      // 6. Route to resolved agent
      if (intentGraph.resolvedAgent) {
        context.agentType = intentGraph.resolvedAgent;
      }

      const response = await next();

      // 7. Store successful classification
      void this.storeIntentClassification(
        embedding,
        intentGraph.resolvedAgent ?? context.agentType,
        context,
        response.type !== 'message' || !(response.payload as any)?.error
      );

      return response;
    } catch (error) {
      // On failure, fall through to existing keyword routing
      logger.warn('SemanticIntentMiddleware: classification failed, falling through', {
        traceId: context.traceId,
        error: error instanceof Error ? error.message : String(error),
      });
      return next();
    }
  }

  // --------------------------------------------------------------------------
  // Private helpers
  // --------------------------------------------------------------------------

  private async classifyIntent(
    query: string,
    _embedding: number[],
    historicalResults: Array<{ memory: any; similarity: number }>,
    organizationId: string
  ): Promise<IntentGraph> {
    const historicalContext = historicalResults
      .slice(0, 3)
      .map((r) => `- "${r.memory.content}" → agent: ${r.memory.metadata?.agentType}, similarity: ${r.similarity.toFixed(2)}`)
      .join('\n');

    const systemPrompt = `You are an intent classifier for a value engineering platform. Classify the user query into a structured intent graph.

Available agent types: opportunity, target, realization, expansion, integrity, company-intelligence, financial-modeling, value-mapping, system-mapper, intervention-designer, outcome-engineer, coordinator, value-eval, communicator, research, benchmark, narrative, groundtruth.

Available intent categories: navigation, query, action, creation, modification, deletion, analysis.

Respond with valid JSON only, no markdown fences:
{
  "intent": "string (snake_case intent name)",
  "confidence": number (0-1),
  "category": "string (one of the intent categories)",
  "parameters": [
    { "name": "string", "type": "string|number|enum|entity", "required": boolean, "value": any_or_null, "description": "string" }
  ],
  "secondaryIntent": "string|null",
  "secondaryConfidence": number (0-1, or 0 if none),
  "resolvedAgent": "string (agent type)|null"
}`;

    const userPrompt = `Query: "${query}"${historicalContext ? `\n\nHistorical matches:\n${historicalContext}` : ''}`;

    try {
      const llmResponse = await this.llmGateway.complete({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1,
        max_tokens: 512,
        metadata: { tenantId: organizationId, agentType: 'semantic_intent' } as any,
      });

      const parsed = JSON.parse(llmResponse.content);

      const missingParameters: IntentParameter[] = (parsed.parameters ?? []).filter(
        (p: IntentParameter) => p.required && (p.value === null || p.value === undefined)
      );

      // Compute ambiguity: based on confidence gap and missing params
      const confidenceGap = parsed.confidence - (parsed.secondaryConfidence ?? 0);
      const ambiguityFromGap = confidenceGap < 0.3 ? 0.6 : confidenceGap < 0.5 ? 0.3 : 0.1;
      const ambiguityFromParams = missingParameters.length > 0 ? 0.3 : 0;
      const ambiguityScore = Math.min(1, ambiguityFromGap + ambiguityFromParams);

      const resolvedAgent =
        resolveAgentFromIntent(parsed.intent) ??
        (parsed.resolvedAgent ? (parsed.resolvedAgent as AgentType) : null);

      const historicalMatches: HistoricalIntentMatch[] = historicalResults.map((r) => ({
        intentId: r.memory.id,
        similarity: r.similarity,
        previousAgent: r.memory.metadata?.agentType ?? 'unknown',
        wasSuccessful: r.memory.metadata?.wasSuccessful ?? false,
      }));

      const root: IntentNode = {
        id: uuidv4(),
        intent: parsed.intent,
        confidence: parsed.confidence,
        category: parsed.category as IntentCategory,
        parameters: parsed.parameters ?? [],
        children: [],
      };

      return {
        root,
        ambiguityScore,
        missingParameters,
        resolvedAgent,
        historicalMatches,
      };
    } catch (error) {
      logger.error('SemanticIntentMiddleware: LLM classification failed', {
        error: error instanceof Error ? error.message : String(error),
      });

      // Return a high-ambiguity fallback so the caller falls through
      return {
        root: {
          id: uuidv4(),
          intent: 'unknown',
          confidence: 0,
          category: 'query',
          parameters: [],
          children: [],
        },
        ambiguityScore: 0,
        missingParameters: [],
        resolvedAgent: null,
        historicalMatches: [],
      };
    }
  }

  private async storeIntentClassification(
    embedding: number[],
    agentType: AgentType,
    context: AgentMiddlewareContext,
    wasSuccessful: boolean
  ): Promise<void> {
    try {
      const organizationId = context.envelope.organizationId;
      await supabase.from('semantic_memory').insert({
        type: 'intent_classification',
        content: context.query,
        embedding,
        organization_id: organizationId,
        metadata: {
          agentType,
          wasSuccessful,
          userId: context.userId,
          tenant_id: organizationId,
          timestamp: new Date().toISOString(),
          tags: ['intent_classification'],
        },
      });
    } catch (error) {
      logger.warn('SemanticIntentMiddleware: failed to store intent classification', {
        traceId: context.traceId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
