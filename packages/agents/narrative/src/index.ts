/**
 * @deprecated This standalone microservice agent is deprecated.
 * Production agent implementations live in packages/backend/src/lib/agent-fabric/agents/.
 * This file will be removed in a future release. Do not add new code here.
 */
/**
 * Narrative Agent
 *
 * Translates financial models and evidence into executive-ready business narratives.
 * Uses LLMGateway for generation, Zod for validation, idempotency key support.
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

const NarrativeItemSchema = z.object({
  title: z.string(),
  description: z.string(),
  confidence: z.number().min(0).max(1),
  category: z.string(),
  narrative_type: z.string(),
  priority: z.string(),
});

const ResponseSchema = z.object({
  narratives: z.array(NarrativeItemSchema),
  analysis: z.string(),
  timestamp: z.string(),
});

type QueryResponse = z.infer<typeof ResponseSchema>;

// ============================================================================
// LLM Interface (dependency injection)
// ============================================================================

export interface NarrativeLLMGateway {
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

const NARRATIVE_SYSTEM_PROMPT = `You are a Narrative Construction agent for a Value Engineering platform. Your role is to translate financial models, value trees, and evidence into executive-ready business narratives.

For each request, produce narrative frameworks that tell a compelling, evidence-backed story.

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
}

Focus on clarity, evidence-backed claims, and executive-level communication.`;

/**
 * Build a domain-aware system prompt by appending glossary and compliance context.
 */
function buildDomainAwarePrompt(
  basePrompt: string,
  domainContext?: { glossary?: Record<string, string>; complianceRules?: string[] },
): string {
  if (!domainContext) return basePrompt;

  let suffix = '';
  if (domainContext.glossary && Object.keys(domainContext.glossary).length > 0) {
    suffix += '\n\nUse these domain-specific terms in your narratives:\n';
    for (const [neutral, domain] of Object.entries(domainContext.glossary)) {
      suffix += `- "${neutral}" → "${domain}"\n`;
    }
  }
  if (domainContext.complianceRules && domainContext.complianceRules.length > 0) {
    suffix += '\n\nEnsure narratives acknowledge these compliance requirements:\n';
    for (const rule of domainContext.complianceRules) {
      suffix += `- ${rule}\n`;
    }
  }
  return basePrompt + suffix;
}

// ============================================================================
// NarrativeAnalyzer
// ============================================================================

export class NarrativeAnalyzer {
  private llmGateway: NarrativeLLMGateway | null;

  constructor(llmGateway?: NarrativeLLMGateway) {
    this.llmGateway = llmGateway ?? null;
  }

  async analyzeNarrative(
    query: string,
    context?: QueryRequest["context"],
    idempotencyKey?: string
  ): Promise<QueryResponse> {
    const tenantId = context?.organizationId ?? 'system';

    logger.info("Analyzing narrative", { query, userId: context?.userId });

    if (!this.llmGateway) {
      logger.warn("No LLMGateway configured, using fallback response");
      return this.fallbackResponse(query);
    }

    // Build domain-aware prompt if context includes domain pack data
    const domainContext = context?.metadata as { glossary?: Record<string, string>; complianceRules?: string[] } | undefined;
    const systemPrompt = buildDomainAwarePrompt(NARRATIVE_SYSTEM_PROMPT, domainContext);

    const response = await this.llmGateway.complete({
      messages: [
        { role: 'system', content: systemPrompt },
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

    const parsed = this.parseResponse(response.content);

    if (response.usage) {
      metrics.agentQueryDuration.observe(
        { agent_type: "narrative" },
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
      narratives: [
        {
          title: "General Narrative Construction",
          description: `Narrative framework for: ${query}`,
          confidence: 0.5,
          category: "General",
          narrative_type: "Multi-purpose",
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

const analyzer = new NarrativeAnalyzer();

const agentRoutes = express.Router();

agentRoutes.post("/query", async (req: express.Request, res: express.Response) => {
  const startTime = Date.now();

  try {
    const validatedQuery = QuerySchema.parse(req.body);

    metrics.httpRequestsTotal.inc({ method: "POST", route: "/query" });
    const queryTimer = metrics.httpRequestDuration.startTimer({ method: "POST", route: "/query" });

    logger.info("Processing narrative query", {
      query: validatedQuery.query,
      userId: validatedQuery.context?.userId,
    });

    const result = await analyzer.analyzeNarrative(
      validatedQuery.query,
      validatedQuery.context,
      validatedQuery.idempotencyKey
    );

    metrics.agentQueriesTotal.inc({ agent_type: "narrative", status: "success" });
    metrics.agentQueryDuration.observe({ agent_type: "narrative" }, Date.now() - startTime);

    queryTimer();
    res.json(result);
  } catch (error: unknown) {
    const duration = Date.now() - startTime;

    logger.error("Query processing failed", error, { duration, body: req.body });

    metrics.httpRequestsTotal.inc({ method: "POST", route: "/query", status_code: "500" });
    metrics.agentQueriesTotal.inc({ agent_type: "narrative", status: "error" });

    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid request format", details: error.errors });
    } else {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

const customHealthChecks = [
  {
    name: "narrative-analyzer",
    check: async () => {
      try {
        await analyzer.analyzeNarrative("health check");
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
  agentType: "narrative",
  version: "1.0.0",
  customHealthChecks,
  middleware: [agentRoutes],
});

metrics.customMetrics.set("narrative_analyzer_health", metrics.healthStatus);

startServer(app, config.PORT).catch((error: any) => {
  logger.error("Failed to start narrative agent", error);
  process.exit(1);
});