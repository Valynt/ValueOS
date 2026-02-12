/**
 * Agent Security Middleware
 *
 * CONSOLIDATION: Security middleware for agent input sanitization, validation,
 * and content safety to ensure secure agent operations.
 *
 * Provides comprehensive security controls including input validation,
 * output filtering, PII detection, and content safety checks.
 */

import { AgentType } from "../../agent-types";
import { logger } from "../../../utils/logger";
import { v4 as uuidv4 } from "uuid";
import { LLMCostTracker } from "../../../../packages/backend/src/services/LLMCostTracker";

// ============================================================================
// Security Types
// ============================================================================

export interface SecurityContext {
  /** User ID */
  userId?: string;
  /** Organization ID */
  organizationId?: string;
  /** Session ID */
  sessionId?: string;
  /** Request source */
  source: string;
  /** User permissions */
  permissions: string[];
  /** Security level */
  securityLevel: "low" | "medium" | "high" | "critical";
  /** IP address */
  ipAddress?: string;
  /** User agent */
  userAgent?: string;
}

export interface SecurityValidationResult {
  /** Validation success */
  valid: boolean;
  /** Sanitized input */
  sanitizedInput?: unknown;
  /** Security violations */
  violations: SecurityViolation[];
  /** Risk score (0-100) */
  riskScore: number;
  /** Recommended actions */
  recommendations: SecurityRecommendation[];
  /** Audit log entry */
  auditEntry: SecurityAuditEntry;
  /** Flag for cost-based downgrade */
  shouldDowngrade?: boolean;
}

export interface SecurityViolation {
  /** Violation ID */
  id: string;
  /** Violation type */
  type: ViolationType;
  /** Violation severity */
  severity: "low" | "medium" | "high" | "critical";
  /** Violation description */
  description: string;
  /** Violation location */
  location: string;
  /** Violation value */
  value?: string;
  /** Detected pattern */
  pattern?: string;
  /** Mitigation applied */
  mitigation?: string;
}

export type ViolationType =
  | "injection_attempt"
  | "pii_detected"
  | "malicious_content"
  | "excessive_length"
  | "forbidden_pattern"
  | "unauthorized_access"
  | "rate_limit_exceeded"
  | "suspicious_origin"
  | "data_leakage"
  | "privilege_escalation";

export interface SecurityRecommendation {
  /** Recommendation ID */
  id: string;
  /** Recommendation type */
  type: RecommendationType;
  /** Recommendation description */
  description: string;
  /** Recommendation priority */
  priority: "low" | "medium" | "high" | "critical";
  /** Auto-apply recommendation */
  autoApply: boolean;
  /** Recommendation parameters */
  parameters?: Record<string, unknown>;
}

export type RecommendationType =
  | "sanitize_input"
  | "block_request"
  | "require_approval"
  | "escalate_review"
  | "log_incident"
  | "notify_admin"
  | "rate_limit_throttle"
  | "content_filter";

export interface SecurityAuditEntry {
  /** Entry ID */
  id: string;
  /** Timestamp */
  timestamp: Date;
  /** Agent type */
  agentType: AgentType;
  /** Security context */
  context: SecurityContext;
  /** Input hash */
  inputHash: string;
  /** Violations detected */
  violations: SecurityViolation[];
  /** Actions taken */
  actions: string[];
  /** Risk score */
  riskScore: number;
  /** Processing time */
  processingTime: number;
}

export interface PIIDetectionResult {
  /** PII detected */
  detected: boolean;
  /** PII types found */
  piiTypes: PIIType[];
  /** PII instances */
  instances: PIIInstance[];
  /** Confidence score */
  confidence: number;
  /** Recommendation */
  recommendation: "allow" | "mask" | "block" | "review";
}

export type PIIType =
  | "email"
  | "phone"
  | "ssn"
  | "credit_card"
  | "bank_account"
  | "address"
  | "name"
  | "ip_address"
  | "url"
  | "api_key"
  | "password"
  | "medical_record";

export interface PIIInstance {
  /** PII type */
  type: PIIType;
  /** Detected value */
  value: string;
  /** Start position */
  start: number;
  /** End position */
  end: number;
  /** Confidence score */
  confidence: number;
  /** Masked value */
  masked: string;
}

export interface ContentSafetyResult {
  /** Content safe */
  safe: boolean;
  /** Risk categories */
  riskCategories: RiskCategory[];
  /** Overall risk score */
  riskScore: number;
  /** Recommendation */
  recommendation: "allow" | "filter" | "block" | "review";
  /** Filtered content */
  filteredContent?: string;
}

export interface RiskCategory {
  /** Category name */
  name: string;
  /** Risk level */
  level: "low" | "medium" | "high" | "critical";
  /** Confidence score */
  confidence: number;
  /** Detected patterns */
  patterns: string[];
  /** Description */
  description: string;
}

export interface SecurityPolicy {
  /** Policy ID */
  id: string;
  /** Policy name */
  name: string;
  /** Policy description */
  description: string;
  /** Agent types this policy applies to */
  agentTypes: AgentType[];
  /** Security level */
  securityLevel: "low" | "medium" | "high" | "critical";
  /** Input validation rules */
  inputValidation: ValidationRule[];
  /** Output filtering rules */
  outputFiltering: FilterRule[];
  /** PII detection settings */
  piiDetection: PIIDetectionSettings;
  /** Content safety settings */
  contentSafety: ContentSafetySettings;
  /** Rate limiting settings */
  rateLimiting: RateLimitSettings;
  /** Enabled status */
  enabled: boolean;
}

export interface ValidationRule {
  /** Rule ID */
  id: string;
  /** Rule name */
  name: string;
  /** Rule type */
  type: "regex" | "length" | "type" | "custom";
  /** Rule pattern */
  pattern?: string;
  /** Rule parameters */
  parameters?: Record<string, unknown>;
  /** Rule action */
  action: "allow" | "warn" | "block" | "sanitize";
  /** Rule severity */
  severity: "low" | "medium" | "high" | "critical";
  /** Enabled status */
  enabled: boolean;
}

export interface FilterRule {
  /** Rule ID */
  id: string;
  /** Rule name */
  name: string;
  /** Filter type */
  type: "regex" | "keyword" | "pii" | "custom";
  /** Filter pattern */
  pattern?: string;
  /** Filter parameters */
  parameters?: Record<string, unknown>;
  /** Filter action */
  action: "mask" | "remove" | "replace" | "flag";
  /** Replacement text */
  replacement?: string;
  /** Enabled status */
  enabled: boolean;
}

export interface PIIDetectionSettings {
  /** Enable PII detection */
  enabled: boolean;
  /** PII types to detect */
  piiTypes: PIIType[];
  /** Minimum confidence threshold */
  minConfidence: number;
  /** Default action */
  defaultAction: "allow" | "mask" | "block" | "review";
  /** Custom patterns */
  customPatterns: Array<{
    name: string;
    pattern: string;
    type: PIIType;
  }>;
}

export interface ContentSafetySettings {
  /** Enable content safety */
  enabled: boolean;
  /** Risk categories to check */
  riskCategories: string[];
  /** Minimum risk threshold */
  minRiskThreshold: number;
  /** Default action */
  defaultAction: "allow" | "filter" | "block" | "review";
  /** Custom keywords */
  customKeywords: string[];
}

export interface RateLimitSettings {
  /** Enable rate limiting */
  enabled: boolean;
  /** Requests per window */
  requestsPerWindow: number;
  /** Window size in seconds */
  windowSize: number;
  /** Burst allowance */
  burstAllowance: number;
  /** Throttling action */
  throttleAction: "delay" | "reject" | "queue";
}

// ============================================================================
// Security Middleware Implementation
// ============================================================================

/**
 * Agent Security Middleware
 *
 * Provides comprehensive security controls for agent operations
 */
export class AgentSecurityMiddleware {
  private static instance: AgentSecurityMiddleware;
  private securityPolicies: Map<string, SecurityPolicy> = new Map();
  private rateLimitTracker: Map<string, RateLimitTracker> = new Map();
  private auditLog: SecurityAuditEntry[] = [];
  private maxAuditLogSize: number = 10000;

  private constructor() {
    this.initializeDefaultPolicies();
    logger.info("AgentSecurityMiddleware initialized");
  }

  /**
   * Get singleton instance
   */
  static getInstance(): AgentSecurityMiddleware {
    if (!AgentSecurityMiddleware.instance) {
      AgentSecurityMiddleware.instance = new AgentSecurityMiddleware();
    }
    return AgentSecurityMiddleware.instance;
  }

  /**
   * Validate and sanitize agent input
   */
  async validateInput(
    agentType: AgentType,
    input: unknown,
    context: SecurityContext
  ): Promise<SecurityValidationResult> {
    const startTime = Date.now();
    const inputHash = this.hashInput(input);
    const violations: SecurityViolation[] = [];
    let sanitizedInput = input;
    let riskScore = 0;

    try {
      // Get applicable security policy
      const policy = this.getSecurityPolicy(agentType, context.securityLevel);
      if (!policy) {
        logger.warn("No security policy found for agent", {
          agentType,
          securityLevel: context.securityLevel,
        });
        return this.createValidationResult(
          true,
          sanitizedInput,
          violations,
          riskScore,
          startTime,
          agentType,
          context,
          inputHash,
          undefined,
          undefined,
          false
        );
      }

      // Input validation
      const validationResult = await this.validateInputRules(
        input,
        policy.inputValidation,
        context
      );
      violations.push(...validationResult.violations);
      sanitizedInput = validationResult.sanitizedInput || input;
      riskScore += validationResult.riskScore;

      // PII detection
      if (policy.piiDetection.enabled) {
        const piiResult = await this.detectPII(JSON.stringify(sanitizedInput), policy.piiDetection);
        if (piiResult.detected) {
          violations.push(...this.createPIIViolations(piiResult));
          riskScore += piiResult.confidence * 20;

          // Apply PII masking if recommended
          if (piiResult.recommendation === "mask") {
            sanitizedInput = this.maskPII(sanitizedInput, piiResult.instances);
          }
        }
      }

      // Content safety check
      if (policy.contentSafety.enabled) {
        const safetyResult = await this.checkContentSafety(
          JSON.stringify(sanitizedInput),
          policy.contentSafety
        );
        if (!safetyResult.safe) {
          violations.push(...this.createSafetyViolations(safetyResult));
          riskScore += safetyResult.riskScore * 15;

          // Apply content filtering if recommended
          if (safetyResult.recommendation === "filter" && safetyResult.filteredContent) {
            sanitizedInput = JSON.parse(safetyResult.filteredContent);
          }
        }
      }

      // Rate limiting check
      if (policy.rateLimiting.enabled) {
        const rateLimitResult = this.checkRateLimit(context, policy.rateLimiting);
        if (!rateLimitResult.allowed) {
          violations.push(this.createRateLimitViolation(rateLimitResult));
          riskScore += 30;
        }
      }

      // Authorization check
      const authResult = this.checkAuthorization(agentType, context);
      if (!authResult.authorized) {
        violations.push(...authResult.violations);
        riskScore += 50;
      }

      // Budget check for downgrade
      let shouldDowngrade = false;
      if (context.organizationId) {
        shouldDowngrade = await this.checkBudgetForDowngrade(context.organizationId, agentType);
      }

      // Calculate final risk score and recommendations
      const recommendations = this.generateRecommendations(violations, riskScore, policy);

      // Create audit entry
      const auditEntry = this.createAuditEntry(
        agentType,
        context,
        inputHash,
        violations,
        riskScore,
        Date.now() - startTime
      );

      // Log audit entry
      this.logAuditEntry(auditEntry);

      // Determine if input is valid
      const valid =
        riskScore < this.getRiskThreshold(context.securityLevel) &&
        !violations.some((v) => v.severity === "critical");

      logger.debug("Input validation completed", {
        agentType,
        valid,
        riskScore,
        violationsCount: violations.length,
        processingTime: Date.now() - startTime,
      });

      return this.createValidationResult(
        valid,
        sanitizedInput,
        violations,
        riskScore,
        startTime,
        agentType,
        context,
        inputHash,
        recommendations,
        auditEntry,
        shouldDowngrade
      );
    } catch (error) {
      logger.error("Input validation failed", {
        agentType,
        error: (error as Error).message,
        processingTime: Date.now() - startTime,
      });

      // Fail secure - block on validation errors
      const securityViolation: SecurityViolation = {
        id: uuidv4(),
        type: "injection_attempt",
        severity: "critical",
        description: "Security validation system error",
        location: "validation_system",
        mitigation: "request_blocked",
      };

      return this.createValidationResult(
        false,
        null,
        [securityViolation],
        100,
        startTime,
        agentType,
        context,
        inputHash,
        undefined,
        undefined,
        false
      );
    }
  }

  /**
   * Filter agent output
   */
  async filterOutput(
    agentType: AgentType,
    output: unknown,
    context: SecurityContext
  ): Promise<{
    filteredOutput: unknown;
    violations: SecurityViolation[];
    riskScore: number;
  }> {
    const violations: SecurityViolation[] = [];
    let filteredOutput = output;
    let riskScore = 0;

    try {
      // Get applicable security policy
      const policy = this.getSecurityPolicy(agentType, context.securityLevel);
      if (!policy) {
        return { filteredOutput, violations, riskScore };
      }

      // Apply output filtering rules
      const filterResult = await this.applyOutputFilters(output, policy.outputFiltering, context);
      violations.push(...filterResult.violations);
      filteredOutput = filterResult.filteredOutput || output;
      riskScore += filterResult.riskScore;

      // PII detection in output
      if (policy.piiDetection.enabled) {
        const piiResult = await this.detectPII(JSON.stringify(filteredOutput), policy.piiDetection);
        if (piiResult.detected) {
          violations.push(...this.createPIIViolations(piiResult));
          riskScore += piiResult.confidence * 25;

          // Always mask PII in output
          filteredOutput = this.maskPII(filteredOutput, piiResult.instances);
        }
      }

      // Content safety check in output
      if (policy.contentSafety.enabled) {
        const safetyResult = await this.checkContentSafety(
          JSON.stringify(filteredOutput),
          policy.contentSafety
        );
        if (!safetyResult.safe) {
          violations.push(...this.createSafetyViolations(safetyResult));
          riskScore += safetyResult.riskScore * 20;

          // Always filter unsafe content in output
          if (safetyResult.filteredContent) {
            filteredOutput = JSON.parse(safetyResult.filteredContent);
          }
        }
      }

      logger.debug("Output filtering completed", {
        agentType,
        riskScore,
        violationsCount: violations.length,
      });

      return { filteredOutput, violations, riskScore };
    } catch (error) {
      logger.error("Output filtering failed", {
        agentType,
        error: (error as Error).message,
      });

      // Fail secure - return empty output on filtering errors
      return {
        filteredOutput: null,
        violations: [
          {
            id: uuidv4(),
            type: "injection_attempt",
            severity: "critical",
            description: "Security filtering system error",
            location: "filtering_system",
            mitigation: "output_blocked",
          },
        ],
        riskScore: 100,
      };
    }
  }

  /**
   * Check user permissions for agent access
   */
  validatePermissions(_userId: string, agentType: AgentType, permissions: string[]): boolean {
    // Basic permission check - can be extended with RBAC
    const requiredPermissions = this.getRequiredPermissions(agentType);

    return requiredPermissions.every(
      (permission) => permissions.includes(permission) || permissions.includes("*")
    );
  }

  /**
   * Check if agent should be downgraded due to budget constraints
   */
  async checkBudgetForDowngrade(organizationId: string, agentType: AgentType): Promise<boolean> {
    try {
      const costTracker = LLMCostTracker.getInstance();
      const thresholds = await costTracker.checkCostThresholds(organizationId);

      // Check if monthly budget is over 90%
      const monthlyUsage = thresholds.monthly?.current || 0;
      const monthlyLimit = thresholds.monthly?.limit || 1000000; // default 1M tokens
      const usagePercent = (monthlyUsage / monthlyLimit) * 100;

      if (usagePercent >= 90) {
        // Check if agent is non-critical (ExpansionAgent)
        const isNonCritical = agentType === "ExpansionAgent";
        if (isNonCritical) {
          logger.info("Budget threshold exceeded, downgrading non-critical agent", {
            organizationId,
            agentType,
            usagePercent: usagePercent.toFixed(2),
          });
          return true;
        }
      }

      return false;
    } catch (error) {
      logger.error("Error checking budget for downgrade", { organizationId, agentType, error });
      return false; // Default to no downgrade on error
    }
  }

  /**
   * Audit agent access
   */
  auditAgentAccess(_userId: string, agentType: AgentType, context: SecurityContext): void {
    const auditEntry: SecurityAuditEntry = {
      id: uuidv4(),
      timestamp: new Date(),
      agentType,
      context,
      inputHash: "",
      violations: [],
      actions: ["agent_access"],
      riskScore: 0,
      processingTime: 0,
    };

    this.logAuditEntry(auditEntry);
  }

  /**
   * Add or update security policy
   */
  updateSecurityPolicy(policy: SecurityPolicy): void {
    this.securityPolicies.set(policy.id, policy);
    logger.info("Security policy updated", { policyId: policy.id, agentTypes: policy.agentTypes });
  }

  /**
   * Get security policy for agent type
   */
  getSecurityPolicy(agentType: AgentType, securityLevel: string): SecurityPolicy | undefined {
    for (const policy of this.securityPolicies.values()) {
      if (
        policy.agentTypes.includes(agentType) &&
        policy.securityLevel === securityLevel &&
        policy.enabled
      ) {
        return policy;
      }
    }
    return undefined;
  }

  /**
   * Get audit log entries
   */
  getAuditLog(filters?: {
    agentType?: AgentType;
    userId?: string;
    startTime?: Date;
    endTime?: Date;
    minRiskScore?: number;
  }): SecurityAuditEntry[] {
    let entries = [...this.auditLog];

    if (filters) {
      if (filters.agentType) {
        entries = entries.filter((e) => e.agentType === filters.agentType);
      }
      if (filters.userId) {
        entries = entries.filter((e) => e.context.userId === filters.userId);
      }
      if (filters.startTime) {
        entries = entries.filter((e) => e.timestamp >= filters.startTime!);
      }
      if (filters.endTime) {
        entries = entries.filter((e) => e.timestamp <= filters.endTime!);
      }
      if (filters.minRiskScore) {
        entries = entries.filter((e) => e.riskScore >= filters.minRiskScore!);
      }
    }

    return entries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Reset security middleware
   */
  reset(): void {
    this.securityPolicies.clear();
    this.rateLimitTracker.clear();
    this.auditLog = [];
    this.initializeDefaultPolicies();
    logger.info("Agent security middleware reset");
  }

  /**
   * Get security statistics
   */
  getSecurityStatistics(): {
    totalPolicies: number;
    activePolicies: number;
    totalAuditEntries: number;
    highRiskEntries: number;
    rateLimitTrackers: number;
    memoryUsage: number;
  } {
    const activePolicies = Array.from(this.securityPolicies.values()).filter(
      (p) => p.enabled
    ).length;
    const highRiskEntries = this.auditLog.filter((e) => e.riskScore >= 70).length;

    return {
      totalPolicies: this.securityPolicies.size,
      activePolicies,
      totalAuditEntries: this.auditLog.length,
      highRiskEntries,
      rateLimitTrackers: this.rateLimitTracker.size,
      memoryUsage: this.estimateMemoryUsage(),
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Initialize default security policies
   */
  private initializeDefaultPolicies(): void {
    const defaultPolicy: SecurityPolicy = {
      id: "default-security-policy",
      name: "Default Security Policy",
      description: "Default security policy for all agents",
      agentTypes: ["opportunity", "target", "expansion", "integrity", "realization"],
      securityLevel: "medium",
      inputValidation: [
        {
          id: "max-length",
          name: "Maximum Input Length",
          type: "length",
          parameters: { maxLength: 10000 },
          action: "block",
          severity: "medium",
          enabled: true,
        },
        {
          id: "sql-injection",
          name: "SQL Injection Detection",
          type: "regex",
          pattern: "(?i)(union|select|insert|update|delete|drop|create|alter|exec|script)",
          action: "block",
          severity: "critical",
          enabled: true,
        },
        {
          id: "xss-prevention",
          name: "XSS Prevention",
          type: "regex",
          pattern: "(?i)(<script|javascript:|onload|onerror|onclick)",
          action: "sanitize",
          severity: "high",
          enabled: true,
        },
      ],
      outputFiltering: [
        {
          id: "pii-filter",
          name: "PII Filter",
          type: "pii",
          action: "mask",
          enabled: true,
        },
        {
          id: "profanity-filter",
          name: "Profanity Filter",
          type: "keyword",
          parameters: { keywords: ["badword1", "badword2"] },
          action: "mask",
          replacement: "[REDACTED]",
          enabled: true,
        },
      ],
      piiDetection: {
        enabled: true,
        piiTypes: ["email", "phone", "ssn", "credit_card", "api_key"],
        minConfidence: 0.7,
        defaultAction: "mask",
        customPatterns: [],
      },
      contentSafety: {
        enabled: true,
        riskCategories: ["violence", "hate_speech", "adult_content"],
        minRiskThreshold: 0.6,
        defaultAction: "filter",
        customKeywords: [],
      },
      rateLimiting: {
        enabled: true,
        requestsPerWindow: 100,
        windowSize: 60,
        burstAllowance: 10,
        throttleAction: "delay",
      },
      enabled: true,
    };

    this.securityPolicies.set(defaultPolicy.id, defaultPolicy);
  }

  /**
   * Validate input against rules
   */
  private async validateInputRules(
    input: unknown,
    rules: ValidationRule[],
    context: SecurityContext
  ): Promise<{ violations: SecurityViolation[]; sanitizedInput?: unknown; riskScore: number }> {
    const violations: SecurityViolation[] = [];
    let sanitizedInput = input;
    let riskScore = 0;

    const inputStr = typeof input === "string" ? input : JSON.stringify(input);

    for (const rule of rules.filter((r) => r.enabled)) {
      try {
        switch (rule.type) {
          case "length":
            if (rule.parameters?.maxLength && inputStr.length > rule.parameters.maxLength) {
              violations.push({
                id: uuidv4(),
                type: "excessive_length",
                severity: rule.severity,
                description: `Input exceeds maximum length of ${rule.parameters.maxLength}`,
                location: "input_validation",
                value: inputStr.substring(0, 100) + "...",
              });
              riskScore += this.getRiskScoreForSeverity(rule.severity);
            }
            break;

          case "regex":
            if (rule.pattern && new RegExp(rule.pattern, "i").test(inputStr)) {
              violations.push({
                id: uuidv4(),
                type: "forbidden_pattern",
                severity: rule.severity,
                description: `Input contains forbidden pattern: ${rule.pattern}`,
                location: "input_validation",
                value: inputStr.substring(0, 100) + "...",
                pattern: rule.pattern,
              });
              riskScore += this.getRiskScoreForSeverity(rule.severity);

              if (rule.action === "sanitize") {
                sanitizedInput = inputStr.replace(new RegExp(rule.pattern, "gi"), "[REDACTED]");
              }
            }
            break;

          case "type":
            // Type validation would go here
            break;

          case "custom":
            // Custom validation logic would go here
            break;
        }
      } catch (error) {
        logger.error("Validation rule failed", {
          ruleId: rule.id,
          error: (error as Error).message,
        });
      }
    }

    return { violations, sanitizedInput, riskScore };
  }

  /**
   * Detect PII in text
   */
  private async detectPII(
    text: string,
    settings: PIIDetectionSettings
  ): Promise<PIIDetectionResult> {
    const instances: PIIInstance[] = [];
    let maxConfidence = 0;

    // Email detection
    if (settings.piiTypes.includes("email")) {
      const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
      const matches = text.match(emailRegex);
      if (matches) {
        matches.forEach((match) => {
          const index = text.indexOf(match);
          instances.push({
            type: "email",
            value: match,
            start: index,
            end: index + match.length,
            confidence: 0.9,
            masked: this.maskEmail(match),
          });
          maxConfidence = Math.max(maxConfidence, 0.9);
        });
      }
    }

    // Phone detection
    if (settings.piiTypes.includes("phone")) {
      const phoneRegex = /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g;
      const matches = text.match(phoneRegex);
      if (matches) {
        matches.forEach((match) => {
          const index = text.indexOf(match);
          instances.push({
            type: "phone",
            value: match,
            start: index,
            end: index + match.length,
            confidence: 0.8,
            masked: this.maskPhone(match),
          });
          maxConfidence = Math.max(maxConfidence, 0.8);
        });
      }
    }

    // Add more PII detection patterns as needed

    const detected = instances.length > 0 && maxConfidence >= settings.minConfidence;
    const recommendation = detected ? settings.defaultAction : "allow";

    return {
      detected,
      piiTypes: instances.map((i) => i.type),
      instances,
      confidence: maxConfidence,
      recommendation,
    };
  }

  /**
   * Check content safety
   */
  private async checkContentSafety(
    text: string,
    settings: ContentSafetySettings
  ): Promise<ContentSafetyResult> {
    const riskCategories: RiskCategory[] = [];
    let totalRiskScore = 0;

    // Simple keyword-based content safety check
    const riskyKeywords = ["violence", "hate", "weapon", "illegal"];
    const foundKeywords = riskyKeywords.filter((keyword) => text.toLowerCase().includes(keyword));

    if (foundKeywords.length > 0) {
      riskCategories.push({
        name: "inappropriate_content",
        level: "medium",
        confidence: 0.7,
        patterns: foundKeywords,
        description: "Content contains potentially inappropriate keywords",
      });
      totalRiskScore += 50;
    }

    const safe = riskCategories.length === 0 || totalRiskScore < settings.minRiskThreshold * 100;
    const recommendation = safe ? "allow" : settings.defaultAction;
    let filteredContent: string | undefined;

    if (recommendation === "filter") {
      filteredContent = text;
      foundKeywords.forEach((keyword) => {
        filteredContent = filteredContent!.replace(new RegExp(keyword, "gi"), "[FILTERED]");
      });
    }

    return {
      safe,
      riskCategories,
      riskScore: totalRiskScore,
      recommendation,
      filteredContent,
    };
  }

  /**
   * Check rate limiting
   */
  private checkRateLimit(
    context: SecurityContext,
    settings: RateLimitSettings
  ): {
    allowed: boolean;
    remainingRequests: number;
    resetTime: Date;
  } {
    const key = `${context.userId || "anonymous"}-${context.ipAddress || "unknown"}`;
    const now = Date.now();
    const windowStart = now - settings.windowSize * 1000;

    let tracker = this.rateLimitTracker.get(key);
    if (!tracker) {
      tracker = {
        requests: [],
        burstCount: 0,
        lastBurstReset: now,
      };
      this.rateLimitTracker.set(key, tracker);
    }

    // Clean old requests
    tracker.requests = tracker.requests.filter((timestamp) => timestamp > windowStart);

    // Check burst allowance
    if (now - tracker.lastBurstReset > 1000) {
      // Reset burst every second
      tracker.burstCount = 0;
      tracker.lastBurstReset = now;
    }

    const allowed =
      tracker.requests.length < settings.requestsPerWindow &&
      tracker.burstCount < settings.burstAllowance;

    if (allowed) {
      tracker.requests.push(now);
      tracker.burstCount++;
    }

    return {
      allowed,
      remainingRequests: Math.max(0, settings.requestsPerWindow - tracker.requests.length),
      resetTime: new Date(windowStart + settings.windowSize * 1000),
    };
  }

  /**
   * Check authorization
   */
  private checkAuthorization(
    agentType: AgentType,
    context: SecurityContext
  ): {
    authorized: boolean;
    violations: SecurityViolation[];
  } {
    const violations: SecurityViolation[] = [];

    // Check if user has required permissions
    const requiredPermissions = this.getRequiredPermissions(agentType);
    const hasPermissions = requiredPermissions.every(
      (permission) => context.permissions.includes(permission) || context.permissions.includes("*")
    );

    if (!hasPermissions) {
      violations.push({
        id: uuidv4(),
        type: "unauthorized_access",
        severity: "high",
        description: `User lacks required permissions for agent: ${agentType}`,
        location: "authorization_check",
      });
    }

    return {
      authorized: violations.length === 0,
      violations,
    };
  }

  /**
   * Generate security recommendations
   */
  private generateRecommendations(
    violations: SecurityViolation[],
    riskScore: number,
    policy: SecurityPolicy
  ): SecurityRecommendation[] {
    const recommendations: SecurityRecommendation[] = [];

    if (riskScore >= 80) {
      recommendations.push({
        id: uuidv4(),
        type: "block_request",
        description: "High risk detected - block request",
        priority: "critical",
        autoApply: true,
      });
    } else if (riskScore >= 60) {
      recommendations.push({
        id: uuidv4(),
        type: "require_approval",
        description: "Medium-high risk detected - require approval",
        priority: "high",
        autoApply: false,
      });
    } else if (riskScore >= 40) {
      recommendations.push({
        id: uuidv4(),
        type: "escalate_review",
        description: "Medium risk detected - escalate for review",
        priority: "medium",
        autoApply: false,
      });
    }

    if (violations.some((v) => v.type === "pii_detected")) {
      recommendations.push({
        id: uuidv4(),
        type: "sanitize_input",
        description: "PII detected - sanitize input",
        priority: "high",
        autoApply: true,
      });
    }

    return recommendations;
  }

  /**
   * Create validation result
   */
  private createValidationResult(
    valid: boolean,
    sanitizedInput: unknown,
    violations: SecurityViolation[],
    riskScore: number,
    startTime: number,
    agentType: AgentType,
    context: SecurityContext,
    inputHash: string,
    recommendations?: SecurityRecommendation[],
    auditEntry?: SecurityAuditEntry,
    shouldDowngrade?: boolean
  ): SecurityValidationResult {
    return {
      valid,
      sanitizedInput,
      violations,
      riskScore,
      recommendations: recommendations || [],
      auditEntry:
        auditEntry ||
        this.createAuditEntry(
          agentType,
          context,
          inputHash,
          violations,
          riskScore,
          Date.now() - startTime
        ),
      shouldDowngrade,
    };
  }

  /**
   * Create audit entry
   */
  private createAuditEntry(
    agentType: AgentType,
    context: SecurityContext,
    inputHash: string,
    violations: SecurityViolation[],
    riskScore: number,
    processingTime: number
  ): SecurityAuditEntry {
    return {
      id: uuidv4(),
      timestamp: new Date(),
      agentType,
      context,
      inputHash,
      violations,
      actions: violations.map((v) => v.mitigation || "logged"),
      riskScore,
      processingTime,
    };
  }

  /**
   * Log audit entry
   */
  private logAuditEntry(entry: SecurityAuditEntry): void {
    this.auditLog.push(entry);

    // Cleanup old entries
    if (this.auditLog.length > this.maxAuditLogSize) {
      this.auditLog.splice(0, this.auditLog.length - this.maxAuditLogSize);
    }

    // Log high-risk entries
    if (entry.riskScore >= 70) {
      logger.warn("High-risk security event", {
        auditId: entry.id,
        agentType: entry.agentType,
        userId: entry.context.userId,
        riskScore: entry.riskScore,
        violations: entry.violations.length,
      });
    }
  }

  /**
   * Helper methods
   */
  private hashInput(input: unknown): string {
    // Simple hash function - in production, use proper cryptographic hash
    return Buffer.from(JSON.stringify(input)).toString("base64").substring(0, 16);
  }

  private getRiskScoreForSeverity(severity: string): number {
    switch (severity) {
      case "low":
        return 10;
      case "medium":
        return 25;
      case "high":
        return 50;
      case "critical":
        return 100;
      default:
        return 0;
    }
  }

  private getRiskThreshold(securityLevel: string): number {
    switch (securityLevel) {
      case "low":
        return 80;
      case "medium":
        return 60;
      case "high":
        return 40;
      case "critical":
        return 20;
      default:
        return 60;
    }
  }

  private getRequiredPermissions(agentType: AgentType): string[] {
    // Basic permission mapping - can be extended
    return [`agent.${agentType}.execute`, "agent.basic.access"];
  }

  private createPIIViolations(piiResult: PIIDetectionResult): SecurityViolation[] {
    return piiResult.instances.map((instance) => ({
      id: uuidv4(),
      type: "pii_detected" as ViolationType,
      severity: "medium" as const,
      description: `PII detected: ${instance.type}`,
      location: "pii_detection",
      value: instance.value,
      pattern: instance.type,
      mitigation: "pii_masked",
    }));
  }

  private createSafetyViolations(safetyResult: ContentSafetyResult): SecurityViolation[] {
    return safetyResult.riskCategories.map((category) => ({
      id: uuidv4(),
      type: "malicious_content" as ViolationType,
      severity: category.level as "low" | "medium" | "high" | "critical",
      description: `Unsafe content detected: ${category.name}`,
      location: "content_safety",
      pattern: category.patterns.join(", "),
      mitigation: "content_filtered",
    }));
  }

  private createRateLimitViolation(rateLimitResult: {
    allowed: boolean;
    remainingRequests: number;
    resetTime: Date;
  }): SecurityViolation {
    return {
      id: uuidv4(),
      type: "rate_limit_exceeded",
      severity: "medium",
      description: "Rate limit exceeded",
      location: "rate_limiting",
      mitigation: "request_throttled",
    };
  }

  private maskEmail(email: string): string {
    const [username, domain] = email.split("@");
    const maskedUsername = username.substring(0, 2) + "*".repeat(username.length - 2);
    return `${maskedUsername}@${domain}`;
  }

  private maskPhone(phone: string): string {
    return phone.replace(/\d(?=\d{4})/g, "*");
  }

  private maskPII(input: unknown, instances: PIIInstance[]): unknown {
    if (typeof input !== "string") return input;

    let result = input;
    instances.forEach((instance) => {
      result = result.replace(instance.value, instance.masked);
    });

    return result;
  }

  private async applyOutputFilters(
    output: unknown,
    rules: FilterRule[],
    context: SecurityContext
  ): Promise<{ violations: SecurityViolation[]; filteredOutput?: unknown; riskScore: number }> {
    // Similar to input validation but for output filtering
    // Implementation would follow similar pattern
    return { violations: [], filteredOutput: output, riskScore: 0 };
  }

  private estimateMemoryUsage(): number {
    // Rough estimation in MB
    const policiesSize = this.securityPolicies.size * 0.01; // ~10KB per policy
    const auditLogSize = this.auditLog.length * 0.002; // ~2KB per entry
    const rateLimitSize = this.rateLimitTracker.size * 0.001; // ~1KB per tracker

    return policiesSize + auditLogSize + rateLimitSize;
  }
}

// ============================================================================
// Supporting Types
// ============================================================================

interface RateLimitTracker {
  requests: number[];
  burstCount: number;
  lastBurstReset: number;
}

// ============================================================================
// Export Singleton
// ============================================================================

export const agentSecurityMiddleware = AgentSecurityMiddleware.getInstance();
