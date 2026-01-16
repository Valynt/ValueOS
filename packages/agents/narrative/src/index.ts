/**
 * Narrative Agent
 * Handles narrative construction, storytelling, and content creation
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
  narratives: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      confidence: z.number().min(0).max(1),
      category: z.string(),
      narrative_type: z.string(),
      priority: z.string(),
    })
  ),
  analysis: z.string(),
  timestamp: z.string(),
});

type QueryResponse = z.infer<typeof ResponseSchema>;

/**
 * Mock LLM service for narrative analysis
 * In production, this would integrate with actual LLM APIs
 */
class NarrativeAnalyzer {
  async analyzeNarrative(query: string, context?: QueryRequest["context"]): Promise<QueryResponse> {
    logger.info("Analyzing narrative", { query, userId: context?.userId });

    // Simulate processing time
    await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 2000));

    // Mock analysis based on query keywords
    const narratives = this.generateMockNarratives(query);

    const analysis =
      `Based on the query "${query}", constructed ${narratives.length} narrative frameworks. ` +
      "These narratives provide compelling storytelling and content creation strategies.";

    return {
      narratives,
      analysis,
      timestamp: new Date().toISOString(),
    };
  }

  private generateMockNarratives(query: string): QueryResponse["narratives"] {
    const keywords = query.toLowerCase();
    const narratives: QueryResponse["narratives"] = [];

    if (keywords.includes("story") || keywords.includes("storytelling")) {
      narratives.push({
        title: "Hero's Journey Narrative Framework",
        description:
          "Classic storytelling structure with character development, conflict resolution, and transformational arcs.",
        confidence: 0.88,
        category: "Storytelling",
        narrative_type: "Journey Framework",
        priority: "High",
      });
    }

    if (keywords.includes("content") || keywords.includes("marketing")) {
      narratives.push({
        title: "Brand Story Content Strategy",
        description:
          "Brand storytelling framework with audience engagement, emotional connection, and message consistency.",
        confidence: 0.85,
        category: "Content",
        narrative_type: "Brand Strategy",
        priority: "High",
      });
    }

    if (keywords.includes("persuasive") || keywords.includes("argument")) {
      narratives.push({
        title: "Persuasive Narrative Construction",
        description:
          "Persuasive storytelling with logical flow, emotional appeals, and call-to-action frameworks.",
        confidence: 0.82,
        category: "Persuasive",
        narrative_type: "Argument Framework",
        priority: "Medium",
      });
    }

    if (keywords.includes("educational") || keywords.includes("learning")) {
      narratives.push({
        title: "Educational Narrative Design",
        description:
          "Learning-focused storytelling with concept introduction, progression, and knowledge retention strategies.",
        confidence: 0.78,
        category: "Educational",
        narrative_type: "Learning Framework",
        priority: "Medium",
      });
    }

    // Always include at least one narrative
    if (narratives.length === 0) {
      narratives.push({
        title: "General Narrative Construction",
        description:
          "Comprehensive narrative framework with structure, pacing, and audience engagement techniques.",
        confidence: 0.75,
        category: "General",
        narrative_type: "Multi-purpose",
        priority: "Medium",
      });
    }

    return narratives;
  }
}

// Initialize analyzer
const analyzer = new NarrativeAnalyzer();

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

    logger.info("Processing benchmark query", {
      query: validatedQuery.query,
      userId: validatedQuery.context?.userId,
    });

    // Process the query
    const result = await analyzer.analyzeBenchmark(validatedQuery.query, validatedQuery.context);

    // Record agent-specific metrics
    metrics.agentQueriesTotal.inc({ agent_type: "benchmark", status: "success" });
    metrics.agentQueryDuration.observe({ agent_type: "benchmark" }, Date.now() - startTime);

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
    metrics.agentQueriesTotal.inc({ agent_type: "benchmark", status: "error" });

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
    name: "benchmark-analyzer",
    check: async () => {
      // Check if analyzer is responsive
      try {
        await analyzer.analyzeBenchmark("health check");
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
  agentType: "benchmark",
  version: "1.0.0",
  customHealthChecks,
  middleware: [agentRoutes],
});

// Add agent-specific metrics
metrics.customMetrics.set("benchmark_analyzer_health", metrics.healthStatus);

// Start the server
createServer(app, config.PORT).catch((error) => {
  logger.error("Failed to start benchmark agent", error);
  process.exit(1);
});
