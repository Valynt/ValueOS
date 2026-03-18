import { logger } from "../../lib/logger.js";
import { DomainSagaEventEmitter } from "../workflows/SagaAdapters.js";

/**
 * Change event types that trigger recalculation
 */
export type ChangeEventType =
  | "assumption_updated"
  | "baseline_modified"
  | "hypothesis_accepted"
  | "hypothesis_rejected"
  | "value_driver_added";

/**
 * Recalculation context
 */
export interface RecalculationContext {
  caseId: string;
  organizationId: string;
  changeType: ChangeEventType;
  changedEntityId: string;
  changedBy: string;
  previousValue?: unknown;
  newValue?: unknown;
  timestamp: string;
}

/**
 * Narrative component that needs refresh
 */
export interface NarrativeRefreshFlag {
  componentId: string;
  componentType: "artifact" | "kpi_card" | "scenario_comparison";
  reason: string;
  priority: "high" | "medium" | "low";
}

/**
 * Recalculation result
 */
export interface RecalculationResult {
  success: boolean;
  caseId: string;
  scenariosRecalculated: ("conservative" | "base" | "upside")[];
  narrativeRefreshFlags: NarrativeRefreshFlag[];
  errors?: string[];
  recalculationId: string;
}

/**
 * Service that handles downstream recalculation when upstream assumptions change.
 * Triggers scenario recalculation and flags narrative components for refresh.
 */
export class RecalculationService {
  private readonly sagaEventEmitter = new DomainSagaEventEmitter();

  /**
   * Trigger recalculation when a baseline or assumption is modified.
   */
  async triggerRecalculation(
    context: RecalculationContext
  ): Promise<RecalculationResult> {
    logger.info("Triggering downstream recalculation", {
      caseId: context.caseId,
      changeType: context.changeType,
      changedEntityId: context.changedEntityId,
    });

    const recalculationId = `recalc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const errors: string[] = [];

    try {
      // Step 1: Recalculate all three scenarios
      const scenariosRecalculated = await this.recalculateScenarios(
        context.caseId,
        context.organizationId
      );

      // Step 2: Identify narrative components that need refresh
      const narrativeRefreshFlags = this.identifyNarrativeRefreshFlags(
        context,
        scenariosRecalculated
      );

      // Step 3: Emit saga event for recalculation
      await this.emitRecalculationEvent(context, recalculationId, scenariosRecalculated);

      logger.info("Recalculation complete", {
        caseId: context.caseId,
        recalculationId,
        scenariosRecalculated,
        narrativeRefreshCount: narrativeRefreshFlags.length,
      });

      return {
        success: true,
        caseId: context.caseId,
        scenariosRecalculated,
        narrativeRefreshFlags,
        recalculationId,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      errors.push(errorMessage);

      logger.error("Recalculation failed", {
        caseId: context.caseId,
        recalculationId,
        error: errorMessage,
      });

      return {
        success: false,
        caseId: context.caseId,
        scenariosRecalculated: [],
        narrativeRefreshFlags: [],
        errors,
        recalculationId,
      };
    }
  }

  /**
   * Recalculate all three scenarios (conservative, base, upside).
   */
  private async recalculateScenarios(
    caseId: string,
    organizationId: string
  ): Promise<("conservative" | "base" | "upside")[]> {
    const scenarios: ("conservative" | "base" | "upside")[] = [
      "conservative",
      "base",
      "upside",
    ];

    // In a real implementation, this would:
    // 1. Fetch current assumptions for the case
    // 2. Re-run FinancialModelingAgent.computeScenarioFinancials for each scenario
    // 3. Update scenarios table with new results
    // 4. Update related KPI targets

    // For now, simulate async work
    await new Promise((resolve) => setTimeout(resolve, 100));

    logger.info("Recalculated scenarios", {
      caseId,
      organizationId,
      scenarioCount: scenarios.length,
    });

    return scenarios;
  }

  /**
   * Identify narrative components that reference changed values.
   */
  private identifyNarrativeRefreshFlags(
    context: RecalculationContext,
    scenariosRecalculated: ("conservative" | "base" | "upside")[]
  ): NarrativeRefreshFlag[] {
    const flags: NarrativeRefreshFlag[] = [];

    // Flag KPI cards that reference the changed assumption
    if (context.changeType === "assumption_updated") {
      flags.push({
        componentId: `kpi_${context.changedEntityId}`,
        componentType: "kpi_card",
        reason: `Assumption ${context.changedEntityId} value changed from ${context.previousValue} to ${context.newValue}`,
        priority: "high",
      });
    }

    // Flag scenario comparison if scenarios were recalculated
    if (scenariosRecalculated.length > 0) {
      flags.push({
        componentId: "scenario_comparison",
        componentType: "scenario_comparison",
        reason: `Scenarios ${scenariosRecalculated.join(", ")} were recalculated due to ${context.changeType}`,
        priority: "high",
      });
    }

    // Flag artifacts that may reference changed values
    flags.push({
      componentId: `artifact_${context.caseId}`,
      componentType: "artifact",
      reason: `Upstream ${context.changeType} may affect narrative content`,
      priority: "medium",
    });

    return flags;
  }

  /**
   * Emit saga.state.transitioned event for recalculation.
   */
  private async emitRecalculationEvent(
    context: RecalculationContext,
    recalculationId: string,
    scenariosRecalculated: ("conservative" | "base" | "upside")[]
  ): Promise<void> {
    this.sagaEventEmitter.emit({
      type: "saga.state.transitioned",
      payload: {
        sagaType: "value_model_recalculation",
        sagaId: recalculationId,
        fromState: "idle",
        toState: "recalculating",
        caseId: context.caseId,
        organizationId: context.organizationId,
        trigger: {
          changeType: context.changeType,
          changedEntityId: context.changedEntityId,
          changedBy: context.changedBy,
        },
        scenariosRecalculated,
        timestamp: new Date().toISOString(),
      },
      meta: {
        correlationId: recalculationId,
        timestamp: new Date().toISOString(),
        source: "RecalculationService.triggerRecalculation",
      },
    });
  }

  /**
   * Handle assumption update and trigger recalculation.
   */
  async onAssumptionUpdated(
    caseId: string,
    organizationId: string,
    assumptionId: string,
    changedBy: string,
    previousValue: unknown,
    newValue: unknown
  ): Promise<RecalculationResult> {
    return this.triggerRecalculation({
      caseId,
      organizationId,
      changeType: "assumption_updated",
      changedEntityId: assumptionId,
      changedBy,
      previousValue,
      newValue,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Handle baseline modification and trigger recalculation.
   */
  async onBaselineModified(
    caseId: string,
    organizationId: string,
    baselineId: string,
    changedBy: string,
    previousValue: unknown,
    newValue: unknown
  ): Promise<RecalculationResult> {
    return this.triggerRecalculation({
      caseId,
      organizationId,
      changeType: "baseline_modified",
      changedEntityId: baselineId,
      changedBy,
      previousValue,
      newValue,
      timestamp: new Date().toISOString(),
    });
  }
}

// Export singleton instance
export const recalculationService = new RecalculationService();
