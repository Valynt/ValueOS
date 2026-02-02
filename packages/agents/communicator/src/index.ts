/**
 * Communicator Agent
 * Handles communication, messaging, and stakeholder engagement
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
  communications: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      confidence: z.number().min(0).max(1),
      category: z.string(),
      communication_type: z.string(),
      priority: z.string(),
    })
  ),
  analysis: z.string(),
  timestamp: z.string(),
});

type QueryResponse = z.infer<typeof ResponseSchema>;

/**
 * Mock LLM service for communication analysis
 * In production, this would integrate with actual LLM APIs
 */
class CommunicatorAnalyzer {
  async analyzeCommunication(
    query: string,
    context?: QueryRequest["context"]
  ): Promise<QueryResponse> {
    logger.info("Analyzing communication", { query, userId: context?.userId });

    // Simulate processing time
    await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 2000));

    // Mock analysis based on query keywords
    const communications = this.generateMockCommunications(query);

    const analysis =
      `Based on the query "${query}", developed ${communications.length} communication strategies. ` +
      "These approaches optimize stakeholder engagement and message effectiveness.";

    return {
      communications,
      analysis,
      timestamp: new Date().toISOString(),
    };
  }

  private generateMockCommunications(query: string): QueryResponse["communications"] {
    const keywords = query.toLowerCase();
    const communications: QueryResponse["communications"] = [];

    if (keywords.includes("stakeholder") || keywords.includes("engagement")) {
      communications.push({
        title: "Stakeholder Communication Strategy",
        description:
          "Comprehensive stakeholder engagement plan with targeted messaging and feedback mechanisms.",
        confidence: 0.88,
        category: "Stakeholder",
        communication_type: "Engagement Plan",
        priority: "High",
      });
    }

    if (keywords.includes("messaging") || keywords.includes("message")) {
      communications.push({
        title: "Key Message Development Framework",
        description:
          "Framework for developing clear, compelling messages tailored to different audiences and channels.",
        confidence: 0.85,
        category: "Messaging",
        communication_type: "Message Framework",
        priority: "High",
      });
    }

    if (keywords.includes("channel") || keywords.includes("delivery")) {
      communications.push({
        title: "Multi-Channel Communication Plan",
        description:
          "Strategic plan for delivering messages across multiple channels with consistent branding and timing.",
        confidence: 0.82,
        category: "Channel",
        communication_type: "Delivery Strategy",
        priority: "Medium",
      });
    }

    if (keywords.includes("crisis") || keywords.includes("response")) {
      communications.push({
        title: "Crisis Communication Protocol",
        description:
          "Protocol for effective communication during crisis situations with rapid response and stakeholder management.",
        confidence: 0.78,
        category: "Crisis",
        communication_type: "Response Protocol",
        priority: "Medium",
      });
    }

    // Always include at least one communication
    if (communications.length === 0) {
      communications.push({
        title: "General Communication Framework",
        description:
          "Comprehensive communication framework for effective messaging, stakeholder engagement, and relationship building.",
        confidence: 0.75,
        category: "General",
        communication_type: "Communication Model",
        priority: "Medium",
      });
    }

    return communications;
  }
}

// Initialize analyzer
const analyzer = new CommunicatorAnalyzer();

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

    logger.info("Processing communication query", {
      query: validatedQuery.query,
      userId: validatedQuery.context?.userId,
    });

    // Process the query
    const result = await analyzer.analyzeCommunication(
      validatedQuery.query,
      validatedQuery.context
    );

    // Record agent-specific metrics
    metrics.agentQueriesTotal.inc({ agent_type: "communicator", status: "success" });
    metrics.agentQueryDuration.observe({ agent_type: "communicator" }, Date.now() - startTime);

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
    metrics.agentQueriesTotal.inc({ agent_type: "communicator", status: "error" });

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
    name: "communicator-analyzer",
    check: async () => {
      // Check if analyzer is responsive
      try {
        await analyzer.analyzeCommunication("health check");
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
  agentType: "communicator",
  version: "1.0.0",
  customHealthChecks,
  middleware: [agentRoutes],
});

// Add agent-specific metrics
metrics.customMetrics.set("communicator_analyzer_health", metrics.healthStatus);

// Start the server
startServer(app, config.PORT).catch((error: any) => {
  logger.error("Failed to start communicator agent", error);
  process.exit(1);
});
