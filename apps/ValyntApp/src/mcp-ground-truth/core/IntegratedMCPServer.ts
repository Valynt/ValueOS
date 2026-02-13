/**
 * Integrated MCP Server - Phase 3 Enhancement
 *
 * Extends the base MCP Financial Ground Truth Server with:
 * - Structural Truth (formulas, KPI relationships)
 * - Causal Truth (action impacts, time curves)
 * - Business Case Generation (comprehensive analysis)
 * - Reasoning Engine (strategic recommendations)
 * - Audit Trail (full traceability)
 *
 * Part of Phase 3 - Integration & Business Case Generation
 */

import { MCPFinancialGroundTruthServer } from "./MCPServer";
import { StructuralTruth } from "../../structural/structural-truth";
import CausalTruth from "../../causal/causal-truth-enhanced";
import { EnhancedBusinessCaseGenerator } from "../../causal/business-case-generator-enhanced";
import { ReasoningEngine } from "../../reasoning/reasoning-engine";
import { AuditTrailManager, ComplianceMonitor } from "../../audit/audit-trail";
import { logger } from "../../lib/logger";

interface IntegratedMCPServerConfig {
  // Base MCP configuration
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

  // Phase 3 configuration
  structuralTruth?: {
    strictValidation?: boolean;
    maxFormulaDepth?: number;
    enableBenchmarkChecks?: boolean;
  };

  causalTruth?: {
    enableContextualAdjustments?: boolean;
    confidenceThreshold?: number;
    maxChainDepth?: number;
  };

  auditTrail?: {
    enabled?: boolean;
    maxEntries?: number;
    persistentStorage?: boolean;
    storagePath?: string;
  };
}

/**
 * Integrated MCP Server
 *
 * Combines all Phase 3 components into a unified MCP server
 */
export class IntegratedMCPServer extends MCPFinancialGroundTruthServer {
  private structuralTruth: StructuralTruth;
  private causalTruth: CausalTruth;
  private businessCaseGenerator: EnhancedBusinessCaseGenerator;
  private reasoningEngine: ReasoningEngine;
  private auditManager: AuditTrailManager;
  private complianceMonitor: ComplianceMonitor;

  constructor(config: IntegratedMCPServerConfig) {
    super(config);

    // Initialize Phase 3 components
    this.structuralTruth = new StructuralTruth(config.structuralTruth || {});
    this.causalTruth = new CausalTruth(config.causalTruth || {});
    this.businessCaseGenerator = new EnhancedBusinessCaseGenerator(
      this.structuralTruth,
      this.causalTruth
    );
    this.reasoningEngine = new ReasoningEngine(this.structuralTruth, this.causalTruth);

    // Initialize audit system
    this.auditManager = AuditTrailManager.getInstance();
    this.auditManager.configure(config.auditTrail || { enabled: true });
    this.complianceMonitor = new ComplianceMonitor();

    logger.info("Integrated MCP Server initialized with Phase 3 components");
  }

  /**
   * Get all available tools (base + Phase 3)
   */
  getTools(): any[] {
    const baseTools = super.getTools();

    const phase3Tools = [
      // Structural Truth Tools
      {
        name: "get_kpi_formula",
        description: "Get formula and dependencies for a specific KPI",
        inputSchema: {
          type: "object",
          properties: {
            kpiId: { type: "string", description: "KPI identifier (e.g., saas_nrr)" },
            industry: {
              type: "string",
              enum: [
                "saas",
                "manufacturing",
                "healthcare",
                "finance",
                "retail",
                "technology",
                "professional_services",
              ],
            },
          },
          required: ["kpiId"],
        },
      },
      {
        name: "calculate_kpi_value",
        description: "Calculate KPI value using formulas and dependencies",
        inputSchema: {
          type: "object",
          properties: {
            kpiId: { type: "string" },
            inputs: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  kpiId: { type: "string" },
                  value: { type: "number" },
                  confidence: { type: "number", minimum: 0, maximum: 1 },
                },
                required: ["kpiId", "value"],
              },
            },
          },
          required: ["kpiId", "inputs"],
        },
      },
      {
        name: "get_cascading_impacts",
        description: "Calculate cascading impacts of a KPI change",
        inputSchema: {
          type: "object",
          properties: {
            rootKpi: { type: "string" },
            changeAmount: { type: "number" },
            maxDepth: { type: "number", minimum: 1, maximum: 5, default: 3 },
          },
          required: ["rootKpi", "changeAmount"],
        },
      },

      // Causal Truth Tools
      {
        name: "get_causal_impact",
        description: "Get causal impact of business action on KPI",
        inputSchema: {
          type: "object",
          properties: {
            action: {
              type: "string",
              enum: [
                "price_increase_5pct",
                "price_decrease_5pct",
                "freemium_to_paid",
                "annual_commitment_discount",
                "increase_sales_team_20pct",
                "double_marketing_spend",
                "launch_abm_campaign",
                "implement_lead_scoring",
                "reduce_pricing_tiers",
                "add_self_service_onboarding",
                "improve_page_load_50pct",
                "launch_new_feature_category",
                "implement_health_scoring",
                "increase_csm_ratio_2x",
                "launch_customer_education",
                "proactive_churn_intervention",
                "automate_manual_processes",
                "reduce_support_ticket_time",
                "implement_usage_based_pricing",
                "expand_to_new_vertical",
              ],
            },
            kpi: { type: "string" },
            persona: {
              type: "string",
              enum: [
                "cfo",
                "cio",
                "cto",
                "coo",
                "vp_sales",
                "vp_ops",
                "vp_engineering",
                "director_finance",
                "data_analyst",
              ],
            },
            industry: {
              type: "string",
              enum: [
                "saas",
                "manufacturing",
                "healthcare",
                "finance",
                "retail",
                "technology",
                "professional_services",
              ],
            },
            companySize: { type: "string", enum: ["startup", "scaleup", "enterprise"] },
          },
          required: ["action", "kpi", "persona", "industry", "companySize"],
        },
      },
      {
        name: "simulate_action_outcome",
        description: "Simulate outcome of business action on multiple KPIs",
        inputSchema: {
          type: "object",
          properties: {
            action: { type: "string" },
            baseline: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  kpi: { type: "string" },
                  value: { type: "number" },
                },
                required: ["kpi", "value"],
              },
            },
            persona: {
              type: "string",
              enum: [
                "cfo",
                "cio",
                "cto",
                "coo",
                "vp_sales",
                "vp_ops",
                "vp_engineering",
                "director_finance",
                "data_analyst",
              ],
            },
            industry: {
              type: "string",
              enum: [
                "saas",
                "manufacturing",
                "healthcare",
                "finance",
                "retail",
                "technology",
                "professional_services",
              ],
            },
            companySize: { type: "string", enum: ["startup", "scaleup", "enterprise"] },
          },
          required: ["action", "baseline", "persona", "industry", "companySize"],
        },
      },
      {
        name: "compare_scenarios",
        description: "Compare multiple business scenarios side by side",
        inputSchema: {
          type: "object",
          properties: {
            scenarios: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  actions: { type: "array", items: { type: "string" } },
                  baseline: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        kpi: { type: "string" },
                        value: { type: "number" },
                      },
                    },
                  },
                  persona: {
                    type: "string",
                    enum: [
                      "cfo",
                      "cio",
                      "cto",
                      "coo",
                      "vp_sales",
                      "vp_ops",
                      "vp_engineering",
                      "director_finance",
                      "data_analyst",
                    ],
                  },
                  industry: {
                    type: "string",
                    enum: [
                      "saas",
                      "manufacturing",
                      "healthcare",
                      "finance",
                      "retail",
                      "technology",
                      "professional_services",
                    ],
                  },
                  companySize: { type: "string", enum: ["startup", "scaleup", "enterprise"] },
                },
                required: ["name", "actions", "baseline", "persona", "industry", "companySize"],
              },
            },
          },
          required: ["scenarios"],
        },
      },
      {
        name: "get_cascading_effects",
        description: "Get cascading effects of an action through multiple KPIs",
        inputSchema: {
          type: "object",
          properties: {
            action: { type: "string" },
            rootKpi: { type: "string" },
            maxDepth: { type: "number", minimum: 1, maximum: 5, default: 3 },
            persona: {
              type: "string",
              enum: [
                "cfo",
                "cio",
                "cto",
                "coo",
                "vp_sales",
                "vp_ops",
                "vp_engineering",
                "director_finance",
                "data_analyst",
              ],
            },
            industry: {
              type: "string",
              enum: [
                "saas",
                "manufacturing",
                "healthcare",
                "finance",
                "retail",
                "technology",
                "professional_services",
              ],
            },
            companySize: { type: "string", enum: ["startup", "scaleup", "enterprise"] },
          },
          required: ["action", "rootKpi", "persona", "industry", "companySize"],
        },
      },
      {
        name: "get_recommendations_for_kpi",
        description: "Get recommended actions to improve a specific KPI",
        inputSchema: {
          type: "object",
          properties: {
            targetKpi: { type: "string" },
            targetImprovement: {
              type: "number",
              description: "Desired improvement as decimal (e.g., 0.1 for 10%)",
            },
            persona: {
              type: "string",
              enum: [
                "cfo",
                "cio",
                "cto",
                "coo",
                "vp_sales",
                "vp_ops",
                "vp_engineering",
                "director_finance",
                "data_analyst",
              ],
            },
            industry: {
              type: "string",
              enum: [
                "saas",
                "manufacturing",
                "healthcare",
                "finance",
                "retail",
                "technology",
                "professional_services",
              ],
            },
            companySize: { type: "string", enum: ["startup", "scaleup", "enterprise"] },
            constraints: {
              type: "object",
              properties: {
                maxTime: { type: "number", description: "Maximum time to impact in days" },
                minConfidence: { type: "number", minimum: 0, maximum: 1 },
              },
            },
          },
          required: ["targetKpi", "targetImprovement", "persona", "industry", "companySize"],
        },
      },

      // Business Case Generation Tools
      {
        name: "generate_business_case",
        description: "Generate comprehensive business case with full audit trail",
        inputSchema: {
          type: "object",
          properties: {
            persona: {
              type: "string",
              enum: [
                "cfo",
                "cio",
                "cto",
                "coo",
                "vp_sales",
                "vp_ops",
                "vp_engineering",
                "director_finance",
                "data_analyst",
              ],
            },
            industry: {
              type: "string",
              enum: [
                "saas",
                "manufacturing",
                "healthcare",
                "finance",
                "retail",
                "technology",
                "professional_services",
              ],
            },
            companySize: { type: "string", enum: ["startup", "scaleup", "enterprise"] },
            annualRevenue: { type: "number" },
            currentKPIs: { type: "object" },
            selectedActions: { type: "array", items: { type: "string" } },
            timeframe: { type: "string", enum: ["30d", "90d", "180d", "365d"] },
            confidenceThreshold: { type: "number", minimum: 0, maximum: 1 },
            scenarioName: { type: "string" },
          },
          required: [
            "persona",
            "industry",
            "companySize",
            "annualRevenue",
            "currentKPIs",
            "selectedActions",
            "timeframe",
          ],
        },
      },
      {
        name: "compare_business_scenarios",
        description: "Compare multiple business case scenarios",
        inputSchema: {
          type: "object",
          properties: {
            scenarios: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  persona: {
                    type: "string",
                    enum: [
                      "cfo",
                      "cio",
                      "cto",
                      "coo",
                      "vp_sales",
                      "vp_ops",
                      "vp_engineering",
                      "director_finance",
                      "data_analyst",
                    ],
                  },
                  industry: {
                    type: "string",
                    enum: [
                      "saas",
                      "manufacturing",
                      "healthcare",
                      "finance",
                      "retail",
                      "technology",
                      "professional_services",
                    ],
                  },
                  companySize: { type: "string", enum: ["startup", "scaleup", "enterprise"] },
                  annualRevenue: { type: "number" },
                  currentKPIs: { type: "object" },
                  selectedActions: { type: "array", items: { type: "string" } },
                  timeframe: { type: "string", enum: ["30d", "90d", "180d", "365d"] },
                },
                required: [
                  "name",
                  "persona",
                  "industry",
                  "companySize",
                  "annualRevenue",
                  "currentKPIs",
                  "selectedActions",
                  "timeframe",
                ],
              },
            },
          },
          required: ["scenarios"],
        },
      },

      // Reasoning Engine Tools
      {
        name: "generate_strategic_recommendations",
        description: "Generate strategic recommendations based on current state and goals",
        inputSchema: {
          type: "object",
          properties: {
            persona: {
              type: "string",
              enum: [
                "cfo",
                "cio",
                "cto",
                "coo",
                "vp_sales",
                "vp_ops",
                "vp_engineering",
                "director_finance",
                "data_analyst",
              ],
            },
            industry: {
              type: "string",
              enum: [
                "saas",
                "manufacturing",
                "healthcare",
                "finance",
                "retail",
                "technology",
                "professional_services",
              ],
            },
            companySize: { type: "string", enum: ["startup", "scaleup", "enterprise"] },
            currentKPIs: { type: "object" },
            goals: { type: "array", items: { type: "string" } },
            constraints: {
              type: "object",
              properties: {
                maxInvestment: { type: "number" },
                maxTime: { type: "number" },
                minROI: { type: "number" },
                riskTolerance: { type: "string", enum: ["low", "medium", "high"] },
                preferredQuickWins: { type: "boolean" },
              },
            },
          },
          required: ["persona", "industry", "companySize", "currentKPIs", "goals"],
        },
      },

      // Audit Trail Tools
      {
        name: "query_audit_trail",
        description: "Query the audit trail for compliance and analysis",
        inputSchema: {
          type: "object",
          properties: {
            startTime: { type: "string", format: "date-time" },
            endTime: { type: "string", format: "date-time" },
            level: {
              type: "array",
              items: { type: "string", enum: ["DEBUG", "INFO", "WARN", "ERROR", "CRITICAL"] },
            },
            category: {
              type: "array",
              items: {
                type: "string",
                enum: [
                  "VALIDATION",
                  "CALCULATION",
                  "DECISION",
                  "EVIDENCE",
                  "COMPLIANCE",
                  "ERROR",
                  "PERFORMANCE",
                  "SECURITY",
                ],
              },
            },
            component: { type: "array", items: { type: "string" } },
            operation: { type: "array", items: { type: "string" } },
            correlationId: { type: "string" },
            sessionId: { type: "string" },
            userId: { type: "string" },
            minConfidence: { type: "number", minimum: 0, maximum: 1 },
          },
        },
      },
      {
        name: "generate_compliance_report",
        description: "Generate compliance report for a specific period",
        inputSchema: {
          type: "object",
          properties: {
            startTime: { type: "string", format: "date-time", required: true },
            endTime: { type: "string", format: "date-time", required: true },
          },
          required: ["startTime", "endTime"],
        },
      },
      {
        name: "verify_audit_integrity",
        description: "Verify the integrity of the audit trail (tamper detection)",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "get_compliance_dashboard",
        description: "Get compliance dashboard data",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
    ];

    return [...baseTools, ...phase3Tools];
  }

  /**
   * Execute an MCP tool (base + Phase 3)
   */
  async executeTool(toolName: string, args: Record<string, any>): Promise<any> {
    // Log tool execution for audit trail
    if (this.auditManager) {
      this.auditManager.log({
        level: "INFO",
        category: "DECISION",
        component: "MCP_Server",
        operation: toolName,
        inputs: args,
        outputs: {},
        confidence: 1.0,
        reasoning: `MCP tool ${toolName} execution requested`,
        evidence: [],
        metadata: { toolName },
      });
    }

    try {
      // Check if it's a Phase 3 tool
      if (
        toolName.startsWith("get_kpi_") ||
        toolName.startsWith("calculate_") ||
        toolName.startsWith("get_cascading_") ||
        toolName.startsWith("get_causal_") ||
        toolName.startsWith("simulate_") ||
        toolName.startsWith("compare_") ||
        toolName.startsWith("generate_") ||
        toolName.startsWith("query_") ||
        toolName.startsWith("verify_") ||
        toolName.startsWith("get_compliance_")
      ) {
        return await this.executePhase3Tool(toolName, args);
      }

      // Fall back to base server for existing tools
      return await super.executeTool(toolName, args);
    } catch (error) {
      // Log errors for audit trail
      if (this.auditManager) {
        this.auditManager.log({
          level: "ERROR",
          category: "ERROR",
          component: "MCP_Server",
          operation: toolName,
          inputs: args,
          outputs: { error: error instanceof Error ? error.message : "Unknown error" },
          confidence: 0,
          reasoning: `Tool execution failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          evidence: [],
          metadata: { toolName, error: String(error) },
        });
      }

      throw error;
    }
  }

  /**
   * Execute Phase 3 specific tools
   */
  private async executePhase3Tool(toolName: string, args: Record<string, any>): Promise<any> {
    switch (toolName) {
      // Structural Truth Tools
      case "get_kpi_formula":
        return await this.getKPIFormula(args as { kpiId: string; industry?: string });

      case "calculate_kpi_value":
        return await this.calculateKPIValue(args as { kpiId: string; inputs: any[] });

      case "get_cascading_impacts":
        return await this.getCascadingImpacts(
          args as { rootKpi: string; changeAmount: number; maxDepth?: number }
        );

      // Causal Truth Tools
      case "get_causal_impact":
        return await this.getCausalImpact(
          args as {
            action: string;
            kpi: string;
            persona: string;
            industry: string;
            companySize: string;
          }
        );

      case "simulate_action_outcome":
        return await this.simulateActionOutcome(
          args as {
            action: string;
            baseline: any[];
            persona: string;
            industry: string;
            companySize: string;
          }
        );

      case "compare_scenarios":
        return await this.compareScenarios(args as { scenarios: any[] });

      case "get_cascading_effects":
        return await this.getCascadingEffects(
          args as {
            action: string;
            rootKpi: string;
            maxDepth?: number;
            persona: string;
            industry: string;
            companySize: string;
          }
        );

      case "get_recommendations_for_kpi":
        return await this.getRecommendationsForKPI(
          args as {
            targetKpi: string;
            targetImprovement: number;
            persona: string;
            industry: string;
            companySize: string;
            constraints?: any;
          }
        );

      // Business Case Generation Tools
      case "generate_business_case":
        return await this.generateBusinessCase(args as { scenarios: any[] });

      case "compare_business_scenarios":
        return await this.compareBusinessScenarios(args as { scenarios: any[] });

      // Reasoning Engine Tools
      case "generate_strategic_recommendations":
        return await this.generateStrategicRecommendations(
          args as {
            action: string;
            rootKpi: string;
            maxDepth?: number;
            persona: string;
            industry: string;
            companySize: string;
          }
        );

      // Audit Trail Tools
      case "query_audit_trail":
        return await this.queryAuditTrail(args as { startTime: string; endTime: string });

      case "generate_compliance_report":
        return await this.generateComplianceReport(args as { startTime: string; endTime: string });

      case "verify_audit_integrity":
        return await this.verifyAuditIntegrity(args);

      case "get_compliance_dashboard":
        return await this.getComplianceDashboard(args);

      default:
        throw new Error(`Unknown Phase 3 tool: ${toolName}`);
    }
  }

  // ============================================================================
  // Phase 3 Tool Implementations
  // ============================================================================

  private async getKPIFormula(args: { kpiId: string; industry?: string }) {
    const registry = this.structuralTruth.getFormulaRegistry();
    const formulas = registry.getFormulasForKPI(args.kpiId);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              kpiId: args.kpiId,
              formulas: formulas,
              dependencies: this.structuralTruth.getDependencies(args.kpiId),
              dependents: this.structuralTruth.getDependents(args.kpiId),
            },
            null,
            2
          ),
        },
      ],
    };
  }

  private async calculateKPIValue(args: { kpiId: string; inputs: any[] }) {
    const registry = this.structuralTruth.getFormulaRegistry();
    const formulas = registry.getFormulasForKPI(args.kpiId);

    if (formulas.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ error: "No formula found for KPI" }, null, 2),
          },
        ],
        isError: true,
      };
    }

    const result = registry.evaluate(formulas[0].formula_id, args.inputs);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  private async getCascadingImpacts(args: {
    rootKpi: string;
    changeAmount: number;
    maxDepth?: number;
  }) {
    const impacts = this.structuralTruth.calculateCascadingImpact(
      args.rootKpi,
      args.changeAmount,
      args.maxDepth || 3
    );

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              rootKpi: args.rootKpi,
              changeAmount: args.changeAmount,
              impacts: impacts,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  private async getCausalImpact(args: {
    action: string;
    kpi: string;
    persona: string;
    industry: string;
    companySize: string;
  }) {
    const impact = this.causalTruth.getImpactForAction(
      args.action as any,
      args.persona as any,
      args.industry as any,
      args.companySize as any
    );

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(impact, null, 2),
        },
      ],
    };
  }

  private async simulateActionOutcome(args: {
    action: string;
    baseline: any[];
    persona: string;
    industry: string;
    companySize: string;
  }) {
    const baselineMap: Record<string, number> = {};
    args.baseline.forEach((item) => {
      baselineMap[item.kpi] = item.value;
    });

    const result = this.causalTruth.simulateScenario(
      [args.action as any],
      baselineMap,
      args.persona as any,
      args.industry as any,
      args.companySize as any
    );

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  private async compareScenarios(args: { scenarios: any[] }) {
    const results = [];

    for (const scenario of args.scenarios) {
      const baselineMap: Record<string, number> = {};
      scenario.baseline.forEach((item: any) => {
        baselineMap[item.kpi] = item.value;
      });

      const result = this.causalTruth.simulateScenario(
        scenario.actions,
        baselineMap,
        scenario.persona as any,
        scenario.industry as any,
        scenario.companySize as any
      );

      results.push(result);
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(results, null, 2),
        },
      ],
    };
  }

  private async getCascadingEffects(args: {
    action: string;
    rootKpi: string;
    maxDepth?: number;
    persona: string;
    industry: string;
    companySize: string;
  }) {
    const effects = this.causalTruth.getCascadingEffects(
      args.action as any,
      args.rootKpi,
      args.maxDepth || 2,
      args.persona as any,
      args.industry as any,
      args.companySize as any
    );

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(effects, null, 2),
        },
      ],
    };
  }

  private async getRecommendationsForKPI(args: {
    targetKpi: string;
    targetImprovement: number;
    persona: string;
    industry: string;
    companySize: string;
    constraints?: any;
  }) {
    const recommendations = this.causalTruth.getRecommendationsForKPI(
      args.targetKpi,
      args.targetImprovement,
      args.persona as any,
      args.industry as any,
      args.companySize as any,
      args.constraints || {}
    );

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(recommendations, null, 2),
        },
      ],
    };
  }

  private async generateBusinessCase(args: any) {
    const result = await this.businessCaseGenerator.generateBusinessCase(args);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  private async compareBusinessScenarios(args: { scenarios: any[] }) {
    const results = [];

    for (const scenario of args.scenarios) {
      const result = await this.businessCaseGenerator.generateBusinessCase(scenario);
      results.push({
        name: scenario.name,
        result,
      });
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(results, null, 2),
        },
      ],
    };
  }

  private async generateStrategicRecommendations(args: any) {
    const result = await this.reasoningEngine.generateRecommendations(args);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  private async queryAuditTrail(args: any) {
    const entries = this.auditManager.query(args);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              total: entries.length,
              entries: entries,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  private async generateComplianceReport(args: { startTime: string; endTime: string }) {
    const report = this.auditManager.generateComplianceReport(args.startTime, args.endTime);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(report, null, 2),
        },
      ],
    };
  }

  private async verifyAuditIntegrity(args: any) {
    const result = this.auditManager.verifyIntegrity();

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  private async getComplianceDashboard(args: any) {
    const dashboard = this.complianceMonitor.getDashboardData();

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(dashboard, null, 2),
        },
      ],
    };
  }

  /**
   * Enhanced health check including Phase 3 components
   */
  async healthCheck(): Promise<{
    status: "healthy" | "degraded" | "unhealthy";
    details: any;
  }> {
    const baseHealth = await super.healthCheck();

    // Check Phase 3 components
    const structuralHealth = this.structuralTruth.getGraph().nodes.length > 0;
    const causalHealth = this.causalTruth.getAvailableActions().length > 0;
    const auditHealth = this.auditManager.getCount() >= 0;

    const allHealthy =
      baseHealth.status === "healthy" && structuralHealth && causalHealth && auditHealth;

    return {
      status: allHealthy ? "healthy" : "degraded",
      details: {
        ...baseHealth.details,
        phase3: {
          structuralTruth: structuralHealth,
          causalTruth: causalHealth,
          businessCaseGenerator: true,
          reasoningEngine: true,
          auditTrail: auditHealth,
          auditEntries: this.auditManager.getCount(),
        },
      },
    };
  }
}

/**
 * Factory function to create integrated MCP server
 */
export async function createIntegratedMCPServer(
  config: IntegratedMCPServerConfig
): Promise<IntegratedMCPServer> {
  const server = new IntegratedMCPServer(config);
  await server.initialize();
  return server;
}
