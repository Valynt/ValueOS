/**
 * Expansion Agent (Standalone Microservice)
 *
 * @deprecated This standalone Express-based agent uses mock data and is
 * superseded by the agent-fabric implementation at
 * packages/backend/src/lib/agent-fabric/agents/ExpansionAgent.ts
 * which uses secureInvoke, memory integration, and Zod validation.
 * This service will be removed in a future release.
 */

import express from "express";
import { createServer, startServer } from "@valueos/agent-base";
import { getConfig } from "@valueos/agent-base";
import { logger } from "@valueos/agent-base";
import { metrics } from "@valueos/agent-base";
import { z } from "zod";

// Agent-specific types
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
});

type QueryRequest = z.infer<typeof QuerySchema>;

const ResponseSchema = z.object({
  expansions: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      confidence: z.number().min(0).max(1),
      category: z.string(),
      priority: z.string(),
      timeframe: z.string().optional(),
    })
  ),
  analysis: z.string(),
  timestamp: z.string(),
});

type QueryResponse = z.infer<typeof ResponseSchema>;

/**
 * Mock LLM service for expansion analysis
 * In production, this would integrate with actual LLM APIs
 */
export class ExpansionAnalyzer {
  async analyzeExpansions(
    query: string,
    context?: QueryRequest["context"]
  ): Promise<QueryResponse> {
    logger.info("Analyzing expansions", { query, userId: context?.userId });

    // Simulate processing time
    await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 2000));

    // Mock analysis based on query keywords
    const expansions = this.generateMockExpansions(query);

    const analysis =
      `Based on the query "${query}", identified ${expansions.length} expansion opportunities. ` +
      "These strategies focus on sustainable growth through market penetration, diversification, and scaling operations.";

    return {
      expansions,
      analysis,
      timestamp: new Date().toISOString(),
    };
  }

  private generateMockExpansions(query: string): QueryResponse["expansions"] {
    const keywords = query.toLowerCase();
    const expansions: QueryResponse["expansions"] = [];

    if (keywords.includes("market") || keywords.includes("geographic")) {
      expansions.push({
        title: "Geographic Market Expansion",
        description:
          "Expand operations into adjacent geographic markets with similar customer profiles and regulatory environments.",
        confidence: 0.85,
        category: "Market Expansion",
        priority: "High",
        timeframe: "12-18 months",
      });
    }

    if (keywords.includes("product") || keywords.includes("diversification")) {
      expansions.push({
        title: "Product Line Diversification",
        description:
          "Develop complementary product lines to reduce dependency on core offerings and increase revenue streams.",
        confidence: 0.78,
        category: "Product Expansion",
        priority: "Medium",
        timeframe: "18-24 months",
      });
    }

    if (keywords.includes("customer") || keywords.includes("segment")) {
      expansions.push({
        title: "Customer Segment Expansion",
        description:
          "Target adjacent customer segments with similar needs but different buying patterns.",
        confidence: 0.82,
        category: "Customer Expansion",
        priority: "High",
        timeframe: "6-12 months",
      });
    }

    if (keywords.includes("channel") || keywords.includes("distribution")) {
      expansions.push({
        title: "Distribution Channel Expansion",
        description:
          "Develop additional sales and distribution channels to reach new customer segments.",
        confidence: 0.75,
        category: "Channel Expansion",
        priority: "Medium",
        timeframe: "9-15 months",
      });
    }

    // Always include at least one expansion
    if (expansions.length === 0) {
      expansions.push({
        title: "Operational Scaling Strategy",
        description:
          "Implement operational improvements to support increased business volume and market presence.",
        confidence: 0.7,
        category: "Operational Expansion",
        priority: "High",
        timeframe: "6-12 months",
      });
    }

    return expansions;
  }
}

// Initialize analyzer
const analyzer = new ExpansionAnalyzer();

// Create custom middleware for agent-specific routes
const agentRoutes = express.Router();

// Query endpoint
agentRoutes.post("/query", async (req: express.Request, res: express.Response) => {
  const startTime = Date.now();

  try {
    const validatedQuery = QuerySchema.parse(req.body);

    // Record metrics
    metrics.httpRequestsTotal.inc({ method: "POST", route: "/query" });
    const queryTimer = metrics.httpRequestDuration.startTimer({ method: "POST", route: "/query" });

    logger.info("Processing expansion query", {
      query: validatedQuery.query,
      userId: validatedQuery.context?.userId,
    });

    // Process the query
    const result = await analyzer.analyzeExpansions(validatedQuery.query, validatedQuery.context);

    // Record agent-specific metrics
    metrics.agentQueriesTotal.inc({ agent_type: "expansion", status: "success" });
    metrics.agentQueryDuration.observe({ agent_type: "expansion" }, Date.now() - startTime);

    queryTimer();

    res.json(result);
  } catch (error) {
    const duration = Date.now() - startTime;

    logger.error("Query processing failed", error, {
      duration,
      body: req.body,
    });

    // Record failure metrics
    metrics.httpRequestsTotal.inc({ method: "POST", route: "/query", status_code: "500" });
    metrics.agentQueriesTotal.inc({ agent_type: "expansion", status: "error" });

    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: "Invalid request format",
        details: error.errors,
      });
    } else {
      res.status(500).json({
        error: "Internal server error",
      });
    }
  }
});

// Health check with agent-specific checks
const customHealthChecks = [
  {
    name: "expansion-analyzer",
    check: async () => {
      // Check if analyzer is responsive
      try {
        await analyzer.analyzeExpansions("health check");
        return { status: "pass" as const };
      } catch (error) {
        return {
          status: "fail" as const,
          error: "Analyzer not responsive",
        };
      }
    },
    critical: true,
  },
];

// Create and start the server
const config = getConfig();
export const app = createServer({
  agentType: "expansion",
  version: "1.0.0",
  customHealthChecks,
  middleware: [agentRoutes],
});

// Add agent-specific metrics
metrics.customMetrics.set("expansion_analyzer_health", metrics.healthStatus);

// Start the server
startServer(app, config.PORT).catch((error: any) => {
  logger.error("Failed to start expansion agent", error);
  process.exit(1);
});
