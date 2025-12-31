/**
 * Local Rules - The Agent "Job Description"
 * 
 * These rules are applied to specific agents or tenants.
 * They define scope of authority, behavioral alignment, workflow logic,
 * and error handling for individual agent types.
 * 
 * In development, these are the rules developers actively write and test.
 */

import { logger } from '../logger';

// =============================================================================
// LOCAL RULE TYPES
// =============================================================================

export type LocalRuleCategory = 
  | 'scope_of_authority'
  | 'behavioral_alignment'
  | 'workflow_logic'
  | 'error_handling'
  | 'resource_limits';

export type AgentType = 
  | 'coordinator'
  | 'system_mapper'
  | 'intervention_designer'
  | 'outcome_engineer'
  | 'realization_loop'
  | 'value_eval'
  | 'communicator'
  | 'custom';

export interface LocalRule {
  id: string;
  name: string;
  category: LocalRuleCategory;
  agentTypes: AgentType[];
  tenantId?: string; // If set, only applies to this tenant
  description: string;
  enabled: boolean;
  priority: number; // Higher priority rules are checked first
  check: (context: LocalRuleContext) => LocalRuleCheckResult;
}

export interface LocalRuleContext {
  agentId: string;
  agentType: AgentType;
  userId: string;
  tenantId: string;
  sessionId: string;
  action: string;
  tool?: string;
  payload: Record<string, unknown>;
  agentState: {
    currentStep: number;
    conversationHistory: Array<{ role: string; content: string }>;
    memory: Record<string, unknown>;
    previousActions: string[];
  };
  workflowContext?: {
    workflowId: string;
    stage: string;
    previousStages: string[];
  };
  environment: 'development' | 'staging' | 'production';
}

export interface LocalRuleCheckResult {
  passed: boolean;
  ruleId: string;
  message: string;
  details?: Record<string, unknown>;
  fallbackAction?: string;
  userMessage?: string; // Message to show to user on failure
}

// =============================================================================
// TOOL ACCESS CONTROL
// =============================================================================

/**
 * Tool allowlist/denylist per agent type
 */
export interface ToolAccessConfig {
  agentType: AgentType;
  allowedTools: string[];
  deniedTools: string[];
  requireApproval: string[]; // Tools that need human approval
}

export const TOOL_ACCESS_CONFIGS: ToolAccessConfig[] = [
  {
    agentType: 'coordinator',
    allowedTools: [
      'plan_task',
      'delegate_to_agent',
      'summarize_results',
      'request_clarification',
      'update_workflow_state',
      'generate_sdui_layout',
    ],
    deniedTools: [
      'execute_sql',
      'modify_system_config',
      'access_raw_database',
      'delete_tenant_data',
    ],
    requireApproval: [
      'finalize_workflow',
      'publish_artifact',
    ],
  },
  {
    agentType: 'system_mapper',
    allowedTools: [
      'analyze_system',
      'create_system_map',
      'identify_components',
      'map_dependencies',
      'generate_diagram',
      'search_knowledge_base',
    ],
    deniedTools: [
      'modify_production_system',
      'execute_commands',
      'access_external_systems',
    ],
    requireApproval: [
      'export_system_map',
    ],
  },
  {
    agentType: 'intervention_designer',
    allowedTools: [
      'design_intervention',
      'analyze_impact',
      'create_recommendation',
      'compare_alternatives',
      'calculate_roi_estimate',
      'search_best_practices',
    ],
    deniedTools: [
      'implement_intervention',
      'modify_live_systems',
      'commit_changes',
    ],
    requireApproval: [
      'approve_intervention',
      'schedule_implementation',
    ],
  },
  {
    agentType: 'outcome_engineer',
    allowedTools: [
      'define_outcomes',
      'create_kpis',
      'build_value_tree',
      'calculate_projections',
      'validate_assumptions',
      'generate_roi_model',
    ],
    deniedTools: [
      'modify_financial_records',
      'adjust_actual_metrics',
      'bypass_validation',
    ],
    requireApproval: [
      'finalize_value_tree',
      'commit_roi_model',
    ],
  },
  {
    agentType: 'realization_loop',
    allowedTools: [
      'track_metrics',
      'compare_projections',
      'generate_reports',
      'identify_variances',
      'create_feedback',
      'update_tracking_dashboard',
    ],
    deniedTools: [
      'modify_baseline_metrics',
      'delete_historical_data',
      'alter_projections_retroactively',
    ],
    requireApproval: [
      'close_realization_loop',
      'mark_value_realized',
    ],
  },
  {
    agentType: 'value_eval',
    allowedTools: [
      'evaluate_value',
      'score_artifact',
      'compare_alternatives',
      'generate_assessment',
      'rank_opportunities',
      'create_evaluation_report',
    ],
    deniedTools: [
      'override_scores',
      'bypass_criteria',
      'modify_evaluation_weights',
    ],
    requireApproval: [
      'finalize_evaluation',
      'publish_rankings',
    ],
  },
  {
    agentType: 'communicator',
    allowedTools: [
      'send_message',
      'broadcast_update',
      'notify_stakeholders',
      'format_report',
      'translate_content',
      'summarize_for_audience',
    ],
    deniedTools: [
      'send_external_email',
      'post_to_social_media',
      'access_external_apis',
    ],
    requireApproval: [
      'send_to_executives',
      'publish_externally',
    ],
  },
];

// =============================================================================
// SCOPE OF AUTHORITY RULES
// =============================================================================

/**
 * LR-001: Tool Access Control
 * Ensures agents only use tools they're authorized for
 */
export const RULE_TOOL_ACCESS: LocalRule = {
  id: 'LR-001',
  name: 'Tool Access Control',
  category: 'scope_of_authority',
  agentTypes: ['coordinator', 'system_mapper', 'intervention_designer', 'outcome_engineer', 'realization_loop', 'value_eval', 'communicator', 'custom'],
  description: 'Controls which tools each agent type can access',
  enabled: true,
  priority: 100,
  check: (context: LocalRuleContext): LocalRuleCheckResult => {
    if (!context.tool) {
      return {
        passed: true,
        ruleId: 'LR-001',
        message: 'No tool invocation',
      };
    }

    const config = TOOL_ACCESS_CONFIGS.find(c => c.agentType === context.agentType);
    
    if (!config) {
      // Custom agent - apply restrictive defaults
      return {
        passed: false,
        ruleId: 'LR-001',
        message: `No tool access config for agent type: ${context.agentType}`,
        fallbackAction: 'deny',
        userMessage: 'This agent type is not configured for tool access.',
      };
    }

    // Check denied tools first (explicit deny takes precedence)
    if (config.deniedTools.includes(context.tool)) {
      return {
        passed: false,
        ruleId: 'LR-001',
        message: `Tool "${context.tool}" is explicitly denied for ${context.agentType}`,
        details: { 
          tool: context.tool, 
          agentType: context.agentType,
          reason: 'explicit_deny',
        },
        userMessage: `The ${context.agentType} agent cannot use the ${context.tool} tool.`,
      };
    }

    // Check if tool requires approval
    if (config.requireApproval.includes(context.tool)) {
      const hasApproval = context.payload.approvalToken !== undefined;
      if (!hasApproval) {
        return {
          passed: false,
          ruleId: 'LR-001',
          message: `Tool "${context.tool}" requires human approval`,
          details: { 
            tool: context.tool, 
            requiresApproval: true,
          },
          fallbackAction: 'request_approval',
          userMessage: `Using ${context.tool} requires approval. Would you like to request it?`,
        };
      }
    }

    // Check allowed tools
    if (!config.allowedTools.includes(context.tool)) {
      return {
        passed: false,
        ruleId: 'LR-001',
        message: `Tool "${context.tool}" is not in allowlist for ${context.agentType}`,
        details: { 
          tool: context.tool, 
          allowedTools: config.allowedTools,
        },
        userMessage: `The ${context.agentType} agent is not authorized to use ${context.tool}.`,
      };
    }

    return {
      passed: true,
      ruleId: 'LR-001',
      message: `Tool "${context.tool}" is allowed for ${context.agentType}`,
    };
  },
};

/**
 * LR-002: Agent Delegation Control
 * Controls which agents can delegate to which other agents
 */
export const RULE_DELEGATION_CONTROL: LocalRule = {
  id: 'LR-002',
  name: 'Agent Delegation Control',
  category: 'scope_of_authority',
  agentTypes: ['coordinator'],
  description: 'Controls agent-to-agent delegation permissions',
  enabled: true,
  priority: 90,
  check: (context: LocalRuleContext): LocalRuleCheckResult => {
    if (context.action !== 'delegate_to_agent') {
      return {
        passed: true,
        ruleId: 'LR-002',
        message: 'Not a delegation action',
      };
    }

    const DELEGATION_MATRIX: Record<AgentType, AgentType[]> = {
      coordinator: ['system_mapper', 'intervention_designer', 'outcome_engineer', 'realization_loop', 'value_eval', 'communicator'],
      system_mapper: ['communicator'],
      intervention_designer: ['system_mapper', 'communicator'],
      outcome_engineer: ['value_eval', 'communicator'],
      realization_loop: ['outcome_engineer', 'communicator'],
      value_eval: ['communicator'],
      communicator: [],
      custom: [],
    };

    const targetAgent = context.payload.targetAgent as AgentType;
    const allowedTargets = DELEGATION_MATRIX[context.agentType] || [];

    if (!allowedTargets.includes(targetAgent)) {
      return {
        passed: false,
        ruleId: 'LR-002',
        message: `${context.agentType} cannot delegate to ${targetAgent}`,
        details: {
          sourceAgent: context.agentType,
          targetAgent,
          allowedTargets,
        },
        userMessage: 'This delegation is not permitted by the workflow.',
      };
    }

    return {
      passed: true,
      ruleId: 'LR-002',
      message: `Delegation from ${context.agentType} to ${targetAgent} is permitted`,
    };
  },
};

// =============================================================================
// BEHAVIORAL ALIGNMENT RULES
// =============================================================================

/**
 * LR-010: Response Quality Standards
 * Ensures agent responses meet quality standards
 */
export const RULE_RESPONSE_QUALITY: LocalRule = {
  id: 'LR-010',
  name: 'Response Quality Standards',
  category: 'behavioral_alignment',
  agentTypes: ['coordinator', 'system_mapper', 'intervention_designer', 'outcome_engineer', 'realization_loop', 'value_eval', 'communicator', 'custom'],
  description: 'Enforces quality standards for agent responses',
  enabled: true,
  priority: 80,
  check: (context: LocalRuleContext): LocalRuleCheckResult => {
    const response = context.payload.response as string;
    
    if (!response) {
      return {
        passed: true,
        ruleId: 'LR-010',
        message: 'No response to validate',
      };
    }

    // Check for empty or too short responses
    if (response.trim().length < 10) {
      return {
        passed: false,
        ruleId: 'LR-010',
        message: 'Response too short to be useful',
        fallbackAction: 'retry_with_elaboration',
        userMessage: 'I need to provide a more detailed response.',
      };
    }

    // Check for unhelpful patterns
    const UNHELPFUL_PATTERNS = [
      /^I don't know\.?$/i,
      /^I cannot help with that\.?$/i,
      /^Sorry, I can't\.?$/i,
      /^No\.?$/i,
      /^Yes\.?$/i,
    ];

    for (const pattern of UNHELPFUL_PATTERNS) {
      if (pattern.test(response.trim())) {
        return {
          passed: false,
          ruleId: 'LR-010',
          message: 'Response matches unhelpful pattern',
          fallbackAction: 'ask_for_clarification',
          userMessage: 'If unsure, I should ask for clarification rather than giving an unhelpful response.',
        };
      }
    }

    // Check for hyperbolic/exaggerated language
    const HYPERBOLIC_PATTERNS = [
      /\b(revolutionary|game-changing|paradigm-shifting|unprecedented)\b/i,
      /\b(guaranteed|100%|absolutely certain|definitely will)\b/i,
      /\b(impossible|never|always|every single)\b/i,
    ];

    for (const pattern of HYPERBOLIC_PATTERNS) {
      if (pattern.test(response)) {
        return {
          passed: false,
          ruleId: 'LR-010',
          message: 'Response contains hyperbolic language',
          details: { pattern: pattern.source },
          fallbackAction: 'moderate_language',
          userMessage: 'I should use more measured, factual language.',
        };
      }
    }

    return {
      passed: true,
      ruleId: 'LR-010',
      message: 'Response meets quality standards',
    };
  },
};

/**
 * LR-011: Persona Enforcement
 * Ensures agent maintains consistent persona/tone
 */
export const RULE_PERSONA_ENFORCEMENT: LocalRule = {
  id: 'LR-011',
  name: 'Persona Enforcement',
  category: 'behavioral_alignment',
  agentTypes: ['coordinator', 'system_mapper', 'intervention_designer', 'outcome_engineer', 'realization_loop', 'value_eval', 'communicator', 'custom'],
  description: 'Enforces consistent agent persona and tone',
  enabled: true,
  priority: 70,
  check: (context: LocalRuleContext): LocalRuleCheckResult => {
    const response = context.payload.response as string;
    
    if (!response) {
      return {
        passed: true,
        ruleId: 'LR-011',
        message: 'No response to validate',
      };
    }

    // Check for inappropriate persona breaks
    const PERSONA_VIOLATIONS = [
      // First person singular (agents should use "we" or be neutral)
      { pattern: /\bI think\b|\bI believe\b|\bI feel\b/i, message: 'Avoid first-person singular opinions' },
      // Emotional expressions
      { pattern: /\b(angry|frustrated|annoyed|excited|thrilled)\b/i, message: 'Avoid emotional expressions' },
      // Informal language
      { pattern: /\b(gonna|wanna|kinda|sorta|ya know|like,)\b/i, message: 'Avoid informal language' },
      // Roleplay breaks
      { pattern: /as an AI|as a language model|I'm just an AI/i, message: 'Avoid meta-references to AI nature' },
    ];

    for (const { pattern, message } of PERSONA_VIOLATIONS) {
      if (pattern.test(response)) {
        return {
          passed: false,
          ruleId: 'LR-011',
          message: `Persona violation: ${message}`,
          details: { pattern: pattern.source },
          fallbackAction: 'rephrase',
        };
      }
    }

    return {
      passed: true,
      ruleId: 'LR-011',
      message: 'Response maintains appropriate persona',
    };
  },
};

/**
 * LR-012: Uncertainty Handling
 * Ensures agents ask for clarification when uncertain
 */
export const RULE_UNCERTAINTY_HANDLING: LocalRule = {
  id: 'LR-012',
  name: 'Uncertainty Handling',
  category: 'behavioral_alignment',
  agentTypes: ['coordinator', 'system_mapper', 'intervention_designer', 'outcome_engineer', 'realization_loop', 'value_eval', 'communicator', 'custom'],
  description: 'Requires agents to seek clarification when uncertain',
  enabled: true,
  priority: 75,
  check: (context: LocalRuleContext): LocalRuleCheckResult => {
    const confidence = context.payload.confidence as number;
    const action = context.action;

    // Skip for clarification requests themselves
    if (action === 'request_clarification') {
      return {
        passed: true,
        ruleId: 'LR-012',
        message: 'Already requesting clarification',
      };
    }

    // If confidence is provided and low, require clarification
    if (confidence !== undefined && confidence < 0.6) {
      const isHighImpact = ['finalize', 'commit', 'publish', 'approve', 'submit'].some(
        op => action.toLowerCase().includes(op)
      );

      if (isHighImpact) {
        return {
          passed: false,
          ruleId: 'LR-012',
          message: `Low confidence (${(confidence * 100).toFixed(0)}%) on high-impact action`,
          details: {
            confidence,
            action,
            threshold: 0.6,
          },
          fallbackAction: 'request_clarification',
          userMessage: 'I need more information before proceeding with this action.',
        };
      }
    }

    return {
      passed: true,
      ruleId: 'LR-012',
      message: 'Confidence level acceptable for action',
    };
  },
};

// =============================================================================
// WORKFLOW LOGIC RULES
// =============================================================================

/**
 * LR-020: Stage Transition Validation
 * Ensures proper workflow stage progression
 */
export const RULE_STAGE_TRANSITION: LocalRule = {
  id: 'LR-020',
  name: 'Stage Transition Validation',
  category: 'workflow_logic',
  agentTypes: ['coordinator', 'outcome_engineer', 'realization_loop'],
  description: 'Validates workflow stage transitions follow correct sequence',
  enabled: true,
  priority: 95,
  check: (context: LocalRuleContext): LocalRuleCheckResult => {
    if (!context.workflowContext) {
      return {
        passed: true,
        ruleId: 'LR-020',
        message: 'No workflow context',
      };
    }

    const VALID_TRANSITIONS: Record<string, string[]> = {
      'opportunity': ['target'],
      'target': ['expansion', 'opportunity'], // Can go back
      'expansion': ['integrity', 'target'],
      'integrity': ['realization', 'expansion'],
      'realization': ['integrity'], // Can loop back for adjustments
    };

    const targetStage = context.payload.targetStage as string;
    const currentStage = context.workflowContext.stage;
    const validNextStages = VALID_TRANSITIONS[currentStage] || [];

    if (targetStage && !validNextStages.includes(targetStage)) {
      return {
        passed: false,
        ruleId: 'LR-020',
        message: `Invalid stage transition: ${currentStage} → ${targetStage}`,
        details: {
          currentStage,
          targetStage,
          validTransitions: validNextStages,
        },
        userMessage: `Cannot move from ${currentStage} to ${targetStage}. Valid next stages: ${validNextStages.join(', ')}`,
      };
    }

    return {
      passed: true,
      ruleId: 'LR-020',
      message: `Stage transition ${currentStage} → ${targetStage} is valid`,
    };
  },
};

/**
 * LR-021: Approval Workflow Enforcement
 * Requires approval for high-value actions
 */
export const RULE_APPROVAL_WORKFLOW: LocalRule = {
  id: 'LR-021',
  name: 'Approval Workflow Enforcement',
  category: 'workflow_logic',
  agentTypes: ['coordinator', 'outcome_engineer', 'intervention_designer'],
  description: 'Requires approval workflow for high-value actions',
  enabled: true,
  priority: 85,
  check: (context: LocalRuleContext): LocalRuleCheckResult => {
    const APPROVAL_THRESHOLDS = {
      expense_amount: 500,
      roi_projection: 100000,
      risk_score: 0.7,
      stakeholder_count: 10,
    };

    const expenseAmount = context.payload.expenseAmount as number;
    const roiProjection = context.payload.roiProjection as number;
    const riskScore = context.payload.riskScore as number;
    const stakeholderCount = context.payload.stakeholderCount as number;

    const requiresApproval = 
      (expenseAmount && expenseAmount > APPROVAL_THRESHOLDS.expense_amount) ||
      (roiProjection && roiProjection > APPROVAL_THRESHOLDS.roi_projection) ||
      (riskScore && riskScore > APPROVAL_THRESHOLDS.risk_score) ||
      (stakeholderCount && stakeholderCount > APPROVAL_THRESHOLDS.stakeholder_count);

    if (requiresApproval) {
      const hasApproval = context.payload.approvalId !== undefined;
      
      if (!hasApproval) {
        const reasons = [];
        if (expenseAmount > APPROVAL_THRESHOLDS.expense_amount) {
          reasons.push(`expense > $${APPROVAL_THRESHOLDS.expense_amount}`);
        }
        if (roiProjection > APPROVAL_THRESHOLDS.roi_projection) {
          reasons.push(`ROI projection > $${APPROVAL_THRESHOLDS.roi_projection}`);
        }
        if (riskScore > APPROVAL_THRESHOLDS.risk_score) {
          reasons.push(`risk score > ${APPROVAL_THRESHOLDS.risk_score}`);
        }
        if (stakeholderCount > APPROVAL_THRESHOLDS.stakeholder_count) {
          reasons.push(`stakeholders > ${APPROVAL_THRESHOLDS.stakeholder_count}`);
        }

        return {
          passed: false,
          ruleId: 'LR-021',
          message: `Action requires approval: ${reasons.join(', ')}`,
          details: {
            expenseAmount,
            roiProjection,
            riskScore,
            stakeholderCount,
            thresholds: APPROVAL_THRESHOLDS,
          },
          fallbackAction: 'trigger_approval_workflow',
          userMessage: `This action requires approval because: ${reasons.join(', ')}`,
        };
      }
    }

    return {
      passed: true,
      ruleId: 'LR-021',
      message: 'No approval required or approval already obtained',
    };
  },
};

/**
 * LR-022: Prerequisite Validation
 * Ensures prerequisites are met before actions
 */
export const RULE_PREREQUISITE_VALIDATION: LocalRule = {
  id: 'LR-022',
  name: 'Prerequisite Validation',
  category: 'workflow_logic',
  agentTypes: ['coordinator', 'outcome_engineer', 'realization_loop'],
  description: 'Validates that prerequisites are met before actions',
  enabled: true,
  priority: 90,
  check: (context: LocalRuleContext): LocalRuleCheckResult => {
    const ACTION_PREREQUISITES: Record<string, string[]> = {
      'build_value_tree': ['system_map_complete', 'opportunities_identified'],
      'calculate_roi': ['value_tree_complete', 'assumptions_documented'],
      'finalize_intervention': ['roi_calculated', 'risks_assessed'],
      'start_realization': ['intervention_approved', 'baseline_established'],
      'close_realization_loop': ['kpis_measured', 'variance_analyzed'],
    };

    const prerequisites = ACTION_PREREQUISITES[context.action];
    
    if (!prerequisites) {
      return {
        passed: true,
        ruleId: 'LR-022',
        message: 'No prerequisites for this action',
      };
    }

    const completedSteps = context.agentState.previousActions || [];
    const memory = context.agentState.memory || {};
    
    const missingPrereqs = prerequisites.filter(prereq => {
      return !completedSteps.includes(prereq) && !memory[prereq];
    });

    if (missingPrereqs.length > 0) {
      return {
        passed: false,
        ruleId: 'LR-022',
        message: `Missing prerequisites: ${missingPrereqs.join(', ')}`,
        details: {
          action: context.action,
          required: prerequisites,
          missing: missingPrereqs,
          completed: completedSteps,
        },
        userMessage: `Before proceeding, we need to complete: ${missingPrereqs.join(', ')}`,
      };
    }

    return {
      passed: true,
      ruleId: 'LR-022',
      message: 'All prerequisites met',
    };
  },
};

// =============================================================================
// ERROR HANDLING RULES
// =============================================================================

/**
 * LR-030: Graceful Degradation
 * Defines fallback behavior when tools/services fail
 */
export const RULE_GRACEFUL_DEGRADATION: LocalRule = {
  id: 'LR-030',
  name: 'Graceful Degradation',
  category: 'error_handling',
  agentTypes: ['coordinator', 'system_mapper', 'intervention_designer', 'outcome_engineer', 'realization_loop', 'value_eval', 'communicator', 'custom'],
  description: 'Defines graceful degradation when services fail',
  enabled: true,
  priority: 100,
  check: (context: LocalRuleContext): LocalRuleCheckResult => {
    const lastError = context.payload.lastError as {
      tool: string;
      errorCode: number;
      message: string;
    } | undefined;

    if (!lastError) {
      return {
        passed: true,
        ruleId: 'LR-030',
        message: 'No error to handle',
      };
    }

    // Define fallback behaviors per error type
    const FALLBACK_BEHAVIORS: Record<string, { message: string; action: string }> = {
      'calendar_api': {
        message: 'I cannot schedule meetings right now. Would you like me to help with something else?',
        action: 'notify_and_continue',
      },
      'database': {
        message: 'I\'m having trouble accessing the data. Let me try an alternative approach.',
        action: 'retry_with_cache',
      },
      'llm_service': {
        message: 'I\'m experiencing some processing delays. Let me try a simpler approach.',
        action: 'use_fallback_model',
      },
      'external_api': {
        message: 'An external service is temporarily unavailable. I\'ll proceed with available information.',
        action: 'continue_without_external',
      },
      'file_system': {
        message: 'I cannot access the requested file right now.',
        action: 'notify_admin',
      },
    };

    const toolCategory = Object.keys(FALLBACK_BEHAVIORS).find(
      cat => lastError.tool.toLowerCase().includes(cat)
    );

    if (toolCategory) {
      const fallback = FALLBACK_BEHAVIORS[toolCategory];
      
      // Log the error and fallback
      logger.warn('Applying graceful degradation', {
        tool: lastError.tool,
        errorCode: lastError.errorCode,
        fallbackAction: fallback.action,
      });

      return {
        passed: true, // Allow to continue with fallback
        ruleId: 'LR-030',
        message: `Applying fallback for ${lastError.tool} failure`,
        details: {
          originalError: lastError,
          fallbackAction: fallback.action,
        },
        fallbackAction: fallback.action,
        userMessage: fallback.message,
      };
    }

    // Default fallback for unknown errors
    return {
      passed: true,
      ruleId: 'LR-030',
      message: 'Applying default error handling',
      fallbackAction: 'log_and_notify',
      userMessage: 'I encountered an issue. Let me try a different approach.',
    };
  },
};

/**
 * LR-031: Retry Policy
 * Defines retry behavior for transient failures
 */
export const RULE_RETRY_POLICY: LocalRule = {
  id: 'LR-031',
  name: 'Retry Policy',
  category: 'error_handling',
  agentTypes: ['coordinator', 'system_mapper', 'intervention_designer', 'outcome_engineer', 'realization_loop', 'value_eval', 'communicator', 'custom'],
  description: 'Defines retry behavior for transient failures',
  enabled: true,
  priority: 95,
  check: (context: LocalRuleContext): LocalRuleCheckResult => {
    const retryCount = (context.payload.retryCount as number) || 0;
    const lastError = context.payload.lastError as { errorCode: number } | undefined;

    // Non-retryable error codes
    const NON_RETRYABLE = [400, 401, 403, 404, 422];
    
    if (lastError && NON_RETRYABLE.includes(lastError.errorCode)) {
      return {
        passed: false,
        ruleId: 'LR-031',
        message: `Error ${lastError.errorCode} is not retryable`,
        details: {
          errorCode: lastError.errorCode,
          retryable: false,
        },
        fallbackAction: 'fail_gracefully',
      };
    }

    // Max retry limits
    const MAX_RETRIES = {
      development: 5,
      staging: 3,
      production: 2,
    };

    const maxRetries = MAX_RETRIES[context.environment];

    if (retryCount >= maxRetries) {
      return {
        passed: false,
        ruleId: 'LR-031',
        message: `Max retries (${maxRetries}) exceeded`,
        details: {
          retryCount,
          maxRetries,
        },
        fallbackAction: 'escalate_to_human',
        userMessage: 'I\'ve tried multiple times but couldn\'t complete this action. Would you like to try something different?',
      };
    }

    return {
      passed: true,
      ruleId: 'LR-031',
      message: `Retry ${retryCount + 1}/${maxRetries} allowed`,
    };
  },
};

// =============================================================================
// RESOURCE LIMITS RULES
// =============================================================================

/**
 * LR-040: Context Window Management
 * Ensures agent doesn't exceed context window limits
 */
export const RULE_CONTEXT_WINDOW: LocalRule = {
  id: 'LR-040',
  name: 'Context Window Management',
  category: 'resource_limits',
  agentTypes: ['coordinator', 'system_mapper', 'intervention_designer', 'outcome_engineer', 'realization_loop', 'value_eval', 'communicator', 'custom'],
  description: 'Manages context window size for LLM calls',
  enabled: true,
  priority: 85,
  check: (context: LocalRuleContext): LocalRuleCheckResult => {
    // Estimate token count (rough approximation: 1 token ≈ 4 chars)
    const conversationLength = context.agentState.conversationHistory.reduce(
      (sum, msg) => sum + msg.content.length, 0
    );
    const estimatedTokens = Math.ceil(conversationLength / 4);

    const TOKEN_LIMITS = {
      development: 100000,
      staging: 50000,
      production: 32000,
    };

    const limit = TOKEN_LIMITS[context.environment];

    if (estimatedTokens > limit * 0.9) {
      return {
        passed: false,
        ruleId: 'LR-040',
        message: `Context window approaching limit: ~${estimatedTokens} tokens`,
        details: {
          estimatedTokens,
          limit,
          percentUsed: ((estimatedTokens / limit) * 100).toFixed(1),
        },
        fallbackAction: 'summarize_and_truncate',
        userMessage: 'Let me summarize our conversation to continue efficiently.',
      };
    }

    return {
      passed: true,
      ruleId: 'LR-040',
      message: `Context window usage: ~${estimatedTokens}/${limit} tokens`,
    };
  },
};

/**
 * LR-041: Memory Usage Limit
 * Limits agent memory consumption
 */
export const RULE_MEMORY_LIMIT: LocalRule = {
  id: 'LR-041',
  name: 'Memory Usage Limit',
  category: 'resource_limits',
  agentTypes: ['coordinator', 'system_mapper', 'intervention_designer', 'outcome_engineer', 'realization_loop', 'value_eval', 'communicator', 'custom'],
  description: 'Limits agent memory consumption',
  enabled: true,
  priority: 80,
  check: (context: LocalRuleContext): LocalRuleCheckResult => {
    const memorySize = JSON.stringify(context.agentState.memory).length;
    
    const MEMORY_LIMITS = {
      development: 10 * 1024 * 1024, // 10MB
      staging: 5 * 1024 * 1024,      // 5MB
      production: 2 * 1024 * 1024,   // 2MB
    };

    const limit = MEMORY_LIMITS[context.environment];

    if (memorySize > limit) {
      return {
        passed: false,
        ruleId: 'LR-041',
        message: `Memory usage ${(memorySize / 1024 / 1024).toFixed(2)}MB exceeds limit`,
        details: {
          currentSize: memorySize,
          limit,
        },
        fallbackAction: 'prune_memory',
      };
    }

    return {
      passed: true,
      ruleId: 'LR-041',
      message: `Memory usage within limits: ${(memorySize / 1024).toFixed(2)}KB`,
    };
  },
};

// =============================================================================
// LOCAL RULES REGISTRY
// =============================================================================

export const LOCAL_RULES: LocalRule[] = [
  // Scope of Authority
  RULE_TOOL_ACCESS,
  RULE_DELEGATION_CONTROL,
  
  // Behavioral Alignment
  RULE_RESPONSE_QUALITY,
  RULE_PERSONA_ENFORCEMENT,
  RULE_UNCERTAINTY_HANDLING,
  
  // Workflow Logic
  RULE_STAGE_TRANSITION,
  RULE_APPROVAL_WORKFLOW,
  RULE_PREREQUISITE_VALIDATION,
  
  // Error Handling
  RULE_GRACEFUL_DEGRADATION,
  RULE_RETRY_POLICY,
  
  // Resource Limits
  RULE_CONTEXT_WINDOW,
  RULE_MEMORY_LIMIT,
];

/**
 * Get rules applicable to an agent type
 */
export function getRulesForAgent(agentType: AgentType): LocalRule[] {
  return LOCAL_RULES
    .filter(rule => rule.agentTypes.includes(agentType) && rule.enabled)
    .sort((a, b) => b.priority - a.priority);
}

/**
 * Get rules by category
 */
export function getRulesByLocalCategory(category: LocalRuleCategory): LocalRule[] {
  return LOCAL_RULES.filter(rule => rule.category === category && rule.enabled);
}

/**
 * Get rule by ID
 */
export function getLocalRuleById(id: string): LocalRule | undefined {
  return LOCAL_RULES.find(rule => rule.id === id);
}
