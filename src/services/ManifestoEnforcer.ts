/**
 * Manifesto Enforcer
 * 
 * Enforces Manifesto rules on actions and artifacts.
 * Provides detailed validation, warnings, and override workflows.
 */

import { logger } from '../lib/logger';
import { MANIFESTO_RULES, ManifestoRule, ValidationRule } from '../lib/manifesto/ManifestoRules';
import {
  CanonicalAction,
  ActionContext,
  ManifestoCheckResult,
  ManifestoViolation,
  ManifestoWarning,
} from '../types/sdui-integration';

/**
 * Validation result with details
 */
export interface DetailedValidationResult {
  rule: ManifestoRule;
  validation: ValidationRule;
  passed: boolean;
  artifact: any;
  message: string;
}

/**
 * Override request
 */
export interface OverrideRequest {
  actionId: string;
  userId: string;
  violations: ManifestoViolation[];
  justification: string;
  timestamp: number;
}

/**
 * Override decision
 */
export interface OverrideDecision {
  approved: boolean;
  approver?: string;
  reason?: string;
  timestamp: number;
}

/**
 * Manifesto Enforcer Service
 */
export class ManifestoEnforcer {
  private overrideRequests: Map<string, OverrideRequest>;
  private overrideDecisions: Map<string, OverrideDecision>;

  constructor() {
    this.overrideRequests = new Map();
    this.overrideDecisions = new Map();
  }

  /**
   * Check Manifesto rules for action
   */
  async checkAction(
    action: CanonicalAction,
    context: ActionContext
  ): Promise<ManifestoCheckResult> {
    logger.info('Checking Manifesto rules for action', {
      actionType: action.type,
      userId: context.userId,
    });

    try {
      const violations: ManifestoViolation[] = [];
      const warnings: ManifestoWarning[] = [];

      // Extract artifact from action
      const artifact = this.extractArtifact(action);

      if (!artifact) {
        // No artifact to validate
        return {
          allowed: true,
          violations: [],
          warnings: [],
        };
      }

      // Run all applicable rules
      const results = await this.validateArtifact(artifact, action.type);

      // Categorize results
      for (const result of results) {
        if (!result.passed) {
          if (result.rule.severity === 'critical' || result.rule.severity === 'high') {
            violations.push({
              rule: result.rule.id,
              severity: 'error',
              message: result.message,
              context: {
                validation: result.validation.name,
                principle: result.rule.principle,
              },
            });
          } else {
            warnings.push({
              rule: result.rule.id,
              message: result.message,
              suggestion: this.getSuggestion(result.rule, result.validation),
            });
          }
        }
      }

      // Check for override
      const hasOverride = await this.checkOverride(action, context, violations);

      const allowed = violations.length === 0 || hasOverride;

      logger.info('Manifesto rules check complete', {
        actionType: action.type,
        allowed,
        violationCount: violations.length,
        warningCount: warnings.length,
      });

      return {
        allowed,
        violations,
        warnings,
      };
    } catch (error) {
      logger.error('Failed to check Manifesto rules', {
        actionType: action.type,
        error: error instanceof Error ? error.message : String(error),
      });

      // On error, allow action but log warning
      return {
        allowed: true,
        violations: [],
        warnings: [
          {
            rule: 'SYSTEM',
            message: 'Manifesto rules check failed',
            suggestion: 'Manual review recommended',
          },
        ],
      };
    }
  }

  /**
   * Validate artifact against all rules
   */
  private async validateArtifact(
    artifact: any,
    actionType: string
  ): Promise<DetailedValidationResult[]> {
    const results: DetailedValidationResult[] = [];

    for (const rule of MANIFESTO_RULES) {
      // Check if rule applies to this action type
      if (!this.ruleApplies(rule, actionType, artifact)) {
        continue;
      }

      for (const validation of rule.validations) {
        try {
          const passed = validation.check(artifact);
          results.push({
            rule,
            validation,
            passed,
            artifact,
            message: passed ? 'Validation passed' : validation.errorMessage,
          });
        } catch (error) {
          logger.error('Validation check failed', {
            rule: rule.id,
            validation: validation.name,
            error: error instanceof Error ? error.message : String(error),
          });
          // Treat error as validation failure
          results.push({
            rule,
            validation,
            passed: false,
            artifact,
            message: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          });
        }
      }
    }

    return results;
  }

  /**
   * Check if rule applies to action type
   */
  private ruleApplies(rule: ManifestoRule, actionType: string, artifact: any): boolean {
    // RULE_001: Applies to all actions with business outcomes
    if (rule.id === 'RULE_001') {
      return actionType === 'updateValueTree' || actionType === 'exportArtifact';
    }

    // RULE_002: Applies to KPI-related actions
    if (rule.id === 'RULE_002') {
      return actionType === 'updateValueTree' || artifact.kpis;
    }

    // RULE_003: Applies to value tree updates
    if (rule.id === 'RULE_003') {
      return actionType === 'updateValueTree';
    }

    // RULE_004: Applies to assumptions and ROI
    if (rule.id === 'RULE_004') {
      return actionType === 'updateAssumption' || artifact.roi_model;
    }

    // RULE_005: Applies to all lifecycle actions
    if (rule.id === 'RULE_005') {
      return actionType === 'navigateToStage' || artifact.lifecycle_stage;
    }

    // RULE_006: Applies to target and realization stages
    if (rule.id === 'RULE_006') {
      return artifact.lifecycle_stage === 'target' || artifact.lifecycle_stage === 'realization';
    }

    // RULE_007: Applies to financial impact
    if (rule.id === 'RULE_007') {
      return artifact.financial_impact || artifact.roi_model;
    }

    // RULE_008: Applies to all actions
    if (rule.id === 'RULE_008') {
      return true;
    }

    return false;
  }

  /**
   * Extract artifact from action
   */
  private extractArtifact(action: CanonicalAction): any | null {
    switch (action.type) {
      case 'updateValueTree':
        return action.updates;

      case 'updateAssumption':
        return action.updates;

      case 'exportArtifact':
        return { artifactType: action.artifactType };

      case 'navigateToStage':
        return { lifecycle_stage: action.stage };

      default:
        return null;
    }
  }

  /**
   * Get suggestion for failed validation
   */
  private getSuggestion(rule: ManifestoRule, validation: ValidationRule): string {
    const suggestions: Record<string, string> = {
      has_business_outcome: 'Add a clear business outcome statement describing customer value',
      no_feature_language: 'Reframe in terms of outcomes rather than features',
      uses_standard_kpis: 'Select KPIs from the Value Fabric catalog',
      consistent_roi_calculation: 'Use the standard ROI calculation methodology',
      follows_value_tree_structure: 'Ensure value tree has Capabilities → Outcomes → KPIs structure',
      has_evidence_for_assumptions: 'Document evidence sources for all assumptions',
      conservative_estimates: 'Use conservative or moderate confidence levels',
      no_hyperbolic_language: 'Use factual, measured language',
      has_lifecycle_stage: 'Associate artifact with a lifecycle stage',
      has_measurement_plan: 'Define how success will be measured',
      defines_success_criteria: 'Specify clear, measurable success criteria',
      has_value_category: 'Categorize impact as revenue, cost, or risk',
      quantifies_financial_impact: 'Provide quantified financial impact estimates',
      has_ownership: 'Assign clear ownership',
      has_stakeholders: 'Identify key stakeholders',
    };

    return suggestions[validation.name] || 'Review and update artifact';
  }

  /**
   * Request override for violations
   */
  async requestOverride(
    actionId: string,
    userId: string,
    violations: ManifestoViolation[],
    justification: string
  ): Promise<string> {
    const requestId = `override-${actionId}-${Date.now()}`;

    const request: OverrideRequest = {
      actionId,
      userId,
      violations,
      justification,
      timestamp: Date.now(),
    };

    this.overrideRequests.set(requestId, request);

    logger.info('Override requested', {
      requestId,
      actionId,
      userId,
      violationCount: violations.length,
    });

    return requestId;
  }

  /**
   * Approve or reject override
   */
  async decideOverride(
    requestId: string,
    approved: boolean,
    approver: string,
    reason?: string
  ): Promise<void> {
    const request = this.overrideRequests.get(requestId);

    if (!request) {
      throw new Error(`Override request not found: ${requestId}`);
    }

    const decision: OverrideDecision = {
      approved,
      approver,
      reason,
      timestamp: Date.now(),
    };

    this.overrideDecisions.set(requestId, decision);

    logger.info('Override decision made', {
      requestId,
      approved,
      approver,
    });
  }

  /**
   * Check if action has valid override
   */
  private async checkOverride(
    action: CanonicalAction,
    context: ActionContext,
    violations: ManifestoViolation[]
  ): Promise<boolean> {
    // Check if there's an approved override for this action
    // In production, this would check a database
    // For now, return false (no override)
    return false;
  }

  /**
   * Get override request
   */
  getOverrideRequest(requestId: string): OverrideRequest | undefined {
    return this.overrideRequests.get(requestId);
  }

  /**
   * Get override decision
   */
  getOverrideDecision(requestId: string): OverrideDecision | undefined {
    return this.overrideDecisions.get(requestId);
  }

  /**
   * Get all pending override requests
   */
  getPendingOverrides(): OverrideRequest[] {
    const pending: OverrideRequest[] = [];

    for (const [requestId, request] of this.overrideRequests.entries()) {
      if (!this.overrideDecisions.has(requestId)) {
        pending.push(request);
      }
    }

    return pending;
  }
}

// Singleton instance
export const manifestoEnforcer = new ManifestoEnforcer();
