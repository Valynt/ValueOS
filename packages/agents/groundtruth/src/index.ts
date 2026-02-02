/**
 * Groundtruth Agent
 * Handles fact verification, truth validation, and accuracy assessment
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
  groundtruths: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      confidence: z.number().min(0).max(1),
      category: z.string(),
      verification_type: z.string(),
      priority: z.string(),
    })
  ),
  analysis: z.string(),
  timestamp: z.string(),
});

type QueryResponse = z.infer<typeof ResponseSchema>;

/**
 * Mock LLM service for groundtruth analysis
 * In production, this would integrate with actual LLM APIs
 */
class GroundtruthAnalyzer {
  async analyzeGroundtruth(
    query: string,
    context?: QueryRequest["context"]
  ): Promise<QueryResponse> {
    logger.info("Analyzing groundtruth", { query, userId: context?.userId });

    // Simulate processing time
    await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 2000));

    // Mock analysis based on query keywords
    const groundtruths = this.generateMockGroundtruths(query);

    const analysis =
      `Based on the query "${query}", performed ${groundtruths.length} fact verification analyses. ` +
      "These assessments provide accuracy validation and truth confirmation.";

    return {
      groundtruths,
      analysis,
      timestamp: new Date().toISOString(),
    };
  }

  private generateMockGroundtruths(query: string): QueryResponse["groundtruths"] {
    const keywords = query.toLowerCase();
    const groundtruths: QueryResponse["groundtruths"] = [];

    if (keywords.includes("fact") || keywords.includes("verify")) {
      groundtruths.push({
        title: "Fact Verification Framework",
        description:
          "Comprehensive fact-checking methodology with source validation, cross-referencing, and accuracy assessment.",
        confidence: 0.88,
        category: "Verification",
        verification_type: "Fact Checking",
        priority: "High",
      });
    }

    if (keywords.includes("truth") || keywords.includes("accuracy")) {
      groundtruths.push({
        title: "Truth Assessment Protocol",
        description:
          "Truth validation protocol with bias detection, logical consistency checks, and evidence-based evaluation.",
        confidence: 0.85,
        category: "Truth",
        verification_type: "Accuracy Assessment",
        priority: "High",
      });
    }

    if (keywords.includes("source") || keywords.includes("reliability")) {
      groundtruths.push({
        title: "Source Reliability Analysis",
        description:
          "Source credibility assessment with reputation tracking, bias evaluation, and trustworthiness metrics.",
        confidence: 0.82,
        category: "Source",
        verification_type: "Reliability Check",
        priority: "Medium",
      });
    }

    if (keywords.includes("claim") || keywords.includes("validation")) {
      groundtruths.push({
        title: "Claim Validation Methodology",
        description:
          "Claim validation framework with evidence analysis, counter-argument consideration, and conclusion confidence.",
        confidence: 0.78,
        category: "Claim",
        verification_type: "Validation Framework",
        priority: "Medium",
      });
    }

    // Always include at least one groundtruth
    if (groundtruths.length === 0) {
      groundtruths.push({
        title: "General Truth Verification",
        description:
          "Comprehensive truth verification approach with multiple validation methods and confidence scoring.",
        confidence: 0.75,
        category: "General",
        verification_type: "Multi-method",
        priority: "Medium",
      });
    }

    return groundtruths;
  }
}

// Initialize analyzer
const analyzer = new GroundtruthAnalyzer();

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

    logger.info("Processing groundtruth query", {
      query: validatedQuery.query,
      userId: validatedQuery.context?.userId,
    });

    // Process the query
    const result = await analyzer.analyzeGroundtruth(validatedQuery.query, validatedQuery.context);

    // Record agent-specific metrics
    metrics.agentQueriesTotal.inc({ agent_type: "groundtruth", status: "success" });
    metrics.agentQueryDuration.observe({ agent_type: "groundtruth" }, Date.now() - startTime);

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
    metrics.agentQueriesTotal.inc({ agent_type: "groundtruth", status: "error" });

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
    name: "groundtruth-analyzer",
    check: async () => {
      // Check if analyzer is responsive
      try {
        await analyzer.analyzeGroundtruth("health check");
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
const app = createServer({
  agentType: "groundtruth",
  version: "1.0.0",
  customHealthChecks,
  middleware: [agentRoutes],
});

// Add agent-specific metrics
metrics.customMetrics.set("groundtruth_analyzer_health", metrics.healthStatus);

// Start the server
startServer(app, config.PORT).catch((error: any) => {
  logger.error("Failed to start groundtruth agent", error);
  process.exit(1);
});
