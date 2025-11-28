/**
 * Rules Enforcer
 * 
 * Central enforcement engine that applies both Global and Local rules
 * to agent actions. Integrates with existing security infrastructure.
 * 
 * Provides Policy-as-Code enforcement for consistent dev/prod behavior.
 */

import { logger } from '../logger';
import { 
  RuleContext, 
  RuleCheckResult,
  GLOBAL_RULES,
  getEnabledRules as getEnabledGlobalRules,
  RuleCategory,
  RuleSeverity,
} from './GlobalRules';
import {
  LocalRuleContext,
  LocalRuleCheckResult,
  LOCAL_RULES,
  getRulesForAgent,
  AgentType,
} from './LocalRules';

// =============================================================================
// ENFORCEMENT TYPES
// =============================================================================

export interface EnforcementResult {
  allowed: boolean;
  globalResults: RuleCheckResult[];
  localResults: LocalRuleCheckResult[];
  violations: RuleViolation[];
  warnings: RuleWarning[];
  fallbackActions: string[];
  userMessages: string[];
  executionTimeMs: number;
  metadata: {
    globalRulesChecked: number;
    localRulesChecked: number;
    timestamp: number;
    requestId: string;
  };
}

export interface RuleViolation {
  ruleId: string;
  ruleName: string;
  category: RuleCategory | string;
  severity: RuleSeverity | 'local';
  message: string;
  details?: Record<string, unknown>;
  remediation?: string;
}

export interface RuleWarning {
  ruleId: string;
  message: string;
  suggestion?: string;
}

export interface EnforcerConfig {
  environment: 'development' | 'staging' | 'production';
  enableGlobalRules: boolean;
  enableLocalRules: boolean;
  strictMode: boolean; // In strict mode, warnings become violations
  auditMode: boolean; // Log all checks without blocking
  tenantOverrides?: TenantRuleOverrides;
}

export interface TenantRuleOverrides {
  tenantId: string;
  disabledRules: string[];
  customThresholds: Record<string, number>;
}

// =============================================================================
// RULES ENFORCER CLASS
// =============================================================================

export class RulesEnforcer {
  private config: EnforcerConfig;
  private enforcementHistory: Map<string, EnforcementResult[]> = new Map();
  private ruleMetrics: Map<string, RuleMetrics> = new Map();

  constructor(config: Partial<EnforcerConfig> = {}) {
    this.config = {
      environment: config.environment || 'development',
      enableGlobalRules: config.enableGlobalRules ?? true,
      enableLocalRules: config.enableLocalRules ?? true,
      strictMode: config.strictMode ?? false,
      auditMode: config.auditMode ?? false,
      tenantOverrides: config.tenantOverrides,
    };

    logger.info('RulesEnforcer initialized', {
      environment: this.config.environment,
      globalRulesEnabled: this.config.enableGlobalRules,
      localRulesEnabled: this.config.enableLocalRules,
      strictMode: this.config.strictMode,
      auditMode: this.config.auditMode,
    });
  }

  /**
   * Main enforcement entry point
   * Checks both global and local rules against the provided context
   */
  async enforce(
    globalContext: RuleContext,
    localContext: LocalRuleContext
  ): Promise<EnforcementResult> {
    const startTime = Date.now();
    const requestId = globalContext.metadata.requestId || `req-${Date.now()}`;

    const result: EnforcementResult = {
      allowed: true,
      globalResults: [],
      localResults: [],
      violations: [],
      warnings: [],
      fallbackActions: [],
      userMessages: [],
      executionTimeMs: 0,
      metadata: {
        globalRulesChecked: 0,
        localRulesChecked: 0,
        timestamp: Date.now(),
        requestId,
      },
    };

    try {
      // Check global rules first (platform constitution)
      if (this.config.enableGlobalRules) {
        await this.checkGlobalRules(globalContext, result);
      }

      // If global rules pass (or audit mode), check local rules
      if (result.allowed || this.config.auditMode) {
        if (this.config.enableLocalRules) {
          await this.checkLocalRules(localContext, result);
        }
      }

      // Determine final allowed status
      result.allowed = result.violations.length === 0;

      // In audit mode, always allow but log violations
      if (this.config.auditMode && result.violations.length > 0) {
        result.allowed = true;
        logger.warn('AUDIT MODE: Violations detected but action allowed', {
          requestId,
          violationCount: result.violations.length,
          violations: result.violations.map(v => v.ruleId),
        });
      }

      result.executionTimeMs = Date.now() - startTime;

      // Log enforcement result
      this.logEnforcementResult(result, globalContext, localContext);

      // Store in history for analysis
      this.storeEnforcementHistory(globalContext.sessionId, result);

      // Update metrics
      this.updateMetrics(result);

      return result;

    } catch (error) {
      logger.error('Rules enforcement failed', error instanceof Error ? error : undefined, {
        errorMessage: error instanceof Error ? undefined : String(error),
        requestId,
      });

      // On enforcement error, fail safe (deny in production, allow in dev)
      result.allowed = this.config.environment === 'development';
      result.violations.push({
        ruleId: 'SYSTEM',
        ruleName: 'Enforcement Error',
        category: 'systemic_safety',
        severity: 'critical',
        message: 'Rules enforcement system error',
        details: { error: error instanceof Error ? error.message : String(error) },
      });

      return result;
    }
  }

  /**
   * Check all enabled global rules
   */
  private async checkGlobalRules(
    context: RuleContext,
    result: EnforcementResult
  ): Promise<void> {
    const enabledRules = getEnabledGlobalRules();
    
    // Filter out tenant-overridden rules
    const applicableRules = enabledRules.filter(rule => {
      if (this.config.tenantOverrides?.disabledRules?.includes(rule.id)) {
        logger.debug('Rule disabled by tenant override', {
          ruleId: rule.id,
          tenantId: this.config.tenantOverrides.tenantId,
        });
        return false;
      }
      return true;
    });

    result.metadata.globalRulesChecked = applicableRules.length;

    for (const rule of applicableRules) {
      try {
        const checkResult = rule.check(context);
        result.globalResults.push(checkResult);

        if (!checkResult.passed) {
          if (rule.enforcementMode === 'block') {
            result.violations.push({
              ruleId: rule.id,
              ruleName: rule.name,
              category: rule.category,
              severity: rule.severity,
              message: checkResult.message,
              details: checkResult.details,
              remediation: checkResult.remediation,
            });
            
            // Critical violations stop further processing
            if (rule.severity === 'critical') {
              result.allowed = false;
              break;
            }
          } else if (rule.enforcementMode === 'warn') {
            result.warnings.push({
              ruleId: rule.id,
              message: checkResult.message,
              suggestion: checkResult.remediation,
            });

            // In strict mode, warnings become violations
            if (this.config.strictMode) {
              result.violations.push({
                ruleId: rule.id,
                ruleName: rule.name,
                category: rule.category,
                severity: 'medium',
                message: `[STRICT] ${checkResult.message}`,
                remediation: checkResult.remediation,
              });
            }
          }
          // 'audit' mode just logs without blocking or warning
        }
      } catch (error) {
        logger.error(`Global rule check failed: ${rule.id}`, error instanceof Error ? error : undefined);
        
        // Rule execution error - fail safe
        if (this.config.environment === 'production') {
          result.violations.push({
            ruleId: rule.id,
            ruleName: rule.name,
            category: rule.category,
            severity: 'high',
            message: `Rule check error: ${error instanceof Error ? error.message : 'Unknown'}`,
          });
        }
      }
    }
  }

  /**
   * Check all applicable local rules for the agent
   */
  private async checkLocalRules(
    context: LocalRuleContext,
    result: EnforcementResult
  ): Promise<void> {
    const applicableRules = getRulesForAgent(context.agentType);
    result.metadata.localRulesChecked = applicableRules.length;

    for (const rule of applicableRules) {
      // Skip tenant-specific rules for other tenants
      if (rule.tenantId && rule.tenantId !== context.tenantId) {
        continue;
      }

      try {
        const checkResult = rule.check(context);
        result.localResults.push(checkResult);

        if (!checkResult.passed) {
          result.violations.push({
            ruleId: rule.id,
            ruleName: rule.name,
            category: rule.category,
            severity: 'local',
            message: checkResult.message,
            details: checkResult.details,
          });

          if (checkResult.fallbackAction) {
            result.fallbackActions.push(checkResult.fallbackAction);
          }

          if (checkResult.userMessage) {
            result.userMessages.push(checkResult.userMessage);
          }
        }
      } catch (error) {
        logger.error(`Local rule check failed: ${rule.id}`, error instanceof Error ? error : undefined, {
          agentType: context.agentType,
        });
      }
    }
  }

  /**
   * Log enforcement result for audit trail
   */
  private logEnforcementResult(
    result: EnforcementResult,
    globalContext: RuleContext,
    localContext: LocalRuleContext
  ): void {
    const logData = {
      requestId: result.metadata.requestId,
      allowed: result.allowed,
      agentType: localContext.agentType,
      action: globalContext.action,
      userId: globalContext.userId,
      tenantId: globalContext.tenantId,
      environment: this.config.environment,
      globalRulesChecked: result.metadata.globalRulesChecked,
      localRulesChecked: result.metadata.localRulesChecked,
      violationCount: result.violations.length,
      warningCount: result.warnings.length,
      executionTimeMs: result.executionTimeMs,
    };

    if (result.allowed) {
      logger.debug('Rules enforcement passed', logData);
    } else {
      logger.warn('Rules enforcement blocked action', {
        ...logData,
        violations: result.violations.map(v => ({
          ruleId: v.ruleId,
          severity: v.severity,
          message: v.message,
        })),
      });
    }
  }

  /**
   * Store enforcement result in history for analysis
   */
  private storeEnforcementHistory(
    sessionId: string,
    result: EnforcementResult
  ): void {
    const history = this.enforcementHistory.get(sessionId) || [];
    history.push(result);

    // Keep only last 100 results per session
    if (history.length > 100) {
      history.shift();
    }

    this.enforcementHistory.set(sessionId, history);
  }

  /**
   * Update rule metrics for monitoring
   */
  private updateMetrics(result: EnforcementResult): void {
    // Update global rule metrics
    for (const checkResult of result.globalResults) {
      const metrics = this.ruleMetrics.get(checkResult.ruleId) || {
        checks: 0,
        passes: 0,
        failures: 0,
        totalTimeMs: 0,
      };

      metrics.checks++;
      if (checkResult.passed) {
        metrics.passes++;
      } else {
        metrics.failures++;
      }

      this.ruleMetrics.set(checkResult.ruleId, metrics);
    }

    // Update local rule metrics
    for (const checkResult of result.localResults) {
      const metrics = this.ruleMetrics.get(checkResult.ruleId) || {
        checks: 0,
        passes: 0,
        failures: 0,
        totalTimeMs: 0,
      };

      metrics.checks++;
      if (checkResult.passed) {
        metrics.passes++;
      } else {
        metrics.failures++;
      }

      this.ruleMetrics.set(checkResult.ruleId, metrics);
    }
  }

  /**
   * Quick check for a specific global rule
   */
  checkGlobalRule(ruleId: string, context: RuleContext): RuleCheckResult {
    const rule = GLOBAL_RULES.find(r => r.id === ruleId);
    
    if (!rule) {
      return {
        passed: false,
        ruleId,
        message: `Rule not found: ${ruleId}`,
      };
    }

    return rule.check(context);
  }

  /**
   * Quick check for a specific local rule
   */
  checkLocalRule(ruleId: string, context: LocalRuleContext): LocalRuleCheckResult {
    const rule = LOCAL_RULES.find(r => r.id === ruleId);
    
    if (!rule) {
      return {
        passed: false,
        ruleId,
        message: `Rule not found: ${ruleId}`,
      };
    }

    return rule.check(context);
  }

  /**
   * Get enforcement history for a session
   */
  getEnforcementHistory(sessionId: string): EnforcementResult[] {
    return this.enforcementHistory.get(sessionId) || [];
  }

  /**
   * Get rule metrics
   */
  getRuleMetrics(): Map<string, RuleMetrics> {
    return new Map(this.ruleMetrics);
  }

  /**
   * Get aggregated metrics for dashboard
   */
  getAggregatedMetrics(): AggregatedMetrics {
    let totalChecks = 0;
    let totalPasses = 0;
    let totalFailures = 0;

    for (const metrics of this.ruleMetrics.values()) {
      totalChecks += metrics.checks;
      totalPasses += metrics.passes;
      totalFailures += metrics.failures;
    }

    const ruleBreakdown: Record<string, { passRate: number; checkCount: number }> = {};
    for (const [ruleId, metrics] of this.ruleMetrics.entries()) {
      ruleBreakdown[ruleId] = {
        passRate: metrics.checks > 0 ? metrics.passes / metrics.checks : 1,
        checkCount: metrics.checks,
      };
    }

    return {
      totalChecks,
      totalPasses,
      totalFailures,
      overallPassRate: totalChecks > 0 ? totalPasses / totalChecks : 1,
      ruleBreakdown,
    };
  }

  /**
   * Clear enforcement history (for testing)
   */
  clearHistory(): void {
    this.enforcementHistory.clear();
  }

  /**
   * Reset metrics (for testing)
   */
  resetMetrics(): void {
    this.ruleMetrics.clear();
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<EnforcerConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info('RulesEnforcer config updated', {
      environment: this.config.environment,
      enableGlobalRules: this.config.enableGlobalRules,
      enableLocalRules: this.config.enableLocalRules,
      strictMode: this.config.strictMode,
      auditMode: this.config.auditMode,
    });
  }
}

// =============================================================================
// HELPER TYPES
// =============================================================================

interface RuleMetrics {
  checks: number;
  passes: number;
  failures: number;
  totalTimeMs: number;
}

interface AggregatedMetrics {
  totalChecks: number;
  totalPasses: number;
  totalFailures: number;
  overallPassRate: number;
  ruleBreakdown: Record<string, { passRate: number; checkCount: number }>;
}

// =============================================================================
// CONTEXT BUILDERS
// =============================================================================

/**
 * Build global rule context from request parameters
 */
export function buildGlobalRuleContext(params: {
  agentId: string;
  agentType: string;
  userId: string;
  tenantId: string;
  sessionId: string;
  action: string;
  payload: Record<string, unknown>;
  environment?: 'development' | 'staging' | 'production';
  requestId?: string;
}): RuleContext {
  return {
    agentId: params.agentId,
    agentType: params.agentType,
    userId: params.userId,
    tenantId: params.tenantId,
    sessionId: params.sessionId,
    action: params.action,
    payload: params.payload,
    environment: params.environment || 'development',
    metadata: {
      timestamp: Date.now(),
      requestId: params.requestId || `req-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    },
  };
}

/**
 * Build local rule context from request parameters
 */
export function buildLocalRuleContext(params: {
  agentId: string;
  agentType: AgentType;
  userId: string;
  tenantId: string;
  sessionId: string;
  action: string;
  tool?: string;
  payload: Record<string, unknown>;
  agentState?: Partial<LocalRuleContext['agentState']>;
  workflowContext?: LocalRuleContext['workflowContext'];
  environment?: 'development' | 'staging' | 'production';
}): LocalRuleContext {
  return {
    agentId: params.agentId,
    agentType: params.agentType,
    userId: params.userId,
    tenantId: params.tenantId,
    sessionId: params.sessionId,
    action: params.action,
    tool: params.tool,
    payload: params.payload,
    agentState: {
      currentStep: params.agentState?.currentStep || 0,
      conversationHistory: params.agentState?.conversationHistory || [],
      memory: params.agentState?.memory || {},
      previousActions: params.agentState?.previousActions || [],
    },
    workflowContext: params.workflowContext,
    environment: params.environment || 'development',
  };
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let enforcerInstance: RulesEnforcer | null = null;

/**
 * Get or create the singleton RulesEnforcer instance
 */
export function getRulesEnforcer(config?: Partial<EnforcerConfig>): RulesEnforcer {
  if (!enforcerInstance) {
    enforcerInstance = new RulesEnforcer(config);
  } else if (config) {
    enforcerInstance.updateConfig(config);
  }
  return enforcerInstance;
}

/**
 * Reset the singleton (for testing)
 */
export function resetRulesEnforcer(): void {
  enforcerInstance = null;
}
