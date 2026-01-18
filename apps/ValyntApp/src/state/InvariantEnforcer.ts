/**
 * State Invariant Enforcement
 *
 * Enforces state invariants across all ValueOS state stores.
 * Critical for maintaining data consistency and preventing corruption.
 *
 * Responsibilities:
 * - Canvas-Workflow consistency validation
 * - SDUI reconstruction invariant enforcement
 * - State transition validation
 * - Cross-store consistency checks
 */

import { logger } from '../lib/logger';
import { WorkflowState } from '../repositories/WorkflowStateRepository';
import { SDUIPageDefinition } from '../sdui/schema';
import { CanvasLayout } from '../sdui/canvas/types';

// ============================================================================
// Types
// ============================================================================

export interface InvariantViolation {
  type: InvariantType;
  severity: 'error' | 'warning' | 'info';
  description: string;
  context: Record<string, any>;
  suggestedAction: string;
  timestamp: Date;
}

export enum InvariantType {
  CANVAS_WORKFLOW_CONSISTENCY = 'canvas_workflow_consistency',
  SDUI_RECONSTRUCTION = 'sdui_reconstruction',
  WORKFLOW_STATE_TRANSITION = 'workflow_state_transition',
  AGENT_AUTHORITY_VIOLATION = 'agent_authority_violation',
  STATE_CORRUPTION = 'state_corruption',
  MEMORY_INCONSISTENCY = 'memory_inconsistency',
}

export interface InvariantCheckResult {
  valid: boolean;
  violations: InvariantViolation[];
  warnings: InvariantViolation[];
}

export interface StateValidationContext {
  workflowState: WorkflowState | null;
  canvasState: CanvasLayout | null;
  sduiState: SDUIPageDefinition | null;
  agentType: string;
  action: string;
  timestamp: Date;
}

// ============================================================================
// Invariant Enforcer
// ============================================================================

export class InvariantEnforcer {
  private violations: InvariantViolation[] = [];
  private readonly maxViolations = 1000;

  /**
   * Enforce all invariants for a state change
   */
  async enforceInvariants(
    context: StateValidationContext,
    proposedChanges: Partial<StateValidationContext>
  ): Promise<InvariantCheckResult> {
    const violations: InvariantViolation[] = [];
    const warnings: InvariantViolation[] = [];

    try {
      // Canvas-Workflow consistency invariant
      const canvasResult = await this.checkCanvasWorkflowConsistency(
        context,
        proposedChanges
      );
      violations.push(...canvasResult.violations);
      warnings.push(...canvasResult.warnings);

      // SDUI reconstruction invariant
      const sduiResult = await this.checkSDUIReconstructionInvariant(
        context,
        proposedChanges
      );
      violations.push(...sduiResult.violations);
      warnings.push(...sduiResult.warnings);

      // Workflow state transition invariant
      const workflowResult = await this.checkWorkflowStateTransitionInvariant(
        context,
        proposedChanges
      );
      violations.push(...workflowResult.violations);
      warnings.push(...workflowResult.warnings);

      // Agent authority invariant
      const authorityResult = await this.checkAgentAuthorityInvariant(
        context,
        proposedChanges
      );
      violations.push(...authorityResult.violations);
      warnings.push(...authorityResult.warnings);

      // State corruption check
      const corruptionResult = await this.checkStateCorruptionInvariant(
        context,
        proposedChanges
      );
      violations.push(...corruptionResult.violations);
      warnings.push(...corruptionResult.warnings);

      // Memory consistency check
      const memoryResult = await this.checkMemoryConsistencyInvariant(
        context,
        proposedChanges
      );
      violations.push(...memoryResult.violations);
      warnings.push(...memoryResult.warnings);

      // Log violations
      this.logViolations(violations, warnings);

      // Store violations for audit
      this.storeViolations(violations);

      return {
        valid: violations.length === 0,
        violations,
        warnings,
      };

    } catch (error) {
      logger.error('Invariant enforcement failed', error instanceof Error ? error : undefined);

      const systemViolation: InvariantViolation = {
        type: InvariantType.STATE_CORRUPTION,
        severity: 'error',
        description: 'Invariant enforcement system error',
        context: { error: error instanceof Error ? error.message : 'Unknown error' },
        suggestedAction: 'Check system logs and restart if necessary',
        timestamp: new Date(),
      };

      return {
        valid: false,
        violations: [systemViolation],
        warnings: [],
      };
    }
  }

  /**
   * Check Canvas-Workflow consistency invariant
   * Rule: Canvas state must not contradict workflow stage
   */
  private async checkCanvasWorkflowConsistency(
    context: StateValidationContext,
    proposedChanges: Partial<StateValidationContext>
  ): Promise<InvariantCheckResult> {
    const violations: InvariantViolation[] = [];
    const warnings: InvariantViolation[] = [];

    const workflowState = proposedChanges.workflowState || context.workflowState;
    const canvasState = proposedChanges.canvasState || context.canvasState;

    if (!workflowState || !canvasState) {
      return { valid: true, violations: [], warnings: [] };
    }

    // Check if canvas components are valid for workflow stage
    const stageConfig = this.getStageConfig(workflowState.currentStage);
    const canvasComponents = canvasState.components || [];

    for (const component of canvasComponents) {
      if (!stageConfig.allowedComponents.includes(component.type)) {
        violations.push({
          type: InvariantType.CANVAS_WORKFLOW_CONSISTENCY,
          severity: 'error',
          description: `Canvas component '${component.type}' not allowed in workflow stage '${workflowState.currentStage}'`,
          context: {
            componentType: component.type,
            workflowStage: workflowState.currentStage,
            allowedComponents: stageConfig.allowedComponents,
          },
          suggestedAction: `Remove component or transition to appropriate stage`,
          timestamp: new Date(),
        });
      }
    }

    // Check if canvas has required components for stage
    const requiredComponents = stageConfig.requiredComponents || [];
    const canvasComponentTypes = new Set(canvasComponents.map(c => c.type));

    for (const required of requiredComponents) {
      if (!canvasComponentTypes.has(required)) {
        warnings.push({
          type: InvariantType.CANVAS_WORKFLOW_CONSISTENCY,
          severity: 'warning',
          description: `Canvas missing required component '${required}' for workflow stage '${workflowState.currentStage}'`,
          context: {
            requiredComponent: required,
            workflowStage: workflowState.currentStage,
            canvasComponents: Array.from(canvasComponentTypes),
          },
          suggestedAction: `Add required component or update stage configuration`,
          timestamp: new Date(),
        });
      }
    }

    return {
      valid: violations.length === 0,
      violations,
      warnings,
    };
  }

  /**
   * Check SDUI reconstruction invariant
   * Rule: SDUI state must be reconstructible from WorkflowState
   */
  private async checkSDUIReconstructionInvariant(
    context: StateValidationContext,
    proposedChanges: Partial<StateValidationContext>
  ): Promise<InvariantCheckResult> {
    const violations: InvariantViolation[] = [];
    const warnings: InvariantViolation[] = [];

    const workflowState = proposedChanges.workflowState || context.workflowState;
    const sduiState = proposedChanges.sduiState || context.sduiState;

    if (!workflowState || !sduiState) {
      return { valid: true, violations: [], warnings: [] };
    }

    // Test reconstruction by generating SDUI from workflow state
    try {
      const reconstructedSDUI = await this.generateSDUIFromWorkflowState(workflowState);

      // Compare key properties
      const differences = this.compareSDUIStates(sduiState, reconstructedSDUI);

      if (differences.critical.length > 0) {
        violations.push({
          type: InvariantType.SDUI_RECONSTRUCTION,
          severity: 'error',
          description: `SDUI state cannot be reconstructed from workflow state`,
          context: {
            differences: differences.critical,
            workflowStage: workflowState.currentStage,
          },
          suggestedAction: `Regenerate SDUI from workflow state or fix workflow state corruption`,
          timestamp: new Date(),
        });
      }

      if (differences.minor.length > 0) {
        warnings.push({
          type: InvariantType.SDUI_RECONSTRUCTION,
          severity: 'warning',
          description: `SDUI state has minor inconsistencies with workflow state`,
          context: {
            differences: differences.minor,
            workflowStage: workflowState.currentStage,
          },
          suggestedAction: `Consider regenerating SDUI for consistency`,
          timestamp: new Date(),
        });
      }

    } catch (error) {
      violations.push({
        type: InvariantType.SDUI_RECONSTRUCTION,
        severity: 'error',
        description: `Failed to reconstruct SDUI from workflow state`,
        context: {
          error: error instanceof Error ? error.message : 'Unknown error',
          workflowStage: workflowState.currentStage,
        },
        suggestedAction: `Check workflow state integrity and SDUI generation logic`,
        timestamp: new Date(),
      });
    }

    return {
      valid: violations.length === 0,
      violations,
      warnings,
    };
  }

  /**
   * Check Workflow State transition invariant
   * Rule: Workflow state transitions must follow valid sequences
   */
  private async checkWorkflowStateTransitionInvariant(
    context: StateValidationContext,
    proposedChanges: Partial<StateValidationContext>
  ): Promise<InvariantCheckResult> {
    const violations: InvariantViolation[] = [];
    const warnings: InvariantViolation[] = [];

    const currentWorkflowState = context.workflowState;
    const proposedWorkflowState = proposedChanges.workflowState;

    if (!currentWorkflowState || !proposedWorkflowState) {
      return { valid: true, violations: [], warnings: [] };
    }

    // Check if transition is valid
    const validTransitions = this.getValidTransitions(currentWorkflowState.currentStage);

    if (!validTransitions.includes(proposedWorkflowState.currentStage)) {
      violations.push({
        type: InvariantType.WORKFLOW_STATE_TRANSITION,
        severity: 'error',
        description: `Invalid workflow state transition from '${currentWorkflowState.currentStage}' to '${proposedWorkflowState.currentStage}'`,
        context: {
          fromStage: currentWorkflowState.currentStage,
          toStage: proposedWorkflowState.currentStage,
          validTransitions,
        },
        suggestedAction: `Use valid transition or update transition rules`,
        timestamp: new Date(),
      });
    }

    // Check if stage transition requires completed prerequisites
    const prerequisites = this.getStagePrerequisites(proposedWorkflowState.currentStage);
    const completedStages = currentWorkflowState.completedStages || [];

    for (const prerequisite of prerequisites) {
      if (!completedStages.includes(prerequisite)) {
        violations.push({
          type: InvariantType.WORKFLOW_STATE_TRANSITION,
          severity: 'error',
          description: `Cannot transition to '${proposedWorkflowState.currentStage}' without completing prerequisite '${prerequisite}'`,
          context: {
            targetStage: proposedWorkflowState.currentStage,
            missingPrerequisites: prerequisites.filter(p => !completedStages.includes(p)),
            completedStages,
          },
          suggestedAction: `Complete prerequisite stages before transitioning`,
          timestamp: new Date(),
        });
      }
    }

    return {
      valid: violations.length === 0,
      violations,
      warnings,
    };
  }

  /**
   * Check Agent Authority invariant
   * Rule: Only authorized agents can perform specific actions
   */
  private async checkAgentAuthorityInvariant(
    context: StateValidationContext,
    proposedChanges: Partial<StateValidationContext>
  ): Promise<InvariantCheckResult> {
    const violations: InvariantViolation[] = [];
    const warnings: InvariantViolation[] = [];

    const agentType = context.agentType;
    const action = context.action;

    // Check if agent is authorized for this action
    const authorizedActions = this.getAuthorizedActions(agentType);

    if (!authorizedActions.includes(action)) {
      violations.push({
        type: InvariantType.AGENT_AUTHORITY_VIOLATION,
        severity: 'error',
        description: `Agent '${agentType}' not authorized to perform action '${action}'`,
        context: {
          agentType,
          action,
          authorizedActions,
        },
        suggestedAction: `Use authorized agent or update authority rules`,
        timestamp: new Date(),
      });
    }

    // Special check for WorkflowState mutations
    if (action.includes('write') || action.includes('delete')) {
      const canMutateWorkflowState = this.canMutateWorkflowState(agentType);

      if (!canMutateWorkflowState) {
        violations.push({
          type: InvariantType.AGENT_AUTHORITY_VIOLATION,
          severity: 'error',
          description: `Agent '${agentType}' attempted to mutate WorkflowState without authority`,
          context: {
            agentType,
            action,
            rule: 'Only governance agents may mutate WorkflowState directly',
          },
          suggestedAction: `Use governance agent or emit proposal instead`,
          timestamp: new Date(),
        });
      }
    }

    return {
      valid: violations.length === 0,
      violations,
      warnings,
    };
  }

  /**
   * Check State Corruption invariant
   * Rule: State data must be internally consistent
   */
  private async checkStateCorruptionInvariant(
    context: StateValidationContext,
    proposedChanges: Partial<StateValidationContext>
  ): Promise<InvariantCheckResult> {
    const violations: InvariantViolation[] = [];
    const warnings: InvariantViolation[] = [];

    // Check WorkflowState integrity
    const workflowState = proposedChanges.workflowState || context.workflowState;
    if (workflowState) {
      if (!workflowState.currentStage) {
        violations.push({
          type: InvariantType.STATE_CORRUPTION,
          severity: 'error',
          description: 'WorkflowState missing currentStage',
          context: { workflowState },
          suggestedAction: 'Restore currentStage or reset workflow state',
          timestamp: new Date(),
        });
      }

      if (!workflowState.context) {
        warnings.push({
          type: InvariantType.STATE_CORRUPTION,
          severity: 'warning',
          description: 'WorkflowState missing context',
          context: { workflowState },
          suggestedAction: 'Initialize context with default values',
          timestamp: new Date(),
        });
      }
    }

    // Check CanvasState integrity
    const canvasState = proposedChanges.canvasState || context.canvasState;
    if (canvasState) {
      if (!canvasState.components || !Array.isArray(canvasState.components)) {
        violations.push({
          type: InvariantType.STATE_CORRUPTION,
          severity: 'error',
          description: 'CanvasState has invalid components structure',
          context: { canvasState },
          suggestedAction: 'Reset canvas state or fix components structure',
          timestamp: new Date(),
        });
      }
    }

    return {
      valid: violations.length === 0,
      violations,
      warnings,
    };
  }

  /**
   * Check Memory Consistency invariant
   * Rule: Agent memory must be consistent with current state
   */
  private async checkMemoryConsistencyInvariant(
    context: StateValidationContext,
    proposedChanges: Partial<StateValidationContext>
  ): Promise<InvariantCheckResult> {
    const violations: InvariantViolation[] = [];
    const warnings: InvariantViolation[] = [];

    // This would integrate with AgentMemoryService
    // For now, return valid as placeholder
    return {
      valid: true,
      violations,
      warnings,
    };
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private getStageConfig(stage: string) {
    const configs: Record<string, { allowedComponents: string[]; requiredComponents: string[] }> = {
      opportunity: {
        allowedComponents: ['ValueHypothesisCard', 'MetricBadge', 'TextBlock'],
        requiredComponents: ['ValueHypothesisCard'],
      },
      target: {
        allowedComponents: ['MetricBadge', 'TextBlock', 'DataTable', 'Chart'],
        requiredComponents: ['MetricBadge'],
      },
      realization: {
        allowedComponents: ['DataTable', 'Chart', 'TextBlock', 'ProgressTracker'],
        requiredComponents: ['DataTable'],
      },
      expansion: {
        allowedComponents: ['TextBlock', 'Chart', 'RecommendationCard'],
        requiredComponents: ['RecommendationCard'],
      },
    };

    return configs[stage] || { allowedComponents: [], requiredComponents: [] };
  }

  private getValidTransitions(fromStage: string): string[] {
    const transitions: Record<string, string[]> = {
      opportunity: ['target', 'opportunity'], // Can stay or move to target
      target: ['realization', 'target'],
      realization: ['expansion', 'realization'],
      expansion: ['expansion'], // Terminal stage
    };

    return transitions[fromStage] || [];
  }

  private getStagePrerequisites(toStage: string): string[] {
    const prerequisites: Record<string, string[]> = {
      opportunity: [],
      target: ['opportunity'],
      realization: ['target'],
      expansion: ['realization'],
    };

    return prerequisites[toStage] || [];
  }

  private async generateSDUIFromWorkflowState(workflowState: WorkflowState): Promise<SDUIPageDefinition> {
    // This would use the actual SDUI generation logic
    // For now, return a basic structure
    return {
      type: 'page',
      version: 1,
      sections: [{
        type: 'component',
        component: 'TextBlock',
        version: 1,
        props: {
          text: `Stage: ${workflowState.currentStage}`,
        },
      }],
      metadata: {
        case_id: workflowState.context.caseId || '',
        generated_at: Date.now().toString(),
      },
    };
  }

  private compareSDUIStates(original: SDUIPageDefinition, reconstructed: SDUIPageDefinition) {
    const critical: string[] = [];
    const minor: string[] = [];

    // Compare section counts
    if (original.sections.length !== reconstructed.sections.length) {
      critical.push(`Section count mismatch: ${original.sections.length} vs ${reconstructed.sections.length}`);
    }

    // Compare component types
    const originalComponents = original.sections.map(s => s.component).sort();
    const reconstructedComponents = reconstructed.sections.map(s => s.component).sort();

    if (JSON.stringify(originalComponents) !== JSON.stringify(reconstructedComponents)) {
      critical.push('Component types differ');
    }

    return { critical, minor };
  }

  private getAuthorizedActions(agentType: string): string[] {
    const actions: Record<string, string[]> = {
      'governance-agent': ['read', 'write', 'delete', 'approve', 'reject'],
      'analytical-agent': ['read', 'propose'],
      'execution-agent': ['read', 'execute'],
      'ui-agent': ['read', 'execute'],
      'system-agent': ['read', 'write', 'delete', 'execute'],
    };

    return actions[agentType] || [];
  }

  private canMutateWorkflowState(agentType: string): boolean {
    return agentType === 'governance-agent' || agentType === 'system-agent';
  }

  private logViolations(violations: InvariantViolation[], warnings: InvariantViolation[]): void {
    if (violations.length > 0) {
      logger.error('Invariant violations detected', {
        count: violations.length,
        violations: violations.map(v => ({
          type: v.type,
          description: v.description,
          severity: v.severity,
        })),
      });
    }

    if (warnings.length > 0) {
      logger.warn('Invariant warnings detected', {
        count: warnings.length,
        warnings: warnings.map(w => ({
          type: w.type,
          description: w.description,
          severity: w.severity,
        })),
      });
    }
  }

  private storeViolations(violations: InvariantViolation[]): void {
    // Store violations for audit and analysis
    violations.forEach(violation => {
      this.violations.push(violation);
    });

    // Maintain max size
    if (this.violations.length > this.maxViolations) {
      this.violations = this.violations.slice(-this.maxViolations);
    }
  }

  /**
   * Get recent violations for monitoring
   */
  getRecentViolations(hours: number = 24): InvariantViolation[] {
    const cutoff = Date.now() - (hours * 60 * 60 * 1000);

    return this.violations
      .filter(v => v.timestamp.getTime() > cutoff)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get violation statistics
   */
  getViolationStats(): {
    total: number;
    byType: Record<InvariantType, number>;
    bySeverity: Record<string, number>;
    recent: number;
  } {
    const byType: Record<InvariantType, number> = {} as any;
    const bySeverity: Record<string, number> = {};

    this.violations.forEach(violation => {
      byType[violation.type] = (byType[violation.type] || 0) + 1;
      bySeverity[violation.severity] = (bySeverity[violation.severity] || 0) + 1;
    });

    const recent = this.getRecentViolations(1).length;

    return {
      total: this.violations.length,
      byType,
      bySeverity,
      recent,
    };
  }
}

// ============================================================================
// Factory
// ============================================================================

export function createInvariantEnforcer(): InvariantEnforcer {
  return new InvariantEnforcer();
}
