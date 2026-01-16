/**
 * Opportunity Agent
 * Identifies and analyzes business opportunities
 */

import express from "express";
import { createServer, getConfig, logger, metrics } from "@valueos/agents/base";
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
  opportunities: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      confidence: z.number().min(0).max(1),
      category: z.string(),
      estimatedValue: z.number().optional(),
      timeframe: z.string().optional(),
    })
  ),
  analysis: z.string(),
  timestamp: z.string(),
});

type QueryResponse = z.infer<typeof ResponseSchema>;

/**
 * Mock LLM service for opportunity analysis
 * In production, this would integrate with actual LLM APIs
 */
class OpportunityAnalyzer {
  async analyzeOpportunities(
    query: string,
    context?: QueryRequest["context"]
  ): Promise<QueryResponse> {
    logger.info("Analyzing opportunities", { query, userId: context?.userId });

    // Simulate processing time
    await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 2000));

    // Mock analysis based on query keywords
    const opportunities = this.generateMockOpportunities(query);

    const analysis =
      `Based on the query "${query}", identified ${opportunities.length} potential opportunities. ` +
      "These opportunities were analyzed considering market trends, competitive landscape, and resource requirements.";

    return {
      opportunities,
      analysis,
      timestamp: new Date().toISOString(),
    };
  }

  private generateMockOpportunities(query: string): QueryResponse["opportunities"] {
    const keywords = query.toLowerCase();
    const opportunities: QueryResponse["opportunities"] = [];

    if (keywords.includes("market") || keywords.includes("expansion")) {
      opportunities.push({
        title: "Market Expansion Opportunity",
        description:
          "Identified potential for geographic market expansion based on customer demand analysis.",
        confidence: 0.85,
        category: "Growth",
        estimatedValue: 2500000,
        timeframe: "6-12 months",
      });
    }

    if (keywords.includes("product") || keywords.includes("innovation")) {
      opportunities.push({
        title: "Product Innovation Initiative",
        description:
          "New product development opportunity identified through customer feedback and trend analysis.",
        confidence: 0.78,
        category: "Innovation",
        estimatedValue: 1800000,
        timeframe: "3-6 months",
      });
    }

    if (keywords.includes("partnership") || keywords.includes("alliance")) {
      opportunities.push({
        title: "Strategic Partnership",
        description:
          "Potential partnership opportunity with complementary business for mutual growth.",
        confidence: 0.92,
        category: "Strategic",
        estimatedValue: 3200000,
        timeframe: "2-4 months",
      });
    }

    // Always include at least one opportunity
    if (opportunities.length === 0) {
      opportunities.push({
        title: "General Business Opportunity",
        description: "Identified opportunity for operational improvements and efficiency gains.",
        confidence: 0.65,
        category: "Operational",
        estimatedValue: 500000,
        timeframe: "1-3 months",
      });
    }

    return opportunities;
  }
}

// Initialize analyzer
const analyzer = new OpportunityAnalyzer();

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

    logger.info("Processing opportunity query", {
      query: validatedQuery.query,
      userId: validatedQuery.context?.userId,
    });

    // Process the query
    const result = await analyzer.analyzeOpportunities(
      validatedQuery.query,
      validatedQuery.context
    );

    // Record agent-specific metrics
    metrics.agentQueriesTotal.inc({ agent_type: "opportunity", status: "success" });
    metrics.agentQueryDuration.observe({ agent_type: "opportunity" }, Date.now() - startTime);

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
    metrics.agentQueriesTotal.inc({ agent_type: "opportunity", status: "error" });

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
    name: "opportunity-analyzer",
    check: async () => {
      // Check if analyzer is responsive
      try {
        await analyzer.analyzeOpportunities("health check");
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
const app = createServer({
  agentType: "opportunity",
  version: "1.0.0",
  customHealthChecks,
  middleware: [agentRoutes],
});

// Add agent-specific metrics
metrics.customMetrics.set("opportunity_analyzer_health", metrics.healthStatus);

// Start the server
createServer(app, config.PORT).catch((error) => {
  logger.error("Failed to start opportunity agent", error);
  process.exit(1);
});
