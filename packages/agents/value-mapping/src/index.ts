/**
 * @deprecated This standalone microservice agent is deprecated.
 * Production agent implementations live in packages/backend/src/lib/agent-fabric/agents/.
 * This file will be removed in a future release. Do not add new code here.
 */
/**
 * Value Mapping Agent
 * Analyzes value propositions, customer value, and business value mapping
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
  value_maps: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      confidence: z.number().min(0).max(1),
      category: z.string(),
      value_type: z.string(),
      priority: z.string(),
    })
  ),
  analysis: z.string(),
  timestamp: z.string(),
});

type QueryResponse = z.infer<typeof ResponseSchema>;

/**
 * Mock LLM service for value mapping analysis
 * In production, this would integrate with actual LLM APIs
 */
class ValueMappingAnalyzer {
  async analyzeValueMapping(
    query: string,
    context?: QueryRequest["context"]
  ): Promise<QueryResponse> {
    logger.info("Analyzing value mapping", { query, userId: context?.userId });

    // Simulate processing time
    await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 2000));

    // Mock analysis based on query keywords
    const value_maps = this.generateMockValueMaps(query);

    const analysis =
      `Based on the query "${query}", created ${value_maps.length} value maps. ` +
      "These mappings identify key value drivers, customer segments, and strategic value propositions.";

    return {
      value_maps,
      analysis,
      timestamp: new Date().toISOString(),
    };
  }

  private generateMockValueMaps(query: string): QueryResponse["value_maps"] {
    const keywords = query.toLowerCase();
    const value_maps: QueryResponse["value_maps"] = [];

    if (keywords.includes("customer") || keywords.includes("segment")) {
      value_maps.push({
        title: "Customer Value Segmentation Map",
        description:
          "Mapping of customer segments by value perception, willingness to pay, and loyalty drivers.",
        confidence: 0.88,
        category: "Customer Value",
        value_type: "Segmentation",
        priority: "High",
      });
    }

    if (keywords.includes("product") || keywords.includes("proposition")) {
      value_maps.push({
        title: "Value Proposition Mapping",
        description:
          "Analysis of product value propositions against customer needs and competitor offerings.",
        confidence: 0.85,
        category: "Product Value",
        value_type: "Proposition",
        priority: "High",
      });
    }

    if (keywords.includes("business") || keywords.includes("stakeholder")) {
      value_maps.push({
        title: "Business Value Network Map",
        description:
          "Mapping of value creation and capture across the business ecosystem and stakeholders.",
        confidence: 0.82,
        category: "Business Value",
        value_type: "Network",
        priority: "Medium",
      });
    }

    if (keywords.includes("economic") || keywords.includes("roi")) {
      value_maps.push({
        title: "Economic Value Mapping",
        description:
          "Quantification of economic value delivered to customers and created for the business.",
        confidence: 0.78,
        category: "Economic Value",
        value_type: "Quantification",
        priority: "Medium",
      });
    }

    // Always include at least one map
    if (value_maps.length === 0) {
      value_maps.push({
        title: "General Value Assessment Map",
        description: "Comprehensive mapping of value creation, delivery, and capture mechanisms.",
        confidence: 0.75,
        category: "General Value",
        value_type: "Assessment",
        priority: "Medium",
      });
    }

    return value_maps;
  }
}

// Initialize analyzer
const analyzer = new ValueMappingAnalyzer();

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

    logger.info("Processing value mapping query", {
      query: validatedQuery.query,
      userId: validatedQuery.context?.userId,
    });

    // Process the query
    const result = await analyzer.analyzeValueMapping(validatedQuery.query, validatedQuery.context);

    // Record agent-specific metrics
    metrics.agentQueriesTotal.inc({ agent_type: "value-mapping", status: "success" });
    metrics.agentQueryDuration.observe({ agent_type: "value-mapping" }, Date.now() - startTime);

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
    metrics.agentQueriesTotal.inc({ agent_type: "value-mapping", status: "error" });

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
    name: "value-mapping-analyzer",
    check: async () => {
      // Check if analyzer is responsive
      try {
        await analyzer.analyzeValueMapping("health check");
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
  agentType: "value-mapping",
  version: "1.0.0",
  customHealthChecks,
  middleware: [agentRoutes],
});

// Add agent-specific metrics
metrics.customMetrics.set("value_mapping_analyzer_health", metrics.healthStatus);

// Start the server
startServer(app, config.PORT).catch((error: any) => {
  logger.error("Failed to start value-mapping agent", error);
  process.exit(1);
});