/**
 * Financial Modeling Agent
 *
 * Builds Value Trees from confirmed hypotheses using the LLMGateway.
 * Replaces mock data with structured LLM calls, Zod-validated output,
 * and idempotency key support.
 */

import express from "express";
import { createServer, startServer } from "@valueos/agent-base";
import { getConfig } from "@valueos/agent-base";
import { logger } from "@valueos/agent-base";
import { metrics } from "@valueos/agent-base";
import { z } from "zod";

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

const FinancialModelSchema = z.object({
  title: z.string(),
  description: z.string(),
  confidence: z.number().min(0).max(1),
  category: z.string(),
  model_type: z.string(),
  priority: z.string(),
});

const ResponseSchema = z.object({
  financial_models: z.array(FinancialModelSchema),
  analysis: z.string(),
  timestamp: z.string(),
});

type QueryResponse = z.infer<typeof ResponseSchema>;

// ============================================================================
// LLM Interface (dependency injection)
// ============================================================================

export interface FinancialModelingLLMGateway {
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

const FINANCIAL_MODELING_SYSTEM_PROMPT = `You are a Financial Modeling agent for a Value Engineering platform. Your role is to analyze financial queries and produce structured financial models.

For each query, produce financial models with projections, valuations, and ROI analysis.

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
  "analysis": "<summary analysis text>"
}

Be specific and quantitative. Base confidence scores on the quality and completeness of available data.`;

// ============================================================================
// FinancialModelingAnalyzer
// ============================================================================

export class FinancialModelingAnalyzer {
  private llmGateway: FinancialModelingLLMGateway | null;

  constructor(llmGateway?: FinancialModelingLLMGateway) {
    this.llmGateway = llmGateway ?? null;
  }

  async analyzeFinancialModels(
    query: string,
    context?: QueryRequest["context"],
    idempotencyKey?: string
  ): Promise<QueryResponse> {
    const tenantId = context?.organizationId ?? 'system';

    logger.info("Analyzing financial models", { query, userId: context?.userId });

    if (!this.llmGateway) {
      logger.warn("No LLMGateway configured, using fallback response");
      return this.fallbackResponse(query);
    }

    const response = await this.llmGateway.complete({
      messages: [
        { role: 'system', content: FINANCIAL_MODELING_SYSTEM_PROMPT },
        { role: 'user', content: `Analyze and build financial models for: ${query}` },
      ],
      metadata: {
        tenantId,
        agentType: 'financial-modeling',
        userId: context?.userId ?? 'system',
        sessionId: context?.sessionId,
        idempotencyKey,
      },
    });

    const parsed = this.parseResponse(response.content);

    if (response.usage) {
      metrics.agentQueryDuration.observe(
        { agent_type: "financial-modeling" },
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

    const raw = JSON.parse(jsonStr);
    return ResponseSchema.omit({ timestamp: true }).parse(raw);
  }

  private fallbackResponse(query: string): QueryResponse {
    return {
      financial_models: [
        {
          title: "General Financial Model",
          description: `Financial modeling framework for: ${query}`,
          confidence: 0.5,
          category: "General",
          model_type: "Financial Statement Model",
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

const analyzer = new FinancialModelingAnalyzer();

const agentRoutes = express.Router();

agentRoutes.post("/query", async (req: express.Request, res: express.Response) => {
  const startTime = Date.now();

  try {
    const validatedQuery = QuerySchema.parse(req.body);

    metrics.httpRequestsTotal.inc({ method: "POST", route: "/query" });
    const queryTimer = metrics.httpRequestDuration.startTimer({ method: "POST", route: "/query" });

    logger.info("Processing financial modeling query", {
      query: validatedQuery.query,
      userId: validatedQuery.context?.userId,
    });

    const result = await analyzer.analyzeFinancialModels(
      validatedQuery.query,
      validatedQuery.context,
      validatedQuery.idempotencyKey
    );

    metrics.agentQueriesTotal.inc({ agent_type: "financial-modeling", status: "success" });
    metrics.agentQueryDuration.observe(
      { agent_type: "financial-modeling" },
      Date.now() - startTime
    );

    queryTimer();
    res.json(result);
  } catch (error) {
    const duration = Date.now() - startTime;

    logger.error("Query processing failed", error, { duration, body: req.body });

    metrics.httpRequestsTotal.inc({ method: "POST", route: "/query", status_code: "500" });
    metrics.agentQueriesTotal.inc({ agent_type: "financial-modeling", status: "error" });

    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid request format", details: error.errors });
    } else {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

const customHealthChecks = [
  {
    name: "financial-modeling-analyzer",
    check: async () => {
      try {
        await analyzer.analyzeFinancialModels("health check");
        return { status: "pass" as const };
      } catch (error) {
        return { status: "fail" as const, error: "Analyzer not responsive" };
      }
    },
    critical: true,
  },
];

const config = getConfig();
const app = createServer({
  agentType: "financial-modeling",
  version: "1.0.0",
  customHealthChecks,
  middleware: [agentRoutes],
});

metrics.customMetrics.set("financial_modeling_analyzer_health", metrics.healthStatus);

startServer(app, config.PORT).catch((error: any) => {
  logger.error("Failed to start financial-modeling agent", error);
  process.exit(1);
});
