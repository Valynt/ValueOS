/**
 * Research Agent
 * Handles research, data collection, and analytical studies
 */

import express from "express";
import { createServer, startServer, getConfig, logger, metrics } from "@valueos/agent-base";
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
  researches: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      confidence: z.number().min(0).max(1),
      category: z.string(),
      research_type: z.string(),
      priority: z.string(),
    })
  ),
  analysis: z.string(),
  timestamp: z.string(),
});

type QueryResponse = z.infer<typeof ResponseSchema>;

/**
 * Mock LLM service for research analysis
 * In production, this would integrate with actual LLM APIs
 */
export class ResearchAnalyzer {
  async analyzeResearch(query: string, context?: QueryRequest["context"]): Promise<QueryResponse> {
    logger.info("Analyzing research", { query, userId: context?.userId });

    // Simulate processing time
    await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 2000));

    // Mock analysis based on query keywords
    const researches = this.generateMockResearches(query);

    const analysis =
      `Based on the query "${query}", developed ${researches.length} research approaches. ` +
      "These methodologies provide structured data collection and analytical frameworks.";

    return {
      researches,
      analysis,
      timestamp: new Date().toISOString(),
    };
  }

  private generateMockResearches(query: string): QueryResponse["researches"] {
    const keywords = query.toLowerCase();
    const researches: QueryResponse["researches"] = [];

    if (keywords.includes("market") || keywords.includes("analysis")) {
      researches.push({
        title: "Market Research Methodology",
        description:
          "Comprehensive market analysis framework with data collection, segmentation, and competitive intelligence.",
        confidence: 0.88,
        category: "Market",
        research_type: "Analysis Framework",
        priority: "High",
      });
    }

    if (keywords.includes("survey") || keywords.includes("data")) {
      researches.push({
        title: "Data Collection and Survey Design",
        description:
          "Structured approach to data collection with survey design, sampling methodology, and validation techniques.",
        confidence: 0.85,
        category: "Data",
        research_type: "Collection Methodology",
        priority: "High",
      });
    }

    if (keywords.includes("trend") || keywords.includes("forecast")) {
      researches.push({
        title: "Trend Analysis and Forecasting",
        description:
          "Trend identification and forecasting methodology with statistical modeling and predictive analytics.",
        confidence: 0.82,
        category: "Trend",
        research_type: "Forecasting Model",
        priority: "Medium",
      });
    }

    if (keywords.includes("qualitative") || keywords.includes("interview")) {
      researches.push({
        title: "Qualitative Research Framework",
        description:
          "Qualitative research methodology with interview protocols, thematic analysis, and insight generation.",
        confidence: 0.78,
        category: "Qualitative",
        research_type: "Interview Framework",
        priority: "Medium",
      });
    }

    // Always include at least one research
    if (researches.length === 0) {
      researches.push({
        title: "General Research Methodology",
        description:
          "Comprehensive research framework combining quantitative and qualitative approaches for thorough investigation.",
        confidence: 0.75,
        category: "General",
        research_type: "Mixed Methods",
        priority: "Medium",
      });
    }

    return researches;
  }
}

// Initialize analyzer
const analyzer = new ResearchAnalyzer();

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

    logger.info("Processing research query", {
      query: validatedQuery.query,
      userId: validatedQuery.context?.userId,
    });

    // Process the query
    const result = await analyzer.analyzeResearch(validatedQuery.query, validatedQuery.context);

    // Record agent-specific metrics
    metrics.agentQueriesTotal.inc({ agent_type: "research", status: "success" });
    metrics.agentQueryDuration.observe({ agent_type: "research" }, Date.now() - startTime);

    queryTimer();

    res.json(result);
  } catch (error: unknown) {
    const duration = Date.now() - startTime;

    logger.error("Query processing failed", error, {
      duration,
      body: req.body,
    });

    // Record failure metrics
    metrics.httpRequestsTotal.inc({ method: "POST", route: "/query", status_code: "500" });
    metrics.agentQueriesTotal.inc({ agent_type: "research", status: "error" });

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
    name: "research-analyzer",
    check: async () => {
      // Check if analyzer is responsive
      try {
        await analyzer.analyzeResearch("health check");
        return { status: "pass" as const };
      } catch (error: unknown) {
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
  agentType: "research",
  version: "1.0.0",
  customHealthChecks,
  middleware: [agentRoutes],
});

// Add agent-specific metrics
metrics.customMetrics.set("research_analyzer_health", metrics.healthStatus);

// Start the server
startServer(app, config.PORT).catch((error: any) => {
  logger.error("Failed to start research agent", error);
  process.exit(1);
});
