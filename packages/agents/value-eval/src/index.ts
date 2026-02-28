/**
 * @deprecated This standalone microservice agent is deprecated.
 * Production agent implementations live in packages/backend/src/lib/agent-fabric/agents/.
 * This file will be removed in a future release. Do not add new code here.
 */
/**
 * Value Eval Agent
 * Evaluates value creation, delivery, and capture mechanisms
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
  value_evaluations: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      confidence: z.number().min(0).max(1),
      category: z.string(),
      evaluation_type: z.string(),
      priority: z.string(),
    })
  ),
  analysis: z.string(),
  timestamp: z.string(),
});

type QueryResponse = z.infer<typeof ResponseSchema>;

/**
 * Mock LLM service for value evaluation analysis
 * In production, this would integrate with actual LLM APIs
 */
class ValueEvalAnalyzer {
  async analyzeValueEvaluation(
    query: string,
    context?: QueryRequest["context"]
  ): Promise<QueryResponse> {
    logger.info("Analyzing value evaluation", { query, userId: context?.userId });

    // Simulate processing time
    await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 2000));

    // Mock analysis based on query keywords
    const value_evaluations = this.generateMockValueEvaluations(query);

    const analysis =
      `Based on the query "${query}", performed ${value_evaluations.length} value evaluations. ` +
      "These assessments provide insights into value creation effectiveness and optimization opportunities.";

    return {
      value_evaluations,
      analysis,
      timestamp: new Date().toISOString(),
    };
  }

  private generateMockValueEvaluations(query: string): QueryResponse["value_evaluations"] {
    const keywords = query.toLowerCase();
    const value_evaluations: QueryResponse["value_evaluations"] = [];

    if (keywords.includes("performance") || keywords.includes("metrics")) {
      value_evaluations.push({
        title: "Value Creation Performance Assessment",
        description:
          "Comprehensive evaluation of value creation performance against established benchmarks and KPIs.",
        confidence: 0.88,
        category: "Performance",
        evaluation_type: "Performance Metrics",
        priority: "High",
      });
    }

    if (keywords.includes("efficiency") || keywords.includes("optimization")) {
      value_evaluations.push({
        title: "Value Delivery Efficiency Analysis",
        description:
          "Analysis of value delivery efficiency with identification of bottlenecks and optimization opportunities.",
        confidence: 0.85,
        category: "Efficiency",
        evaluation_type: "Process Analysis",
        priority: "High",
      });
    }

    if (keywords.includes("impact") || keywords.includes("roi")) {
      value_evaluations.push({
        title: "Value Impact Assessment",
        description:
          "Assessment of overall value impact including ROI analysis and stakeholder value realization.",
        confidence: 0.82,
        category: "Impact",
        evaluation_type: "Impact Analysis",
        priority: "Medium",
      });
    }

    if (keywords.includes("benchmark") || keywords.includes("comparison")) {
      value_evaluations.push({
        title: "Value Benchmarking Evaluation",
        description:
          "Benchmarking evaluation comparing value creation against industry standards and competitors.",
        confidence: 0.78,
        category: "Benchmarking",
        evaluation_type: "Comparative Analysis",
        priority: "Medium",
      });
    }

    // Always include at least one evaluation
    if (value_evaluations.length === 0) {
      value_evaluations.push({
        title: "Comprehensive Value Assessment",
        description:
          "Overall evaluation of value creation, delivery, and capture effectiveness across all dimensions.",
        confidence: 0.75,
        category: "Comprehensive",
        evaluation_type: "Full Assessment",
        priority: "Medium",
      });
    }

    return value_evaluations;
  }
}

// Initialize analyzer
const analyzer = new ValueEvalAnalyzer();

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

    logger.info("Processing value evaluation query", {
      query: validatedQuery.query,
      userId: validatedQuery.context?.userId,
    });

    // Process the query
    const result = await analyzer.analyzeValueEvaluation(
      validatedQuery.query,
      validatedQuery.context
    );

    // Record agent-specific metrics
    metrics.agentQueriesTotal.inc({ agent_type: "value-eval", status: "success" });
    metrics.agentQueryDuration.observe({ agent_type: "value-eval" }, Date.now() - startTime);

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
    metrics.agentQueriesTotal.inc({ agent_type: "value-eval", status: "error" });

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
    name: "value-eval-analyzer",
    check: async () => {
      // Check if analyzer is responsive
      try {
        await analyzer.analyzeValueEvaluation("health check");
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
  agentType: "value-eval",
  version: "1.0.0",
  customHealthChecks,
  middleware: [agentRoutes],
});

// Add agent-specific metrics
metrics.customMetrics.set("value_eval_analyzer_health", metrics.healthStatus);

// Start the server
startServer(app, config.PORT).catch((error: any) => {
  logger.error("Failed to start value-eval agent", error);
  process.exit(1);
});