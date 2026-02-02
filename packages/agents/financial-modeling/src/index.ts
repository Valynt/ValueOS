/**
 * Financial Modeling Agent
 * Analyzes financial models, projections, and valuations
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
  financial_models: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      confidence: z.number().min(0).max(1),
      category: z.string(),
      model_type: z.string(),
      priority: z.string(),
    })
  ),
  analysis: z.string(),
  timestamp: z.string(),
});

type QueryResponse = z.infer<typeof ResponseSchema>;

/**
 * Mock LLM service for financial modeling analysis
 * In production, this would integrate with actual LLM APIs
 */
export class FinancialModelingAnalyzer {
  async analyzeFinancialModels(
    query: string,
    context?: QueryRequest["context"]
  ): Promise<QueryResponse> {
    logger.info("Analyzing financial models", { query, userId: context?.userId });

    // Simulate processing time
    await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 2000));

    // Mock analysis based on query keywords
    const financial_models = this.generateMockFinancialModels(query);

    const analysis =
      `Based on the query "${query}", developed ${financial_models.length} financial models. ` +
      "These models provide projections, valuations, and ROI analysis for strategic decision-making.";

    return {
      financial_models,
      analysis,
      timestamp: new Date().toISOString(),
    };
  }

  private generateMockFinancialModels(query: string): QueryResponse["financial_models"] {
    const keywords = query.toLowerCase();
    const financial_models: QueryResponse["financial_models"] = [];

    if (keywords.includes("roi") || keywords.includes("return")) {
      financial_models.push({
        title: "ROI Projection Model",
        description:
          "Comprehensive ROI analysis with payback period calculations and sensitivity analysis.",
        confidence: 0.88,
        category: "Investment Analysis",
        model_type: "Cash Flow Model",
        priority: "High",
      });
    }

    if (keywords.includes("valuation") || keywords.includes("value")) {
      financial_models.push({
        title: "Business Valuation Model",
        description: "DCF-based valuation with multiple scenarios and comparable company analysis.",
        confidence: 0.85,
        category: "Valuation",
        model_type: "DCF Model",
        priority: "High",
      });
    }

    if (keywords.includes("budget") || keywords.includes("forecast")) {
      financial_models.push({
        title: "Financial Forecast Model",
        description:
          "Multi-year financial projections with revenue, expense, and cash flow forecasting.",
        confidence: 0.82,
        category: "Forecasting",
        model_type: "Budget Model",
        priority: "Medium",
      });
    }

    if (keywords.includes("risk") || keywords.includes("sensitivity")) {
      financial_models.push({
        title: "Risk Analysis Model",
        description: "Sensitivity analysis and scenario modeling for financial risk assessment.",
        confidence: 0.78,
        category: "Risk Analysis",
        model_type: "Monte Carlo Model",
        priority: "Medium",
      });
    }

    // Always include at least one model
    if (financial_models.length === 0) {
      financial_models.push({
        title: "General Financial Model",
        description:
          "Standard financial modeling framework for profitability and cash flow analysis.",
        confidence: 0.75,
        category: "General",
        model_type: "Financial Statement Model",
        priority: "Medium",
      });
    }

    return financial_models;
  }
}

// Initialize analyzer
const analyzer = new FinancialModelingAnalyzer();

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

    logger.info("Processing financial modeling query", {
      query: validatedQuery.query,
      userId: validatedQuery.context?.userId,
    });

    // Process the query
    const result = await analyzer.analyzeFinancialModels(
      validatedQuery.query,
      validatedQuery.context
    );

    // Record agent-specific metrics
    metrics.agentQueriesTotal.inc({ agent_type: "financial-modeling", status: "success" });
    metrics.agentQueryDuration.observe(
      { agent_type: "financial-modeling" },
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
    metrics.agentQueriesTotal.inc({ agent_type: "financial-modeling", status: "error" });

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
    name: "financial-modeling-analyzer",
    check: async () => {
      // Check if analyzer is responsive
      try {
        await analyzer.analyzeFinancialModels("health check");
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
  agentType: "financial-modeling",
  version: "1.0.0",
  customHealthChecks,
  middleware: [agentRoutes],
});

// Add agent-specific metrics
metrics.customMetrics.set("financial_modeling_analyzer_health", metrics.healthStatus);

// Start the server
startServer(app, config.PORT).catch((error: any) => {
  logger.error("Failed to start financial-modeling agent", error);
  process.exit(1);
});
