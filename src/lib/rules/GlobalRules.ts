/**
 * Global Rules - The Platform "Constitution"
 * 
 * These rules are applied to ALL agents across the entire SaaS platform,
 * regardless of tenant or function. They are immutable safety and compliance
 * constraints that cannot be overridden by local rules.
 * 
 * Enforced via Policy-as-Code pattern for consistent dev/prod behavior.
 */

import { logger } from '../logger';

// =============================================================================
// RULE SEVERITY LEVELS
// =============================================================================

export type RuleSeverity = 'critical' | 'high' | 'medium' | 'low';

export type RuleCategory = 
  | 'systemic_safety'
  | 'data_sovereignty'
  | 'pii_protection'
  | 'cost_control'
  | 'audit_compliance';

export interface GlobalRule {
  id: string;
  name: string;
  category: RuleCategory;
  severity: RuleSeverity;
  description: string;
  enabled: boolean;
  enforcementMode: 'block' | 'warn' | 'audit';
  check: (context: RuleContext) => RuleCheckResult;
  devOverridable: boolean; // Can developers override in dev environment?
}

export interface RuleContext {
  agentId: string;
  agentType: string;
  userId: string;
  tenantId: string;
  sessionId: string;
  action: string;
  payload: Record<string, unknown>;
  environment: 'development' | 'staging' | 'production';
  metadata: {
    timestamp: number;
    requestId: string;
    sourceIp?: string;
    userAgent?: string;
  };
}

export interface RuleCheckResult {
  passed: boolean;
  ruleId: string;
  message: string;
  details?: Record<string, unknown>;
  remediation?: string;
}

// =============================================================================
// SYSTEMIC SAFETY RULES
// =============================================================================

/**
 * GR-001: Block Dangerous System Commands
 * Prevents "God Mode" - ensures no agent can execute dangerous system-level commands
 */
export const RULE_BLOCK_DANGEROUS_COMMANDS: GlobalRule = {
  id: 'GR-001',
  name: 'Block Dangerous System Commands',
  category: 'systemic_safety',
  severity: 'critical',
  description: 'Blocks execution of dangerous system-level commands (DROP TABLE, rm -rf, etc.)',
  enabled: true,
  enforcementMode: 'block',
  devOverridable: false,
  check: (context: RuleContext): RuleCheckResult => {
    const DANGEROUS_PATTERNS = [
      // SQL injection / destructive SQL
      /\bDROP\s+(TABLE|DATABASE|SCHEMA|INDEX)\b/i,
      /\bTRUNCATE\s+TABLE\b/i,
      /\bDELETE\s+FROM\s+\w+\s*;?\s*$/i, // DELETE without WHERE
      /\bUPDATE\s+\w+\s+SET\s+.*\s*;?\s*$/i, // UPDATE without WHERE
      /\bALTER\s+SYSTEM\b/i,
      /;\s*--/i, // SQL comment injection
      
      // Shell commands
      /\brm\s+-rf?\s+[\/~]/i,
      /\bsudo\s+/i,
      /\bchmod\s+777\b/i,
      /\bchown\s+-R\s+/i,
      /\b(curl|wget)\s+.*\|\s*(bash|sh)\b/i,
      /\beval\s*\(/i,
      
      // Process/system manipulation
      /\bkill\s+-9\b/i,
      /\bshutdown\b/i,
      /\breboot\b/i,
      /\bmkfs\b/i,
      /\bformat\s+[a-z]:/i,
      
      // Credential exposure
      /\b(password|secret|api_key|token)\s*=\s*['"][^'"]+['"]/i,
    ];

    const payloadStr = JSON.stringify(context.payload).toLowerCase();
    
    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(payloadStr) || pattern.test(context.action)) {
        return {
          passed: false,
          ruleId: 'GR-001',
          message: `Dangerous command pattern detected: ${pattern.source}`,
          details: { pattern: pattern.source, action: context.action },
          remediation: 'Remove or sanitize the dangerous command pattern',
        };
      }
    }

    return {
      passed: true,
      ruleId: 'GR-001',
      message: 'No dangerous command patterns detected',
    };
  },
};

/**
 * GR-002: Network Allowlist Enforcement
 * Blocks all outbound traffic to non-allowlisted IPs/domains
 */
export const RULE_NETWORK_ALLOWLIST: GlobalRule = {
  id: 'GR-002',
  name: 'Network Allowlist Enforcement',
  category: 'systemic_safety',
  severity: 'critical',
  description: 'Blocks outbound traffic to non-allowlisted IPs/domains',
  enabled: true,
  enforcementMode: 'block',
  devOverridable: false,
  check: (context: RuleContext): RuleCheckResult => {
    const ALLOWLISTED_DOMAINS = [
      // Internal services
      'localhost',
      '127.0.0.1',
      '*.supabase.co',
      '*.supabase.com',
      
      // LLM providers
      'api.together.ai',
      'api.openai.com',
      'api.anthropic.com',
      
      // Monitoring
      '*.sentry.io',
      '*.datadoghq.com',
      
      // CDN
      '*.cloudflare.com',
      '*.fastly.net',
    ];

    const BLOCKED_DOMAINS = [
      '*.github.com', // Block public GitHub in prod
      '*.githubusercontent.com',
      '*.pastebin.com',
      '*.ngrok.io',
      '*.serveo.net',
    ];

    // Extract URLs from payload
    const urlPattern = /https?:\/\/([a-zA-Z0-9.-]+)/gi;
    const payloadStr = JSON.stringify(context.payload);
    const matches = payloadStr.match(urlPattern) || [];

    for (const url of matches) {
      const domain = url.replace(/https?:\/\//, '').split('/')[0];
      
      // Check if blocked (in production)
      if (context.environment === 'production') {
        for (const blocked of BLOCKED_DOMAINS) {
          const pattern = blocked.replace(/\*/g, '.*');
          if (new RegExp(`^${pattern}$`).test(domain)) {
            return {
              passed: false,
              ruleId: 'GR-002',
              message: `Blocked domain detected: ${domain}`,
              details: { domain, blockedPattern: blocked },
              remediation: 'Use only allowlisted domains for external requests',
            };
          }
        }
      }

      // Check if allowlisted
      let isAllowed = false;
      for (const allowed of ALLOWLISTED_DOMAINS) {
        const pattern = allowed.replace(/\*/g, '.*');
        if (new RegExp(`^${pattern}$`).test(domain)) {
          isAllowed = true;
          break;
        }
      }

      // In production, block non-allowlisted domains
      if (context.environment === 'production' && !isAllowed) {
        return {
          passed: false,
          ruleId: 'GR-002',
          message: `Non-allowlisted domain detected: ${domain}`,
          details: { domain },
          remediation: 'Add domain to allowlist or use an approved alternative',
        };
      }
    }

    return {
      passed: true,
      ruleId: 'GR-002',
      message: 'All network targets are allowlisted',
    };
  },
};

/**
 * GR-003: Recursion Depth Limit
 * Prevents infinite loops and stack overflow attacks
 */
export const RULE_RECURSION_LIMIT: GlobalRule = {
  id: 'GR-003',
  name: 'Recursion Depth Limit',
  category: 'systemic_safety',
  severity: 'high',
  description: 'Limits recursion depth to prevent infinite loops',
  enabled: true,
  enforcementMode: 'block',
  devOverridable: true,
  check: (context: RuleContext): RuleCheckResult => {
    const MAX_RECURSION_DEPTH = context.environment === 'development' ? 10 : 5;
    const depth = (context.payload.recursionDepth as number) || 0;

    if (depth >= MAX_RECURSION_DEPTH) {
      return {
        passed: false,
        ruleId: 'GR-003',
        message: `Recursion depth ${depth} exceeds maximum ${MAX_RECURSION_DEPTH}`,
        details: { currentDepth: depth, maxDepth: MAX_RECURSION_DEPTH },
        remediation: 'Refactor to reduce recursion or use iterative approach',
      };
    }

    return {
      passed: true,
      ruleId: 'GR-003',
      message: `Recursion depth ${depth} is within limits`,
    };
  },
};

// =============================================================================
// DATA SOVEREIGNTY RULES
// =============================================================================

/**
 * GR-010: Tenant Isolation Enforcement
 * Ensures all database queries include tenant context
 */
export const RULE_TENANT_ISOLATION: GlobalRule = {
  id: 'GR-010',
  name: 'Tenant Isolation Enforcement',
  category: 'data_sovereignty',
  severity: 'critical',
  description: 'Ensures all database operations include tenant_id filter',
  enabled: true,
  enforcementMode: 'block',
  devOverridable: false,
  check: (context: RuleContext): RuleCheckResult => {
    // Check if this is a database operation
    const DB_OPERATIONS = ['query', 'insert', 'update', 'delete', 'select'];
    const isDbOperation = DB_OPERATIONS.some(op => 
      context.action.toLowerCase().includes(op)
    );

    if (!isDbOperation) {
      return {
        passed: true,
        ruleId: 'GR-010',
        message: 'Not a database operation',
      };
    }

    // Check for tenant_id in payload or filters - must match context tenant
    const payloadTenantId = 
      (context.payload.filters as Record<string, unknown>)?.tenant_id ??
      (context.payload.where as Record<string, unknown>)?.tenant_id ??
      context.payload.tenant_id;

    // Payload must explicitly include tenant_id filter
    if (payloadTenantId === undefined) {
      return {
        passed: false,
        ruleId: 'GR-010',
        message: 'Database operation missing tenant_id filter',
        details: { 
          action: context.action,
          requiredField: 'tenant_id',
        },
        remediation: 'Add WHERE tenant_id = current_context to all queries',
      };
    }

    // Verify tenant_id matches context (use already-extracted value)
    if (payloadTenantId !== context.tenantId) {
      return {
        passed: false,
        ruleId: 'GR-010',
        message: 'Cross-tenant access attempt detected',
        details: {
          expectedTenant: context.tenantId,
          attemptedTenant: payloadTenantId,
        },
        remediation: 'Ensure operations only target current tenant data',
      };
    }

    return {
      passed: true,
      ruleId: 'GR-010',
      message: 'Tenant isolation verified',
    };
  },
};

/**
 * GR-011: Cross-Tenant Data Transfer Block
 * Prevents copying or moving data between tenants
 */
export const RULE_CROSS_TENANT_TRANSFER: GlobalRule = {
  id: 'GR-011',
  name: 'Cross-Tenant Data Transfer Block',
  category: 'data_sovereignty',
  severity: 'critical',
  description: 'Blocks any operation that transfers data between tenants',
  enabled: true,
  enforcementMode: 'block',
  devOverridable: false,
  check: (context: RuleContext): RuleCheckResult => {
    const TRANSFER_OPERATIONS = ['copy', 'move', 'transfer', 'migrate', 'export'];
    const isTransfer = TRANSFER_OPERATIONS.some(op =>
      context.action.toLowerCase().includes(op)
    );

    if (!isTransfer) {
      return {
        passed: true,
        ruleId: 'GR-011',
        message: 'Not a transfer operation',
      };
    }

    // Check source and destination tenants
    const sourceTenant = context.payload.sourceTenantId as string;
    const destTenant = context.payload.destinationTenantId as string;

    if (sourceTenant && destTenant && sourceTenant !== destTenant) {
      return {
        passed: false,
        ruleId: 'GR-011',
        message: 'Cross-tenant data transfer blocked',
        details: {
          sourceTenant,
          destinationTenant: destTenant,
        },
        remediation: 'Data cannot be transferred between tenants',
      };
    }

    return {
      passed: true,
      ruleId: 'GR-011',
      message: 'Transfer operation within same tenant',
    };
  },
};

// =============================================================================
// PII PROTECTION RULES
// =============================================================================

/**
 * GR-020: PII Detection and Redaction
 * Sanitizes inputs/outputs to prevent accidental PII exposure
 */
export const RULE_PII_REDACTION: GlobalRule = {
  id: 'GR-020',
  name: 'PII Detection and Redaction',
  category: 'pii_protection',
  severity: 'critical',
  description: 'Detects and blocks PII patterns (SSN, credit cards, etc.)',
  enabled: true,
  enforcementMode: 'block',
  devOverridable: false,
  check: (context: RuleContext): RuleCheckResult => {
    const PII_PATTERNS = {
      // US Social Security Number
      ssn: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/,
      
      // Credit Card Numbers (Luhn-valid patterns)
      credit_card: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b/,
      
      // Email addresses in contexts that suggest bulk data
      email_bulk: /\[\s*["'][^"']+@[^"']+["']\s*,/,
      
      // Phone numbers (US format)
      phone: /\b(?:\+1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/,
      
      // Passport numbers (simplified)
      passport: /\b[A-Z]{1,2}[0-9]{6,9}\b/,
      
      // Bank account patterns
      bank_account: /\b[0-9]{8,17}\b(?=.*(?:routing|account|iban))/i,
      
      // Driver's license (simplified state patterns)
      drivers_license: /\b[A-Z][0-9]{7,8}\b/,
      
      // Date of birth with specific context
      dob: /\b(?:dob|birth|born)\b.*\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b/i,
      
      // Healthcare IDs (NPI, Medicare)
      healthcare_id: /\b(?:NPI|Medicare)\s*:?\s*[0-9]{10,11}\b/i,
    };

    const payloadStr = JSON.stringify(context.payload);
    const detectedPII: string[] = [];

    for (const [piiType, pattern] of Object.entries(PII_PATTERNS)) {
      if (pattern.test(payloadStr)) {
        detectedPII.push(piiType);
      }
    }

    if (detectedPII.length > 0) {
      return {
        passed: false,
        ruleId: 'GR-020',
        message: `PII detected in payload: ${detectedPII.join(', ')}`,
        details: { 
          detectedTypes: detectedPII,
          // DO NOT include the actual PII values
        },
        remediation: 'Remove or redact PII before processing. Use synthetic data for testing.',
      };
    }

    return {
      passed: true,
      ruleId: 'GR-020',
      message: 'No PII patterns detected',
    };
  },
};

/**
 * GR-021: Logging PII Prevention
 * Ensures PII is never written to logs
 */
export const RULE_LOGGING_PII: GlobalRule = {
  id: 'GR-021',
  name: 'Logging PII Prevention',
  category: 'pii_protection',
  severity: 'high',
  description: 'Prevents PII from being written to logs',
  enabled: true,
  enforcementMode: 'block',
  devOverridable: false,
  check: (context: RuleContext): RuleCheckResult => {
    const isLoggingAction = ['log', 'trace', 'debug', 'audit'].some(op =>
      context.action.toLowerCase().includes(op)
    );

    if (!isLoggingAction) {
      return {
        passed: true,
        ruleId: 'GR-021',
        message: 'Not a logging operation',
      };
    }

    // Re-use PII detection from GR-020
    const result = RULE_PII_REDACTION.check(context);
    if (!result.passed) {
      return {
        passed: false,
        ruleId: 'GR-021',
        message: 'Attempted to log PII data',
        details: result.details,
        remediation: 'Redact PII before logging. Use sanitization utilities.',
      };
    }

    return {
      passed: true,
      ruleId: 'GR-021',
      message: 'Log data is PII-free',
    };
  },
};

// =============================================================================
// COST CONTROL RULES
// =============================================================================

/**
 * GR-030: Reasoning Loop Step Limit
 * Prevents runaway agentic loops from consuming resources
 */
export const RULE_LOOP_STEP_LIMIT: GlobalRule = {
  id: 'GR-030',
  name: 'Reasoning Loop Step Limit',
  category: 'cost_control',
  severity: 'high',
  description: 'Limits reasoning loop steps to prevent runaway execution',
  enabled: true,
  enforcementMode: 'block',
  devOverridable: true,
  check: (context: RuleContext): RuleCheckResult => {
    const LIMITS = {
      development: { maxSteps: 20, maxLLMCalls: 50 },
      staging: { maxSteps: 15, maxLLMCalls: 30 },
      production: { maxSteps: 10, maxLLMCalls: 20 },
    };

    const limits = LIMITS[context.environment];
    const currentSteps = (context.payload.loopSteps as number) || 0;
    const currentLLMCalls = (context.payload.llmCalls as number) || 0;

    if (currentSteps >= limits.maxSteps) {
      return {
        passed: false,
        ruleId: 'GR-030',
        message: `Reasoning loop exceeded ${limits.maxSteps} steps`,
        details: { 
          currentSteps, 
          maxSteps: limits.maxSteps,
          environment: context.environment,
        },
        remediation: 'Break down complex tasks or optimize reasoning chain',
      };
    }

    if (currentLLMCalls >= limits.maxLLMCalls) {
      return {
        passed: false,
        ruleId: 'GR-030',
        message: `LLM call limit exceeded: ${currentLLMCalls}/${limits.maxLLMCalls}`,
        details: { 
          currentCalls: currentLLMCalls, 
          maxCalls: limits.maxLLMCalls,
        },
        remediation: 'Optimize prompt strategy or batch LLM requests',
      };
    }

    return {
      passed: true,
      ruleId: 'GR-030',
      message: `Loop metrics within limits: ${currentSteps}/${limits.maxSteps} steps, ${currentLLMCalls}/${limits.maxLLMCalls} LLM calls`,
    };
  },
};

/**
 * GR-031: Session Cost Limit
 * Hard cap on spending per session
 */
export const RULE_SESSION_COST_LIMIT: GlobalRule = {
  id: 'GR-031',
  name: 'Session Cost Limit',
  category: 'cost_control',
  severity: 'high',
  description: 'Enforces maximum spend per session',
  enabled: true,
  enforcementMode: 'block',
  devOverridable: true,
  check: (context: RuleContext): RuleCheckResult => {
    const COST_LIMITS = {
      development: 5.00,  // $5 max per dev session
      staging: 10.00,     // $10 max per staging session
      production: 25.00,  // $25 max per production session
    };

    const maxCost = COST_LIMITS[context.environment];
    const currentCost = (context.payload.sessionCost as number) || 0;

    if (currentCost >= maxCost) {
      return {
        passed: false,
        ruleId: 'GR-031',
        message: `Session cost $${currentCost.toFixed(2)} exceeds limit $${maxCost.toFixed(2)}`,
        details: {
          currentCost,
          maxCost,
          currency: 'USD',
        },
        remediation: 'Optimize token usage or start a new session',
      };
    }

    // Warn at 80% threshold
    if (currentCost >= maxCost * 0.8) {
      logger.warn('Session approaching cost limit', {
        sessionId: context.sessionId,
        currentCost,
        maxCost,
        percentUsed: ((currentCost / maxCost) * 100).toFixed(1),
      });
    }

    return {
      passed: true,
      ruleId: 'GR-031',
      message: `Session cost $${currentCost.toFixed(2)} within limit $${maxCost.toFixed(2)}`,
    };
  },
};

/**
 * GR-032: Execution Time Limit
 * Prevents long-running agent executions
 */
export const RULE_EXECUTION_TIME_LIMIT: GlobalRule = {
  id: 'GR-032',
  name: 'Execution Time Limit',
  category: 'cost_control',
  severity: 'high',
  description: 'Limits maximum execution time per agent action',
  enabled: true,
  enforcementMode: 'block',
  devOverridable: true,
  check: (context: RuleContext): RuleCheckResult => {
    const TIME_LIMITS = {
      development: 60_000,  // 60 seconds
      staging: 45_000,      // 45 seconds
      production: 30_000,   // 30 seconds
    };

    const maxTime = TIME_LIMITS[context.environment];
    const elapsed = (context.payload.executionTimeMs as number) || 0;

    if (elapsed >= maxTime) {
      return {
        passed: false,
        ruleId: 'GR-032',
        message: `Execution time ${elapsed}ms exceeds limit ${maxTime}ms`,
        details: {
          elapsed,
          maxTime,
        },
        remediation: 'Break down into smaller tasks or optimize processing',
      };
    }

    return {
      passed: true,
      ruleId: 'GR-032',
      message: `Execution time ${elapsed}ms within limit`,
    };
  },
};

// =============================================================================
// AUDIT COMPLIANCE RULES
// =============================================================================

/**
 * GR-040: Action Audit Trail Requirement
 * Ensures all significant actions are logged to audit trail
 */
export const RULE_AUDIT_TRAIL: GlobalRule = {
  id: 'GR-040',
  name: 'Action Audit Trail Requirement',
  category: 'audit_compliance',
  severity: 'medium',
  description: 'Requires audit logging for all significant actions',
  enabled: true,
  enforcementMode: 'audit',
  devOverridable: true,
  check: (context: RuleContext): RuleCheckResult => {
    const AUDITABLE_ACTIONS = [
      'create', 'update', 'delete', 'export', 'import',
      'approve', 'reject', 'submit', 'finalize', 'publish',
      'grant', 'revoke', 'login', 'logout', 'configure',
    ];

    const isAuditable = AUDITABLE_ACTIONS.some(action =>
      context.action.toLowerCase().includes(action)
    );

    if (!isAuditable) {
      return {
        passed: true,
        ruleId: 'GR-040',
        message: 'Action does not require audit logging',
      };
    }

    // Check if audit metadata is present
    const hasAuditFields = 
      context.metadata.requestId !== undefined &&
      context.userId !== undefined &&
      context.metadata.timestamp !== undefined;

    if (!hasAuditFields) {
      return {
        passed: false,
        ruleId: 'GR-040',
        message: 'Auditable action missing required audit metadata',
        details: {
          action: context.action,
          missingFields: [
            !context.metadata.requestId && 'requestId',
            !context.userId && 'userId',
            !context.metadata.timestamp && 'timestamp',
          ].filter(Boolean),
        },
        remediation: 'Ensure all auditable actions include request context',
      };
    }

    return {
      passed: true,
      ruleId: 'GR-040',
      message: 'Audit metadata present for auditable action',
    };
  },
};

// =============================================================================
// GLOBAL RULES REGISTRY
// =============================================================================

export const GLOBAL_RULES: GlobalRule[] = [
  // Systemic Safety
  RULE_BLOCK_DANGEROUS_COMMANDS,
  RULE_NETWORK_ALLOWLIST,
  RULE_RECURSION_LIMIT,
  
  // Data Sovereignty
  RULE_TENANT_ISOLATION,
  RULE_CROSS_TENANT_TRANSFER,
  
  // PII Protection
  RULE_PII_REDACTION,
  RULE_LOGGING_PII,
  
  // Cost Control
  RULE_LOOP_STEP_LIMIT,
  RULE_SESSION_COST_LIMIT,
  RULE_EXECUTION_TIME_LIMIT,
  
  // Audit Compliance
  RULE_AUDIT_TRAIL,
];

/**
 * Get all rules by category
 */
export function getRulesByCategory(category: RuleCategory): GlobalRule[] {
  return GLOBAL_RULES.filter(rule => rule.category === category);
}

/**
 * Get all enabled rules
 */
export function getEnabledRules(): GlobalRule[] {
  return GLOBAL_RULES.filter(rule => rule.enabled);
}

/**
 * Get rule by ID
 */
export function getRuleById(id: string): GlobalRule | undefined {
  return GLOBAL_RULES.find(rule => rule.id === id);
}
