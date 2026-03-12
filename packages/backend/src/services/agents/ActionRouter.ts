/**
 * Action Router
 *
 * Central router for all user interactions in the SDUI system.
 * Enforces governance, validates actions, and routes to appropriate handlers.
 */

import { randomUUID } from "crypto";

import { SDUIPageDefinition } from "@valueos/sdui";
import {
  ActionContext,
  ActionHandler,
  ActionResult,
  CanonicalAction,
  ManifestoCheckResult,
  ValidationResult,
} from "@valueos/shared/types/actions";

import { logger } from "../lib/logger.js";
import { EnforcementResult, enforceRules } from "../lib/rules";
import { getSupabaseClient } from "../lib/supabase.js";
import {
  ActionValidationError,
  validateActionContext,
  validateCanonicalAction,
} from "../schemas/actions.schema.js";
import { normalizeExecutionRequest } from "../types/execution";
import {
  downloadBlob,
  exportToCSV,
  exportToExcel,
  exportToPDF,
  exportToPNG,
  generateFilename,
} from "../utils/export";

import type { AgentType } from "./agent-types.js";
import { AgentAPI, getAgentAPI } from "./AgentAPI.js";
import { assumptionService } from "./AssumptionService.js";
import { atomicActionExecutor } from "./AtomicActionExecutor.js";
import { AuditLogService } from "./AuditLogService.js";
import { canvasSchemaService } from "./CanvasSchemaService.js";
import { ComponentMutationService } from "./ComponentMutationService.js";
import { manifestoEnforcer } from "./ManifestoEnforcer.js";
import { createExecutionRuntime } from "../runtime/execution-runtime/index.js";
import type { IExecutionRuntime } from "../../types/execution/IExecutionRuntime.js";
import { LifecycleContext, ValueTreeService, ValueTreeUpdate } from "./ValueTreeService.js";
import { workspaceStateService } from "./WorkspaceStateService.js";



/**
 * Action Router
 */
export class ActionRouter {
  private handlers: Map<string, ActionHandler>;
  private auditLogService: AuditLogService;
  private executionRuntime: IExecutionRuntime;
  private agentAPI: AgentAPI;
  private valueTreeService: ValueTreeService | undefined;

  private componentMutationService: ComponentMutationService;

  constructor(
    auditLogService?: AuditLogService,
    _orchestrator?: unknown,
    agentAPI?: AgentAPI,
    componentMutationService?: ComponentMutationService,
    valueTreeService?: ValueTreeService
  ) {
    this.handlers = new Map();
    this.auditLogService = auditLogService || new AuditLogService();
    this.executionRuntime = createExecutionRuntime();
    this.agentAPI = agentAPI || getAgentAPI();
    this.componentMutationService = componentMutationService || new ComponentMutationService();

    // Lazily initialize valueTreeService if not provided
    // We try-catch because getSupabaseClient might fail in some environments (e.g. tests without config)
    // but allowing injection in constructor helps with testing.
    if (valueTreeService) {
      this.valueTreeService = valueTreeService;
    } else {
      try {
        this.valueTreeService = new ValueTreeService(getSupabaseClient());
      } catch (e) {
        logger.warn("Failed to initialize ValueTreeService in ActionRouter constructor", e);
      }
    }

    // Register default handlers
    this.registerDefaultHandlers();
  }

  /**
   * Route an action to appropriate handler
   */
  async routeAction(action: CanonicalAction, context: ActionContext): Promise<ActionResult> {
    const startTime = Date.now();
    const traceId = randomUUID(); // Generate unique trace ID for this request

    // Inject trace ID into context
    const enhancedContext: ActionContext = {
      ...context,
      traceId,
      timestamp: context.timestamp || new Date().toISOString(),
    };

    logger.info("Routing action", {
      actionType: action.type,
      workspaceId: context.workspaceId,
      userId: context.userId,
      traceId,
    });

    let validatedAction: CanonicalAction = action;
    let validatedContext: ActionContext = enhancedContext;
    try {
      // Schema-first validation using Zod
      validatedAction = validateCanonicalAction(action) as unknown as CanonicalAction;
      validatedContext = validateActionContext(enhancedContext) as unknown as ActionContext;

      // CRITICAL: Check Governance Rules (GR/LR) first - Policy-as-Code enforcement
      const governanceCheck = await this.checkGovernanceRules(validatedAction, validatedContext);
      if (!governanceCheck.allowed) {
        logger.error("Governance rules violated - BLOCKING ACTION", {
          actionType: action.type,
          violations: governanceCheck.violations.map((v) => `${v.ruleId}: ${v.message}`),
        });

        return {
          success: false,
          error: `Governance rules violated: ${governanceCheck.violations.map((v) => v.message).join(", ")}`,
          metadata: {
            violations: governanceCheck.violations,
            warnings: governanceCheck.warnings,
          },
        };
      }

      // Check Manifesto rules (business value principles)
      const manifestoCheck = await this.checkManifestoRules(validatedAction, validatedContext);
      if (!manifestoCheck.allowed) {
        logger.warn("Manifesto rules violated", {
          actionType: validatedAction.type,
          violations: manifestoCheck.violations,
          traceId,
        });

        return {
          success: false,
          error: `Manifesto rules violated: ${manifestoCheck.violations.map((v) => v.message).join(", ")}`,
          metadata: {
            violations: manifestoCheck.violations,
            warnings: manifestoCheck.warnings,
            traceId,
          },
        };
      }

      // Get handler for action type
      const handler = this.handlers.get(validatedAction.type);
      if (!handler) {
        logger.error("No handler registered for action type", {
          actionType: validatedAction.type,
          traceId,
        });

        return {
          success: false,
          error: `No handler registered for action type: ${validatedAction.type}`,
        };
      }

      // Execute handler
      const result = await handler.execute(validatedAction, validatedContext);

      // Log action to audit trail
      await this.logAction(validatedAction, validatedContext, result, Date.now() - startTime);

      logger.info("Action routed successfully", {
        actionType: validatedAction.type,
        success: result.success,
        duration: Date.now() - startTime,
        traceId,
      });

      return result;
    } catch (error) {
      // Handle validation errors specifically
      if (error instanceof ActionValidationError) {
        logger.error("Action validation failed", {
          actionType: error.actionType,
          issues: error.issues,
          traceId,
        });

        return {
          success: false,
          error: `Validation failed: ${error.message}`,
          metadata: { traceId },
        };
      }

      logger.error("Action routing failed", {
        actionType: validatedAction?.type || "unknown",
        error: error instanceof Error ? error.message : String(error),
        traceId,
      });

      // Log error to audit trail
      await this.logAction(
        validatedAction || action,
        validatedContext || context,
        {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        },
        Date.now() - startTime
      );

      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Validate action before routing
   * @deprecated Use validateCanonicalAction from schemas/actions.schema.ts for schema-first validation
   */
  validateAction(action: CanonicalAction): ValidationResult {
    try {
      validateCanonicalAction(action);
      return { valid: true, errors: [] };
    } catch (error) {
      if (error instanceof ActionValidationError) {
        return { valid: false, errors: [error.message] };
      }
      return { valid: false, errors: [String(error)] };
    }
  }

  /**
   * Check Manifesto rules for action
   */
  async checkManifestoRules(
    action: CanonicalAction,
    context: ActionContext
  ): Promise<ManifestoCheckResult> {
    try {
      // ManifestoEnforcer uses sdui-integration types; adapt to shared types
      const result = await manifestoEnforcer.checkAction(
        action as unknown as Parameters<typeof manifestoEnforcer.checkAction>[0],
        context as unknown as Parameters<typeof manifestoEnforcer.checkAction>[1]
      );

      // sdui-integration types have optional violations/warnings
      const rawViolations = result.violations ?? [];
      const rawWarnings = result.warnings ?? [];

      // Log violations and warnings
      if (rawViolations.length > 0) {
        logger.warn("Manifesto rule violations detected", {
          actionType: action.type,
          violations: rawViolations.map((v) => v.ruleId),
        });
      }

      if (rawWarnings.length > 0) {
        logger.info("Manifesto rule warnings", {
          actionType: action.type,
          warnings: rawWarnings,
        });
      }

      // Normalize violations to shared ManifestoViolation shape
      const violations: ManifestoCheckResult["violations"] = rawViolations.map(
        (v) => ({
          ruleId: v.ruleId ?? "unknown",
          ruleName: v.ruleName ?? "unknown",
          severity: v.severity as "error" | "warning" | "info",
          message: v.message ?? "",
          path: v.path,
          suggestion: v.suggestion,
        })
      );

      // sdui-integration warnings are strings; wrap into ManifestoViolation shape
      const warnings: ManifestoCheckResult["warnings"] = rawWarnings.map(
        (w) => ({
          ruleId: "manifesto-warning",
          ruleName: "Manifesto Warning",
          severity: "warning" as const,
          message: typeof w === "string" ? w : String(w),
        })
      );

      return { allowed: result.allowed ?? true, violations, warnings };
    } catch (error) {
      logger.error("Failed to check Manifesto rules", {
        actionType: action.type,
        error: error instanceof Error ? error.message : String(error),
      });

      // On error, allow action but log warning
      return {
        allowed: true,
        violations: [],
        warnings: [
          {
            ruleId: "SYSTEM",
            ruleName: "System",
            severity: "warning",
            message: "Manifesto rules check failed",
            suggestion: "Manual review recommended",
          },
        ],
      };
    }
  }

  /**
   * Check Governance Rules (GR/LR) - Policy-as-Code enforcement
   * CRITICAL: This must run before any action execution
   */
  async checkGovernanceRules(
    action: CanonicalAction,
    context: ActionContext
  ): Promise<EnforcementResult> {
    try {
      // Build governance rule context from action
      const governanceResult = await enforceRules({
        agentId: `action-router-${action.type}`,
        agentType: this.mapActionToAgentType(action.type),
        userId: context.userId,
        tenantId: context.workspaceId, // Use workspaceId as tenantId
        sessionId: context.sessionId || `session-${Date.now()}`,
        action: action.type,
        payload: action,
        environment:
          (process.env.NODE_ENV as "development" | "staging" | "production") || "development",
      });

      // Log governance enforcement result
      if (!governanceResult.allowed) {
        logger.error("GOVERNANCE VIOLATION - ACTION BLOCKED", {
          actionType: action.type,
          userId: context.userId,
          tenantId: context.workspaceId,
          violations: governanceResult.violations.map((v) => `${v.ruleId}: ${v.message}`),
          globalRulesChecked: governanceResult.metadata?.globalRulesChecked,
          localRulesChecked: governanceResult.metadata?.localRulesChecked,
        });
      } else {
        logger.debug("Governance rules passed", {
          actionType: action.type,
          globalRulesChecked: governanceResult.metadata?.globalRulesChecked,
          localRulesChecked: governanceResult.metadata?.localRulesChecked,
          warnings: governanceResult.warnings.length,
        });
      }

      return governanceResult;
    } catch (error) {
      logger.error("CRITICAL: Governance rules check failed - FAILING SAFE", {
        actionType: action.type,
        error: error instanceof Error ? error.message : String(error),
      });

      // CRITICAL: On governance failure, BLOCK action (fail-closed)
      return {
        allowed: false,
        violations: [
          {
            ruleId: "SYSTEM",
            ruleName: "Governance System Error",
            severity: "critical",
            message: "Governance rules enforcement failed - action blocked for safety",
          },
        ],
        warnings: [],
        metadata: {
          globalRulesChecked: 0,
          localRulesChecked: 0,
          timestamp: Date.now(),
          requestId: `error-${Date.now()}`,
        },
      };
    }
  }

  /**
   * Map action type to agent type for governance rules
   */
  private mapActionToAgentType(
    actionType: string
  ):
    | "coordinator"
    | "system_mapper"
    | "intervention_designer"
    | "outcome_engineer"
    | "realization_loop"
    | "value_eval"
    | "communicator" {
    // Map action types to agent types for governance rules
    const actionToAgentMap: Record<
      string,
      | "coordinator"
      | "system_mapper"
      | "intervention_designer"
      | "outcome_engineer"
      | "realization_loop"
      | "value_eval"
      | "communicator"
    > = {
      invokeAgent: "coordinator",
      updateValueTree: "outcome_engineer",
      exportArtifact: "communicator",
      navigateToStage: "coordinator",
      createSystemMap: "system_mapper",
      designIntervention: "intervention_designer",
      trackMetrics: "realization_loop",
      evaluateValue: "value_eval",
      sendMessage: "communicator",
    };

    return actionToAgentMap[actionType] || "coordinator"; // Default to coordinator
  }

  /**
   * Validate value tree structure
   */
  private validateValueTreeStructure(updates: unknown): boolean {
    // Check if updates maintain standard structure
    if (!updates || typeof updates !== "object") return true;

    const record = updates as Record<string, unknown>;

    // If updating structure, ensure it has required fields
    if (record.structure && typeof record.structure === "object") {
      const structure = record.structure as Record<string, unknown>;
      return (
        structure.capabilities !== undefined &&
        structure.outcomes !== undefined &&
        structure.kpis !== undefined
      );
    }

    return true;
  }

  /**
   * Validate assumption evidence
   */
  private validateAssumptionEvidence(updates: unknown): boolean {
    // Check if assumption has evidence source
    if (!updates || typeof updates !== "object") return true;

    const record = updates as Record<string, unknown>;

    if (typeof record.source === "string") {
      return record.source !== "estimate" && record.source.length > 0;
    }

    return true;
  }

  /**
   * Register action handler
   */
  registerHandler(actionType: string, handler: ActionHandler | ((action: CanonicalAction, context: ActionContext) => Promise<ActionResult>)): void {
    const normalized: ActionHandler = typeof handler === "function"
      ? { name: actionType, execute: handler as ActionHandler["execute"] }
      : handler;
    this.handlers.set(actionType, normalized);
    logger.debug("Registered action handler", { actionType });
  }

  /**
   * Register default handlers for all action types
   */
  private registerDefaultHandlers(): void {
    // invokeAgent handler
    this.registerHandler("invokeAgent", async (action: CanonicalAction, context: ActionContext): Promise<ActionResult> => {
      if (action.type !== "invokeAgent") {
        return { success: false, error: "Invalid action type" };
      }

      try {
        const rawExecution = (action.execution ?? context.execution ?? {}) as Record<string, unknown>;
        const execution = normalizeExecutionRequest({
          agent_id: "action-router",
          ...rawExecution,
        });
        const agentContext = {
          ...execution.parameters,
          ...action.payload,
          intent: execution.intent,
          environment: execution.environment,
          workspaceId: context.workspaceId,
          userId: context.userId,
          sessionId: context.sessionId,
          timestamp: context.timestamp,
          metadata: {
            ...execution.metadata,
            ...context.metadata,
          },
        };

        // Route to agent API
        const result = await this.agentAPI.invokeAgent({
          agent: action.agentId as AgentType,
          query: String(action.input ?? ""),
          context: agentContext,
        });

        return {
          success: true,
          data: result,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });

    // runWorkflowStep handler
    this.registerHandler("runWorkflowStep", async (action: CanonicalAction, context: ActionContext): Promise<ActionResult> => {
      if (action.type !== "runWorkflowStep") {
        return { success: false, error: "Invalid action type" };
      }

      try {
        // Route to workflow orchestrator
        const envelope = {
          intent: "run-workflow-step",
          actor: { id: context.userId },
          organizationId: context.organizationId || "unknown",
          entryPoint: "action-router",
          reason: "workflow-step",
          timestamps: { requestedAt: new Date().toISOString() },
        } as const;
        const result = await this.executionRuntime.executeWorkflow(
          envelope,
          action.workflowId,
          { stepId: action.stepId, ...context },
          context.userId
        );

        return {
          success: true,
          data: result,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });

    // updateValueTree handler
    this.registerHandler("updateValueTree", async (action: CanonicalAction, context: ActionContext): Promise<ActionResult> => {
      if (action.type !== "updateValueTree") {
        return { success: false, error: "Invalid action type" };
      }

      if (!this.valueTreeService) {
        // Try to init if missing (e.g. if env vars were missing at startup but now available)
        try {
          this.valueTreeService = new ValueTreeService(getSupabaseClient());
        } catch (e) {
          logger.error("ValueTreeService not available", e);
          return { success: false, error: "ValueTreeService not available" };
        }
      }

      // Validate structure
      if (!this.validateValueTreeStructure(action.updates)) {
        return { success: false, error: "Invalid value tree structure updates" };
      }

      try {
        const lifecycleContext: LifecycleContext = {
          userId: context.userId,
          organizationId: context.organizationId,
          sessionId: context.sessionId,
        };

        const result = await this.valueTreeService.updateValueTree(
          action.treeId,
          action.updates as ValueTreeUpdate,
          lifecycleContext
        );

        return {
          success: true,
          data: {
            treeId: result.id,
            updated: true,
            version: result.version,
          },
        };
      } catch (error) {
        logger.error("Failed to update value tree", {
          treeId: action.treeId,
          error: error instanceof Error ? error.message : String(error),
        });

        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });

    // updateAssumption handler
    this.registerHandler("updateAssumption", async (action: CanonicalAction, context: ActionContext): Promise<ActionResult> => {
      if (action.type !== "updateAssumption") {
        return { success: false, error: "Invalid action type" };
      }

      try {
        const result = await assumptionService.updateAssumption(
          action.assumptionId,
          action.updates as Record<string, unknown>,
          {
            userId: context.userId,
            externalSub: typeof context.metadata?.auth0_sub === "string" ? context.metadata.auth0_sub : undefined,
            sessionId: context.sessionId,
            valueCaseId: context.workspaceId,
            organizationId: context.organizationId,
          }
        );

        return {
          success: true,
          data: result,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });

    // exportArtifact handler
    this.registerHandler("exportArtifact", async (action: CanonicalAction, context: ActionContext): Promise<ActionResult> => {
      if (action.type !== "exportArtifact") {
        return { success: false, error: "Invalid action type" };
      }

      // Check if running in browser environment
      if (typeof window === "undefined" || typeof document === "undefined") {
        return {
          success: false,
          error: "Export is only supported in browser environment",
        };
      }

      try {
        const { artifactType, format } = action;
        const filename = generateFilename(artifactType, format);
        let blob: Blob;

        if (format === "pdf") {
          blob = await exportToPDF({ artifactType }, { filename });
        } else if (format === "png") {
          blob = await exportToPNG(artifactType, { filename });
        } else if (format === "excel" || format === "csv") {
          // For data exports, fetch data from workspace state
          const workspaceId = context.workspaceId ?? "";
          const state = await workspaceStateService.getState(workspaceId);
          let dataToExport: unknown[] = [];

          // Strategy:
          // 1. Check if state.data[artifactType] exists and is an array -> use it
          // 2. If it is an object -> wrap in array
          // 3. If generic export -> export whole state.data

          if (state.data && state.data[artifactType]) {
            const targetData = state.data[artifactType];
            if (Array.isArray(targetData)) {
              dataToExport = targetData;
            } else {
              dataToExport = [targetData];
            }
          } else {
            // Fallback: if artifactType doesn't match a specific key,
            // check if there is any data to export at all
            if (state.data && Object.keys(state.data).length > 0) {
              dataToExport = [state.data];
            } else {
              return { success: false, error: `No data found for artifact type: ${artifactType}` };
            }
          }

          if (format === "csv") {
            const csvContent = exportToCSV(dataToExport);
            blob = new Blob([csvContent], { type: "text/csv" });
          } else {
            blob = await exportToExcel(dataToExport, { sheetName: artifactType });
          }
        } else {
          return { success: false, error: `Unsupported format: ${format}` };
        }

        // Trigger download
        downloadBlob(blob, filename);

        return {
          success: true,
          data: { artifactType, format, exported: true, filename },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });

    // openAuditTrail handler
    this.registerHandler("openAuditTrail", async (action: CanonicalAction, context: ActionContext): Promise<ActionResult> => {
      if (action.type !== "openAuditTrail") {
        return { success: false, error: "Invalid action type" };
      }

      try {
        const logs = await this.auditLogService.query({
          tenantId: context.organizationId,
          resourceId: action.entityId,
          resourceType: action.entityType,
          limit: 100,
        });

        return {
          success: true,
          data: {
            entityId: action.entityId,
            entityType: action.entityType,
            logs,
          },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });

    // showExplanation handler
    this.registerHandler("showExplanation", async (action: CanonicalAction, context: ActionContext): Promise<ActionResult> => {
      if (action.type !== "showExplanation") {
        return { success: false, error: "Invalid action type" };
      }

      try {
        // Get current schema
        const currentSchema = await canvasSchemaService.getCachedSchema(context.workspaceId ?? "");

        if (!currentSchema) {
          return {
            success: false,
            error: "No schema available for workspace to explain component",
          };
        }

        const found = this.findComponentById(currentSchema, action.componentId);
        if (!found) {
          return {
            success: false,
            error: `Component not found with ID: ${action.componentId}`,
          };
        }

        const componentData = found.component as Record<string, unknown>;
        const componentName = typeof componentData.component === "string" ? componentData.component : "unknown";
        const componentProps = componentData.props ?? {};

        // Construct context for agent
        const explanationContext = {
          ...context,
          componentName,
          componentProps,
          topic: action.topic,
        };

        // Use invokeAgent with 'narrative' agent
        const agentResponse = await this.agentAPI.invokeAgent({
          agent: "narrative",
          query: `Explain the "${action.topic}" for the component "${componentName}".
The component has the following configuration: ${JSON.stringify(componentProps, null, 2)}.
Please provide a clear, concise explanation suitable for a user.`,
          context: explanationContext,
        });

        if (!agentResponse.success) {
          return {
            success: false,
            error: agentResponse.error || "Failed to generate explanation",
          };
        }

        return {
          success: true,
          data: {
            componentId: action.componentId,
            topic: action.topic,
            explanation: agentResponse.data,
          },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });

    // navigateToStage handler
    this.registerHandler("navigateToStage", async (action: CanonicalAction, _context: ActionContext): Promise<ActionResult> => {
      if (action.type !== "navigateToStage") {
        return { success: false, error: "Invalid action type" };
      }

      // Navigation is handled by schema regeneration
      return {
        success: true,
        data: { stage: action.stage },
      };
    });

    // saveWorkspace handler
    this.registerHandler("saveWorkspace", async (action: CanonicalAction, _context: ActionContext): Promise<ActionResult> => {
      if (action.type !== "saveWorkspace") {
        return { success: false, error: "Invalid action type" };
      }

      try {
        await workspaceStateService.persistState(action.workspaceId);

        return {
          success: true,
          data: { workspaceId: action.workspaceId, saved: true },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });

    // mutateComponent handler
    this.registerHandler("mutateComponent", async (action: CanonicalAction, context: ActionContext): Promise<ActionResult> => {
      if (action.type !== "mutateComponent") {
        return { success: false, error: "Invalid action type" };
      }

      try {
        // Get current schema
        const currentSchema = await canvasSchemaService.getCachedSchema(context.workspaceId ?? "");

        if (!currentSchema) {
          return {
            success: false,
            error: "No schema available for workspace",
          };
        }

        // Execute atomic action — action.action is a string descriptor parsed by the executor
        const executionResult = await atomicActionExecutor.executeAction(
          action.action as unknown as Parameters<typeof atomicActionExecutor.executeAction>[0],
          currentSchema,
          context.workspaceId ?? ""
        );

        // If successful, update cached schema
        if (executionResult.success) {
          logger.info("Atomic action executed successfully", {
            executionId: executionResult.executionId,
            affectedComponents: executionResult.actionResult.affected_components.length,
          });
        }

        return {
          success: executionResult.success,
          data: {
            executionId: executionResult.executionId,
            ...executionResult.actionResult,
          },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });

    // requestOverride handler
    this.registerHandler("requestOverride", async (action: CanonicalAction, context: ActionContext) => {
      try {
        const record = action as unknown as Record<string, unknown>;
        const actionId = record.actionId as string;
        const violations = record.violations as Parameters<typeof manifestoEnforcer.requestOverride>[2];
        const justification = record.justification as string;

        const requestId = await manifestoEnforcer.requestOverride(
          actionId,
          context.userId,
          violations,
          justification
        );

        return {
          success: true,
          data: { requestId },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });

    // approveOverride handler
    this.registerHandler("approveOverride", async (action: CanonicalAction, context: ActionContext) => {
      try {
        const record = action as unknown as Record<string, unknown>;
        const requestId = record.requestId as string;
        const reason = record.reason as string;

        await manifestoEnforcer.decideOverride(requestId, true, context.userId, reason);

        return {
          success: true,
          data: { requestId, approved: true },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });

    // rejectOverride handler
    this.registerHandler("rejectOverride", async (action: CanonicalAction, context: ActionContext) => {
      try {
        const record = action as unknown as Record<string, unknown>;
        const requestId = record.requestId as string;
        const reason = record.reason as string;

        await manifestoEnforcer.decideOverride(requestId, false, context.userId, reason);

        return {
          success: true,
          data: { requestId, approved: false },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });

    logger.info("Registered default action handlers", {
      handlerCount: this.handlers.size,
    });
  }

  /**
   * Helper to find a component by ID in the schema
   */
  private findComponentById(
    schema: SDUIPageDefinition,
    componentId: string
  ): { component: unknown; path: string } | null {
    // 1. Search top-level sections
    for (let i = 0; i < schema.sections.length; i++) {
      const section = schema.sections[i];
      // Check explicit ID in props
      if (section.props?.id === componentId) {
        return { component: section, path: `sections[${i}]` };
      }

      // Check implicit ID (ComponentMutationService style)
      // ComponentMutationService uses `${section.component}_${index}`
      // We should check if componentId matches this pattern
      const implicitId = `${section.component}_${i}`;
      if (implicitId === componentId) {
        return { component: section, path: `sections[${i}]` };
      }

      // Check for 'id' property if it exists at top level (unlikely for SDUISection but possible in some schemas)
      if ((section as any).id === componentId) {
        return { component: section, path: `sections[${i}]` };
      }

      // Recursive search in props
      const found = this.findComponentInProps(section.props, componentId, `sections[${i}]`);
      if (found) return found;
    }
    return null;
  }

  private findComponentInProps(
    props: unknown,
    componentId: string,
    currentPath: string
  ): { component: unknown; path: string } | null {
    if (!props || typeof props !== "object") return null;

    if (Array.isArray(props)) {
      for (let i = 0; i < props.length; i++) {
        const result = this.findComponentInProps(props[i], componentId, `${currentPath}[${i}]`);
        if (result) return result;
      }
      return null;
    }

    const record = props as Record<string, unknown>;

    // Check if current object is a component (heuristic)
    if (record.component && typeof record.component === "string") {
      const innerProps = record.props as Record<string, unknown> | undefined;
      if (innerProps?.id === componentId) {
        return { component: props, path: currentPath };
      }
      if (record.id === componentId) {
        return { component: props, path: currentPath };
      }
    }

    // Recurse into keys
    for (const key of Object.keys(record)) {
      const value = record[key];
      if (typeof value === "object" && value !== null) {
        const result = this.findComponentInProps(value, componentId, `${currentPath}.${key}`);
        if (result) return result;
      }
    }

    return null;
  }

  /**
   * Log action to audit trail
   */
  private async logAction(
    action: CanonicalAction,
    context: ActionContext,
    result: ActionResult,
    duration: number
  ): Promise<void> {
    try {
      await this.auditLogService.logAction({
        action_type: action.type,
        workspace_id: context.workspaceId,
        user_id: context.userId,
        session_id: context.sessionId,
        organization_id: context.organizationId,
        action_data: action,
        result_data: result,
        success: result.success,
        error_message: result.error,
        duration_ms: duration,
        timestamp: new Date().toISOString(),
        trace_id: context.traceId,
      });
    } catch (error) {
      logger.error("Failed to log action to audit trail", {
        actionType: action.type,
        traceId: context.traceId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

// Singleton instance
export const actionRouter = new ActionRouter();
