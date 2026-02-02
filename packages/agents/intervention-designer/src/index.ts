/**
 * System Mapper Agent
 * Analyzes system architecture, dependencies, and component relationships
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
  system_maps: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      confidence: z.number().min(0).max(1),
      category: z.string(),
      map_type: z.string(),
      priority: z.string(),
    })
  ),
  analysis: z.string(),
  timestamp: z.string(),
});

type QueryResponse = z.infer<typeof ResponseSchema>;

/**
 * Mock LLM service for system mapping analysis
 * In production, this would integrate with actual LLM APIs
 */
class SystemMapperAnalyzer {
  async analyzeSystemMapping(
    query: string,
    context?: QueryRequest["context"]
  ): Promise<QueryResponse> {
    logger.info("Analyzing system mapping", { query, userId: context?.userId });

    // Simulate processing time
    await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 2000));

    // Mock analysis based on query keywords
    const system_maps = this.generateMockSystemMaps(query);

    const analysis =
      `Based on the query "${query}", created ${system_maps.length} system maps. ` +
      "These mappings provide insights into system architecture, dependencies, and component interactions.";

    return {
      system_maps,
      analysis,
      timestamp: new Date().toISOString(),
    };
  }

  private generateMockSystemMaps(query: string): QueryResponse["system_maps"] {
    const keywords = query.toLowerCase();
    const system_maps: QueryResponse["system_maps"] = [];

    if (keywords.includes("architecture") || keywords.includes("structure")) {
      system_maps.push({
        title: "System Architecture Map",
        description:
          "Visual representation of system components, their relationships, and data flow patterns.",
        confidence: 0.88,
        category: "Architecture",
        map_type: "Component Diagram",
        priority: "High",
      });
    }

    if (keywords.includes("dependency") || keywords.includes("relationship")) {
      system_maps.push({
        title: "Dependency Relationship Map",
        description:
          "Mapping of system dependencies, coupling levels, and integration points between components.",
        confidence: 0.85,
        category: "Dependencies",
        map_type: "Dependency Graph",
        priority: "High",
      });
    }

    if (keywords.includes("data") || keywords.includes("flow")) {
      system_maps.push({
        title: "Data Flow Architecture Map",
        description:
          "Analysis of data movement patterns, storage locations, and processing pipelines within the system.",
        confidence: 0.82,
        category: "Data Flow",
        map_type: "Data Flow Diagram",
        priority: "Medium",
      });
    }

    if (keywords.includes("security") || keywords.includes("risk")) {
      system_maps.push({
        title: "Security Architecture Map",
        description:
          "Mapping of security controls, threat vectors, and vulnerability assessment across system components.",
        confidence: 0.78,
        category: "Security",
        map_type: "Security Model",
        priority: "Medium",
      });
    }

    // Always include at least one map
    if (system_maps.length === 0) {
      system_maps.push({
        title: "General System Topology Map",
        description:
          "Comprehensive mapping of system topology including components, connections, and operational boundaries.",
        confidence: 0.75,
        category: "Topology",
        map_type: "System Overview",
        priority: "Medium",
      });
    }

    return system_maps;
  }
}

// Initialize analyzer
const analyzer = new SystemMapperAnalyzer();

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

    logger.info("Processing intervention design query", {
      query: validatedQuery.query,
      userId: validatedQuery.context?.userId,
    });

    // Process the query
    const result = await analyzer.analyzeInterventionDesign(
      validatedQuery.query,
      validatedQuery.context
    );

    // Record agent-specific metrics
    metrics.agentQueriesTotal.inc({ agent_type: "intervention-designer", status: "success" });
    metrics.agentQueryDuration.observe(
      { agent_type: "intervention-designer" },
      Date.now() - startTime
    );

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
    metrics.agentQueriesTotal.inc({ agent_type: "intervention-designer", status: "error" });

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
    name: "intervention-designer-analyzer",
    check: async () => {
      // Check if analyzer is responsive
      try {
        await analyzer.analyzeInterventionDesign("health check");
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
  agentType: "intervention-designer",
  version: "1.0.0",
  customHealthChecks,
  middleware: [agentRoutes],
});

// Add agent-specific metrics
metrics.customMetrics.set("intervention_designer_analyzer_health", metrics.healthStatus);

// Start the server
startServer(app, config.PORT).catch((error: any) => {
  logger.error("Failed to start intervention-designer agent", error);
  process.exit(1);
});
