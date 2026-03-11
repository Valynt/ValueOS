/**
 * Tenant Isolation Service
 *
 * Implements multi-tenant data isolation mechanisms for zero-trust security.
 * Ensures complete separation between tenant data and prevents cross-tenant access.
 */

import { logger } from "../lib/logger.js"

// ============================================================================
// Types
// ============================================================================

export interface Tenant {
  id: string;
  name: string;
  domain?: string;
  status: "active" | "suspended" | "terminated";
  createdAt: Date;
  updatedAt: Date;
  settings: TenantSettings;
  limits: TenantLimits;
}

export interface TenantSettings {
  allowCrossTenantSharing: boolean;
  dataRetentionDays: number;
  encryptionEnabled: boolean;
  auditLoggingEnabled: boolean;
  allowedDomains: string[];
  featureFlags: Record<string, boolean>;
}

export interface TenantLimits {
  maxUsers: number;
  maxStorageGB: number;
  maxApiCallsPerHour: number;
  maxConcurrentSessions: number;
  rateLimitPerMinute: number;
}

export interface TenantContext {
  tenantId: string;
  userId: string;
  roles: string[];
  permissions: string[];
  sessionId: string;
  ipAddress: string;
  userAgent: string;
  requestId: string;
}

export interface IsolationRule {
  id: string;
  name: string;
  description: string;
  priority: number;
  enabled: boolean;

  // Isolation constraints
  allowedTenantIds: string[];
  blockedTenantIds: string[];
  allowedResourceTypes: string[];
  blockedResourceTypes: string[];

  // Data access rules
  rowLevelSecurity: boolean;
  columnLevelSecurity: boolean;
  fieldEncryption: boolean;

  // Network isolation
  networkSegmentation: boolean;
  allowedNetworks: string[];
  blockedNetworks: string[];
}

export interface DataAccessRequest {
  tenantContext: TenantContext;
  resourceType: string;
  resourceId?: string;
  operation: "read" | "write" | "delete" | "list";
  query?: any;
  filters?: Record<string, any>;
}

export interface IsolationResult {
  allowed: boolean;
  reason: string;
  filteredData?: any;
  appliedRules: string[];
  warnings: string[];
  auditRequired: boolean;
}

// ============================================================================
// Tenant Isolation Service
// ============================================================================

export class TenantIsolationService {
  private static instance: TenantIsolationService;
  private tenants: Map<string, Tenant> = new Map();
  private isolationRules: Map<string, IsolationRule> = new Map();
  private tenantCache: Map<string, TenantContext[]> = new Map();
  private metrics: {
    totalRequests: number;
    blockedRequests: number;
    allowedRequests: number;
    averageProcessingTime: number;
    ruleViolations: Map<string, number>;
  };

  private constructor() {
    this.metrics = {
      totalRequests: 0,
      blockedRequests: 0,
      allowedRequests: 0,
      averageProcessingTime: 0,
      ruleViolations: new Map(),
    };

    this.loadDefaultIsolationRules();
    this.startMetricsCollection();
  }

  static getInstance(): TenantIsolationService {
    if (!TenantIsolationService.instance) {
      TenantIsolationService.instance = new TenantIsolationService();
    }
    return TenantIsolationService.instance;
  }

  /**
   * Load default tenant isolation rules
   */
  private loadDefaultIsolationRules(): void {
    const defaultRules: IsolationRule[] = [
      // High-priority security rules
      {
        id: "strict-tenant-isolation",
        name: "Strict Tenant Isolation",
        description: "Block all cross-tenant data access",
        priority: 1000,
        enabled: true,
        allowedTenantIds: [], // Empty means only same tenant
        blockedTenantIds: ["*"], // Block all other tenants
        allowedResourceTypes: ["*"],
        blockedResourceTypes: [],
        rowLevelSecurity: true,
        columnLevelSecurity: false,
        fieldEncryption: true,
        networkSegmentation: true,
        allowedNetworks: [],
        blockedNetworks: ["external"],
      },

      // Administrative override rule
      {
        id: "admin-cross-tenant-access",
        name: "Administrative Cross-Tenant Access",
        description: "Allow system administrators to access multiple tenants",
        priority: 900,
        enabled: true,
        allowedTenantIds: ["*"],
        blockedTenantIds: [],
        allowedResourceTypes: ["user", "tenant", "audit"],
        blockedResourceTypes: [],
        rowLevelSecurity: false,
        columnLevelSecurity: false,
        fieldEncryption: false,
        networkSegmentation: false,
        allowedNetworks: ["internal"],
        blockedNetworks: [],
      },

      // Data sharing rule
      {
        id: "controlled-data-sharing",
        name: "Controlled Data Sharing",
        description: "Allow controlled sharing between specific tenants",
        priority: 800,
        enabled: false, // Disabled by default for strict isolation
        allowedTenantIds: [], // Must be configured per tenant
        blockedTenantIds: [],
        allowedResourceTypes: ["shared_resource"],
        blockedResourceTypes: [],
        rowLevelSecurity: true,
        columnLevelSecurity: true,
        fieldEncryption: true,
        networkSegmentation: true,
        allowedNetworks: ["internal"],
        blockedNetworks: ["external"],
      },

      // Public resource access
      {
        id: "public-resource-access",
        name: "Public Resource Access",
        description: "Allow access to public resources across tenants",
        priority: 700,
        enabled: true,
        allowedTenantIds: ["*"],
        blockedTenantIds: [],
        allowedResourceTypes: ["public_api", "public_data"],
        blockedResourceTypes: [],
        rowLevelSecurity: false,
        columnLevelSecurity: false,
        fieldEncryption: false,
        networkSegmentation: false,
        allowedNetworks: ["*"],
        blockedNetworks: [],
      },

      // Audit logging rule
      {
        id: "audit-logging-access",
        name: "Audit Logging Access",
        description: "Allow access to audit logs within tenant",
        priority: 600,
        enabled: true,
        allowedTenantIds: [], // Same tenant only
        blockedTenantIds: ["*"],
        allowedResourceTypes: ["audit_log"],
        blockedResourceTypes: [],
        rowLevelSecurity: true,
        columnLevelSecurity: false,
        fieldEncryption: false,
        networkSegmentation: true,
        allowedNetworks: ["internal"],
        blockedNetworks: [],
      },
    ];

    defaultRules.forEach((rule) => {
      this.isolationRules.set(rule.id, rule);
    });

    logger.info("Tenant isolation rules loaded", {
      count: this.isolationRules.size,
    });
  }

  /**
   * Enforce tenant isolation for data access request
   */
  public async enforceIsolation(
    request: DataAccessRequest
  ): Promise<IsolationResult> {
    const startTime = Date.now();
    this.metrics.totalRequests++;

    try {
      // Validate tenant context
      const tenantValid = await this.validateTenantContext(
        request.tenantContext
      );
      if (!tenantValid) {
        return this.createIsolationResult(
          false,
          "Invalid tenant context",
          [],
          [],
          true
        );
      }

      // Apply isolation rules
      const applicableRules = this.getApplicableRules(request);
      let allowed = false;
      let reason = "No applicable isolation rules";
      const appliedRules: string[] = [];
      const warnings: string[] = [];
      let auditRequired = false;
      let filteredData = request.query;

      for (const rule of applicableRules) {
        const ruleResult = await this.applyIsolationRule(rule, request);

        if (!ruleResult.allowed) {
          allowed = false;
          reason = ruleResult.reason;
          auditRequired = true;
          this.metrics.ruleViolations.set(
            rule.id,
            (this.metrics.ruleViolations.get(rule.id) || 0) + 1
          );
          break;
        }

        appliedRules.push(rule.id);
        allowed = true;
        reason = "Access allowed by isolation rules";

        if (ruleResult.filteredData) {
          filteredData = ruleResult.filteredData;
        }

        if (ruleResult.warnings) {
          warnings.push(...ruleResult.warnings);
        }

        if (rule.rowLevelSecurity || rule.columnLevelSecurity) {
          auditRequired = true;
        }
      }

      // Apply data filtering if needed
      if (allowed && filteredData) {
        filteredData = await this.applyDataFiltering(request, filteredData);
      }

      const result = this.createIsolationResult(
        allowed,
        reason,
        appliedRules,
        warnings,
        auditRequired,
        filteredData
      );

      // Update metrics
      if (allowed) {
        this.metrics.allowedRequests++;
      } else {
        this.metrics.blockedRequests++;
      }

      const processingTime = Date.now() - startTime;
      this.metrics.averageProcessingTime =
        (this.metrics.averageProcessingTime + processingTime) / 2;

      logger.debug("Tenant isolation enforced", {
        tenantId: request.tenantContext.tenantId,
        resourceType: request.resourceType,
        operation: request.operation,
        allowed: result.allowed,
        processingTime,
      });

      return result;
    } catch (error) {
      logger.error(
        "Tenant isolation enforcement error",
        error instanceof Error ? error : new Error(String(error)),
        {
          tenantId: request.tenantContext.tenantId,
          resourceType: request.resourceType,
        }
      );

      // Default deny on error
      return this.createIsolationResult(
        false,
        "Isolation enforcement error",
        [],
        ["System error occurred during isolation check"],
        true
      );
    }
  }

  /**
   * Validate tenant context
   */
  private async validateTenantContext(
    context: TenantContext
  ): Promise<boolean> {
    // Check if tenant exists and is active
    const tenant = this.tenants.get(context.tenantId);
    if (!tenant || tenant.status !== "active") {
      return false;
    }

    // Check user belongs to tenant
    const userContexts = this.tenantCache.get(context.tenantId) || [];
    const userContext = userContexts.find((uc) => uc.userId === context.userId);

    if (!userContext) {
      return false;
    }

    // Validate session
    if (userContext.sessionId !== context.sessionId) {
      logger.warn("Session mismatch in tenant isolation", {
        tenantId: context.tenantId,
        userId: context.userId,
        providedSession: context.sessionId,
        expectedSession: userContext.sessionId,
      });
      return false;
    }

    return true;
  }

  /**
   * Get applicable isolation rules for request
   */
  private getApplicableRules(request: DataAccessRequest): IsolationRule[] {
    return Array.from(this.isolationRules.values())
      .filter((rule) => rule.enabled)
      .filter((rule) => this.isRuleApplicable(rule, request))
      .sort((a, b) => b.priority - a.priority); // Higher priority first
  }

  /**
   * Check if isolation rule is applicable
   */
  private isRuleApplicable(
    rule: IsolationRule,
    request: DataAccessRequest
  ): boolean {
    // Check resource type
    const resourceTypeMatch =
      rule.allowedResourceTypes.includes("*") ||
      rule.allowedResourceTypes.includes(request.resourceType);

    if (!resourceTypeMatch) {
      return false;
    }

    // Check blocked resource types
    const resourceTypeBlocked = rule.blockedResourceTypes.includes(
      request.resourceType
    );
    if (resourceTypeBlocked) {
      return false;
    }

    return true;
  }

  /**
   * Apply isolation rule to request
   */
  private async applyIsolationRule(
    rule: IsolationRule,
    request: DataAccessRequest
  ): Promise<{
    allowed: boolean;
    reason: string;
    filteredData?: any;
    warnings?: string[];
  }> {
    // Check tenant access
    const tenantAllowed = this.checkTenantAccess(
      rule,
      request.tenantContext.tenantId
    );
    if (!tenantAllowed) {
      return {
        allowed: false,
        reason: `Tenant access blocked by rule: ${rule.name}`,
      };
    }

    // Check network access
    const networkAllowed = this.checkNetworkAccess(
      rule,
      request.tenantContext.ipAddress
    );
    if (!networkAllowed) {
      return {
        allowed: false,
        reason: `Network access blocked by rule: ${rule.name}`,
      };
    }

    // Apply data filtering
    let filteredData = request.query;
    const warnings: string[] = [];

    if (rule.rowLevelSecurity) {
      filteredData = await this.applyRowLevelSecurity(request, filteredData);
      warnings.push("Row-level security applied");
    }

    if (rule.columnLevelSecurity) {
      filteredData = await this.applyColumnLevelSecurity(request, filteredData);
      warnings.push("Column-level security applied");
    }

    return {
      allowed: true,
      reason: `Access allowed by rule: ${rule.name}`,
      filteredData,
      warnings,
    };
  }

  /**
   * Check if tenant access is allowed
   */
  private checkTenantAccess(rule: IsolationRule, tenantId: string): boolean {
    // If allowed tenants includes the request tenant, allow
    if (
      rule.allowedTenantIds.includes(tenantId) ||
      rule.allowedTenantIds.includes("*")
    ) {
      return true;
    }

    // If blocked tenants includes the request tenant, deny
    if (
      rule.blockedTenantIds.includes(tenantId) ||
      rule.blockedTenantIds.includes("*")
    ) {
      return false;
    }

    // Default: allow if no specific restrictions
    return rule.allowedTenantIds.length === 0;
  }

  /**
   * Check if network access is allowed
   */
  private checkNetworkAccess(rule: IsolationRule, ipAddress: string): boolean {
    // Check blocked networks
    for (const blockedNetwork of rule.blockedNetworks) {
      if (blockedNetwork === "external" && this.isExternalNetwork(ipAddress)) {
        return false;
      }
      if (this.matchesNetwork(ipAddress, blockedNetwork)) {
        return false;
      }
    }

    // Check allowed networks
    if (rule.allowedNetworks.length > 0) {
      for (const allowedNetwork of rule.allowedNetworks) {
        if (
          allowedNetwork === "*" ||
          this.matchesNetwork(ipAddress, allowedNetwork)
        ) {
          return true;
        }
      }
      return false; // Not in allowed networks
    }

    return true; // No network restrictions
  }

  /**
   * Apply row-level security filtering
   */
  private async applyRowLevelSecurity(
    request: DataAccessRequest,
    query: any
  ): Promise<any> {
    // Add tenant_id filter to query
    const filteredQuery = {
      ...query,
      filters: {
        ...query.filters,
        tenant_id: request.tenantContext.tenantId,
      },
    };

    return filteredQuery;
  }

  /**
   * Apply column-level security filtering
   */
  private async applyColumnLevelSecurity(
    request: DataAccessRequest,
    query: any
  ): Promise<any> {
    // Remove sensitive columns based on user permissions
    const allowedColumns = await this.getAllowedColumns(request);

    if (query.select && Array.isArray(query.select)) {
      query.select = query.select.filter((column: string) =>
        allowedColumns.includes(column)
      );
    }

    return query;
  }

  /**
   * Get allowed columns for user
   */
  private async getAllowedColumns(
    request: DataAccessRequest
  ): Promise<string[]> {
    // This would integrate with the permission system
    const baseColumns = ["id", "name", "created_at"];

    // Add additional columns based on roles
    if (request.tenantContext.roles.includes("ADMIN")) {
      return [...baseColumns, "sensitive_data", "audit_info"];
    }

    if (request.tenantContext.roles.includes("ANALYST")) {
      return [...baseColumns, "analytics_data"];
    }

    return baseColumns;
  }

  /**
   * Apply additional data filtering
   */
  private async applyDataFiltering(
    request: DataAccessRequest,
    query: any
  ): Promise<any> {
    // Apply any additional tenant-specific filtering
    return {
      ...query,
      tenant_id: request.tenantContext.tenantId,
    };
  }

  /**
   * Check if IP is from external network
   */
  private isExternalNetwork(ipAddress: string): boolean {
    // Simple check - in production, this would use network configuration
    const internalRanges = [
      "10.0.0.0/8",
      "172.16.0.0/12",
      "192.168.0.0/16",
      "127.0.0.1",
      "localhost",
    ];

    return !internalRanges.some((range) =>
      this.matchesNetwork(ipAddress, range)
    );
  }

  /**
   * Check if IP matches network range
   */
  private matchesNetwork(ipAddress: string, network: string): boolean {
    // Simple implementation - in production, use proper IP range checking
    if (network === "*") return true;
    if (network === "internal") return !this.isExternalNetwork(ipAddress);

    // Basic CIDR matching (simplified)
    if (network.includes("/")) {
      const [networkBase] = network.split("/");
      return ipAddress.startsWith(networkBase.split(".").slice(0, 3).join("."));
    }

    return ipAddress.startsWith(network);
  }

  /**
   * Create isolation result
   */
  private createIsolationResult(
    allowed: boolean,
    reason: string,
    appliedRules: string[],
    warnings: string[],
    auditRequired: boolean,
    filteredData?: any
  ): IsolationResult {
    return {
      allowed,
      reason,
      appliedRules,
      warnings,
      auditRequired,
      filteredData,
    };
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    setInterval(() => {
      logger.debug("Tenant isolation metrics", {
        totalRequests: this.metrics.totalRequests,
        allowedRequests: this.metrics.allowedRequests,
        blockedRequests: this.metrics.blockedRequests,
        averageProcessingTime: this.metrics.averageProcessingTime,
        ruleViolations: Object.fromEntries(this.metrics.ruleViolations),
      });
    }, 300000); // Every 5 minutes
  }

  /**
   * Add tenant
   */
  public addTenant(tenant: Tenant): void {
    this.tenants.set(tenant.id, tenant);
    logger.info("Tenant added to isolation service", {
      tenantId: tenant.id,
      tenantName: tenant.name,
    });
  }

  /**
   * Remove tenant
   */
  public removeTenant(tenantId: string): boolean {
    const removed = this.tenants.delete(tenantId);
    if (removed) {
      this.tenantCache.delete(tenantId);
      logger.info("Tenant removed from isolation service", { tenantId });
    }
    return removed;
  }

  /**
   * Add isolation rule
   */
  public addIsolationRule(rule: IsolationRule): void {
    this.isolationRules.set(rule.id, rule);
    logger.info("Isolation rule added", {
      ruleId: rule.id,
      ruleName: rule.name,
    });
  }

  /**
   * Remove isolation rule
   */
  public removeIsolationRule(ruleId: string): boolean {
    const removed = this.isolationRules.delete(ruleId);
    if (removed) {
      logger.info("Isolation rule removed", { ruleId });
    }
    return removed;
  }

  /**
   * Update tenant context cache
   */
  public updateTenantContext(
    tenantId: string,
    contexts: TenantContext[]
  ): void {
    this.tenantCache.set(tenantId, contexts);
  }

  /**
   * Get isolation metrics
   */
  public getMetrics(): any {
    return {
      ...this.metrics,
      activeTenants: this.tenants.size,
      activeRules: this.isolationRules.size,
      cacheSize: this.tenantCache.size,
      ruleViolations: Object.fromEntries(this.metrics.ruleViolations),
    };
  }
}

// ============================================================================
// Exports
// ============================================================================

export function createTenantIsolationService(): TenantIsolationService {
  return TenantIsolationService.getInstance();
}

export default {
  TenantIsolationService,
  createTenantIsolationService,
};
