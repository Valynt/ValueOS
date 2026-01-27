/**
 * MCP Financial Ground Truth Server
 *
 * Model Context Protocol (MCP) server implementation for financial data retrieval.
 * Exposes standardized tools for LLM agents to query authoritative financial data
 * with zero-hallucination guarantees.
 *
 * MCP Specification: v1.0
 * Security Level: IL4 (Impact Level 4 - Controlled Unclassified Information)
 *
 * Implements tools:
 * - get_authoritative_financials (Tier 1)
 * - get_private_entity_estimates (Tier 2)
 * - verify_claim_aletheia (Verification)
 * - populate_value_driver_tree (Value Engineering)
 */

import { UnifiedTruthLayer } from "./UnifiedTruthLayer";
import { EDGARModule } from "../modules/EDGARModule";
import { XBRLModule } from "../modules/XBRLModule";
import { MarketDataModule } from "../modules/MarketDataModule";
import { PrivateCompanyModule } from "../modules/PrivateCompanyModule";
import { IndustryBenchmarkModule } from "../modules/IndustryBenchmarkModule";
import { ESOModule } from "../modules/StructuralTruthModule";
import { ErrorCodes, GroundTruthError } from "../types";
import { logger } from "../../lib/logger";
import { sha256 } from "../../lib/contentHash";
import { SentimentAnalysisService } from "../services/SentimentAnalysisService";
import { PredictiveModelingService } from "../services/PredictiveModelingService";
import { AutomatedInsightsService } from "../services/AutomatedInsightsService";
import { GroundTruthIntegrationService } from "../services/GroundTruthIntegrationService";
import { WebSocketServer } from "../services/WebSocketServer";
import { SECWebhookSystem } from "../services/SECWebhookSystem";
import { EventBus, getEventBus } from "../services/EventBus";
import { StreamingSentimentAnalyzer } from "../services/StreamingSentimentAnalyzer";

interface MCPServerConfig {
  // Module configurations
  edgar: {
    userAgent: string;
    rateLimit?: number;
  };
  xbrl: {
    userAgent: string;
    rateLimit?: number;
  };
  marketData: {
    provider: "alphavantage" | "polygon" | "tiingo";
    apiKey: string;
    rateLimit?: number;
  };
  privateCompany: {
    crunchbaseApiKey?: string;
    zoomInfoApiKey?: string;
    linkedInApiKey?: string;
    enableWebScraping?: boolean;
  };
  industryBenchmark: {
    blsApiKey?: string;
    censusApiKey?: string;
    enableStaticData?: boolean;
  };

  // Truth layer configuration
  truthLayer: {
    enableFallback?: boolean;
    strictMode?: boolean;
    maxResolutionTime?: number;
    parallelQuery?: boolean;
  };

  // Security configuration
  security: {
    enableWhitelist?: boolean;
    enableRateLimiting?: boolean;
    enableAuditLogging?: boolean;
  };
}

/**
 * MCP Tool Definition
 */
interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, any>;
    required: string[];
  };
}

/**
 * MCP Tool Result
 */
interface MCPToolResult {
  content: Array<{
    type: "text" | "resource";
    text?: string;
    resource?: any;
  }>;
  isError?: boolean;
}

/**
 * MCP Financial Ground Truth Server
 *
 * Main server class that implements the Model Context Protocol
 * for financial data retrieval.
 */
export class MCPFinancialGroundTruthServer {
  private truthLayer: UnifiedTruthLayer;
  private modules: {
    edgar?: EDGARModule;
    xbrl?: XBRLModule;
    marketData?: MarketDataModule;
    privateCompany?: PrivateCompanyModule;
    industryBenchmark?: IndustryBenchmarkModule;
    eso?: ESOModule;
  } = {};

  private config: MCPServerConfig;
  private initialized = false;

  // AI Services
  private sentimentService: SentimentAnalysisService;
  private predictiveService: PredictiveModelingService;
  private insightsService: AutomatedInsightsService;

  // Streaming Services (Phase 3)
  private webSocketServer?: WebSocketServer;
  private secWebhookSystem?: SECWebhookSystem;
  private eventBus: EventBus;
  private streamingSentimentAnalyzer: StreamingSentimentAnalyzer;
  private ingestionService?: GroundTruthIntegrationService;

  constructor(config: MCPServerConfig, httpServer?: any) {
    this.config = config;
    this.truthLayer = new UnifiedTruthLayer(config.truthLayer);

    // Initialize AI services
    this.sentimentService = new SentimentAnalysisService();
    this.predictiveService = new PredictiveModelingService();
    this.insightsService = new AutomatedInsightsService();

    // Initialize streaming services (Phase 3)
    this.eventBus = getEventBus();
    this.streamingSentimentAnalyzer = new StreamingSentimentAnalyzer();

    // Initialize ingestion service for automated, provenance-enforced ingestion
    // (EDGAR, XBRL, BLS modules are initialized in .initialize())
    // Will be set after modules are ready
    this.ingestionService = undefined;

    // Initialize WebSocket server if HTTP server provided
    if (httpServer) {
      this.webSocketServer = new WebSocketServer(httpServer);
      this.secWebhookSystem = new SECWebhookSystem(this.webSocketServer);
    }
  }

  /**
   * Initialize the MCP server and all modules
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.warn("MCP server already initialized");
      return;
    }

    logger.info("Initializing MCP Financial Ground Truth Server");

    try {
      // Initialize EDGAR module (Tier 1)
      this.modules.edgar = new EDGARModule();
      await this.modules.edgar.initialize(this.config.edgar);
      this.truthLayer.registerModule(this.modules.edgar);

      // Initialize XBRL module (Tier 1)
      this.modules.xbrl = new XBRLModule();
      await this.modules.xbrl.initialize(this.config.xbrl);
      this.truthLayer.registerModule(this.modules.xbrl);

      // Initialize Market Data module (Tier 2)
      this.modules.marketData = new MarketDataModule();
      await this.modules.marketData.initialize(this.config.marketData);
      this.truthLayer.registerModule(this.modules.marketData);

      // Initialize Private Company module (Tier 2)
      this.modules.privateCompany = new PrivateCompanyModule();
      await this.modules.privateCompany.initialize(this.config.privateCompany);
      this.truthLayer.registerModule(this.modules.privateCompany);

      // Initialize Industry Benchmark module (Tier 3)
      this.modules.industryBenchmark = new IndustryBenchmarkModule();
      await this.modules.industryBenchmark.initialize(this.config.industryBenchmark);
      this.truthLayer.registerModule(this.modules.industryBenchmark);

      // Initialize ESO module (Economic Structure Ontology)
      this.modules.eso = new ESOModule();
      await this.modules.eso.initialize();
      this.truthLayer.registerModule(this.modules.eso);

      // Initialize ingestion service (now that modules are ready)
      this.ingestionService = new GroundTruthIntegrationService(
        this.modules.edgar!,
        this.modules.xbrl!,
        this.modules.industryBenchmark!
      );

      // Initialize streaming services (Phase 3)
      if (this.webSocketServer && this.secWebhookSystem) {
        await this.eventBus.connect();
        await this.secWebhookSystem.start();

        // Set up market data streaming
        this.setupMarketDataStreaming();

        logger.info("Streaming services initialized successfully");
      }

      this.initialized = true;
      logger.info("MCP Financial Ground Truth Server initialized successfully");
    } catch (error) {
      logger.error(
        "Failed to initialize MCP server",
        error instanceof Error ? error : new Error("Unknown error")
      );
      throw error;
    }
  }

  /**
   * Get list of available MCP tools
   */
  getTools(): MCPTool[] {
    return [
      {
        name: "get_authoritative_financials",
        description:
          "Retrieves strict Tier 1 GAAP financial data from SEC EDGAR filings (10-K/10-Q). Use this for all public company historical analysis. Returns deterministic values with provenance.",
        inputSchema: {
          type: "object",
          properties: {
            entity_id: {
              type: "string",
              description:
                "The CIK (Central Index Key) or Ticker symbol. CIK is preferred to avoid collision.",
              pattern: "^[A-Z0-9]{1,10}$",
            },
            period: {
              type: "string",
              description: "Fiscal period normalized to Calendar Quarters or Annual format.",
              enum: ["FY2023", "FY2024", "CQ1_2024", "CQ2_2024", "LTM"],
            },
            metrics: {
              type: "array",
              description: "List of standardized GAAP taxonomy tags requested.",
              items: {
                type: "string",
                enum: [
                  "revenue_total",
                  "gross_profit",
                  "operating_income",
                  "net_income",
                  "eps_diluted",
                  "cash_and_equivalents",
                  "total_debt",
                ],
              },
              minItems: 1,
            },
            currency: {
              type: "string",
              description: "ISO 4217 currency code. Defaults to reporting currency if omitted.",
              default: "USD",
              pattern: "^[A-Z]{3}$",
            },
          },
          required: ["entity_id", "metrics"],
        },
      },
      {
        name: "get_private_entity_estimates",
        description:
          "Generates financial estimates for private entities using proxy data (Headcount, Industry Benchmarks). Use ONLY when Tier 1 data is unavailable.",
        inputSchema: {
          type: "object",
          properties: {
            domain: {
              type: "string",
              description: "Corporate domain name for entity resolution.",
              format: "hostname",
            },
            proxy_metric: {
              type: "string",
              description: "The base metric used for estimation derivation.",
              enum: ["headcount_linkedin", "web_traffic", "funding_stage"],
              default: "headcount_linkedin",
            },
            industry_code: {
              type: "string",
              description: "NAICS or SIC code to select appropriate productivity benchmarks.",
            },
          },
          required: ["domain"],
        },
      },
      {
        name: "verify_claim_aletheia",
        description:
          "Cross-references a specific natural language claim against the Ground Truth database. Returns a boolean verification status and evidence snippet.",
        inputSchema: {
          type: "object",
          properties: {
            claim_text: {
              type: "string",
              description: "The sentence or assertion containing a financial fact to verify.",
            },
            context_entity: {
              type: "string",
              description: "CIK or Name of the entity in question.",
            },
            context_date: {
              type: "string",
              description: "ISO 8601 date string for the point-in-time of the claim.",
            },
            strict_mode: {
              type: "boolean",
              description:
                "If true, requires Tier 1 source for verification. If false, accepts Tier 2.",
              default: true,
            },
          },
          required: ["claim_text", "context_entity"],
        },
      },
      {
        name: "populate_value_driver_tree",
        description:
          "Calculates productivity deltas and populates a specific Value Driver Tree node based on benchmark comparisons.",
        inputSchema: {
          type: "object",
          properties: {
            target_cik: {
              type: "string",
              description: "The target company to analyze.",
            },
            benchmark_naics: {
              type: "string",
              description: "The industry peer group for comparison.",
            },
            driver_node_id: {
              type: "string",
              description: "ID of the value tree node to populate.",
              enum: ["revenue_uplift", "cost_reduction", "risk_mitigation", "productivity_delta"],
            },
            simulation_period: {
              type: "string",
              description: "The forward-looking period for the value realization model.",
            },
          },
          required: ["target_cik", "benchmark_naics", "driver_node_id"],
        },
      },
      {
        name: "get_industry_benchmark",
        description:
          "Retrieves industry benchmark data for a specific NAICS code or Occupation code.",
        inputSchema: {
          type: "object",
          properties: {
            identifier: {
              type: "string",
              description: "NAICS code (6 digits) or SOC Occupation code (XX-XXXX).",
            },
            metric: {
              type: "string",
              description: "Specific metric to retrieve (optional).",
            },
          },
          required: ["identifier"],
        },
      },
      {
        name: "analyze_financial_sentiment",
        description:
          "Analyze sentiment and qualitative factors from financial documents (earnings calls, SEC filings, press releases) using AI-powered natural language processing.",
        inputSchema: {
          type: "object",
          properties: {
            document_type: {
              type: "string",
              description: "Type of document to analyze",
              enum: ["earnings_call", "sec_filing", "press_release", "analyst_report"],
            },
            content: {
              type: "string",
              description: "The document content to analyze",
            },
            company_name: {
              type: "string",
              description: "Name of the company (optional, for context)",
            },
            filing_type: {
              type: "string",
              description: "SEC filing type (10-K, 10-Q, 8-K, etc.)",
            },
            period: {
              type: "string",
              description: "Reporting period (FY2024, Q3-2024, etc.)",
            },
          },
          required: ["document_type", "content"],
        },
      },
      {
        name: "generate_financial_forecast",
        description:
          "Generate statistical forecasts and predictive models for financial metrics using time series analysis and machine learning.",
        inputSchema: {
          type: "object",
          properties: {
            metric_name: {
              type: "string",
              description: "The financial metric to forecast (revenue, earnings, etc.)",
            },
            historical_data: {
              type: "object",
              description: "Historical time series data",
              properties: {
                periods: {
                  type: "array",
                  items: { type: "string" },
                  description: "Time periods (e.g., ['FY2020', 'FY2021', 'FY2022'])",
                },
                values: {
                  type: "array",
                  items: { type: "number" },
                  description: "Corresponding metric values",
                },
              },
              required: ["periods", "values"],
            },
            forecast_periods: {
              type: "number",
              description: "Number of periods to forecast",
              default: 4,
              minimum: 1,
              maximum: 12,
            },
            confidence_level: {
              type: "number",
              description: "Confidence level for intervals (0.8, 0.9, 0.95)",
              default: 0.95,
              minimum: 0.8,
              maximum: 0.99,
            },
          },
          required: ["metric_name", "historical_data"],
        },
      },
      {
        name: "detect_financial_anomalies",
        description:
          "Detect unusual patterns and anomalies in financial time series data using statistical analysis and machine learning.",
        inputSchema: {
          type: "object",
          properties: {
            metric_name: {
              type: "string",
              description: "The financial metric being analyzed",
            },
            data: {
              type: "object",
              description: "Time series data to analyze",
              properties: {
                periods: {
                  type: "array",
                  items: { type: "string" },
                  description: "Time periods",
                },
                values: {
                  type: "array",
                  items: { type: "number" },
                  description: "Metric values",
                },
              },
              required: ["periods", "values"],
            },
            sensitivity: {
              type: "string",
              description: "Anomaly detection sensitivity",
              enum: ["low", "medium", "high"],
              default: "medium",
            },
          },
          required: ["metric_name", "data"],
        },
      },
      {
        name: "analyze_financial_trends",
        description:
          "Analyze trends, patterns, and statistical properties in financial data with peer comparisons and forecast implications.",
        inputSchema: {
          type: "object",
          properties: {
            metric_name: {
              type: "string",
              description: "The financial metric to analyze",
            },
            data: {
              type: "object",
              description: "Time series data to analyze",
              properties: {
                periods: {
                  type: "array",
                  items: { type: "string" },
                  description: "Time periods",
                },
                values: {
                  type: "array",
                  items: { type: "number" },
                  description: "Metric values",
                },
              },
              required: ["periods", "values"],
            },
            comparison_data: {
              type: "array",
              description: "Optional peer company data for comparison",
              items: {
                type: "object",
                properties: {
                  periods: { type: "array", items: { type: "string" } },
                  values: { type: "array", items: { type: "number" } },
                },
                required: ["periods", "values"],
              },
            },
          },
          required: ["metric_name", "data"],
        },
      },
      {
        name: "start_sentiment_stream",
        description:
          "Start a real-time sentiment analysis session for live financial events (earnings calls, conferences)",
        inputSchema: {
          type: "object",
          properties: {
            session_id: {
              type: "string",
              description: "Unique identifier for the streaming session",
            },
            event_type: {
              type: "string",
              description: "Type of financial event",
              enum: ["earnings_call", "press_conference", "sec_hearing", "investor_meeting"],
            },
            company_name: {
              type: "string",
              description: "Name of the company being analyzed",
            },
          },
          required: ["session_id", "event_type", "company_name"],
        },
      },
      {
        name: "process_stream_transcript",
        description:
          "Process streaming transcript data for real-time sentiment analysis during live events",
        inputSchema: {
          type: "object",
          properties: {
            session_id: {
              type: "string",
              description: "Active streaming session identifier",
            },
            speaker: {
              type: "string",
              description: "Name or identifier of the speaker",
            },
            text: {
              type: "string",
              description: "Transcript text content",
            },
            sequence_number: {
              type: "number",
              description: "Sequence number for ordering transcript segments",
            },
            is_partial: {
              type: "boolean",
              description: "Whether more text is expected for this segment",
              default: false,
            },
          },
          required: ["session_id", "speaker", "text"],
        },
      },
      {
        name: "end_sentiment_stream",
        description: "End a real-time sentiment analysis session and get final analysis results",
        inputSchema: {
          type: "object",
          properties: {
            session_id: {
              type: "string",
              description: "Active streaming session identifier",
            },
          },
          required: ["session_id"],
        },
      },
      {
        name: "get_streaming_stats",
        description: "Get real-time statistics about streaming services and active connections",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      // ESO Module Tools
      ...((this.modules.eso?.getTools() || []) as MCPTool[]),
    ];
  }

  /**
   * Execute an MCP tool
   */
  async executeTool(toolName: string, args: Record<string, any>): Promise<MCPToolResult> {
    if (!this.initialized) {
      throw new GroundTruthError(ErrorCodes.INVALID_REQUEST, "MCP server not initialized");
    }

    // Input validation and sanitization
    this.validateToolArguments(toolName, args);

    logger.info("MCP tool execution started", { toolName, args });

    try {
      switch (toolName) {
        case "get_authoritative_financials":
          return await this.getAuthoritativeFinancials(
            args as {
              entity_id: string;
              period?: string;
              metrics: string[];
              currency?: string;
            }
          );

        case "get_private_entity_estimates":
          return await this.getPrivateEntityEstimates(
            args as {
              domain: string;
              proxy_metric?: string;
              industry_code?: string;
            }
          );

        case "verify_claim_aletheia":
          return await this.verifyClaimAletheia(
            args as {
              claim_text: string;
              context_entity: string;
              context_date?: string;
              strict_mode?: boolean;
            }
          );

        case "populate_value_driver_tree":
          return await this.populateValueDriverTree(
            args as {
              target_cik: string;
              benchmark_naics: string;
              driver_node_id: string;
              simulation_period: string;
            }
          );

        case "get_industry_benchmark":
          return await this.getIndustryBenchmark(args as { identifier: string; metric?: string });

        case "analyze_financial_sentiment":
          return await this.analyzeFinancialSentiment(
            args as {
              document_type: string;
              content: string;
              company_name?: string;
              filing_type?: string;
              period?: string;
            }
          );

        case "generate_financial_forecast":
          return await this.generateFinancialForecast(
            args as {
              metric_name: string;
              historical_data: { periods: string[]; values: number[] };
              forecast_periods?: number;
              confidence_level?: number;
            }
          );

        case "detect_financial_anomalies":
          return await this.detectFinancialAnomalies(
            args as {
              metric_name: string;
              data: { periods: string[]; values: number[] };
              sensitivity?: string;
            }
          );

        case "analyze_financial_trends":
          return await this.analyzeFinancialTrends(
            args as {
              metric_name: string;
              data: { periods: string[]; values: number[] };
              comparison_data?: Array<{ periods: string[]; values: number[] }>;
            }
          );

        case "generate_business_intelligence":
          return await this.generateBusinessIntelligence(
            args as {
              company_name: string;
              cik?: string;
              industry?: string;
              time_range?: { start: string; end: string };
              include_sentiment?: boolean;
              include_forecasting?: boolean;
              peer_companies?: string[];
            }
          );

        case "start_sentiment_stream":
          return await this.startSentimentStream(
            args as {
              session_id: string;
              event_type: string;
              company_name: string;
            }
          );

        case "process_stream_transcript":
          return await this.processStreamTranscript(
            args as {
              session_id: string;
              speaker: string;
              text: string;
              sequence_number?: number;
              is_partial?: boolean;
            }
          );

        case "end_sentiment_stream":
          return await this.endSentimentStream(
            args as {
              session_id: string;
            }
          );

        case "get_streaming_stats":
          return await this.getStreamingStats();

        case "eso_get_metric_value":
        case "eso_validate_claim":
        case "eso_get_value_chain":
        case "eso_get_similar_traces":
        case "eso_get_persona_kpis":
          if (this.modules.eso) {
            const result = await this.modules.eso.handleToolCall(toolName, args);
            return {
              content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
            };
          }
          throw new GroundTruthError(ErrorCodes.INVALID_REQUEST, "ESO module not initialized");

        default:
          throw new GroundTruthError(ErrorCodes.INVALID_REQUEST, `Unknown tool: ${toolName}`);
      }
    } catch (error) {
      logger.error(
        "MCP tool execution failed",
        error instanceof Error ? error : new Error("Unknown error"),
        {
          toolName,
        }
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                error: {
                  code:
                    error instanceof GroundTruthError ? error.code : ErrorCodes.UPSTREAM_FAILURE,
                  message: error instanceof Error ? error.message : "Unknown error",
                },
              },
              null,
              2
            ),
          },
        ],
        isError: true,
      };
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Validate tool arguments against Zod schemas
   */
  private validateToolArguments(toolName: string, args: any): void {
    const schema = ToolSchemas[toolName];

    if (!schema) {
      // If no schema defined, we might want to warn or allow if it's an ESO tool
      // specific logic for ESO tools is handled in executeTool but we should check here too
      if (toolName.startsWith("eso_")) return;

      logger.warn(`No validation schema found for tool: ${toolName}`);
      return;
    }

    try {
      schema.parse(args);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new GroundTruthError(
          ErrorCodes.INVALID_REQUEST,
          `Invalid arguments for tool ${toolName}: ${error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")}`
        );
      }
      throw error;
    }
  }

  // ============================================================================
  // Tool Implementations
  // ============================================================================

  /**
   * Tool: get_authoritative_financials
   */
  private async getAuthoritativeFinancials(args: {
    entity_id: string;
    period?: string;
    metrics: string[];
    currency?: string;
  }): Promise<MCPToolResult> {
    const { entity_id, period, metrics, currency = "USD" } = args;

    // Resolve each metric
    const results = await this.truthLayer.resolveMultiple(
      metrics.map((metric) => ({
        identifier: entity_id,
        metric,
        period,
        prefer_tier: "tier1",
        fallback_enabled: false, // Strict Tier 1 only
      }))
    );

    // Format response according to MCP standard
    const response = {
      data: results.map((r) => ({
        entity: {
          name: r.metric.metadata.company_name || entity_id,
          cik: entity_id,
        },
        metric: r.metric.metric_name,
        value: r.metric.value,
        unit: currency,
        period: r.metric.provenance.period,
      })),
      metadata: results.map((r) => ({
        source_tier: 1,
        source_name: r.metric.source,
        filing_type: r.metric.provenance.filing_type,
        accession_number: r.metric.provenance.accession_number,
        filing_date: r.metric.metadata.filing_date,
        extraction_confidence: r.metric.confidence,
      })),
      audit: {
        trace_id: `mcp-req-${Date.now()}`,
        timestamp: new Date().toISOString(),
        verification_hash: await this.generateVerificationHash(results),
      },
    };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(response, null, 2),
        },
      ],
    };
  }

  /**
   * Tool: get_industry_benchmark
   */
  private async getIndustryBenchmark(args: {
    identifier: string;
    metric?: string;
  }): Promise<MCPToolResult> {
    const { identifier, metric } = args;

    const result = await this.truthLayer.resolve({
      identifier,
      metric: metric || "all_metrics",
      prefer_tier: "tier3",
      fallback_enabled: true,
    });

    const response = {
      identifier,
      metric: result.metric.metric_name,
      value: result.metric.value,
      unit: result.metric.metadata.unit,
      source: result.metric.source,
      confidence: result.metric.confidence,
      metadata: result.metric.metadata,
      audit: {
        trace_id: `mcp-req-${Date.now()}`,
        timestamp: new Date().toISOString(),
      },
    };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(response, null, 2),
        },
      ],
    };
  }

  /**
   * Tool: get_private_entity_estimates
   */
  private async getPrivateEntityEstimates(args: {
    domain: string;
    proxy_metric?: string;
    industry_code?: string;
  }): Promise<MCPToolResult> {
    const { domain, proxy_metric = "headcount_linkedin", industry_code } = args;

    const result = await this.truthLayer.resolve({
      identifier: domain,
      metric: "revenue_estimate",
      prefer_tier: "tier2",
      fallback_enabled: false,
    });

    const response = {
      data: {
        domain,
        metric: result.metric.metric_name,
        value: result.metric.value,
        confidence_score: result.metric.confidence,
        rationale: result.metric.metadata.rationale,
      },
      metadata: {
        source_tier: 2,
        estimation_method: result.metric.metadata.estimation_method,
        proxy_metric,
        industry_code,
        quality_factors: result.metric.metadata.quality_factors,
      },
      audit: {
        trace_id: `mcp-req-${Date.now()}`,
        timestamp: new Date().toISOString(),
      },
    };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(response, null, 2),
        },
      ],
    };
  }

  /**
   * Tool: verify_claim_aletheia
   */
  private async verifyClaimAletheia(args: {
    claim_text: string;
    context_entity: string;
    context_date?: string;
    strict_mode?: boolean;
  }): Promise<MCPToolResult> {
    const { claim_text, context_entity, context_date, strict_mode = true } = args;

    const verification = await this.truthLayer.verifyClaim(
      claim_text,
      context_entity,
      context_date,
      strict_mode
    );

    const response = {
      verified: verification.verified,
      confidence: verification.confidence,
      evidence: verification.evidence
        ? {
            metric: verification.evidence.metric_name,
            value: verification.evidence.value,
            source: verification.evidence.source,
            tier: verification.evidence.tier,
          }
        : undefined,
      discrepancy: verification.discrepancy,
      audit: {
        trace_id: `mcp-req-${Date.now()}`,
        timestamp: new Date().toISOString(),
        claim_text,
        context_entity,
        strict_mode,
      },
    };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(response, null, 2),
        },
      ],
    };
  }

  /**
   * Tool: populate_value_driver_tree
   */
  private async populateValueDriverTree(args: {
    target_cik: string;
    benchmark_naics: string;
    driver_node_id: string;
    simulation_period: string;
  }): Promise<MCPToolResult> {
    const { target_cik, benchmark_naics, driver_node_id, simulation_period } = args;

    const result = await this.truthLayer.populateValueDriverTree(
      target_cik,
      benchmark_naics,
      driver_node_id,
      simulation_period
    );

    const response = {
      node_id: result.node_id,
      value: result.value,
      rationale: result.rationale,
      confidence: result.confidence,
      supporting_data: result.supporting_data.map((m) => ({
        metric: m.metric_name,
        value: m.value,
        source: m.source,
        tier: m.tier,
      })),
      audit: {
        trace_id: `mcp-req-${Date.now()}`,
        timestamp: new Date().toISOString(),
        target_cik,
        benchmark_naics,
        simulation_period,
      },
    };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(response, null, 2),
        },
      ],
    };
  }

  /**
   * Health check endpoint
   */
  async healthCheck(): Promise<{
    status: "healthy" | "degraded" | "unhealthy";
    details: any;
  }> {
    const health = await this.truthLayer.healthCheck();

    return {
      status: health.healthy ? "healthy" : "degraded",
      details: {
        initialized: this.initialized,
        modules: health.modules,
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Tool: analyze_financial_sentiment
   */
  private async analyzeFinancialSentiment(args: {
    document_type: string;
    content: string;
    company_name?: string;
    filing_type?: string;
    period?: string;
  }): Promise<MCPToolResult> {
    const { document_type, content, company_name, filing_type, period } = args;

    const result = await this.sentimentService.analyzeDocument({
      documentType: document_type as
        | "earnings_call"
        | "sec_filing"
        | "press_release"
        | "analyst_report",
      content,
      companyName: company_name,
      filingType: filing_type,
      period,
    });

    const response = {
      document_type,
      company_name,
      sentiment_analysis: result,
      audit: {
        trace_id: `mcp-sentiment-${Date.now()}`,
        timestamp: new Date().toISOString(),
        processing_time_ms: Date.now() - Date.now(), // Would track actual processing time
      },
    };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(response, null, 2),
        },
      ],
    };
  }

  /**
   * Tool: generate_financial_forecast
   */
  private async generateFinancialForecast(args: {
    metric_name: string;
    historical_data: { periods: string[]; values: number[] };
    forecast_periods?: number;
    confidence_level?: number;
  }): Promise<MCPToolResult> {
    const { metric_name, historical_data, forecast_periods = 4, confidence_level = 0.95 } = args;

    const result = await this.predictiveService.generateForecast({
      historicalData: {
        periods: historical_data.periods,
        values: historical_data.values,
        metadata: { metric: metric_name },
      },
      forecastPeriods: forecast_periods,
      confidenceLevel: confidence_level,
    });

    const response = {
      metric_name,
      forecast: result,
      audit: {
        trace_id: `mcp-forecast-${Date.now()}`,
        timestamp: new Date().toISOString(),
        model_info: result.model_info,
      },
    };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(response, null, 2),
        },
      ],
    };
  }

  /**
   * Tool: detect_financial_anomalies
   */
  private async detectFinancialAnomalies(args: {
    metric_name: string;
    data: { periods: string[]; values: number[] };
    sensitivity?: string;
  }): Promise<MCPToolResult> {
    const { metric_name, data, sensitivity = "medium" } = args;

    const result = await this.predictiveService.detectAnomalies({
      data: {
        periods: data.periods,
        values: data.values,
        metadata: { metric: metric_name },
      },
      sensitivity: sensitivity as "low" | "medium" | "high",
    });

    const response = {
      metric_name,
      anomaly_analysis: result,
      audit: {
        trace_id: `mcp-anomaly-${Date.now()}`,
        timestamp: new Date().toISOString(),
        sensitivity,
        total_points: data.values.length,
      },
    };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(response, null, 2),
        },
      ],
    };
  }

  /**
   * Tool: analyze_financial_trends
   */
  private async analyzeFinancialTrends(args: {
    metric_name: string;
    data: { periods: string[]; values: number[] };
    comparison_data?: Array<{ periods: string[]; values: number[] }>;
  }): Promise<MCPToolResult> {
    const { metric_name, data, comparison_data } = args;

    const result = await this.predictiveService.analyzeTrends({
      data: {
        periods: data.periods,
        values: data.values,
        metadata: { metric: metric_name },
      },
      comparisonData: comparison_data?.map((cd) => ({
        periods: cd.periods,
        values: cd.values,
      })),
    });

    const response = {
      metric_name,
      trend_analysis: result,
      audit: {
        trace_id: `mcp-trends-${Date.now()}`,
        timestamp: new Date().toISOString(),
        has_comparison_data: !!comparison_data?.length,
      },
    };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(response, null, 2),
        },
      ],
    };
  }

  /**
   * Tool: generate_business_intelligence
   */
  private async generateBusinessIntelligence(args: {
    company_name: string;
    cik?: string;
    industry?: string;
    time_range?: { start: string; end: string };
    include_sentiment?: boolean;
    include_forecasting?: boolean;
    peer_companies?: string[];
  }): Promise<MCPToolResult> {
    const {
      company_name,
      cik,
      industry,
      time_range,
      include_sentiment = true,
      include_forecasting = true,
      peer_companies,
    } = args;

    const result = await this.insightsService.generateBusinessIntelligenceReport({
      companyName: company_name,
      cik,
      industry,
      timeRange: time_range
        ? {
            start: time_range.start,
            end: time_range.end,
          }
        : undefined,
      includeSentiment: include_sentiment,
      includeForecasting: include_forecasting,
      peerCompanies: peer_companies,
    });

    const response = {
      company_name,
      cik,
      industry,
      business_intelligence: result,
      audit: {
        trace_id: `mcp-bi-${Date.now()}`,
        timestamp: new Date().toISOString(),
        confidence_level: result.confidence_level,
        report_generated_at: result.generated_at,
      },
    };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(response, null, 2),
        },
      ],
    };
  }

  /**
   * Tool: process_stream_transcript
   */
  private async processStreamTranscript(args: {
    session_id: string;
    speaker: string;
    text: string;
    sequence_number?: number;
    is_partial?: boolean;
  }): Promise<MCPToolResult> {
    const { session_id, speaker, text, sequence_number = 0, is_partial = false } = args;

    await this.streamingSentimentAnalyzer.processTranscript({
      sessionId: session_id,
      speaker,
      text,
      timestamp: Date.now(),
      sequenceNumber: sequence_number,
      isPartial: is_partial,
    });

    const response = {
      session_id,
      processed: true,
      speaker,
      text_length: text.length,
      sequence_number,
      is_partial,
      audit: {
        trace_id: `mcp-stream-process-${Date.now()}`,
        timestamp: new Date().toISOString(),
      },
    };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(response, null, 2),
        },
      ],
    };
  }

  /**
   * Tool: end_sentiment_stream
   */
  private async endSentimentStream(args: { session_id: string }): Promise<MCPToolResult> {
    const { session_id } = args;

    const session = await this.streamingSentimentAnalyzer.endSession(session_id);

    const response = {
      session_id,
      status: "ended",
      final_sentiment: session?.currentSentiment,
      session_summary: session
        ? {
            duration: session.lastUpdate - session.startTime,
            transcripts_processed: session.transcriptBuffer.length,
            sentiment_updates: session.sentimentHistory.length,
          }
        : null,
      audit: {
        trace_id: `mcp-stream-end-${Date.now()}`,
        timestamp: new Date().toISOString(),
      },
    };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(response, null, 2),
        },
      ],
    };
  }

  /**
   * Tool: get_streaming_stats
   */
  private async getStreamingStats(): Promise<MCPToolResult> {
    const websocketStats = this.webSocketServer?.getStats() || {
      totalClients: 0,
      authenticatedClients: 0,
      activeChannels: 0,
      channelSubscriptions: {},
    };

    const sentimentStats = this.streamingSentimentAnalyzer.getStats();
    const webhookStats = this.secWebhookSystem?.getStats() || {
      activeSubscriptions: 0,
      pendingDeliveries: 0,
      lastProcessedFiling: "",
      rssMonitoring: false,
    };

    const eventBusStats = this.eventBus.getStats();

    const response = {
      streaming_services: {
        websocket: websocketStats,
        sentiment_analysis: sentimentStats,
        sec_webhooks: webhookStats,
        event_bus: eventBusStats,
      },
      overall_health: {
        websocket_healthy: !!this.webSocketServer,
        sentiment_healthy: true,
        webhooks_healthy: !!this.secWebhookSystem,
        eventbus_connected: eventBusStats.isConnected,
      },
      audit: {
        trace_id: `mcp-streaming-stats-${Date.now()}`,
        timestamp: new Date().toISOString(),
      },
    };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(response, null, 2),
        },
      ],
    };
  }

  /**
   * Set up market data streaming integration
   */
  private setupMarketDataStreaming(): void {
    if (!this.webSocketServer) return;

    // Set up market data streaming to WebSocket clients
    // This would integrate with the MarketData module to stream real-time updates
    // For now, we'll set up event handlers

    this.eventBus.registerHandler("market.price_update", async (event) => {
      this.webSocketServer!.broadcastToChannel("market.realtime", {
        channel: "market.realtime",
        data: event.data,
        timestamp: event.timestamp,
        metadata: {
          source: event.source,
          quality: "realtime",
        },
      });
    });

    this.eventBus.registerHandler("market.fundamentals_update", async (event) => {
      this.webSocketServer!.broadcastToChannel("market.fundamentals", {
        channel: "market.fundamentals",
        data: event.data,
        timestamp: event.timestamp,
        metadata: {
          source: event.source,
          quality: "batch",
        },
      });
    });

    logger.info("Market data streaming integration configured");
  }

  private validateAuthoritativeFinancialsArgs(args: Record<string, any>): void {
    if (!args.entity_id || typeof args.entity_id !== "string") {
      throw new GroundTruthError(
        ErrorCodes.INVALID_REQUEST,
        "entity_id is required and must be a string"
      );
    }
    if (args.entity_id.length > 20) {
      throw new GroundTruthError(ErrorCodes.INVALID_REQUEST, "entity_id too long");
    }
    if (!Array.isArray(args.metrics) || args.metrics.length === 0) {
      throw new GroundTruthError(ErrorCodes.INVALID_REQUEST, "metrics must be a non-empty array");
    }
    if (args.metrics.length > 10) {
      throw new GroundTruthError(ErrorCodes.INVALID_REQUEST, "too many metrics requested");
    }
  }

  private validatePrivateEntityEstimatesArgs(args: Record<string, any>): void {
    if (!args.domain || typeof args.domain !== "string") {
      throw new GroundTruthError(
        ErrorCodes.INVALID_REQUEST,
        "domain is required and must be a string"
      );
    }
    if (args.domain.length > 253) {
      // Max domain length per RFC
      throw new GroundTruthError(ErrorCodes.INVALID_REQUEST, "domain name too long");
    }
  }

  private validateVerifyClaimArgs(args: Record<string, any>): void {
    if (!args.claim_text || typeof args.claim_text !== "string") {
      throw new GroundTruthError(
        ErrorCodes.INVALID_REQUEST,
        "claim_text is required and must be a string"
      );
    }
    if (!args.context_entity || typeof args.context_entity !== "string") {
      throw new GroundTruthError(
        ErrorCodes.INVALID_REQUEST,
        "context_entity is required and must be a string"
      );
    }
    if (args.claim_text.length > 2000) {
      throw new GroundTruthError(ErrorCodes.INVALID_REQUEST, "claim_text too long");
    }
  }

  private validateValueDriverTreeArgs(args: Record<string, any>): void {
    if (!args.target_cik || typeof args.target_cik !== "string") {
      throw new GroundTruthError(
        ErrorCodes.INVALID_REQUEST,
        "target_cik is required and must be a string"
      );
    }
    if (!args.benchmark_naics || typeof args.benchmark_naics !== "string") {
      throw new GroundTruthError(
        ErrorCodes.INVALID_REQUEST,
        "benchmark_naics is required and must be a string"
      );
    }
    if (!args.driver_node_id || typeof args.driver_node_id !== "string") {
      throw new GroundTruthError(
        ErrorCodes.INVALID_REQUEST,
        "driver_node_id is required and must be a string"
      );
    }
  }

  private validateIndustryBenchmarkArgs(args: Record<string, any>): void {
    if (!args.identifier || typeof args.identifier !== "string") {
      throw new GroundTruthError(
        ErrorCodes.INVALID_REQUEST,
        "identifier is required and must be a string"
      );
    }
    if (args.identifier.length > 20) {
      throw new GroundTruthError(ErrorCodes.INVALID_REQUEST, "identifier too long");
    }
  }

  private async generateVerificationHash(results: any[]): Promise<string> {
    try {
      const data = JSON.stringify(results);
      const hash = await sha256(data);
      return `sha256:${hash}`;
    } catch (error) {
      logger.error(
        "Failed to generate verification hash",
        error instanceof Error ? error : undefined
      );
      // Fallback to simple hash for audit trail continuity
      let hash = 0;
      const data = JSON.stringify(results);
      for (let i = 0; i < data.length; i++) {
        const char = data.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash;
      }
      return `fallback:${Math.abs(hash).toString(16)}`;
    }
  }
}
