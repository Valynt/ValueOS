/**
 * Integrity Agent
 * Analyzes system integrity, compliance, and security assessments
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
  integrity_checks: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      confidence: z.number().min(0).max(1),
      category: z.string(),
      priority: z.string(),
      status: z.string(),
    })
  ),
  analysis: z.string(),
  timestamp: z.string(),
});

type QueryResponse = z.infer<typeof ResponseSchema>;

/**
 * Mock LLM service for integrity analysis
 * In production, this would integrate with actual LLM APIs
 */
class IntegrityAnalyzer {
  async analyzeIntegrity(query: string, context?: QueryRequest["context"]): Promise<QueryResponse> {
    logger.info("Analyzing integrity", { query, userId: context?.userId });

    // Simulate processing time
    await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 2000));

    // Mock analysis based on query keywords
    const integrity_checks = this.generateMockIntegrityChecks(query);

    const analysis =
      `Based on the query "${query}", performed ${integrity_checks.length} integrity checks. ` +
      "These assessments ensure system reliability, compliance, and security standards are maintained.";

    return {
      integrity_checks,
      analysis,
      timestamp: new Date().toISOString(),
    };
  }

  private generateMockIntegrityChecks(query: string): QueryResponse["integrity_checks"] {
    const keywords = query.toLowerCase();
    const integrity_checks: QueryResponse["integrity_checks"] = [];

    if (keywords.includes("security") || keywords.includes("audit")) {
      integrity_checks.push({
        title: "Security Audit Assessment",
        description:
          "Comprehensive security audit to identify vulnerabilities and ensure compliance with security standards.",
        confidence: 0.92,
        category: "Security",
        priority: "High",
        status: "Pass",
      });
    }

    if (keywords.includes("compliance") || keywords.includes("regulation")) {
      integrity_checks.push({
        title: "Regulatory Compliance Check",
        description:
          "Verification of compliance with relevant industry regulations and data protection standards.",
        confidence: 0.88,
        category: "Compliance",
        priority: "High",
        status: "Pass",
      });
    }

    if (keywords.includes("data") || keywords.includes("integrity")) {
      integrity_checks.push({
        title: "Data Integrity Validation",
        description:
          "Validation of data consistency, accuracy, and protection against unauthorized modifications.",
        confidence: 0.85,
        category: "Data",
        priority: "High",
        status: "Pass",
      });
    }

    if (keywords.includes("system") || keywords.includes("reliability")) {
      integrity_checks.push({
        title: "System Reliability Assessment",
        description:
          "Assessment of system uptime, performance stability, and fault tolerance capabilities.",
        confidence: 0.78,
        category: "System",
        priority: "Medium",
        status: "Pass",
      });
    }

    // Always include at least one check
    if (integrity_checks.length === 0) {
      integrity_checks.push({
        title: "General Integrity Verification",
        description:
          "Overall integrity verification including security, compliance, and operational checks.",
        confidence: 0.7,
        category: "General",
        priority: "Medium",
        status: "Pass",
      });
    }

    return integrity_checks;
  }
}

// Initialize analyzer
const analyzer = new IntegrityAnalyzer();

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

    logger.info("Processing integrity query", {
      query: validatedQuery.query,
      userId: validatedQuery.context?.userId,
    });

    // Process the query
    const result = await analyzer.analyzeIntegrity(validatedQuery.query, validatedQuery.context);

    // Record agent-specific metrics
    metrics.agentQueriesTotal.inc({ agent_type: "integrity", status: "success" });
    metrics.agentQueryDuration.observe({ agent_type: "integrity" }, Date.now() - startTime);

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
    metrics.agentQueriesTotal.inc({ agent_type: "integrity", status: "error" });

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
    name: "integrity-analyzer",
    check: async () => {
      // Check if analyzer is responsive
      try {
        await analyzer.analyzeIntegrity("health check");
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
  agentType: "integrity",
  version: "1.0.0",
  customHealthChecks,
  middleware: [agentRoutes],
});

// Add agent-specific metrics
metrics.customMetrics.set("integrity_analyzer_health", metrics.healthStatus);

// Start the server
createServer(app, config.PORT).catch((error) => {
  logger.error("Failed to start integrity agent", error);
  process.exit(1);
});
