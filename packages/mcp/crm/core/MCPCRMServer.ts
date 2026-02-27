/**
 * MCP CRM Server
 *
 * Provides LLM tool access to CRM data (HubSpot, Salesforce).
 * Uses tenant-level OAuth connections.
 */

import { logger } from "../../lib/logger";
import { supabase } from "../../lib/supabase";
import { HubSpotModule } from "../modules/HubSpotModule";
import { SalesforceModule } from "../modules/SalesforceModule";
import { CRMConfigManager } from "../config/CRMConfigManager";
import {
  MCPCRMError,
  MCPErrorCodes,
  mcpRateLimiter,
  MCPResponseBuilder,
  ParallelInitializer,
} from "../../mcp-common";
import {
  CRMActivity,
  CRMConnection,
  CRMContact,
  CRMModule,
  CRMProvider,
  DealSearchParams,
  MCPCRMConfig,
  MCPCRMToolResult,
} from "../types";

// ============================================================================
// Tool Definitions for LLM
// ============================================================================

export const CRM_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "crm_search_deals",
      description:
        "Search for deals/opportunities in the connected CRM (HubSpot or Salesforce). Use this to find specific deals by company name, stage, or amount.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "Free text search query (e.g., company name, deal name)",
          },
          company_name: {
            type: "string",
            description: "Filter by company name",
          },
          stages: {
            type: "array",
            items: { type: "string" },
            description:
              'Filter by deal stages (e.g., ["qualified", "proposal"])',
          },
          min_amount: {
            type: "number",
            description: "Minimum deal amount",
          },
          limit: {
            type: "number",
            description: "Maximum number of results (default 10)",
          },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "crm_get_deal_details",
      description:
        "Get detailed information about a specific deal including all properties, associated contacts, and recent activities.",
      parameters: {
        type: "object",
        properties: {
          deal_id: {
            type: "string",
            description: "The ID of the deal to retrieve",
          },
          include_contacts: {
            type: "boolean",
            description: "Include associated contacts (default true)",
          },
          include_activities: {
            type: "boolean",
            description: "Include recent activities (default true)",
          },
        },
        required: ["deal_id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "crm_get_stakeholders",
      description:
        "Get all contacts/stakeholders associated with a deal, including their roles and contact information.",
      parameters: {
        type: "object",
        properties: {
          deal_id: {
            type: "string",
            description: "The ID of the deal",
          },
        },
        required: ["deal_id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "crm_get_recent_activities",
      description:
        "Get recent activities (emails, calls, meetings) for a deal to understand engagement history.",
      parameters: {
        type: "object",
        properties: {
          deal_id: {
            type: "string",
            description: "The ID of the deal",
          },
          limit: {
            type: "number",
            description: "Number of recent activities to retrieve (default 10)",
          },
        },
        required: ["deal_id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "crm_add_note",
      description:
        "Add a note to a deal in the CRM with value case insights or analysis results.",
      parameters: {
        type: "object",
        properties: {
          deal_id: {
            type: "string",
            description: "The ID of the deal",
          },
          note: {
            type: "string",
            description: "The note content to add",
          },
        },
        required: ["deal_id", "note"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "crm_get_deal_context",
      description:
        "Get normalized deal context optimized for value analysis. Returns standardized financial data, stage mapping, and key metrics needed for ROI calculations.",
      parameters: {
        type: "object",
        properties: {
          deal_id: {
            type: "string",
            description: "The ID of the deal to retrieve context for",
          },
          include_history: {
            type: "boolean",
            description: "Include stage history and timeline (default false)",
          },
        },
        required: ["deal_id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "crm_sync_metrics",
      description:
        "Write calculated value metrics (ROI, NPV, Payback Period) back to CRM custom fields. Supports dry-run mode to validate permissions before writing.",
      parameters: {
        type: "object",
        properties: {
          deal_id: {
            type: "string",
            description: "The ID of the deal to update",
          },
          metrics: {
            type: "object",
            description: "Metrics to sync to CRM",
            properties: {
              roi: {
                type: "number",
                description: "ROI percentage (e.g., 245 for 245%)",
              },
              npv: {
                type: "number",
                description: "Net Present Value in deal currency",
              },
              payback_months: {
                type: "number",
                description: "Payback period in months",
              },
              total_value: {
                type: "number",
                description: "Total projected value",
              },
              confidence_score: {
                type: "number",
                description: "Confidence score 0-100",
              },
            },
          },
          dry_run: {
            type: "boolean",
            description:
              "If true, validate permissions without writing (default false)",
          },
        },
        required: ["deal_id", "metrics"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "crm_inspect_schema",
      description:
        "Inspect the CRM object schema to understand available fields for mapping. Returns field definitions, types, and editability.",
      parameters: {
        type: "object",
        properties: {
          object_type: {
            type: "string",
            enum: ["deal", "contact", "company"],
            description: "The CRM object type to inspect",
          },
        },
        required: ["object_type"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "crm_check_connection",
      description:
        "Check which CRM systems are connected and available for this tenant.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
];

// ============================================================================
// MCP CRM Server
// ============================================================================

export class MCPCRMServer {
  private config: MCPCRMConfig;
  private modules: Map<CRMProvider, CRMModule> = new Map();
  private connections: Map<CRMProvider, CRMConnection> = new Map();
  private configManager: CRMConfigManager;
  public parallelInitializer: ParallelInitializer;

  // Monitoring and metrics
  private metrics = {
    requests: {
      total: 0,
      successful: 0,
      failed: 0,
      byTool: new Map<
        string,
        {
          total: number;
          successful: number;
          failed: number;
          avgDuration: number;
        }
      >(),
      byProvider: new Map<
        string,
        {
          total: number;
          successful: number;
          failed: number;
          avgDuration: number;
        }
      >(),
    },
    rateLimits: {
      hits: 0,
      blocks: 0,
      adaptiveDelays: 0,
      byProvider: new Map<
        string,
        { hits: number; blocks: number; adaptiveDelays: number }
      >(),
    },
    errors: {
      total: 0,
      byType: new Map<string, number>(),
      byProvider: new Map<string, number>(),
      recent: [] as Array<{
        timestamp: number;
        tool: string;
        provider: string;
        error: string;
      }>,
    },
    performance: {
      avgRequestDuration: 0,
      p95RequestDuration: 0,
      totalRequestDuration: 0,
      requestDurations: [] as number[],
    },
  };

  constructor(config: MCPCRMConfig) {
    this.config = config;
    this.configManager = CRMConfigManager.getInstance();
    this.parallelInitializer = new ParallelInitializer({
      maxConcurrency: 5,
      defaultTimeout: 30000,
      enableBatching: true,
      enableConnectionPooling: true,
      poolSize: 3,
    });

    // Start metrics collection
    this.startMetricsCollection();
  }

  /**
   * Start periodic metrics collection
   */
  private startMetricsCollection(): void {
    // Periodically calculate p95 and average durations
    setInterval(() => {
      const durations = this.metrics.performance.requestDurations;
      if (durations.length > 0) {
        // Calculate average
        this.metrics.performance.avgRequestDuration =
          this.metrics.performance.totalRequestDuration / durations.length;

        // Calculate p95
        const sorted = [...durations].sort((a, b) => a - b);
        const p95Index = Math.floor(sorted.length * 0.95);
        this.metrics.performance.p95RequestDuration = sorted[p95Index] || 0;

        // Keep only last 1000 durations to prevent memory growth
        if (durations.length > 1000) {
          this.metrics.performance.requestDurations = durations.slice(-1000);
        }
      }

      // Trim recent errors to last 100
      if (this.metrics.errors.recent.length > 100) {
        this.metrics.errors.recent = this.metrics.errors.recent.slice(-100);
      }
    }, 60000); // Every minute
  }

  /**
   * Load CRM connections from database
   */
  private async loadConnections(): Promise<void> {
    if (!supabase) {
      logger.warn("Supabase not configured, skipping connection loading");
      return;
    }

    const { data: connections, error } = await supabase
      .from("crm_connections")
      .select("*")
      .eq("tenant_id", this.config.tenantId)
      .eq("status", "active");

    if (error) {
      logger.error("Failed to load CRM connections", error);
      return;
    }

    for (const conn of connections || []) {
      const connection: CRMConnection = {
        id: conn.id,
        tenantId: conn.tenant_id,
        provider: conn.provider as CRMProvider,
        accessToken: conn.access_token,
        refreshToken: conn.refresh_token,
        tokenExpiresAt: conn.token_expires_at
          ? new Date(conn.token_expires_at)
          : undefined,
        instanceUrl: conn.instance_url,
        hubId: conn.hub_id,
        scopes: conn.scopes || [],
        status: conn.status || "active",
      };
      this.connections.set(connection.provider, connection);
    }
  }

  /**
   * Initialize a CRM module for a connection
   */
  private async initializeModule(connection: CRMConnection): Promise<void> {
    let module: CRMModule;

    if (connection.provider === "hubspot") {
      module = new HubSpotModule(connection);
    } else if (connection.provider === "salesforce") {
      module = new SalesforceModule(connection);
    } else {
      logger.warn("Unknown CRM provider", { provider: connection.provider });
      return;
    }

    // Test connection to validate credentials
    await module.testConnection();
    this.modules.set(connection.provider, module);
  }

  /**
   * Update rolling average duration for metrics
   */
  private updateAverageDuration(
    metrics: { total: number; avgDuration: number },
    newDuration: number
  ): void {
    // Incremental average calculation
    metrics.avgDuration =
      metrics.avgDuration + (newDuration - metrics.avgDuration) / metrics.total;
  }

  /**
   * Initialize the server using parallel initialization
   */
  async initialize(): Promise<void> {
    const startTime = Date.now();
    // Add initialization tasks
    this.addInitializationTasks();

    // Execute all tasks in parallel
    const results = await this.parallelInitializer.execute();

    // Check for any failures
    const failures = Array.from(results.values()).filter(
      (r: any) => !r.success
    );
    if (failures.length > 0) {
      const errorDetails = failures.map((f: any) => ({
        taskId: f.taskId || "unknown",
        error: f.error?.message || String(f.error) || "Unknown error",
      }));

      logger.error(
        `Some initialization tasks failed: ${failures.length} failures`,
        undefined,
        { errorDetails }
      );
    }

    const duration = Date.now() - startTime;
    logger.info("CRM server initialization completed", {
      duration,
      totalTasks: results.size,
      failures: failures.length,
    });
  }

  /**
   * Add parallel initialization tasks
   */
  private addInitializationTasks(): void {
    // Task 1: Load configuration (high priority, no dependencies)
    this.parallelInitializer.addTask({
      id: "load-config",
      name: "Load CRM Configuration",
      priority: "high",
      timeout: 10000,
      retryAttempts: 3,
      retryDelay: 1000,
      executor: async () => {
        await this.configManager.loadConfig();
        return this.configManager.getConfig();
      },
    });

    // Task 2: Register rate limiters (medium priority, depends on config)
    this.parallelInitializer.addTask({
      id: "register-rate-limiters",
      name: "Register Rate Limiters",
      priority: "medium",
      dependencies: ["load-config"],
      timeout: 5000,
      retryAttempts: 2,
      retryDelay: 500,
      executor: async () => {
        this.registerRateLimiters();
        return this.configManager.getEnabledProviders();
      },
    });

    // Task 3: Load database connections (medium priority, depends on config)
    this.parallelInitializer.addTask({
      id: "load-connections",
      name: "Load CRM Connections",
      priority: "medium",
      dependencies: ["load-config"],
      timeout: 15000,
      retryAttempts: 3,
      retryDelay: 1000,
      executor: async () => {
        await this.loadConnections();
        return Array.from(this.connections.keys());
      },
    });

    // Task 4: Initialize modules (low priority, depends on connections and rate limiters)
    this.parallelInitializer.addTask({
      id: "initialize-modules",
      name: "Initialize CRM Modules",
      priority: "low",
      dependencies: ["load-connections", "register-rate-limiters"],
      timeout: 20000,
      retryAttempts: 2,
      retryDelay: 1000,
      executor: async () => {
        const modulePromises = Array.from(this.connections.values()).map(
          (connection) => this.initializeModule(connection)
        );
        await Promise.all(modulePromises);
        return Array.from(this.modules.keys());
      },
    });

    // Task 5: Health check (low priority, depends on all modules)
    this.parallelInitializer.addTask({
      id: "health-check",
      name: "Perform Health Check",
      priority: "low",
      dependencies: ["initialize-modules"],
      timeout: 10000,
      retryAttempts: 1,
      retryDelay: 500,
      executor: async () => {
        const healthResults = await Promise.allSettled(
          Array.from(this.modules.entries()).map(async ([provider, module]) => {
            try {
              // Simple health check - try to get a small amount of data
              await module.searchDeals({ limit: 1 });
              return { provider, status: "healthy" };
            } catch (error) {
              return {
                provider,
                status: "unhealthy",
                error: error instanceof Error ? error.message : "Unknown error",
              };
            }
          })
        );

        return healthResults.map((result) =>
          result.status === "fulfilled" ? result.value : result.reason
        );
      },
    });
  }

  /**
   * Register rate limiters for all enabled providers
   */
  private registerRateLimiters(): void {
    const enabledProviders = this.configManager.getEnabledProviders();

    for (const provider of enabledProviders) {
      const rateLimitConfig = this.configManager.getRateLimitConfig(provider);

      mcpRateLimiter.registerProvider({
        provider,
        requestsPerSecond: rateLimitConfig.requestsPerSecond,
        burstCapacity: rateLimitConfig.burstCapacity,
        windowMs: 60000, // 1 minute window
        retryAfterBase: 60,
        maxRetries: 3,
        backoffMultiplier: 2,
        adaptiveThrottling: true,
        circuitBreaker: {
          enabled: true,
          failureThreshold: 5,
          recoveryTimeout: 300000, // 5 minutes
          monitoringPeriod: 600000, // 10 minutes
        },
      });
    }
  }

  /**
   * Get available tools based on connected CRMs
   */
  getTools(): typeof CRM_TOOLS {
    if (this.connections.size === 0) {
      // Return only the connection check tool if no CRMs connected
      return CRM_TOOLS.filter(
        (t) => t.function.name === "crm_check_connection"
      );
    }
    return CRM_TOOLS;
  }

  /**
   * Check if any CRM is connected
   */
  isConnected(): boolean {
    return this.connections.size > 0;
  }

  /**
   * Get connected providers
   */
  getConnectedProviders(): CRMProvider[] {
    return Array.from(this.connections.keys());
  }

  /**
   * Execute a CRM tool
   */
  async executeTool(
    toolName: string,
    args: Record<string, unknown>
  ): Promise<MCPCRMToolResult> {
    const startTime = Date.now();
    const requestId = `crm-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const responseBuilder = new MCPResponseBuilder(
      toolName,
      undefined,
      requestId
    );

    try {
      // Get the first available module (prefer HubSpot for now)
      const module =
        this.modules.get("hubspot") || this.modules.get("salesforce");

      switch (toolName) {
        case "crm_check_connection":
          return this.handleCheckConnection(responseBuilder, startTime);

        case "crm_search_deals":
          if (!module) return this.noConnectionResult(responseBuilder);
          return this.handleSearchDeals(
            module,
            args,
            responseBuilder,
            startTime
          );

        case "crm_get_deal_details":
          if (!module) return this.noConnectionResult(responseBuilder);
          return this.handleGetDealDetails(
            module,
            args,
            responseBuilder,
            startTime
          );

        case "crm_get_stakeholders":
          if (!module) return this.noConnectionResult(responseBuilder);
          return this.handleGetStakeholders(
            module,
            args,
            responseBuilder,
            startTime
          );

        case "crm_get_recent_activities":
          if (!module) return this.noConnectionResult(responseBuilder);
          return this.handleGetActivities(
            module,
            args,
            responseBuilder,
            startTime
          );

        case "crm_add_note":
          if (!module) return this.noConnectionResult(responseBuilder);
          return this.handleAddNote(module, args, responseBuilder, startTime);

        case "crm_get_deal_context":
          if (!module) return this.noConnectionResult(responseBuilder);
          return this.handleGetDealContext(
            module,
            args,
            responseBuilder,
            startTime
          );

        case "crm_sync_metrics":
          if (!module) return this.noConnectionResult(responseBuilder);
          return this.handleSyncMetrics(
            module,
            args,
            responseBuilder,
            startTime
          );

        case "crm_inspect_schema":
          if (!module) return this.noConnectionResult(responseBuilder);
          return this.handleInspectSchema(
            module,
            args,
            responseBuilder,
            startTime
          );

        default:
          const error = new MCPCRMError(
            MCPErrorCodes.INVALID_REQUEST,
            `Unknown CRM tool: ${toolName}`,
            { requestId, tool: toolName }
          );
          return responseBuilder.error(error) as any;
      }
    } catch (error) {
      logger.error(
        "CRM tool execution failed",
        error instanceof Error ? error : undefined
      );
      return responseBuilder.error(
        new MCPCRMError(
          MCPErrorCodes.INTERNAL_ERROR,
          error instanceof Error ? error.message : "Unknown error",
          { requestId, tool: toolName }
        )
      ) as any;
    }
  }

  // ==========================================================================
  // Tool Handlers
  // ==========================================================================

  private handleCheckConnection(
    _responseBuilder: MCPResponseBuilder,
    _startTime: number
  ): MCPCRMToolResult {
    const providers = this.getConnectedProviders();
    const result = {
      success: true,
      data: {
        connected: providers.length > 0,
        providers,
        message:
          providers.length > 0
            ? `Connected to: ${providers.join(", ")}`
            : "No CRM connected. Ask an admin to connect HubSpot or Salesforce in Settings.",
      },
    };

    return _responseBuilder.crmSuccess(
      result.data,
      this.config.tenantId,
      providers.length > 0 ? "connected" : "disconnected"
    ) as any;
  }

  private async handleSearchDeals(
    module: CRMModule,
    args: Record<string, unknown>,
    responseBuilder: MCPResponseBuilder,
    startTime: number
  ): Promise<MCPCRMToolResult> {
    const toolName = "crm_search_deals";
    const provider = module.provider;

    // Track request start
    this.metrics.requests.total++;
    const toolMetrics = this.metrics.requests.byTool.get(toolName) || {
      total: 0,
      successful: 0,
      failed: 0,
      avgDuration: 0,
    };
    const providerMetrics = this.metrics.requests.byProvider.get(provider) || {
      total: 0,
      successful: 0,
      failed: 0,
      avgDuration: 0,
    };
    toolMetrics.total++;
    providerMetrics.total++;
    this.metrics.requests.byTool.set(toolName, toolMetrics);
    this.metrics.requests.byProvider.set(provider, providerMetrics);

    // Check rate limit
    const rateLimitResult = await mcpRateLimiter.checkLimit(module.provider);
    if (!rateLimitResult.allowed) {
      // Track rate limit blocks
      this.metrics.rateLimits.blocks++;
      const rateLimitMetrics = this.metrics.rateLimits.byProvider.get(
        provider
      ) || {
        hits: 0,
        blocks: 0,
        adaptiveDelays: 0,
      };
      rateLimitMetrics.blocks++;
      this.metrics.rateLimits.byProvider.set(provider, rateLimitMetrics);

      // Track failed request
      this.metrics.requests.failed++;
      toolMetrics.failed++;
      providerMetrics.failed++;
      this.metrics.requests.byTool.set(toolName, toolMetrics);
      this.metrics.requests.byProvider.set(provider, providerMetrics);

      // Track error
      this.metrics.errors.total++;
      const errorType = "RATE_LIMIT_EXCEEDED";
      const errorCount = this.metrics.errors.byType.get(errorType) || 0;
      this.metrics.errors.byType.set(errorType, errorCount + 1);
      const providerErrorCount =
        this.metrics.errors.byProvider.get(provider) || 0;
      this.metrics.errors.byProvider.set(provider, providerErrorCount + 1);

      this.metrics.errors.recent.push({
        timestamp: Date.now(),
        tool: toolName,
        provider,
        error: rateLimitResult.circuitBreakerOpen
          ? `CRM provider ${module.provider} is temporarily unavailable due to high error rates`
          : `Rate limit exceeded for ${module.provider}`,
      });

      return {
        success: false,
        error: rateLimitResult.circuitBreakerOpen
          ? `CRM provider ${module.provider} is temporarily unavailable due to high error rates`
          : `Rate limit exceeded for ${module.provider}. Please try again in ${rateLimitResult.retryAfter} seconds.`,
      };
    }

    // Track rate limit hits
    this.metrics.rateLimits.hits++;
    const rateLimitMetrics = this.metrics.rateLimits.byProvider.get(
      provider
    ) || {
      hits: 0,
      blocks: 0,
      adaptiveDelays: 0,
    };
    rateLimitMetrics.hits++;
    this.metrics.rateLimits.byProvider.set(provider, rateLimitMetrics);

    // Apply adaptive throttling delay if needed
    if (rateLimitResult.adaptiveDelay && rateLimitResult.adaptiveDelay > 0) {
      this.metrics.rateLimits.adaptiveDelays++;
      rateLimitMetrics.adaptiveDelays++;
      this.metrics.rateLimits.byProvider.set(provider, rateLimitMetrics);

      await new Promise((resolve) =>
        setTimeout(resolve, rateLimitResult.adaptiveDelay)
      );
    }

    const params: DealSearchParams = {
      query: args.query as string | undefined,
      companyName: args.company_name as string | undefined,
      stage: args.stages as string[] | undefined,
      minAmount: args.min_amount as number | undefined,
      limit: (args.limit as number) || 10,
    };

    try {
      const result = await module.searchDeals(params);
      const duration = Date.now() - startTime;

      // Track successful request
      this.metrics.requests.successful++;
      toolMetrics.successful++;
      providerMetrics.successful++;
      this.updateAverageDuration(toolMetrics, duration);
      this.updateAverageDuration(providerMetrics, duration);
      this.metrics.requests.byTool.set(toolName, toolMetrics);
      this.metrics.requests.byProvider.set(provider, providerMetrics);

      // Track performance
      this.metrics.performance.totalRequestDuration += duration;
      this.metrics.performance.requestDurations.push(duration);

      // Record successful request
      mcpRateLimiter.recordSuccess(module.provider, Date.now() - startTime);

      return {
        success: true,
        data: {
          deals: result.deals.map((d) => ({
            id: d.id,
            name: d.name,
            company: d.companyName,
            amount: d.amount,
            stage: d.stage,
            closeDate: d.closeDate?.toISOString(),
            owner: d.ownerName,
          })),
          total: result.total,
          hasMore: result.hasMore,
        },
        metadata: {
          provider: module.provider,
          requestDurationMs: duration,
          rateLimitRemaining: rateLimitResult.remaining,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      // Track failed request
      this.metrics.requests.failed++;
      toolMetrics.failed++;
      providerMetrics.failed++;
      this.updateAverageDuration(toolMetrics, duration);
      this.updateAverageDuration(providerMetrics, duration);
      this.metrics.requests.byTool.set(toolName, toolMetrics);
      this.metrics.requests.byProvider.set(provider, providerMetrics);

      // Track error
      this.metrics.errors.total++;
      const errorType = "SEARCH_DEALS_FAILED";
      const errorCount = this.metrics.errors.byType.get(errorType) || 0;
      this.metrics.errors.byType.set(errorType, errorCount + 1);
      const providerErrorCount =
        this.metrics.errors.byProvider.get(provider) || 0;
      this.metrics.errors.byProvider.set(provider, providerErrorCount + 1);

      this.metrics.errors.recent.push({
        timestamp: Date.now(),
        tool: toolName,
        provider,
        error: error instanceof Error ? error.message : "Unknown error",
      });

      // Record failed request
      mcpRateLimiter.recordFailure(
        module.provider,
        error instanceof Error ? error : undefined
      );

      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown error occurred while searching deals",
      };
    }
  }

  private async handleGetDealDetails(
    module: CRMModule,
    args: Record<string, unknown>,
    responseBuilder: MCPResponseBuilder,
    startTime: number
  ): Promise<MCPCRMToolResult> {
    const dealId = args.deal_id as string;
    const includeContacts = args.include_contacts !== false;
    const includeActivities = args.include_activities !== false;

    if (!dealId) {
      return {
        success: false,
        error: "deal_id parameter is required",
        metadata: {
          provider: module.provider,
          requestDurationMs: Date.now() - startTime,
        },
      };
    }

    // Get deal details
    let deal;
    try {
      deal = await module.getDeal(dealId);
    } catch (error) {
      return {
        success: false,
        error: `Failed to fetch deal details: ${error instanceof Error ? error.message : "Unknown error"}`,
        metadata: {
          provider: module.provider,
          requestDurationMs: Date.now() - startTime,
        },
      };
    }

    if (!deal) {
      return {
        success: false,
        error: `Deal not found: ${dealId}. Please verify the deal ID and ensure you have access to this deal.`,
        metadata: {
          provider: module.provider,
          requestDurationMs: Date.now() - startTime,
        },
      };
    }

    // Get contacts if requested
    let contacts: CRMContact[] = [];
    if (includeContacts) {
      try {
        contacts = await module.getDealContacts(dealId);
      } catch (error) {
        logger.warn("Failed to fetch deal contacts", {
          dealId,
          provider: module.provider,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        // Don't fail the entire request, just log and continue with empty contacts
        contacts = [];
      }
    }

    // Get activities if requested
    let activities: CRMActivity[] = [];
    if (includeActivities) {
      try {
        activities = await module.getDealActivities(dealId, 5);
      } catch (error) {
        logger.warn("Failed to fetch deal activities", {
          dealId,
          provider: module.provider,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        // Don't fail the entire request, just log and continue with empty activities
        activities = [];
      }
    }

    return {
      success: true,
      data: {
        deal: {
          id: deal.id,
          name: deal.name,
          amount: deal.amount,
          currency: deal.currency,
          stage: deal.stage,
          probability: deal.probability,
          closeDate: deal.closeDate?.toISOString(),
          owner: deal.ownerName,
          company: deal.companyName,
          createdAt: deal.createdAt.toISOString(),
          updatedAt: deal.updatedAt.toISOString(),
        },
        contacts: contacts.map((c) => ({
          name: `${c.firstName || ""} ${c.lastName || ""}`.trim() || c.email,
          email: c.email,
          phone: c.phone,
          title: c.title,
          role: c.role,
        })),
        recentActivities: activities.map((a) => ({
          type: a.type,
          subject: a.subject,
          date: a.occurredAt.toISOString(),
          duration: a.durationMinutes,
        })),
      },
      metadata: {
        provider: module.provider,
        requestDurationMs: Date.now() - startTime,
      },
    };
  }

  private async handleGetStakeholders(
    module: CRMModule,
    args: Record<string, unknown>,
    responseBuilder: MCPResponseBuilder,
    startTime: number
  ): Promise<MCPCRMToolResult> {
    const dealId = args.deal_id as string;

    if (!dealId) {
      return {
        success: false,
        error: "deal_id parameter is required",
        metadata: {
          provider: module.provider,
          requestDurationMs: Date.now() - startTime,
        },
      };
    }

    try {
      const contacts = await module.getDealContacts(dealId);

      return {
        success: true,
        data: {
          stakeholders: contacts.map((c) => ({
            name:
              `${c.firstName || ""} ${c.lastName || ""}`.trim() || "Unknown",
            email: c.email,
            phone: c.phone,
            title: c.title,
            role: c.role || "Contact",
            company: c.companyName,
          })),
          count: contacts.length,
        },
        metadata: {
          provider: module.provider,
          requestDurationMs: Date.now() - startTime,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to fetch stakeholders: ${error instanceof Error ? error.message : "Unknown error"}`,
        metadata: {
          provider: module.provider,
          requestDurationMs: Date.now() - startTime,
        },
      };
    }
  }

  private async handleGetActivities(
    module: CRMModule,
    args: Record<string, unknown>,
    responseBuilder: MCPResponseBuilder,
    startTime: number
  ): Promise<MCPCRMToolResult> {
    const dealId = args.deal_id as string;
    const limit = (args.limit as number) || 10;

    if (!dealId) {
      return {
        success: false,
        error: "deal_id parameter is required",
        metadata: {
          provider: module.provider,
          requestDurationMs: Date.now() - startTime,
        },
      };
    }

    if (limit < 1 || limit > 50) {
      return {
        success: false,
        error: "limit parameter must be between 1 and 50",
        metadata: {
          provider: module.provider,
          requestDurationMs: Date.now() - startTime,
        },
      };
    }

    try {
      const activities = await module.getDealActivities(dealId, limit);

      return {
        success: true,
        data: {
          activities: activities.map((a) => ({
            type: a.type,
            subject: a.subject,
            body: a.body?.substring(0, 200),
            date: a.occurredAt.toISOString(),
            durationMinutes: a.durationMinutes,
          })),
          count: activities.length,
        },
        metadata: {
          provider: module.provider,
          requestDurationMs: Date.now() - startTime,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to fetch activities: ${error instanceof Error ? error.message : "Unknown error"}`,
        metadata: {
          provider: module.provider,
          requestDurationMs: Date.now() - startTime,
        },
      };
    }
  }

  private async handleAddNote(
    module: CRMModule,
    args: Record<string, unknown>,
    responseBuilder: MCPResponseBuilder,
    startTime: number
  ): Promise<MCPCRMToolResult> {
    const dealId = args.deal_id as string;
    const note = args.note as string;

    // Validate required parameters
    if (!dealId || typeof dealId !== "string" || dealId.trim().length === 0) {
      return {
        success: false,
        error: "deal_id parameter is required and must be a non-empty string",
        metadata: {
          provider: module.provider,
          requestDurationMs: Date.now() - startTime,
        },
      };
    }

    if (!note || typeof note !== "string" || note.trim().length === 0) {
      return {
        success: false,
        error: "note parameter is required and must be a non-empty string",
        metadata: {
          provider: module.provider,
          requestDurationMs: Date.now() - startTime,
        },
      };
    }

    // Limit note length to prevent abuse (10KB max)
    const maxNoteLength = 10240;
    if (note.length > maxNoteLength) {
      return {
        success: false,
        error: `note parameter exceeds maximum length of ${maxNoteLength} characters`,
        metadata: {
          provider: module.provider,
          requestDurationMs: Date.now() - startTime,
        },
      };
    }

    const success = await module.addDealNote(dealId.trim(), note.trim());

    return {
      success,
      data: success ? { message: "Note added successfully" } : undefined,
      error: success ? undefined : "Failed to add note",
      metadata: {
        provider: module.provider,
        requestDurationMs: Date.now() - startTime,
      },
    };
  }

  /**
   * Get normalized deal context for value analysis
   * Returns standardized financial data optimized for ROI calculations
   */
  private async handleGetDealContext(
    module: CRMModule,
    args: Record<string, unknown>,
    responseBuilder: MCPResponseBuilder,
    startTime: number
  ): Promise<MCPCRMToolResult> {
    const dealId = args.deal_id as string;
    const includeHistory = args.include_history === true;

    const deal = await module.getDeal(dealId);
    if (!deal) {
      return { success: false, error: `Deal not found: ${dealId}` };
    }

    // Normalize stage to standardized enum
    const normalizedStage = this.normalizeStage(deal.stage);

    // Build normalized context optimized for value analysis
    const normalizedContext = {
      // Core identification
      dealId: deal.id,
      externalId: deal.externalId,
      provider: deal.provider,

      // Financial data (normalized)
      financial: {
        dealValue: this.normalizeCurrency(deal.amount),
        currency: deal.currency || "USD",
        probability: deal.probability ?? 0,
        expectedValue: (deal.amount || 0) * ((deal.probability ?? 0) / 100),
      },

      // Stage information
      stage: {
        current: deal.stage,
        normalized: normalizedStage,
        closeDate: deal.closeDate?.toISOString(),
        daysInStage: this.calculateDaysInStage(deal.updatedAt),
        daysToClose: deal.closeDate
          ? this.calculateDaysToClose(deal.closeDate)
          : null,
      },

      // Stakeholders summary
      company: {
        id: deal.companyId,
        name: deal.companyName || "Unknown",
      },

      // Owner
      owner: {
        id: deal.ownerId,
        name: deal.ownerName || "Unassigned",
      },

      // Timestamps
      timestamps: {
        created: deal.createdAt.toISOString(),
        lastModified: deal.updatedAt.toISOString(),
      },

      // Custom properties (filtered for relevant fields)
      customFields: this.extractRelevantProperties(deal.properties),
    };

    // Optionally include stage history
    if (includeHistory) {
      const activities = await module.getDealActivities(dealId, 20);
      (normalizedContext as any).history = {
        recentActivityCount: activities.length,
        lastActivityDate: activities[0]?.occurredAt?.toISOString() || null,
        activityTypes: Array.from(new Set(activities.map((a) => a.type))),
      };
    }

    return {
      success: true,
      data: { context: normalizedContext },
      metadata: {
        provider: module.provider,
        requestDurationMs: Date.now() - startTime,
      },
    };
  }

  /**
   * Sync calculated metrics back to CRM
   * Supports dry-run mode for permission validation
   */
  private async handleSyncMetrics(
    module: CRMModule,
    args: Record<string, unknown>,
    responseBuilder: MCPResponseBuilder,
    startTime: number
  ): Promise<MCPCRMToolResult> {
    const dealId = args.deal_id as string;
    const metrics = args.metrics as Record<string, number>;
    const dryRun = args.dry_run === true;

    // Map metrics to CRM field names based on provider
    const fieldMapping = this.getMetricsFieldMapping(module.provider);
    const propertiesToUpdate: Record<string, unknown> = {};

    if (metrics.roi !== undefined && fieldMapping.roi) {
      propertiesToUpdate[fieldMapping.roi] = metrics.roi;
    }
    if (metrics.npv !== undefined && fieldMapping.npv) {
      propertiesToUpdate[fieldMapping.npv] = metrics.npv;
    }
    if (metrics.payback_months !== undefined && fieldMapping.payback_months) {
      propertiesToUpdate[fieldMapping.payback_months] = metrics.payback_months;
    }
    if (metrics.total_value !== undefined && fieldMapping.total_value) {
      propertiesToUpdate[fieldMapping.total_value] = metrics.total_value;
    }
    if (
      metrics.confidence_score !== undefined &&
      fieldMapping.confidence_score
    ) {
      propertiesToUpdate[fieldMapping.confidence_score] =
        metrics.confidence_score;
    }

    // Add metadata fields
    propertiesToUpdate[
      fieldMapping.last_calculated || "valuecanvas_last_sync"
    ] = new Date().toISOString();

    if (dryRun) {
      // Validate by attempting to read the deal first
      const deal = await module.getDeal(dealId);
      if (!deal) {
        return { success: false, error: `Deal not found: ${dealId}` };
      }

      return {
        success: true,
        data: {
          dryRun: true,
          dealId,
          wouldUpdate: Object.keys(propertiesToUpdate),
          message: `Dry run successful. ${Object.keys(propertiesToUpdate).length} fields would be updated.`,
        },
        metadata: {
          provider: module.provider,
          requestDurationMs: Date.now() - startTime,
        },
      };
    }

    // Actually write the metrics
    const success = await module.updateDealProperties(
      dealId,
      propertiesToUpdate
    );

    return {
      success,
      data: success
        ? {
            dealId,
            fieldsUpdated: Object.keys(propertiesToUpdate),
            timestamp: new Date().toISOString(),
            message: `Successfully synced ${Object.keys(metrics).length} metrics to CRM.`,
          }
        : undefined,
      error: success
        ? undefined
        : "Failed to update deal properties. Check field permissions.",
      metadata: {
        provider: module.provider,
        requestDurationMs: Date.now() - startTime,
      },
    };
  }

  /**
   * Inspect CRM object schema for field mapping
   */
  private async handleInspectSchema(
    module: CRMModule,
    args: Record<string, unknown>,
    responseBuilder: MCPResponseBuilder,
    startTime: number
  ): Promise<MCPCRMToolResult> {
    const objectType = args.object_type as string;

    // Get schema based on object type
    // Note: This would call the CRM's describe/metadata API
    // For now, return known field structure
    const schema = this.getObjectSchema(module.provider, objectType);

    return {
      success: true,
      data: {
        objectType,
        provider: module.provider,
        fields: schema.fields,
        customFieldsCount: schema.customFieldsCount,
        requiredFields: schema.requiredFields,
        writableFields: schema.writableFields,
      },
      metadata: {
        provider: module.provider,
        requestDurationMs: Date.now() - startTime,
      },
    };
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  private normalizeStage(stage: string): string {
    const stageMap: Record<string, string> = {
      // HubSpot stages
      appointmentscheduled: "discovery",
      qualifiedtobuy: "qualified",
      presentationscheduled: "proposal",
      decisionmakerboughtin: "negotiation",
      contractsent: "negotiation",
      closedwon: "closed_won",
      closedlost: "closed_lost",
      // Salesforce stages
      prospecting: "discovery",
      qualification: "qualified",
      "needs analysis": "qualified",
      "value proposition": "proposal",
      "id. decision makers": "proposal",
      "perception analysis": "proposal",
      "proposal/price quote": "proposal",
      "negotiation/review": "negotiation",
      "closed won": "closed_won",
      "closed lost": "closed_lost",
    };

    const normalized = stageMap[stage.toLowerCase()];
    return normalized || "unknown";
  }

  private normalizeCurrency(amount: number | undefined): number {
    if (amount === undefined || amount === null) return 0;
    // Handle string amounts like "$1.2M" or "EUR 500K"
    if (typeof amount === "string") {
      const cleaned = String(amount).replace(/[^0-9.-]/g, "");
      const parsed = parseFloat(cleaned);
      // Handle K/M suffixes
      if (String(amount).toLowerCase().includes("m")) return parsed * 1000000;
      if (String(amount).toLowerCase().includes("k")) return parsed * 1000;
      return parsed || 0;
    }
    return amount;
  }

  private calculateDaysInStage(lastModified: Date): number {
    const now = new Date();
    const diffMs = now.getTime() - lastModified.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  private calculateDaysToClose(closeDate: Date): number {
    const now = new Date();
    const diffMs = closeDate.getTime() - now.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  private extractRelevantProperties(
    props: Record<string, unknown>
  ): Record<string, unknown> {
    // Filter for value-relevant properties
    const relevantKeys = [
      "annual_revenue",
      "revenue",
      "arr",
      "mrr",
      "contract_value",
      "contract_length",
      "term",
      "discount",
      "industry",
      "company_size",
      "employees",
    ];

    const result: Record<string, unknown> = {};
    for (const key of Object.keys(props)) {
      const lowerKey = key.toLowerCase();
      if (relevantKeys.some((rk) => lowerKey.includes(rk))) {
        result[key] = props[key];
      }
    }
    return result;
  }

  private getMetricsFieldMapping(
    provider: CRMProvider
  ): Record<string, string> {
    try {
      return this.configManager.getFieldMappings(provider);
    } catch (error) {
      logger.error(
        "Failed to get field mappings from config, using defaults",
        error instanceof Error ? error : undefined,
        { provider }
      );

      // Fallback to hard-coded mappings if config fails
      if (provider === "salesforce") {
        return {
          roi: "Calculated_ROI__c",
          npv: "Net_Present_Value__c",
          payback_months: "Payback_Period_Months__c",
          total_value: "Total_Projected_Value__c",
          confidence_score: "Value_Confidence__c",
          last_calculated: "ValueCanvas_Last_Sync__c",
        };
      }
      // HubSpot
      return {
        roi: "calculated_roi",
        npv: "net_present_value",
        payback_months: "payback_period_months",
        total_value: "total_projected_value",
        confidence_score: "value_confidence",
        last_calculated: "valuecanvas_last_sync",
      };
    }
  }

  private getObjectSchema(
    provider: CRMProvider,
    objectType: string
  ): {
    fields: Array<{
      name: string;
      type: string;
      editable: boolean;
      required: boolean;
    }>;
    customFieldsCount: number;
    requiredFields: string[];
    writableFields: string[];
  } {
    // Return common schema structure
    const dealFields = [
      { name: "name", type: "string", editable: true, required: true },
      { name: "amount", type: "currency", editable: true, required: false },
      { name: "stage", type: "picklist", editable: true, required: true },
      { name: "close_date", type: "date", editable: true, required: false },
      { name: "probability", type: "percent", editable: true, required: false },
      { name: "owner_id", type: "reference", editable: true, required: true },
    ];

    // Add provider-specific custom fields for metrics
    const customFields =
      provider === "salesforce"
        ? [
            {
              name: "Calculated_ROI__c",
              type: "number",
              editable: true,
              required: false,
            },
            {
              name: "Net_Present_Value__c",
              type: "currency",
              editable: true,
              required: false,
            },
            {
              name: "Payback_Period_Months__c",
              type: "number",
              editable: true,
              required: false,
            },
          ]
        : [
            {
              name: "calculated_roi",
              type: "number",
              editable: true,
              required: false,
            },
            {
              name: "net_present_value",
              type: "number",
              editable: true,
              required: false,
            },
            {
              name: "payback_period_months",
              type: "number",
              editable: true,
              required: false,
            },
          ];

    const allFields = [...dealFields, ...customFields];

    return {
      fields: allFields,
      customFieldsCount: customFields.length,
      requiredFields: allFields.filter((f) => f.required).map((f) => f.name),
      writableFields: allFields.filter((f) => f.editable).map((f) => f.name),
    };
  }

  private noConnectionResult(
    responseBuilder: MCPResponseBuilder
  ): MCPCRMToolResult {
    return {
      success: false,
      error:
        "No CRM connected. Ask an admin to connect HubSpot or Salesforce in Settings → Integrations.",
    };
  }
}

// ============================================================================
// Tenant-Keyed Instance Cache
// ============================================================================

const serverInstances = new Map<string, MCPCRMServer>();
const initializationLocks = new Map<string, Promise<MCPCRMServer>>();

export async function getMCPCRMServer(
  tenantId: string,
  userId: string
): Promise<MCPCRMServer> {
  // Check if we already have an initialized instance for this tenant
  const existingInstance = serverInstances.get(tenantId);
  if (existingInstance) {
    return existingInstance;
  }

  // Check if initialization is already in progress for this tenant
  const existingLock = initializationLocks.get(tenantId);
  if (existingLock) {
    return existingLock;
  }

  // Create initialization promise to prevent race conditions
  const initPromise = (async () => {
    try {
      const server = new MCPCRMServer({
        tenantId,
        userId,
        enabledProviders: ["hubspot", "salesforce"],
        refreshTokensAutomatically: true,
      });
      await server.initialize();
      serverInstances.set(tenantId, server);
      return server;
    } finally {
      // Always clean up the lock
      initializationLocks.delete(tenantId);
    }
  })();

  initializationLocks.set(tenantId, initPromise);
  return initPromise;
}

/**
 * Clear a cached server instance (useful for testing or when connection changes)
 */
export function clearMCPCRMServer(tenantId?: string): void {
  if (tenantId) {
    serverInstances.delete(tenantId);
  } else {
    serverInstances.clear();
  }
}
