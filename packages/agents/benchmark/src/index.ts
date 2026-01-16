/**
 * Benchmark Agent
 * Handles benchmarking, performance comparison, and competitive analysis
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
  benchmarks: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      confidence: z.number().min(0).max(1),
      category: z.string(),
      benchmark_type: z.string(),
      priority: z.string(),
    })
  ),
  analysis: z.string(),
  timestamp: z.string(),
});

type QueryResponse = z.infer<typeof ResponseSchema>;

/**
 * Mock LLM service for benchmark analysis
 * In production, this would integrate with actual LLM APIs
 */
class BenchmarkAnalyzer {
  async analyzeBenchmark(query: string, context?: QueryRequest["context"]): Promise<QueryResponse> {
    logger.info("Analyzing benchmark", { query, userId: context?.userId });

    // Simulate processing time
    await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 2000));

    // Mock analysis based on query keywords
    const benchmarks = this.generateMockBenchmarks(query);

    const analysis =
      `Based on the query "${query}", established ${benchmarks.length} benchmark frameworks. ` +
      "These benchmarks provide performance standards and competitive positioning insights.";

    return {
      benchmarks,
      analysis,
      timestamp: new Date().toISOString(),
    };
  }

  private generateMockBenchmarks(query: string): QueryResponse["benchmarks"] {
    const keywords = query.toLowerCase();
    const benchmarks: QueryResponse["benchmarks"] = [];

    if (keywords.includes("performance") || keywords.includes("kpi")) {
      benchmarks.push({
        title: "Performance Benchmark Framework",
        description:
          "Comprehensive performance benchmarking with KPI tracking, industry standards, and gap analysis.",
        confidence: 0.88,
        category: "Performance",
        benchmark_type: "KPI Framework",
        priority: "High",
      });
    }

    if (keywords.includes("competitive") || keywords.includes("competitor")) {
      benchmarks.push({
        title: "Competitive Benchmarking Analysis",
        description:
          "Competitive positioning analysis with market share tracking, feature comparison, and strategic gap identification.",
        confidence: 0.85,
        category: "Competitive",
        benchmark_type: "Market Comparison",
        priority: "High",
      });
    }

    if (keywords.includes("industry") || keywords.includes("standard")) {
      benchmarks.push({
        title: "Industry Standards Benchmarking",
        description:
          "Industry best practices benchmarking with compliance tracking and improvement roadmap development.",
        confidence: 0.82,
        category: "Industry",
        benchmark_type: "Standards Framework",
        priority: "Medium",
      });
    }

    if (keywords.includes("internal") || keywords.includes("process")) {
      benchmarks.push({
        title: "Internal Process Benchmarking",
        description:
          "Internal process benchmarking with efficiency metrics, bottleneck identification, and optimization targets.",
        confidence: 0.78,
        category: "Internal",
        benchmark_type: "Process Metrics",
        priority: "Medium",
      });
    }

    // Always include at least one benchmark
    if (benchmarks.length === 0) {
      benchmarks.push({
        title: "General Benchmarking Framework",
        description:
          "Comprehensive benchmarking framework with performance metrics, competitive analysis, and improvement tracking.",
        confidence: 0.75,
        category: "General",
        benchmark_type: "Multi-dimensional",
        priority: "Medium",
      });
    }

    return benchmarks;
  }
}

// Initialize analyzer
const analyzer = new BenchmarkAnalyzer();

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
