/**
 * Integrity Agent - Enhanced ValueOS Agent
 *
 * Validates ROI models and ensures integrity of value calculations,
 * focusing on mathematical accuracy, data consistency, and compliance.
 *
 * @version 2.0.0
 * @security Level: Critical - Financial validation with veto authority
 */

import {
  BaseAgent,
  AgentExecutionContext,
  AgentResponse,
  AgentCapability,
  AgentTool,
  ToolExecutionContext,
  ToolPermissions,
  ValueLifecycleStage,
  AgentClassification,
  AuthorityLevel,
  RiskCategory,
  MemoryType,
  SecureInvokeInput,
} from "./BaseAgent";
import { z } from "zod";
import { LLMGateway } from "../LLMGateway";
import { MemorySystem } from "../MemorySystem";
import { AuditLogger } from "../AuditLogger";

// ═══════════════════════════════════════════════════════════════════════════
// SCHEMAS & TYPES
// ═══════════════════════════════════════════════════════════════════════════

const ROIModelSchema = z.object({
  modelId: z.string(),
  name: z.string(),
  description: z.string(),
  inputs: z.array(
    z.object({
      name: z.string(),
      value: z.number(),
      unit: z.string(),
      source: z.string(),
      confidence: z.number().min(0).max(1),
    })
  ),
  calculations: z.array(
    z.object({
      step: z.string(),
      formula: z.string(),
      result: z.number(),
      assumptions: z.array(z.string()),
    })
  ),
  outputs: z.object({
    roi: z.number(),
    npv: z.number(),
    irr: z.number(),
    paybackPeriod: z.number(),
    confidence: z.number().min(0).max(1),
  }),
  validation: z.object({
    mathematicalAccuracy: z.number().min(0).max(100),
    dataConsistency: z.number().min(0).max(100),
    assumptionValidity: z.number().min(0).max(100),
    overallScore: z.number().min(0).max(100),
    issues: z.array(
      z.object({
        severity: z.enum(["error", "warning", "info"]),
        category: z.enum(["math", "data", "assumption", "logic"]),
        description: z.string(),
        recommendation: z.string(),
      })
    ),
  }),
  compliance: z.object({
    frameworks: z.array(z.string()),
    validated: z.boolean(),
    exceptions: z.array(z.string()),
    auditTrail: z.array(
      z.object({
        timestamp: z.string(),
        action: z.string(),
        result: z.string(),
      })
    ),
  }),
  hallucination_check: z.boolean().optional(),
});

export interface ROIModel extends z.infer<typeof ROIModelSchema> {}

// ═══════════════════════════════════════════════════════════════════════════
// ENHANCED INTEGRITY AGENT
// ═══════════════════════════════════════════════════════════════════════════

export class IntegrityAgent extends BaseAgent {
  // ═══════════════════════════════════════════════════════════════════════════
  // IDENTITY & METADATA
  // ═══════════════════════════════════════════════════════════════════════════

  readonly agentId = "integrity-agent";
  readonly name = "Integrity Agent";
  readonly version = "2.0.0";
  readonly lifecycleStage = ValueLifecycleStage.GOVERNANCE;
  readonly authorityLevel = AuthorityLevel.GOVERNOR; // Can veto financial decisions
  readonly classification = AgentClassification.LIFECYCLE;

  // ═══════════════════════════════════════════════════════════════════════════
  // CONSTRUCTOR
  // ═══════════════════════════════════════════════════════════════════════════

  constructor(config: {
    llmGateway: LLMGateway;
    memorySystem: MemorySystem;
    auditLogger: AuditLogger;
    telemetryService?: any;
    policyEngine?: any;
    circuitBreaker?: any;
  }) {
    super(config);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ABSTRACT METHOD IMPLEMENTATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  getCapabilities(): AgentCapability[] {
    return [
      {
        id: "roi_validation",
        name: "ROI Model Validation",
        description:
          "Comprehensive validation of ROI models including mathematical accuracy, data consistency, and compliance",
        inputSchema: z.object({
          modelData: z.record(z.any()),
          tenantId: z.string(),
        }),
        outputSchema: ROIModelSchema,
        riskCategory: RiskCategory.FINANCIAL,
        requiredAuthority: AuthorityLevel.GOVERNOR,
      },
      {
        id: "mathematical_accuracy_check",
        name: "Mathematical Accuracy Check",
        description: "Verify mathematical correctness of financial calculations",
        inputSchema: z.object({
          calculations: z.array(z.any()),
          tenantId: z.string(),
        }),
        outputSchema: z.object({
          accuracy: z.number(),
          issues: z.array(z.string()),
          hallucination_check: z.boolean().optional(),
        }),
        riskCategory: RiskCategory.FINANCIAL,
        requiredAuthority: AuthorityLevel.VALIDATOR,
      },
      {
        id: "compliance_validation",
        name: "Compliance Validation",
        description: "Validate financial models against regulatory frameworks",
        inputSchema: z.object({
          modelData: z.record(z.any()),
          frameworks: z.array(z.string()),
          tenantId: z.string(),
        }),
        outputSchema: z.object({
          compliant: z.boolean(),
          frameworks: z.array(z.string()),
          exceptions: z.array(z.string()),
          hallucination_check: z.boolean().optional(),
        }),
        riskCategory: RiskCategory.GOVERNANCE,
        requiredAuthority: AuthorityLevel.VALIDATOR,
      },
    ];
  }

  getTools(): AgentTool[] {
    return [
      {
        id: "roi_calculator",
        name: "ROI Calculator",
        description: "Calculate ROI metrics from input data",
        inputSchema: z.object({
          investment: z.number(),
          returns: z.number(),
          timePeriod: z.number().optional(),
        }),
        execute: async (input: any, context: ToolExecutionContext) => {
          const roi = ((input.returns - input.investment) / input.investment) * 100;
          return { roi, investment: input.investment, returns: input.returns };
        },
        permissions: { read: true, write: false },
      },
      {
        id: "npv_calculator",
        name: "NPV Calculator",
        description: "Calculate Net Present Value",
        inputSchema: z.object({
          cashFlows: z.array(z.number()),
          discountRate: z.number(),
        }),
        execute: async (input: any, context: ToolExecutionContext) => {
          const npv = input.cashFlows.reduce((sum: number, flow: number, index: number) => {
            return sum + flow / Math.pow(1 + input.discountRate, index);
          }, 0);
          return { npv, cashFlows: input.cashFlows, discountRate: input.discountRate };
        },
        permissions: { read: true, write: false },
      },
    ];
  }

  async processRequest(context: AgentExecutionContext): Promise<AgentResponse> {
    const { intent, tenantId, sessionId, payload } = context;

    try {
      switch (intent) {
        case "validate_roi_model":
          return await this.validateROIModelRequest(payload, tenantId, sessionId);

        case "check_mathematical_accuracy":
          return await this.checkMathematicalAccuracyRequest(payload, tenantId, sessionId);

        case "validate_compliance":
          return await this.validateComplianceRequest(payload, tenantId, sessionId);

        default:
          return {
            success: false,
            error: {
              code: "INVALID_INTENT",
              message: `Unknown intent: ${intent}`,
            },
          };
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: "PROCESSING_ERROR",
          message: error instanceof Error ? error.message : "Unknown error",
        },
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BUSINESS LOGIC METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  private async validateROIModelRequest(
    payload: any,
    tenantId: string,
    sessionId: string
  ): Promise<AgentResponse> {
    const input: SecureInvokeInput = {
      prompt: `Validate the following ROI model for mathematical accuracy, data consistency, and compliance:

${JSON.stringify(payload.modelData, null, 2)}

Provide a comprehensive validation report including:
1. Mathematical accuracy assessment
2. Data consistency checks
3. Assumption validity evaluation
4. Compliance verification
5. Overall confidence score
6. Specific issues and recommendations

Respond with a structured JSON object matching the ROIModel schema.`,
      context: {
        tenantId,
        sessionId,
        additionalContext: { validationType: "comprehensive" },
      },
    };

    const result = await this.secureInvoke(sessionId, input, ROIModelSchema, {
      riskCategory: RiskCategory.FINANCIAL,
      requireHighConfidence: true,
      tenantId,
    });

    if (!result.success || !result.data) {
      return {
        success: false,
        error: result.error,
        metadata: {
          executionTime: 0,
          confidence: "low",
        },
      };
    }

    // Store validation results in memory
    await this.storeMemory(
      MemoryType.SEMANTIC,
      `roi-validation-${result.data.modelId}`,
      result.data,
      {
        tenantId,
        agentId: this.agentId,
        confidence: result.metadata.confidenceScore,
      }
    );

    return {
      success: true,
      data: result.data,
      metadata: {
        executionTime: result.metadata.latencyMs,
        confidence: result.metadata.confidenceLevel.toLowerCase() as any,
      },
    };
  }

  private async checkMathematicalAccuracyRequest(
    payload: any,
    tenantId: string,
    sessionId: string
  ): Promise<AgentResponse> {
    const accuracySchema = z.object({
      accuracy: z.number().min(0).max(100),
      issues: z.array(z.string()),
      recommendations: z.array(z.string()),
      hallucination_check: z.boolean().optional(),
    });

    const input: SecureInvokeInput = {
      prompt: `Check the mathematical accuracy of these financial calculations:

${JSON.stringify(payload.calculations, null, 2)}

Verify formulas, calculations, and numerical consistency. Identify any errors or inconsistencies.`,
      context: {
        tenantId,
        sessionId,
        additionalContext: { checkType: "mathematical" },
      },
    };

    const result = await this.secureInvoke(sessionId, input, accuracySchema, {
      riskCategory: RiskCategory.FINANCIAL,
      tenantId,
    });

    if (!result.success || !result.data) {
      return {
        success: false,
        error: result.error,
      };
    }

    return {
      success: true,
      data: result.data,
      metadata: {
        executionTime: result.metadata.latencyMs,
        confidence: result.metadata.confidenceLevel.toLowerCase() as any,
      },
    };
  }

  private async validateComplianceRequest(
    payload: any,
    tenantId: string,
    sessionId: string
  ): Promise<AgentResponse> {
    const complianceSchema = z.object({
      compliant: z.boolean(),
      frameworks: z.array(z.string()),
      exceptions: z.array(z.string()),
      auditTrail: z.array(
        z.object({
          timestamp: z.string(),
          action: z.string(),
          result: z.string(),
        })
      ),
      hallucination_check: z.boolean().optional(),
    });

    const input: SecureInvokeInput = {
      prompt: `Validate this financial model against the specified compliance frameworks:

Model Data:
${JSON.stringify(payload.modelData, null, 2)}

Frameworks to check:
${payload.frameworks.join(", ")}

Provide compliance assessment and any exceptions.`,
      context: {
        tenantId,
        sessionId,
        additionalContext: { checkType: "compliance" },
      },
    };

    const result = await this.secureInvoke(sessionId, input, complianceSchema, {
      riskCategory: RiskCategory.GOVERNANCE,
      tenantId,
    });

    if (!result.success || !result.data) {
      return {
        success: false,
        error: result.error,
      };
    }

    return {
      success: true,
      data: result.data,
      metadata: {
        executionTime: result.metadata.latencyMs,
        confidence: result.metadata.confidenceLevel.toLowerCase() as any,
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LEGACY COMPATIBILITY METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  async execute(
    sessionId: string,
    input: any,
    context?: Record<string, any>
  ): Promise<AgentResponse> {
    // Convert legacy format to new format
    const executionContext: AgentExecutionContext = {
      intent: input.intent || "validate_roi_model",
      tenantId: context?.tenantId || input.tenantId || "unknown",
      sessionId,
      payload: input,
      userId: context?.userId,
    };

    return this.processRequest(executionContext);
  }

  getAgentType(): any {
    return "integrity";
  }
}
