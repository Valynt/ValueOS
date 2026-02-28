/**
 * @deprecated This standalone microservice agent is deprecated.
 * Production agent implementations live in packages/backend/src/lib/agent-fabric/agents/.
 * This file will be removed in a future release. Do not add new code here.
 */
/**
 * Integrity Agent
 *
 * Validates value claims against evidence, performs integrity checks,
 * and produces confidence scores. Uses LLMGateway for analysis.
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

const IntegrityCheckSchema = z.object({
  title: z.string(),
  description: z.string(),
  confidence: z.number().min(0).max(1),
  category: z.string(),
  priority: z.string(),
  status: z.string(),
});

const ResponseSchema = z.object({
  integrity_checks: z.array(IntegrityCheckSchema),
  analysis: z.string(),
  timestamp: z.string(),
});

type QueryResponse = z.infer<typeof ResponseSchema>;

// ============================================================================
// LLM Interface (dependency injection)
// ============================================================================

export interface IntegrityLLMGateway {
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

const INTEGRITY_SYSTEM_PROMPT = `You are an Integrity Validation agent for a Value Engineering platform. Your role is to validate value claims against evidence, check data integrity, and assess confidence levels.

For each request, perform integrity checks covering data quality, source reliability, calculation accuracy, and compliance.

You MUST respond with valid JSON matching this schema:
{
  "integrity_checks": [
    {
      "title": "<check title>",
      "description": "<check description and findings>",
      "confidence": <0.0-1.0>,
      "category": "<Security|Compliance|Data|System|General>",
      "priority": "<High|Medium|Low>",
      "status": "<Pass|Fail|Warning>"
    }
  ],
  "analysis": "<overall integrity assessment>"
}

Be rigorous. Flag any claims that lack evidence or have questionable data sources.`;

// ============================================================================
// IntegrityAnalyzer
// ============================================================================

export class IntegrityAnalyzer {
  private llmGateway: IntegrityLLMGateway | null;

  constructor(llmGateway?: IntegrityLLMGateway) {
    this.llmGateway = llmGateway ?? null;
  }

  async analyzeIntegrity(
    query: string,
    context?: QueryRequest["context"],
    idempotencyKey?: string
  ): Promise<QueryResponse> {
    const tenantId = context?.organizationId ?? 'system';

    logger.info("Analyzing integrity", { query, userId: context?.userId });

    if (!this.llmGateway) {
      logger.warn("No LLMGateway configured, using fallback response");
      return this.fallbackResponse(query);
    }

    const response = await this.llmGateway.complete({
      messages: [
        { role: 'system', content: INTEGRITY_SYSTEM_PROMPT },
        { role: 'user', content: `Perform integrity validation for: ${query}` },
      ],
      metadata: {
        tenantId,
        agentType: 'integrity',
        userId: context?.userId ?? 'system',
        sessionId: context?.sessionId,
        idempotencyKey,
      },
    });

    const parsed = this.parseResponse(response.content);

    if (response.usage) {
      metrics.agentQueryDuration.observe(
        { agent_type: "integrity" },
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
      integrity_checks: [
        {
          title: "General Integrity Verification",
          description: `Integrity check for: ${query}`,
          confidence: 0.5,
          category: "General",
          priority: "Medium",
          status: "Warning",
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

const analyzer = new IntegrityAnalyzer();

const agentRoutes = express.Router();

agentRoutes.post("/query", async (req: express.Request, res: express.Response) => {
  const startTime = Date.now();

  try {
    const validatedQuery = QuerySchema.parse(req.body);

    metrics.httpRequestsTotal.inc({ method: "POST", route: "/query" });
    const queryTimer = metrics.httpRequestDuration.startTimer({ method: "POST", route: "/query" });

    logger.info("Processing integrity query", {
      query: validatedQuery.query,
      userId: validatedQuery.context?.userId,
    });

    const result = await analyzer.analyzeIntegrity(
      validatedQuery.query,
      validatedQuery.context,
      validatedQuery.idempotencyKey
    );

    metrics.agentQueriesTotal.inc({ agent_type: "integrity", status: "success" });
    metrics.agentQueryDuration.observe({ agent_type: "integrity" }, Date.now() - startTime);

    queryTimer();
    res.json(result);
  } catch (error) {
    const duration = Date.now() - startTime;

    logger.error("Query processing failed", error, { duration, body: req.body });

    metrics.httpRequestsTotal.inc({ method: "POST", route: "/query", status_code: "500" });
    metrics.agentQueriesTotal.inc({ agent_type: "integrity", status: "error" });

    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid request format", details: error.errors });
    } else {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

const customHealthChecks = [
  {
    name: "integrity-analyzer",
    check: async () => {
      try {
        await analyzer.analyzeIntegrity("health check");
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
  agentType: "integrity",
  version: "1.0.0",
  customHealthChecks,
  middleware: [agentRoutes],
});

metrics.customMetrics.set("integrity_analyzer_health", metrics.healthStatus);

startServer(app, config.PORT).catch((error: any) => {
  logger.error("Failed to start integrity agent", error);
  process.exit(1);
});