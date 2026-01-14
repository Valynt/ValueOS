/**
 * Attribute-Based Access Control (ABAC)
 *
 * Extends Role-Based Access Control (RBAC) with attribute-based policies
 * for fine-grained authorization in zero-trust architecture.
 */

import { logger } from "../logger";

// ============================================================================
// Types
// ============================================================================

export interface SubjectAttributes {
  userId: string;
  roles: string[];
  groups: string[];
  tenantId: string;
  organizationId?: string;
  department?: string;
  clearanceLevel: "public" | "internal" | "confidential" | "restricted";
  ipAddress: string;
  userAgent: string;
  sessionId: string;
  mfaVerified: boolean;
  riskScore: number;
}

export interface ResourceAttributes {
  resourceId: string;
  resourceType: "api" | "data" | "file" | "service" | "tenant";
  ownerId?: string;
  tenantId: string;
  classification: "public" | "internal" | "confidential" | "restricted";
  sensitivity: "low" | "medium" | "high" | "critical";
  tags: string[];
  metadata: Record<string, any>;
}

export interface EnvironmentAttributes {
  timeOfDay: string;
  dayOfWeek: string;
  location: string;
  networkType: "internal" | "external" | "vpn";
  deviceType: "desktop" | "mobile" | "tablet";
  threatLevel: "low" | "medium" | "high" | "critical";
  complianceStatus: "compliant" | "non_compliant" | "unknown";
}

export interface ABACPolicy {
  id: string;
  name: string;
  description: string;
  priority: number;
  enabled: boolean;

  // Policy conditions
  subjectConditions: SubjectCondition[];
  resourceConditions: ResourceCondition[];
  environmentConditions: EnvironmentCondition[];
  actionConditions: ActionCondition[];

  // Policy effect
  effect: "allow" | "deny";

  // Additional constraints
  obligations?: PolicyObligation[];
  advice?: PolicyAdvice[];
}

export interface SubjectCondition {
  attribute: keyof SubjectAttributes;
  operator:
    | "equals"
    | "not_equals"
    | "in"
    | "not_in"
    | "contains"
    | "regex"
    | "gt"
    | "lt"
    | "gte"
    | "lte";
  value: any;
}

export interface ResourceCondition {
  attribute: keyof ResourceAttributes;
  operator: "equals" | "not_equals" | "in" | "not_in" | "contains" | "regex";
  value: any;
}

export interface EnvironmentCondition {
  attribute: keyof EnvironmentAttributes;
  operator:
    | "equals"
    | "not_equals"
    | "in"
    | "not_in"
    | "contains"
    | "regex"
    | "gt"
    | "lt"
    | "gte"
    | "lte";
  value: any;
}

export interface ActionCondition {
  actions: string[];
  methods?: string[];
  paths?: string[];
}

export interface PolicyObligation {
  type: "log" | "notify" | "mfa_required" | "ip_whitelist" | "time_restriction";
  parameters: Record<string, any>;
}

export interface PolicyAdvice {
  type: "warning" | "info" | "recommendation";
  message: string;
  actions: string[];
}

export interface AccessRequest {
  subject: SubjectAttributes;
  resource: ResourceAttributes;
  environment: EnvironmentAttributes;
  action: {
    operation: string;
    method?: string;
    path?: string;
    parameters?: Record<string, any>;
  };
}

export interface AccessDecision {
  allowed: boolean;
  reason: string;
  policiesApplied: string[];
  obligations: PolicyObligation[];
  advice: PolicyAdvice[];
  riskScore: number;
  auditInfo: {
    timestamp: number;
    decisionId: string;
    processingTime: number;
  };
}

// ============================================================================
// ABAC Policy Engine
// ============================================================================

export class ABACPolicyEngine {
  private static instance: ABACPolicyEngine;
  private policies: Map<string, ABACPolicy> = new Map();
  private policyCache: Map<string, AccessDecision> = new Map();
  private metrics: {
    totalRequests: number;
    cacheHits: number;
    cacheMisses: number;
    averageProcessingTime: number;
    policyViolations: number;
  };

  private constructor() {
    this.metrics = {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageProcessingTime: 0,
      policyViolations: 0,
    };

    this.loadDefaultPolicies();
    this.startMetricsCollection();
  }

  static getInstance(): ABACPolicyEngine {
    if (!ABACPolicyEngine.instance) {
      ABACPolicyEngine.instance = new ABACPolicyEngine();
    }
    return ABACPolicyEngine.instance;
  }

  /**
   * Load default ABAC policies for zero-trust security
   */
  private loadDefaultPolicies(): void {
    const defaultPolicies: ABACPolicy[] = [
      // High-priority deny policies
      {
        id: "deny-high-risk-users",
        name: "Deny High Risk Users",
        description: "Deny access for users with high risk scores",
        priority: 1000,
        enabled: true,
        subjectConditions: [
          { attribute: "riskScore", operator: "gte", value: 80 },
        ],
        resourceConditions: [],
        environmentConditions: [],
        actionConditions: [{ actions: ["*"] }],
        effect: "deny",
        obligations: [
          {
            type: "log",
            parameters: {
              level: "warn",
              message: "High risk user access denied",
            },
          },
          {
            type: "notify",
            parameters: { recipients: ["security-team"], urgency: "high" },
          },
        ],
      },

      // Tenant isolation policy
      {
        id: "tenant-isolation",
        name: "Tenant Data Isolation",
        description:
          "Ensure users can only access resources within their tenant",
        priority: 900,
        enabled: true,
        subjectConditions: [],
        resourceConditions: [],
        environmentConditions: [],
        actionConditions: [{ actions: ["read", "write", "delete"] }],
        effect: "allow",
        obligations: [
          {
            type: "log",
            parameters: {
              level: "info",
              message: "Cross-tenant access attempt",
            },
          },
        ],
      },

      // Time-based restrictions for sensitive resources
      {
        id: "sensitive-data-business-hours",
        name: "Sensitive Data Business Hours Only",
        description: "Restrict access to sensitive data during business hours",
        priority: 800,
        enabled: true,
        subjectConditions: [],
        resourceConditions: [
          {
            attribute: "classification",
            operator: "in",
            value: ["confidential", "restricted"],
          },
        ],
        environmentConditions: [
          {
            attribute: "timeOfDay",
            operator: "not_in",
            value: ["09:00-17:00"],
          },
        ],
        actionConditions: [{ actions: ["read", "write"] }],
        effect: "deny",
        advice: [
          {
            type: "warning",
            message:
              "Access to sensitive data is restricted to business hours (9 AM - 5 PM)",
            actions: ["schedule_access", "request_exception"],
          },
        ],
      },

      // MFA requirement for administrative actions
      {
        id: "admin-mfa-required",
        name: "Admin Actions Require MFA",
        description: "Require MFA verification for administrative operations",
        priority: 700,
        enabled: true,
        subjectConditions: [
          { attribute: "roles", operator: "contains", value: "ADMIN" },
        ],
        resourceConditions: [],
        environmentConditions: [],
        actionConditions: [{ actions: ["create", "update", "delete"] }],
        effect: "allow",
        obligations: [
          {
            type: "mfa_required",
            parameters: { methods: ["totp", "hardware_key"] },
          },
        ],
      },

      // Network-based restrictions
      {
        id: "external-network-restrictions",
        name: "External Network Restrictions",
        description: "Restrict certain operations from external networks",
        priority: 600,
        enabled: true,
        subjectConditions: [],
        resourceConditions: [
          {
            attribute: "classification",
            operator: "equals",
            value: "restricted",
          },
        ],
        environmentConditions: [
          { attribute: "networkType", operator: "equals", value: "external" },
        ],
        actionConditions: [{ actions: ["read", "write"] }],
        effect: "deny",
        advice: [
          {
            type: "recommendation",
            message:
              "Use VPN for accessing restricted resources from external networks",
            actions: ["connect_vpn", "use_internal_network"],
          },
        ],
      },

      // Default allow for basic operations
      {
        id: "default-allow-basic",
        name: "Default Allow Basic Operations",
        description: "Allow basic read operations for authenticated users",
        priority: 100,
        enabled: true,
        subjectConditions: [
          {
            attribute: "clearanceLevel",
            operator: "in",
            value: ["internal", "confidential"],
          },
        ],
        resourceConditions: [
          {
            attribute: "classification",
            operator: "in",
            value: ["public", "internal"],
          },
        ],
        environmentConditions: [],
        actionConditions: [{ actions: ["read"] }],
        effect: "allow",
      },
    ];

    defaultPolicies.forEach((policy) => {
      this.policies.set(policy.id, policy);
    });

    logger.info("ABAC policies loaded", { count: this.policies.size });
  }

  /**
   * Evaluate access request against ABAC policies
   */
  public async evaluateAccess(request: AccessRequest): Promise<AccessDecision> {
    const startTime = Date.now();
    this.metrics.totalRequests++;

    // Check cache first
    const cacheKey = this.generateCacheKey(request);
    const cachedDecision = this.policyCache.get(cacheKey);

    if (cachedDecision && this.isCacheValid(cachedDecision)) {
      this.metrics.cacheHits++;
      return cachedDecision;
    }

    this.metrics.cacheMisses++;

    try {
      // Sort policies by priority (higher number = higher priority)
      const applicablePolicies = Array.from(this.policies.values())
        .filter((policy) => policy.enabled)
        .filter((policy) => this.isPolicyApplicable(policy, request))
        .sort((a, b) => b.priority - a.priority);

      let allowed = false;
      let reason = "No applicable policies";
      const policiesApplied: string[] = [];
      const obligations: PolicyObligation[] = [];
      const advice: PolicyAdvice[] = [];
      let riskScore = this.calculateRiskScore(request);

      // Evaluate policies in priority order
      for (const policy of applicablePolicies) {
        if (this.matchesPolicy(policy, request)) {
          policiesApplied.push(policy.id);

          if (policy.effect === "deny") {
            allowed = false;
            reason = `Denied by policy: ${policy.name}`;
            obligations.push(...(policy.obligations || []));
            advice.push(...(policy.advice || []));
            this.metrics.policyViolations++;
            break;
          } else if (policy.effect === "allow") {
            allowed = true;
            reason = `Allowed by policy: ${policy.name}`;
            obligations.push(...(policy.obligations || []));
            advice.push(...(policy.advice || []));
          }
        }
      }

      const decision: AccessDecision = {
        allowed,
        reason,
        policiesApplied,
        obligations,
        advice,
        riskScore,
        auditInfo: {
          timestamp: Date.now(),
          decisionId: `decision_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          processingTime: Date.now() - startTime,
        },
      };

      // Cache decision for future use
      this.policyCache.set(cacheKey, decision);

      // Update metrics
      const processingTime = Date.now() - startTime;
      this.metrics.averageProcessingTime =
        (this.metrics.averageProcessingTime + processingTime) / 2;

      logger.debug("ABAC access decision", {
        allowed: decision.allowed,
        reason: decision.reason,
        policiesApplied: decision.policiesApplied.length,
        processingTime,
      });

      return decision;
    } catch (error) {
      logger.error(
        "ABAC evaluation error",
        error instanceof Error ? error : new Error(String(error)),
        {
          subjectId: request.subject.userId,
          resourceId: request.resource.resourceId,
        }
      );

      // Default deny on error
      return {
        allowed: false,
        reason: "Policy evaluation error",
        policiesApplied: [],
        obligations: [],
        advice: [],
        riskScore: 100,
        auditInfo: {
          timestamp: Date.now(),
          decisionId: `error_${Date.now()}`,
          processingTime: Date.now() - startTime,
        },
      };
    }
  }

  /**
   * Check if policy is applicable to the request
   */
  private isPolicyApplicable(
    policy: ABACPolicy,
    request: AccessRequest
  ): boolean {
    // Check action conditions
    const actionMatches = policy.actionConditions.some((condition) => {
      const actionMatch =
        condition.actions.includes("*") ||
        condition.actions.includes(request.action.operation);

      const methodMatch =
        !condition.methods ||
        condition.methods.includes(request.action.method || "");

      const pathMatch =
        !condition.paths ||
        condition.paths.some((path) =>
          this.matchesPath(path, request.action.path || "")
        );

      return actionMatch && methodMatch && pathMatch;
    });

    return actionMatches;
  }

  /**
   * Check if request matches policy conditions
   */
  private matchesPolicy(policy: ABACPolicy, request: AccessRequest): boolean {
    // Check subject conditions
    const subjectMatches = policy.subjectConditions.every((condition) =>
      this.evaluateCondition(condition, request.subject)
    );

    // Check resource conditions
    const resourceMatches = policy.resourceConditions.every((condition) =>
      this.evaluateCondition(condition, request.resource)
    );

    // Check environment conditions
    const environmentMatches = policy.environmentConditions.every((condition) =>
      this.evaluateCondition(condition, request.environment)
    );

    return subjectMatches && resourceMatches && environmentMatches;
  }

  /**
   * Evaluate individual condition
   */
  private evaluateCondition(condition: any, target: any): boolean {
    const actualValue = target[condition.attribute];

    switch (condition.operator) {
      case "equals":
        return actualValue === condition.value;
      case "not_equals":
        return actualValue !== condition.value;
      case "in":
        return (
          Array.isArray(condition.value) &&
          condition.value.includes(actualValue)
        );
      case "not_in":
        return (
          Array.isArray(condition.value) &&
          !condition.value.includes(actualValue)
        );
      case "contains":
        return (
          typeof actualValue === "string" &&
          actualValue.includes(condition.value)
        );
      case "regex":
        return new RegExp(condition.value).test(actualValue);
      case "gt":
        return actualValue > condition.value;
      case "lt":
        return actualValue < condition.value;
      case "gte":
        return actualValue >= condition.value;
      case "lte":
        return actualValue <= condition.value;
      default:
        return false;
    }
  }

  /**
   * Check if path matches pattern
   */
  private matchesPath(pattern: string, path: string): boolean {
    // Simple wildcard matching
    const regex = new RegExp(pattern.replace(/\*/g, ".*"));
    return regex.test(path);
  }

  /**
   * Calculate risk score for the access request
   */
  private calculateRiskScore(request: AccessRequest): number {
    let score = 0;

    // Risk factors
    if (request.subject.riskScore > 50) score += 20;
    if (request.environment.networkType === "external") score += 15;
    if (!request.subject.mfaVerified) score += 10;
    if (request.resource.classification === "restricted") score += 25;
    if (request.environment.threatLevel === "high") score += 20;
    if (request.environment.timeOfDay.includes("night")) score += 10;

    return Math.min(score, 100);
  }

  /**
   * Generate cache key for request
   */
  private generateCacheKey(request: AccessRequest): string {
    // Create a deterministic key from request attributes
    const key = `${request.subject.userId}:${request.resource.resourceId}:${request.action.operation}:${request.environment.networkType}`;
    return require("crypto").createHash("md5").update(key).digest("hex");
  }

  /**
   * Check if cached decision is still valid
   */
  private isCacheValid(decision: AccessDecision): boolean {
    // Cache for 5 minutes
    const maxAge = 5 * 60 * 1000;
    return Date.now() - decision.auditInfo.timestamp < maxAge;
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    setInterval(() => {
      // Clean old cache entries
      const maxAge = 10 * 60 * 1000; // 10 minutes
      const cutoffTime = Date.now() - maxAge;

      for (const [key, decision] of this.policyCache.entries()) {
        if (decision.auditInfo.timestamp < cutoffTime) {
          this.policyCache.delete(key);
        }
      }

      logger.debug("ABAC metrics updated", {
        cacheSize: this.policyCache.size,
        totalRequests: this.metrics.totalRequests,
        cacheHitRate:
          this.metrics.cacheHits /
          (this.metrics.cacheHits + this.metrics.cacheMisses),
      });
    }, 60000); // Every minute
  }

  /**
   * Add new ABAC policy
   */
  public addPolicy(policy: ABACPolicy): void {
    this.policies.set(policy.id, policy);
    logger.info("ABAC policy added", {
      policyId: policy.id,
      policyName: policy.name,
    });
  }

  /**
   * Remove ABAC policy
   */
  public removePolicy(policyId: string): boolean {
    const removed = this.policies.delete(policyId);
    if (removed) {
      logger.info("ABAC policy removed", { policyId });
    }
    return removed;
  }

  /**
   * Get policy metrics
   */
  public getMetrics(): any {
    return {
      ...this.metrics,
      activePolicies: this.policies.size,
      cacheSize: this.policyCache.size,
      enabledPolicies: Array.from(this.policies.values()).filter(
        (p) => p.enabled
      ).length,
    };
  }

  /**
   * Get all policies
   */
  public getPolicies(): ABACPolicy[] {
    return Array.from(this.policies.values());
  }
}

// ============================================================================
// Exports
// ============================================================================

export function createABACPolicyEngine(): ABACPolicyEngine {
  return ABACPolicyEngine.getInstance();
}

export default {
  ABACPolicyEngine,
  createABACPolicyEngine,
};
