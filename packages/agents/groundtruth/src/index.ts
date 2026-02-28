/**
 * @deprecated This standalone microservice agent is deprecated.
 * Production agent implementations live in packages/backend/src/lib/agent-fabric/agents/.
 * This file will be removed in a future release. Do not add new code here.
 */
/**
 * Ground Truth Agent
 *
 * Fetches grounding data and evidence for value claims.
 * Classifies evidence into tiers and produces citations.
 * Uses LLMGateway for evidence retrieval and classification.
 */

import express from "express";
import { createServer, startServer } from "@valueos/agent-base";
import { getConfig } from "@valueos/agent-base";
import { logger } from "@valueos/agent-base";
import { metrics } from "@valueos/agent-base";
import { z } from "zod";
import { semanticMemory } from "@valueos/shared";

// ============================================================================
// Schemas
// ============================================================================

const QuerySchema = z.object({
  query: z.string(),
  context: z
    .object({
      userId: z.string().optional(),
      organizationId: z.string().optional(),
      sessionId: z.string().optional(),
      metadata: z.record(z.any()).optional(),
    })
    .optional(),
  idempotencyKey: z.string().uuid().optional(),
});

type QueryRequest = z.infer<typeof QuerySchema>;

const GroundtruthItemSchema = z.object({
  title: z.string(),
  description: z.string(),
  confidence: z.number().min(0).max(1),
  category: z.string(),
  verification_type: z.string(),
  priority: z.string(),
  evidence_tier: z.enum(['tier1', 'tier2', 'tier3']).optional(),
  source_url: z.string().optional(),
});

const ResponseSchema = z.object({
  groundtruths: z.array(GroundtruthItemSchema),
  analysis: z.string(),
  timestamp: z.string(),
});

type QueryResponse = z.infer<typeof ResponseSchema>;

// ============================================================================
// LLM Interface (dependency injection)
// ============================================================================

export interface GroundtruthLLMGateway {
  complete(request: {
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
    metadata: { tenantId: string; [key: string]: unknown };
  }): Promise<{
    content: string;
    usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  }>;
}

// ============================================================================
// System Prompt
// ============================================================================

const GROUNDTRUTH_SYSTEM_PROMPT = `You are a Ground Truth agent for a Value Engineering platform. Your role is to verify facts, validate claims against evidence, and assess data accuracy.

You will be provided with RETRIEVED CONTEXT from authoritative sources (SEC filings, web data). Use this context to verify the user's query.

For each request, perform evidence retrieval and classification. Identify the source type (EDGAR filing, analyst report, internal data, etc.) and assess reliability.

EVIDENCE TIERS:
- Tier 1: SEC EDGAR filings (10-K, 10-Q). Absolute truth.
- Tier 2: Market data, analyst reports, high-fidelity estimates.
- Tier 3: General web data, marketing claims.

You MUST respond with valid JSON matching this schema:
{
  "groundtruths": [
    {
      "title": "<verification title>",
      "description": "<findings and evidence details>",
      "confidence": <0.0-1.0 (Higher for Tier 1)>,
      "category": "<Verification|Truth|Source|Claim|General>",
      "verification_type": "<Fact Checking|Accuracy Assessment|Reliability Check|Validation Framework|Multi-method>",
      "priority": "<High|Medium|Low>",
      "evidence_tier": "tier1|tier2|tier3",
      "source_url": "<url or sec path>"
    }
  ],
  "analysis": "<overall evidence assessment referencing the tiers found>"
}

Be thorough in source attribution. Every claim should trace back to a verifiable source.`;

// ============================================================================
// GroundtruthAnalyzer
// ============================================================================

export class GroundtruthAnalyzer {
  private llmGateway: GroundtruthLLMGateway | null;

  constructor(llmGateway?: GroundtruthLLMGateway) {
    this.llmGateway = llmGateway ?? null;
  }

  async analyzeGroundtruth(
    query: string,
    context?: QueryRequest["context"],
    idempotencyKey?: string
  ): Promise<QueryResponse> {
    const tenantId = context?.organizationId ?? 'system';

    logger.info("Analyzing groundtruth with RAG", { query, userId: context?.userId });

    // 1. RAG Lookup
    let ragContext = '';
    try {
      const searchResults = await semanticMemory.search(query, {
        tenantId,
        limit: 10
      });

      if (searchResults.length > 0) {
        ragContext = searchResults
          .map((r: { entry: { metadata: Record<string, unknown>; content: string } }) => {
            const tier = r.entry.metadata.tier || 'tier3';
            return `[Source (${tier}): ${r.entry.metadata.source_url || 'Unknown'}]\n${r.entry.content}`;
          })
          .join('\n\n---\n\n');
        
        logger.info('Groundtruth RAG context retrieved', { chunks: searchResults.length });
      }
    } catch (ragErr) {
      logger.warn('Groundtruth RAG lookup failed, proceeding with hallucinated retrieval', { error: (ragErr as any).message });
    }

    if (!this.llmGateway) {
      logger.warn("No LLMGateway configured, using fallback response");
      return this.fallbackResponse(query);
    }

    const userPrompt = `
${ragContext ? `RETRIEVED CONTEXT:\n${ragContext}\n\n` : 'NO AUTHORITATIVE CONTEXT FOUND. USE GENERAL KNOWLEDGE BUT FLAG AS LOW CONFIDENCE.'}
USER QUERY: ${query}

Retrieve and verify evidence for the query above using the provided context where available.
`;

    const response = await this.llmGateway.complete({
      messages: [
        { role: 'system', content: GROUNDTRUTH_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      metadata: {
        tenantId,
        agentType: 'groundtruth',
        userId: context?.userId ?? 'system',
        sessionId: context?.sessionId,
        idempotencyKey,
      },
    });

    const parsed = this.parseResponse(response.content);

    if (response.usage) {
      metrics.agentQueryDuration.observe(
        { agent_type: "groundtruth" },
        response.usage.total_tokens
      );
    }

    return {
      ...parsed,
      timestamp: new Date().toISOString(),
    };
  }

  private parseResponse(content: string): Omit<QueryResponse, 'timestamp'> {
    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1]!;
    }

    try {
      const raw = JSON.parse(jsonStr);
      return ResponseSchema.omit({ timestamp: true }).parse(raw);
    } catch (err) {
      logger.error('Failed to parse Groundtruth LLM response', { error: (err as any).message, content });
      throw err;
    }
  }

  private fallbackResponse(query: string): QueryResponse {
    return {
      groundtruths: [
        {
          title: "General Truth Verification",
          description: `Evidence retrieval for: ${query}`,
          confidence: 0.5,
          category: "General",
          verification_type: "Multi-method",
          priority: "Medium",
        },
      ],
      analysis: `Fallback analysis for "${query}". LLMGateway not configured.`,
      timestamp: new Date().toISOString(),
    };
  }
}

// ============================================================================
// Server Setup
// ============================================================================

const analyzer = new GroundtruthAnalyzer();

const agentRoutes = express.Router();

agentRoutes.post("/query", async (req: express.Request, res: express.Response) => {
  const startTime = Date.now();

  try {
    const validatedQuery = QuerySchema.parse(req.body);

    metrics.httpRequestsTotal.inc({ method: "POST", route: "/query" });
    const queryTimer = metrics.httpRequestDuration.startTimer({ method: "POST", route: "/query" });

    logger.info("Processing groundtruth query", {
      query: validatedQuery.query,
      userId: validatedQuery.context?.userId,
    });

    const result = await analyzer.analyzeGroundtruth(
      validatedQuery.query,
      validatedQuery.context,
      validatedQuery.idempotencyKey
    );

    metrics.agentQueriesTotal.inc({ agent_type: "groundtruth", status: "success" });
    metrics.agentQueryDuration.observe({ agent_type: "groundtruth" }, Date.now() - startTime);

    queryTimer();
    res.json(result);
  } catch (error: unknown) {
    const duration = Date.now() - startTime;

    logger.error("Query processing failed", error, { duration, body: req.body });

    metrics.httpRequestsTotal.inc({ method: "POST", route: "/query", status_code: "500" });
    metrics.agentQueriesTotal.inc({ agent_type: "groundtruth", status: "error" });

    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid request format", details: error.errors });
    } else {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

const customHealthChecks = [
  {
    name: "groundtruth-analyzer",
    check: async () => {
      try {
        await analyzer.analyzeGroundtruth("health check");
        return { status: "pass" as const };
      } catch (error: unknown) {
        return { status: "fail" as const, error: "Analyzer not responsive" };
      }
    },
    critical: true,
  },
];

const config = getConfig();
const app = createServer({
  agentType: "groundtruth",
  version: "1.0.0",
  customHealthChecks,
  middleware: [agentRoutes],
});

metrics.customMetrics.set("groundtruth_analyzer_health", metrics.healthStatus);

startServer(app, config.PORT).catch((error: any) => {
  logger.error("Failed to start groundtruth agent", error);
  process.exit(1);
});