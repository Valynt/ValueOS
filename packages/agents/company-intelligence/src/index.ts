/**
 * Company Intelligence Agent
 * Analyzes company intelligence and competitive landscape
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
  intelligence_reports: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      confidence: z.number().min(0).max(1),
      category: z.string(),
      source: z.string(),
      priority: z.string(),
    })
  ),
  analysis: z.string(),
  timestamp: z.string(),
});

type QueryResponse = z.infer<typeof ResponseSchema>;

/**
 * Mock LLM service for company intelligence analysis
 * In production, this would integrate with actual LLM APIs
 */
class CompanyIntelligenceAnalyzer {
  async analyzeCompanyIntelligence(
    query: string,
    context?: QueryRequest["context"]
  ): Promise<QueryResponse> {
    logger.info("Analyzing company intelligence", { query, userId: context?.userId });

    // Simulate processing time
    await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 2000));

    // Mock analysis based on query keywords
    const intelligence_reports = this.generateMockIntelligenceReports(query);

    const analysis =
      `Based on the query "${query}", gathered ${intelligence_reports.length} intelligence reports. ` +
      "These insights provide competitive analysis, market trends, and strategic recommendations.";

    return {
      intelligence_reports,
      analysis,
      timestamp: new Date().toISOString(),
    };
  }

  private generateMockIntelligenceReports(query: string): QueryResponse["intelligence_reports"] {
    const keywords = query.toLowerCase();
    const intelligence_reports: QueryResponse["intelligence_reports"] = [];

    if (keywords.includes("competitor") || keywords.includes("competition")) {
      intelligence_reports.push({
        title: "Competitor Strategy Analysis",
        description:
          "Analysis of competitor product launches, pricing strategies, and market positioning.",
        confidence: 0.88,
        category: "Competitive Intelligence",
        source: "Market Research",
        priority: "High",
      });
    }

    if (keywords.includes("market") || keywords.includes("trend")) {
      intelligence_reports.push({
        title: "Market Trend Intelligence",
        description:
          "Current market trends, emerging technologies, and industry shifts affecting the sector.",
        confidence: 0.82,
        category: "Market Intelligence",
        source: "Industry Reports",
        priority: "Medium",
      });
    }

    if (keywords.includes("customer") || keywords.includes("segment")) {
      intelligence_reports.push({
        title: "Customer Behavior Insights",
        description: "Analysis of customer preferences, buying patterns, and satisfaction metrics.",
        confidence: 0.85,
        category: "Customer Intelligence",
        source: "Survey Data",
        priority: "High",
      });
    }

    if (keywords.includes("regulatory") || keywords.includes("policy")) {
      intelligence_reports.push({
        title: "Regulatory Intelligence",
        description:
          "Monitoring of regulatory changes, compliance requirements, and policy impacts.",
        confidence: 0.78,
        category: "Regulatory Intelligence",
        source: "Government Sources",
        priority: "Medium",
      });
    }

    // Always include at least one report
    if (intelligence_reports.length === 0) {
      intelligence_reports.push({
        title: "General Industry Intelligence",
        description: "Overview of industry developments, key players, and strategic opportunities.",
        confidence: 0.75,
        category: "Industry Intelligence",
        source: "Multiple Sources",
        priority: "Medium",
      });
    }

    return intelligence_reports;
  }
}

// Initialize analyzer
const analyzer = new CompanyIntelligenceAnalyzer();

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

    logger.info("Processing company intelligence query", {
      query: validatedQuery.query,
      userId: validatedQuery.context?.userId,
    });

    // Process the query
    const result = await analyzer.analyzeCompanyIntelligence(
      validatedQuery.query,
      validatedQuery.context
    );

    // Record agent-specific metrics
    metrics.agentQueriesTotal.inc({ agent_type: "company-intelligence", status: "success" });
    metrics.agentQueryDuration.observe(
      { agent_type: "company-intelligence" },
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
    metrics.agentQueriesTotal.inc({ agent_type: "company-intelligence", status: "error" });

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
    name: "company-intelligence-analyzer",
    check: async () => {
      // Check if analyzer is responsive
      try {
        await analyzer.analyzeCompanyIntelligence("health check");
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
  agentType: "company-intelligence",
  version: "1.0.0",
  customHealthChecks,
  middleware: [agentRoutes],
});

// Add agent-specific metrics
metrics.customMetrics.set("company_intelligence_analyzer_health", metrics.healthStatus);

// Start the server
createServer(app, config.PORT).catch((error) => {
  logger.error("Failed to start company-intelligence agent", error);
  process.exit(1);
});
