/**
 * Rules Framework Index
 * 
 * Central export for the ValueCanvas Rules Framework.
 * Provides Policy-as-Code enforcement for enterprise agentic SaaS.
 */

// =============================================================================
// GLOBAL RULES (Platform Constitution)
// =============================================================================

export {
  // Types
  type RuleSeverity,
  type RuleCategory,
  type GlobalRule,
  type RuleContext,
  type RuleCheckResult,
  
  // Individual Rules
  RULE_BLOCK_DANGEROUS_COMMANDS,
  RULE_NETWORK_ALLOWLIST,
  RULE_RECURSION_LIMIT,
  RULE_TENANT_ISOLATION,
  RULE_CROSS_TENANT_TRANSFER,
  RULE_PII_REDACTION,
  RULE_LOGGING_PII,
  RULE_LOOP_STEP_LIMIT,
  RULE_SESSION_COST_LIMIT,
  RULE_EXECUTION_TIME_LIMIT,
  RULE_AUDIT_TRAIL,
  
  // Registry
  GLOBAL_RULES,
  
  // Helpers
  getRulesByCategory,
  getEnabledRules,
  getRuleById,
} from './GlobalRules';

// =============================================================================
// LOCAL RULES (Agent Job Descriptions)
// =============================================================================

export {
  // Types
  type LocalRuleCategory,
  type AgentType,
  type LocalRule,
  type LocalRuleContext,
  type LocalRuleCheckResult,
  type ToolAccessConfig,
  
  // Tool Configs
  TOOL_ACCESS_CONFIGS,
  
  // Individual Rules
  RULE_TOOL_ACCESS,
  RULE_DELEGATION_CONTROL,
  RULE_RESPONSE_QUALITY,
  RULE_PERSONA_ENFORCEMENT,
  RULE_UNCERTAINTY_HANDLING,
  RULE_STAGE_TRANSITION,
  RULE_APPROVAL_WORKFLOW,
  RULE_PREREQUISITE_VALIDATION,
  RULE_GRACEFUL_DEGRADATION,
  RULE_RETRY_POLICY,
  RULE_CONTEXT_WINDOW,
  RULE_MEMORY_LIMIT,
  
  // Registry
  LOCAL_RULES,
  
  // Helpers
  getRulesForAgent,
  getRulesByLocalCategory,
  getLocalRuleById,
} from './LocalRules';

// =============================================================================
// RULES ENFORCER
// =============================================================================

export {
  // Types
  type EnforcementResult,
  type RuleViolation,
  type RuleWarning,
  type EnforcerConfig,
  type TenantRuleOverrides,
  
  // Main Class
  RulesEnforcer,
  
  // Context Builders
  buildGlobalRuleContext,
  buildLocalRuleContext,
  
  // Singleton Access
  getRulesEnforcer,
  resetRulesEnforcer,
} from './RulesEnforcer';

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

import { 
  getRulesEnforcer as _getRulesEnforcer, 
  buildGlobalRuleContext as _buildGlobalRuleContext, 
  buildLocalRuleContext as _buildLocalRuleContext 
} from './RulesEnforcer';
import { GLOBAL_RULES as _GLOBAL_RULES } from './GlobalRules';
import { LOCAL_RULES as _LOCAL_RULES, type AgentType as _AgentType } from './LocalRules';

/**
 * Quick enforcement check for common use cases
 */
export async function enforceRules(params: {
  agentId: string;
  agentType: _AgentType;
  userId: string;
  tenantId: string;
  sessionId: string;
  action: string;
  tool?: string;
  payload: Record<string, unknown>;
  environment?: 'development' | 'staging' | 'production';
}) {
  const enforcer = _getRulesEnforcer({ environment: params.environment });
  
  const globalContext = _buildGlobalRuleContext({
    agentId: params.agentId,
    agentType: params.agentType,
    userId: params.userId,
    tenantId: params.tenantId,
    sessionId: params.sessionId,
    action: params.action,
    payload: params.payload,
    environment: params.environment,
  });
  
  const localContext = _buildLocalRuleContext({
    agentId: params.agentId,
    agentType: params.agentType,
    userId: params.userId,
    tenantId: params.tenantId,
    sessionId: params.sessionId,
    action: params.action,
    tool: params.tool,
    payload: params.payload,
    environment: params.environment,
  });
  
  return enforcer.enforce(globalContext, localContext);
}

/**
 * Check if an action is allowed (simplified boolean check)
 */
export async function isActionAllowed(params: {
  agentId: string;
  agentType: _AgentType;
  userId: string;
  tenantId: string;
  sessionId: string;
  action: string;
  tool?: string;
  payload: Record<string, unknown>;
  environment?: 'development' | 'staging' | 'production';
}): Promise<boolean> {
  const result = await enforceRules(params);
  return result.allowed;
}

/**
 * Get all rule IDs (for documentation/testing)
 */
export function getAllRuleIds(): { global: string[]; local: string[] } {
  return {
    global: _GLOBAL_RULES.map(r => r.id),
    local: _LOCAL_RULES.map(r => r.id),
  };
}
