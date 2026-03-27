/**
 * Multi-Tenant Performance Isolation Manager
 *
 * Resource quota management, fair scheduling algorithms, tenant-specific performance SLAs,
 * and resource usage analytics for enterprise multi-tenant deployments.
 */

import { EventEmitter } from "events";

import { v4 as uuidv4 } from "uuid";

import { logger } from "../../lib/logger.js"
import { getAgentPerformanceMonitor } from "../monitoring/AgentPerformanceMonitor.js"

// ============================================================================
// Types
// ============================================================================

export interface Tenant {
  id: string;
  name: string;
  domain: string;
  status: TenantStatus;
  tier: TenantTier;
  quotas: ResourceQuotas;
  sla: ServiceLevelAgreement;
  priority: TenantPriority;
  configuration: TenantConfiguration;
  createdAt: number;
  updatedAt: number;
  lastActivity: number;
}

export interface ResourceQuotas {
  // Agent quotas
  maxConcurrentAgents: number;
  maxAgentExecutionsPerHour: number;
  maxAgentMemoryUsage: number; // MB
  maxAgentExecutionTime: number; // seconds

  // Data quotas
  maxStorageSize: number; // GB
  maxApiCallsPerDay: number;
  maxBandwidthPerHour: number; // GB

  // Collaboration quotas
  maxCollaborativeTeams: number;
  maxTeamMembers: number;
  maxSharedContextSize: number; // MB

  // Security quotas
  maxSecurityContexts: number;
  maxAuditRetentionDays: number;
  maxConcurrentSessions: number;
}

export interface ServiceLevelAgreement {
  availability: number; // percentage (99.9, 99.99, etc.)
  responseTime: ResponseTimeSLA;
  throughput: ThroughputSLA;
  errorRate: number; // percentage
  supportResponseTime: SupportResponseSLA;
  compensation: CompensationPolicy;
  monitoring: MonitoringRequirements;
}

export interface ResponseTimeSLA {
  p50: number; // ms
  p90: number; // ms
  p95: number; // ms
  p99: number; // ms
}

export interface ThroughputSLA {
  requestsPerSecond: number;
  concurrentConnections: number;
  dataTransferRate: number; // MB/s
}

export interface SupportResponseSLA {
  critical: number; // hours
  high: number; // hours
  medium: number; // hours
  low: number; // hours
}

export interface CompensationPolicy {
  serviceCredits: boolean;
  refundPolicy: string;
  downtimeThreshold: number; // percentage
  creditCalculation: string;
}

export interface MonitoringRequirements {
  metrics: string[];
  alerting: boolean;
  reporting: boolean;
  dashboard: boolean;
  apiAccess: boolean;
}

export interface TenantConfiguration {
  timezone: string;
  locale: string;
  complianceFrameworks: string[];
  securitySettings: SecuritySettings;
  integrationSettings: IntegrationSettings;
  customSettings: Record<string, any>;
}

export interface SecuritySettings {
  encryptionRequired: boolean;
  auditLogging: boolean;
  mfaRequired: boolean;
  sessionTimeout: number;
  ipWhitelist: string[];
  dataResidency: string[];
}

export interface IntegrationSettings {
  allowedApis: string[];
  webhookEndpoints: string[];
  ssoProviders: string[];
  externalSystems: ExternalSystem[];
}

export interface ExternalSystem {
  name: string;
  type: string;
  endpoint: string;
  authentication: string;
  rateLimit: number;
}

export interface TenantMetrics {
  tenantId: string;
  timestamp: number;

  // Resource usage
  activeAgents: number;
  totalExecutions: number;
  memoryUsage: number; // MB
  storageUsage: number; // GB
  apiCalls: number;
  bandwidthUsage: number; // GB

  // Performance metrics
  avgResponseTime: number;
  p95ResponseTime: number;
  errorRate: number;
  throughput: number;

  // Collaboration metrics
  activeTeams: number;
  totalCollaborations: number;
  sharedContextSize: number;

  // Security metrics
  activeSessions: number;
  securityEvents: number;
  auditEntries: number;

  // SLA compliance
  slaCompliance: SLACompliance;
}

export interface SLACompliance {
  availability: number;
  responseTimeCompliance: boolean;
  throughputCompliance: boolean;
  errorRateCompliance: boolean;
  overallCompliance: number; // 0-100
}

export interface ResourceAllocation {
  tenantId: string;
  resourceType: ResourceType;
  allocated: number;
  used: number;
  available: number;
  utilization: number; // 0-1
  lastUpdated: number;
}

export interface FairSchedule {
  tenantId: string;
  priority: number;
  weight: number;
  quotaRemaining: number;
  lastAllocation: number;
  nextAllocation: number;
}

export interface PerformanceAlert {
  id: string;
  tenantId: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  metric: string;
  currentValue: number;
  threshold: number;
  timestamp: number;
  resolved: boolean;
  resolvedAt?: number;
}

export interface TenantIsolationPolicy {
  id: string;
  name: string;
  description: string;
  type: IsolationType;
  rules: IsolationRule[];
  enabled: boolean;
  priority: number;
}

// ============================================================================
// Enums
// ============================================================================

export type TenantStatus = "active" | "suspended" | "terminated" | "trial" | "pending";
export type TenantTier = "basic" | "professional" | "enterprise" | "custom";
export type TenantPriority = "low" | "medium" | "high" | "critical";
export type ResourceType = "cpu" | "memory" | "storage" | "bandwidth" | "agents" | "api_calls";
export type AlertType =
  | "quota_exceeded"
  | "sla_violation"
  | "performance_degradation"
  | "security_incident"
  | "resource_exhaustion";
export type AlertSeverity = "info" | "warning" | "error" | "critical";
export type IsolationType = "strict" | "moderate" | "relaxed" | "custom";

// ============================================================================
// Supporting Types
// ============================================================================

export interface IsolationRule {
  resource: ResourceType;
  action: IsolationAction;
  threshold: number;
  enforcement: EnforcementAction;
}

export type IsolationAction = "limit" | "throttle" | "prioritize" | "isolate";
export type EnforcementAction = "block" | "queue" | "degrade" | "alert";
type AllocationStatus = "normal" | "warning" | "critical";
type AlertResolvedStatus = "active" | "resolved";

// ============================================================================
// TenantPerformanceManager Implementation
// ============================================================================

export class TenantPerformanceManager extends EventEmitter {
  private tenants = new Map<string, Tenant>();
  private tenantIdsByStatus = new Map<TenantStatus, Set<string>>();
  private tenantMetrics = new Map<string, TenantMetrics[]>();
  private resourceAllocations = new Map<string, ResourceAllocation>();
  private allocationKeysByTenant = new Map<string, Set<string>>();
  private allocationKeysByResource = new Map<ResourceType, Set<string>>();
  private allocationKeysByStatus = new Map<AllocationStatus, Set<string>>();
  private fairSchedules = new Map<string, FairSchedule>();
  private activeAlerts = new Map<string, PerformanceAlert>();
  private alertIdsByTenant = new Map<string, Set<string>>();
  private alertIdsByResolvedStatus = new Map<AlertResolvedStatus, Set<string>>();
  private alertIdsByTenantAndResolvedStatus = new Map<string, Set<string>>();
  private isolationPolicies = new Map<string, TenantIsolationPolicy>();

  private performanceMonitor = getAgentPerformanceMonitor();
  private config: TenantManagerConfig;
  private monitoringTaskHandles = new Map<string, ReturnType<typeof setInterval>>();
  private monitoringTasksStarted = false;

  constructor(config: Partial<TenantManagerConfig> = {}) {
    super();

    this.config = {
      defaultQuotas: this.getDefaultQuotas(),
      defaultSLA: this.getDefaultSLA(),
      monitoringInterval: 60000, // 1 minute
      metricsRetention: 7 * 24 * 60 * 60 * 1000, // 7 days
      alertThresholds: this.getDefaultAlertThresholds(),
      fairSchedulingAlgorithm: "weighted_round_robin",
      resourceCleanupInterval: 5 * 60 * 1000, // 5 minutes
      ...config,
    };
    
    this.initializeIndexes();          // data layer, idempotent
    this.initializeMonitoringTasks();  // define tasks, no execution
    this.startMonitoringTasks();       // execution boundary
  }

  /**
   * Register a new tenant
   */
  async registerTenant(
    name: string,
    domain: string,
    tier: TenantTier,
    configuration: Partial<TenantConfiguration> = {}
  ): Promise<string> {
    const tenantId = uuidv4();
    const now = Date.now();

    const tenant: Tenant = {
      id: tenantId,
      name,
      domain,
      status: "pending",
      tier,
      quotas: this.getQuotasForTier(tier),
      sla: this.getSLAForTier(tier),
      priority: this.getPriorityForTier(tier),
      configuration: {
        timezone: "UTC",
        locale: "en-US",
        complianceFrameworks: [],
        securitySettings: {
          encryptionRequired: true,
          auditLogging: true,
          mfaRequired: false,
          sessionTimeout: 3600000,
          ipWhitelist: [],
          dataResidency: [],
        },
        integrationSettings: {
          allowedApis: [],
          webhookEndpoints: [],
          ssoProviders: [],
          externalSystems: [],
        },
        customSettings: {},
        ...configuration,
      },
      createdAt: now,
      updatedAt: now,
      lastActivity: now,
    };

    this.setTenant(tenant);

    // Initialize resource allocations
    await this.initializeResourceAllocations(tenantId);

    // Initialize fair scheduling
    await this.initializeFairSchedule(tenantId);

    logger.info("Tenant registered", { tenantId, name, tier });
    this.emit("tenantRegistered", { tenantId, tenant });

    return tenantId;
  }

  /**
   * Get tenant information
   */
  getTenant(tenantId: string): Tenant | null {
    return this.tenants.get(tenantId) || null;
  }

  /**
   * Update tenant configuration
   */
  async updateTenant(tenantId: string, updates: Partial<Tenant>): Promise<void> {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) {
      throw new Error(`Tenant ${tenantId} not found`);
    }

    const previousStatus = tenant.status;
    Object.assign(tenant, updates, { updatedAt: Date.now() });
    this.updateTenantStatusIndex(tenantId, previousStatus, tenant.status);

    // Update resource allocations if quotas changed
    if (updates.quotas) {
      await this.updateResourceAllocations(tenantId);
    }

    this.emit("tenantUpdated", { tenantId, tenant });
  }

  /**
   * Check if tenant can execute action
   */
  async checkResourceAvailability(
    tenantId: string,
    resourceType: ResourceType,
    amount: number
  ): Promise<ResourceAvailability> {
    const allocation = this.resourceAllocations.get(`${tenantId}-${resourceType}`);

    if (!allocation) {
      return { available: false, reason: "Resource not allocated", availableAmount: 0 };
    }

    const available = allocation.available >= amount;

    if (!available) {
      // Check if we can reallocate from other tenants
      const canReallocate = await this.checkReallocatability(tenantId, resourceType, amount);

      if (canReallocate) {
        await this.reallocateResources(tenantId, resourceType, amount);
        return {
          available: true,
          reason: "Available",
          availableAmount: amount,
        };
      }
    }

    return {
      available,
      reason: available ? "Available" : "Quota exceeded",
      availableAmount: allocation.available,
    };
  }

  /**
   * Record resource usage
   */
  async recordResourceUsage(
    tenantId: string,
    resourceType: ResourceType,
    amount: number
  ): Promise<void> {
    const allocation = this.resourceAllocations.get(`${tenantId}-${resourceType}`);

    if (allocation) {
      allocation.used += amount;
      allocation.available = allocation.allocated - allocation.used;
      allocation.utilization = allocation.used / allocation.allocated;
      allocation.lastUpdated = Date.now();
      this.setResourceAllocation(allocation);

      // Check for quota violations
      if (allocation.utilization > 0.9) {
        await this.createAlert(
          tenantId,
          "quota_exceeded",
          "warning",
          `Resource ${resourceType} usage at ${(allocation.utilization * 100).toFixed(1)}%`
        );
      }

      // Update fair schedule
      await this.updateFairSchedule(tenantId, resourceType, amount);
    }

    this.emit("resourceUsed", { tenantId, resourceType, amount });
  }

  /**
   * Get tenant metrics
   */
  getTenantMetrics(tenantId: string, timeRange?: { start: number; end: number }): TenantMetrics[] {
    const metrics = this.tenantMetrics.get(tenantId) || [];

    if (!timeRange) {
      return metrics;
    }

    return metrics.filter(
      (metric) => metric.timestamp >= timeRange.start && metric.timestamp <= timeRange.end
    );
  }

  /**
   * Get tenant performance alerts
   */
  getTenantAlerts(tenantId?: string, includeResolved: boolean = false): PerformanceAlert[] {
    const resolvedStatus: AlertResolvedStatus | "all" = includeResolved ? "all" : "active";
    const alertIds = this.getAlertIdsByScope(tenantId, resolvedStatus);
    const alerts: PerformanceAlert[] = [];

    for (const alertId of alertIds) {
      const alert = this.activeAlerts.get(alertId);
      if (alert) {
        alerts.push(alert);
      }
    }

    return alerts.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get resource allocation summary
   */
  getResourceAllocationSummary(): {
    totalTenants: number;
    totalAllocated: Record<ResourceType, number>;
    totalUsed: Record<ResourceType, number>;
    utilization: Record<ResourceType, number>;
    topConsumers: Array<{ tenantId: string; resource: ResourceType; usage: number }>;
  } {
    const allocations = this.getResourceUtilization();
    const tenants = new Set(allocations.map((a) => a.tenantId));

    const totalAllocated = {} as Record<ResourceType, number>;
    const totalUsed = {} as Record<ResourceType, number>;
    const utilization = {} as Record<ResourceType, number>;

    // Aggregate by resource type
    for (const allocation of allocations) {
      if (!totalAllocated[allocation.resourceType]) {
        totalAllocated[allocation.resourceType] = 0;
        totalUsed[allocation.resourceType] = 0;
      }

      totalAllocated[allocation.resourceType] += allocation.allocated;
      totalUsed[allocation.resourceType] += allocation.used;
    }

    // Calculate utilization
    for (const resourceType of Object.keys(totalAllocated)) {
      const allocated = totalAllocated[resourceType as ResourceType];
      const used = totalUsed[resourceType as ResourceType];
      utilization[resourceType as ResourceType] = allocated > 0 ? used / allocated : 0;
    }

    // Find top consumers
    const topConsumers = allocations
      .sort((a, b) => b.used - a.used)
      .slice(0, 10)
      .map((a) => ({
        tenantId: a.tenantId,
        resource: a.resourceType,
        usage: a.used,
      }));

    return {
      totalTenants: tenants.size,
      totalAllocated,
      totalUsed,
      utilization,
      topConsumers,
    };
  }

  /**
   * Enforce tenant isolation policies
   */
  async enforceIsolationPolicies(): Promise<void> {
    const activeTenants = this.tenantIdsByStatus.get("active") ?? new Set<string>();
    for (const tenantId of activeTenants) {
      const policy = this.isolationPolicies.get(tenantId);
      if (!policy || !policy.enabled) continue;

      for (const rule of policy.rules) {
        await this.enforceIsolationRule(tenantId, rule);
      }
    }
  }

  /**
   * Perform fair scheduling
   */
  async performFairScheduling(): Promise<SchedulingResult[]> {
    const results: SchedulingResult[] = [];

    // Get all active tenants sorted by priority
    const activeTenantIds = this.tenantIdsByStatus.get("active") ?? new Set<string>();
    const activeTenants = Array.from(activeTenantIds)
      .map((tenantId) => this.tenants.get(tenantId))
      .filter((tenant): tenant is Tenant => tenant !== undefined)
      .sort((a, b) => this.getPriorityWeight(b.priority) - this.getPriorityWeight(a.priority));

    for (const tenant of activeTenants) {
      const schedule = this.fairSchedules.get(tenant.id);
      if (!schedule) continue;

      const result = await this.calculateTenantAllocation(tenant, schedule);
      results.push(result);
    }

    return results;
  }

  /**
   * Check SLA compliance
   */
  async checkSLACompliance(tenantId: string): Promise<SLACompliance> {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) {
      throw new Error(`Tenant ${tenantId} not found`);
    }

    const metrics = this.getTenantMetrics(tenantId, {
      start: Date.now() - 24 * 60 * 60 * 1000, // Last 24 hours
      end: Date.now(),
    });

    if (metrics.length === 0) {
      return {
        availability: 0,
        responseTimeCompliance: false,
        throughputCompliance: false,
        errorRateCompliance: false,
        overallCompliance: 0,
      };
    }

    const latest = metrics[metrics.length - 1];
    if (!latest) {
      return {
        availability: 0,
        responseTimeCompliance: false,
        throughputCompliance: false,
        errorRateCompliance: false,
        overallCompliance: 0,
      };
    }
    const sla = tenant.sla;

    // Calculate compliance metrics
    const availability = this.calculateAvailability(metrics);
    const responseTimeCompliance = latest.p95ResponseTime <= sla.responseTime.p95;
    const throughputCompliance = latest.throughput >= sla.throughput.requestsPerSecond;
    const errorRateCompliance = latest.errorRate <= sla.errorRate;

    // Calculate overall compliance
    const complianceFactors = [
      availability / 100,
      responseTimeCompliance ? 1 : 0,
      throughputCompliance ? 1 : 0,
      errorRateCompliance ? 1 : 0,
    ];

    const overallCompliance =
      (complianceFactors.reduce((sum, factor) => sum + factor, 0) / complianceFactors.length) * 100;

    const compliance: SLACompliance = {
      availability,
      responseTimeCompliance,
      throughputCompliance,
      errorRateCompliance,
      overallCompliance,
    };

    // Create alert if SLA violated
    if (overallCompliance < 95) {
      await this.createAlert(
        tenantId,
        "sla_violation",
        "error",
        `SLA compliance at ${overallCompliance.toFixed(1)}%`
      );
    }

    return compliance;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private initializeMonitoringTasks(): void {
    this.startMonitoringTasks();
  }

  private registerMonitoringTask(
    taskName: string,
    callback: () => void,
    intervalMs: number
  ): void {
    const intervalHandle = setInterval(callback, intervalMs);
    this.monitoringTaskHandles.set(taskName, intervalHandle);
  }

  private startMonitoringTasks(): void {
    if (this.monitoringTasksStarted) {
      logger.warn("Tenant performance monitoring tasks already running");
      return;
    }

    // Collect metrics
    this.registerMonitoringTask("collect_metrics", () => {
      this.collectMetrics();
    }, this.config.monitoringInterval);

    // Enforce isolation policies
    this.registerMonitoringTask("enforce_isolation_policies", () => {
      this.enforceIsolationPolicies();
    }, 5 * 60 * 1000); // Every 5 minutes

    // Perform fair scheduling
    this.registerMonitoringTask("perform_fair_scheduling", () => {
      this.performFairScheduling();
    }, 60 * 1000); // Every minute

    // Check SLA compliance
    this.registerMonitoringTask("check_all_sla_compliance", () => {
      this.checkAllSLACompliance();
    }, 15 * 60 * 1000); // Every 15 minutes

    // Cleanup old metrics
    this.registerMonitoringTask("cleanup_old_metrics", () => {
      this.cleanupOldMetrics();
    }, 60 * 60 * 1000); // Every hour

    this.monitoringTasksStarted = true;
  }

  public stopMonitoringTasks(): void {
    if (!this.monitoringTasksStarted) {
      return;
    }

    for (const intervalHandle of this.monitoringTaskHandles.values()) {
      clearInterval(intervalHandle);
    }

    this.monitoringTaskHandles.clear();
    this.monitoringTasksStarted = false;
  }

  public teardown(): void {
    this.stopMonitoringTasks();
  }

  private async collectMetrics(): Promise<void> {
    const activeTenantIds = this.tenantIdsByStatus.get("active") ?? new Set<string>();
    for (const tenantId of activeTenantIds) {
      const tenant = this.tenants.get(tenantId);
      if (!tenant) continue;

      const metrics = await this.calculateTenantMetrics(tenant);

      // Store metrics
      if (!this.tenantMetrics.has(tenantId)) {
        this.tenantMetrics.set(tenantId, []);
      }

      const tenantMetricsList = this.tenantMetrics.get(tenantId)!;
      tenantMetricsList.push(metrics);

      // Maintain metrics size
      const cutoff = Date.now() - this.config.metricsRetention;
      const filtered = tenantMetricsList.filter((m) => m.timestamp > cutoff);
      this.tenantMetrics.set(tenantId, filtered);
    }

    this.emit("metricsCollected");
  }

  private async calculateTenantMetrics(tenant: Tenant): Promise<TenantMetrics> {
    // Get performance monitor data for tenant
    const healthScore = this.performanceMonitor.getHealthScore("tenant-" + tenant.id);

    // Calculate resource usage
    const resourceUsage = this.calculateResourceUsage(tenant.id);

    // Calculate SLA compliance
    const slaCompliance = await this.checkSLACompliance(tenant.id);

    return {
      tenantId: tenant.id,
      timestamp: Date.now(),
      activeAgents: resourceUsage.activeAgents,
      totalExecutions: resourceUsage.totalExecutions,
      memoryUsage: resourceUsage.memoryUsage,
      storageUsage: resourceUsage.storageUsage,
      apiCalls: resourceUsage.apiCalls,
      bandwidthUsage: resourceUsage.bandwidthUsage,
      avgResponseTime: healthScore ? 100 : 200, // Mock values
      p95ResponseTime: healthScore ? 150 : 300,
      errorRate: healthScore ? 0.01 : 0.05,
      throughput: resourceUsage.totalExecutions / 3600, // per second
      activeTeams: resourceUsage.activeTeams,
      totalCollaborations: resourceUsage.totalCollaborations,
      sharedContextSize: resourceUsage.sharedContextSize,
      activeSessions: resourceUsage.activeSessions,
      securityEvents: resourceUsage.securityEvents,
      auditEntries: resourceUsage.auditEntries,
      slaCompliance,
    };
  }

  private calculateResourceUsage(_tenantId: string): {
    activeAgents: number;
    totalExecutions: number;
    memoryUsage: number;
    storageUsage: number;
    apiCalls: number;
    bandwidthUsage: number;
    activeTeams: number;
    totalCollaborations: number;
    sharedContextSize: number;
    activeSessions: number;
    securityEvents: number;
    auditEntries: number;
  } {
    // Mock resource usage calculation - in reality would aggregate from various sources
    return {
      activeAgents: 5,
      totalExecutions: 1000,
      memoryUsage: 256,
      storageUsage: 10,
      apiCalls: 5000,
      bandwidthUsage: 1.5,
      activeTeams: 3,
      totalCollaborations: 50,
      sharedContextSize: 50,
      activeSessions: 10,
      securityEvents: 2,
      auditEntries: 1000,
    };
  }

  private calculateAvailability(metrics: TenantMetrics[]): number {
    if (metrics.length === 0) return 0;

    const totalRequests = metrics.reduce((sum, m) => sum + m.totalExecutions, 0);
    const totalErrors = metrics.reduce((sum, m) => sum + m.totalExecutions * m.errorRate, 0);

    return totalRequests > 0 ? ((totalRequests - totalErrors) / totalRequests) * 100 : 0;
  }

  private async initializeResourceAllocations(tenantId: string): Promise<void> {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) return;

    const resources: ResourceType[] = [
      "cpu",
      "memory",
      "storage",
      "bandwidth",
      "agents",
      "api_calls",
    ];

    for (const resourceType of resources) {
      const allocation: ResourceAllocation = {
        tenantId,
        resourceType,
        allocated: this.getQuotaForResource(tenant.quotas, resourceType),
        used: 0,
        available: this.getQuotaForResource(tenant.quotas, resourceType),
        utilization: 0,
        lastUpdated: Date.now(),
      };

      this.setResourceAllocation(allocation);
    }
  }

  private async initializeFairSchedule(tenantId: string): Promise<void> {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) return;

    const schedule: FairSchedule = {
      tenantId,
      priority: this.getPriorityWeight(tenant.priority),
      weight: this.getTierWeight(tenant.tier),
      quotaRemaining: 100, // Percentage
      lastAllocation: Date.now(),
      nextAllocation: Date.now() + 60000, // 1 minute from now
    };

    this.fairSchedules.set(tenantId, schedule);
  }

  private getQuotaForResource(quotas: ResourceQuotas, resourceType: ResourceType): number {
    switch (resourceType) {
      case "agents":
        return quotas.maxConcurrentAgents;
      case "memory":
        return quotas.maxAgentMemoryUsage;
      case "storage":
        return quotas.maxStorageSize * 1024; // Convert GB to MB
      case "bandwidth":
        return quotas.maxBandwidthPerHour * 1024; // Convert GB to MB
      case "api_calls":
        return quotas.maxApiCallsPerDay;
      case "cpu":
        return 100; // Mock CPU allocation
      default:
        return 0;
    }
  }

  private getQuotasForTier(tier: TenantTier): ResourceQuotas {
    switch (tier) {
      case "basic":
        return {
          maxConcurrentAgents: 5,
          maxAgentExecutionsPerHour: 100,
          maxAgentMemoryUsage: 256,
          maxAgentExecutionTime: 300,
          maxStorageSize: 10,
          maxApiCallsPerDay: 10000,
          maxBandwidthPerHour: 1,
          maxCollaborativeTeams: 3,
          maxTeamMembers: 5,
          maxSharedContextSize: 50,
          maxSecurityContexts: 10,
          maxAuditRetentionDays: 30,
          maxConcurrentSessions: 5,
        };
      case "professional":
        return {
          maxConcurrentAgents: 20,
          maxAgentExecutionsPerHour: 1000,
          maxAgentMemoryUsage: 512,
          maxAgentExecutionTime: 600,
          maxStorageSize: 100,
          maxApiCallsPerDay: 100000,
          maxBandwidthPerHour: 10,
          maxCollaborativeTeams: 10,
          maxTeamMembers: 20,
          maxSharedContextSize: 200,
          maxSecurityContexts: 50,
          maxAuditRetentionDays: 90,
          maxConcurrentSessions: 20,
        };
      case "enterprise":
        return {
          maxConcurrentAgents: 100,
          maxAgentExecutionsPerHour: 10000,
          maxAgentMemoryUsage: 1024,
          maxAgentExecutionTime: 1800,
          maxStorageSize: 1000,
          maxApiCallsPerDay: 1000000,
          maxBandwidthPerHour: 100,
          maxCollaborativeTeams: 50,
          maxTeamMembers: 100,
          maxSharedContextSize: 1000,
          maxSecurityContexts: 200,
          maxAuditRetentionDays: 2555, // 7 years
          maxConcurrentSessions: 100,
        };
      default:
        return this.getDefaultQuotas();
    }
  }

  private getSLAForTier(tier: TenantTier): ServiceLevelAgreement {
    switch (tier) {
      case "basic":
        return {
          availability: 99.0,
          responseTime: { p50: 500, p90: 1000, p95: 1500, p99: 2000 },
          throughput: { requestsPerSecond: 10, concurrentConnections: 5, dataTransferRate: 1 },
          errorRate: 1.0,
          supportResponseTime: { critical: 48, high: 72, medium: 120, low: 168 },
          compensation: {
            serviceCredits: true,
            refundPolicy: "Pro-rated credit for downtime exceeding 1%",
            downtimeThreshold: 1.0,
            creditCalculation: "Monthly service credit based on downtime percentage",
          },
          monitoring: {
            metrics: ["response_time", "error_rate", "throughput"],
            alerting: true,
            reporting: true,
            dashboard: false,
            apiAccess: false,
          },
        };
      case "professional":
        return {
          availability: 99.9,
          responseTime: { p50: 200, p90: 500, p95: 800, p99: 1200 },
          throughput: { requestsPerSecond: 100, concurrentConnections: 50, dataTransferRate: 10 },
          errorRate: 0.5,
          supportResponseTime: { critical: 12, high: 24, medium: 48, low: 72 },
          compensation: {
            serviceCredits: true,
            refundPolicy: "Full month credit for downtime exceeding SLA",
            downtimeThreshold: 0.1,
            creditCalculation: "Full month service credit for any SLA violation",
          },
          monitoring: {
            metrics: ["response_time", "error_rate", "throughput", "availability"],
            alerting: true,
            reporting: true,
            dashboard: true,
            apiAccess: true,
          },
        };
      case "enterprise":
        return {
          availability: 99.99,
          responseTime: { p50: 100, p90: 250, p95: 400, p99: 600 },
          throughput: {
            requestsPerSecond: 1000,
            concurrentConnections: 500,
            dataTransferRate: 100,
          },
          errorRate: 0.1,
          supportResponseTime: { critical: 1, high: 4, medium: 8, low: 24 },
          compensation: {
            serviceCredits: true,
            refundPolicy: "Multiple month credits for significant downtime",
            downtimeThreshold: 0.01,
            creditCalculation: "Multiple months credit based on downtime severity",
          },
          monitoring: {
            metrics: [
              "response_time",
              "error_rate",
              "throughput",
              "availability",
              "resource_usage",
            ],
            alerting: true,
            reporting: true,
            dashboard: true,
            apiAccess: true,
          },
        };
      default:
        return this.getDefaultSLA();
    }
  }

  private getPriorityForTier(tier: TenantTier): TenantPriority {
    switch (tier) {
      case "basic":
        return "low";
      case "professional":
        return "medium";
      case "enterprise":
        return "high";
      default:
        return "medium";
    }
  }

  private getPriorityWeight(priority: TenantPriority): number {
    switch (priority) {
      case "low":
        return 1;
      case "medium":
        return 2;
      case "high":
        return 3;
      case "critical":
        return 4;
      default:
        return 2;
    }
  }

  private getTierWeight(tier: TenantTier): number {
    switch (tier) {
      case "basic":
        return 1;
      case "professional":
        return 2;
      case "enterprise":
        return 3;
      default:
        return 2;
    }
  }

  private async createAlert(
    tenantId: string,
    type: AlertType,
    severity: AlertSeverity,
    message: string
  ): Promise<void> {
    const alertId = uuidv4();

    const alert: PerformanceAlert = {
      id: alertId,
      tenantId,
      type,
      severity,
      message,
      metric: "resource_usage",
      currentValue: 0,
      threshold: 0,
      timestamp: Date.now(),
      resolved: false,
    };

    this.setAlert(alert);
    this.emit("performanceAlert", alert);
  }

  private async checkReallocatability(
    tenantId: string,
    resourceType: ResourceType,
    amount: number
  ): Promise<boolean> {
    // Check if other tenants have unused resources that can be reallocated
    const allocations = this.getResourceUtilization(undefined, resourceType).filter(
      (a) => a.tenantId !== tenantId
    );

    const totalAvailable = allocations.reduce((sum, a) => sum + a.available, 0);
    return totalAvailable >= amount;
  }

  private async reallocateResources(
    tenantId: string,
    resourceType: ResourceType,
    amount: number
  ): Promise<void> {
    // Implement resource reallocation logic
    logger.info("Reallocating resources", { tenantId, resourceType, amount });
  }

  private async updateResourceAllocations(tenantId: string): Promise<void> {
    // Update allocations based on new quotas
    const tenant = this.tenants.get(tenantId);
    if (!tenant) return;

    const allocationKeys = this.allocationKeysByTenant.get(tenantId);
    if (!allocationKeys) return;

    for (const allocationKey of allocationKeys) {
      const allocation = this.resourceAllocations.get(allocationKey);
      if (!allocation) continue;

      const newAllocation = this.getQuotaForResource(tenant.quotas, allocation.resourceType);
      allocation.allocated = newAllocation;
      allocation.available = newAllocation - allocation.used;
      allocation.utilization = allocation.used / newAllocation;
      allocation.lastUpdated = Date.now();
      this.setResourceAllocation(allocation);
    }
  }

  private async updateFairSchedule(
    tenantId: string,
    _resourceType: ResourceType,
    amount: number
  ): Promise<void> {
    const schedule = this.fairSchedules.get(tenantId);
    if (!schedule) return;

    // Update quota remaining based on usage
    schedule.quotaRemaining = Math.max(0, schedule.quotaRemaining - amount / 100);
    schedule.lastAllocation = Date.now();
  }

  private async enforceIsolationRule(tenantId: string, rule: IsolationRule): Promise<void> {
    const allocation = this.resourceAllocations.get(`${tenantId}-${rule.resource}`);

    if (!allocation) return;

    const utilization = allocation.utilization;

    if (utilization > rule.threshold) {
      switch (rule.enforcement) {
        case "block":
          // Block further resource usage
          allocation.available = 0;
          break;
        case "queue":
          // Queue requests
          break;
        case "degrade":
          // Degrade service quality
          break;
        case "alert":
          // Just alert, no action
          break;
      }

      await this.createAlert(
        tenantId,
        "resource_exhaustion",
        "warning",
        `Resource ${rule.resource} utilization at ${(utilization * 100).toFixed(1)}%`
      );
    }
  }

  private async calculateTenantAllocation(
    tenant: Tenant,
    schedule: FairSchedule
  ): Promise<SchedulingResult> {
    // Calculate fair allocation based on priority and weight
    const baseAllocation = schedule.priority * schedule.weight;
    const timeFactor = Math.max(0, 1 - (Date.now() - schedule.lastAllocation) / (60 * 60 * 1000)); // Decay over 1 hour

    const allocation = (baseAllocation * timeFactor * schedule.quotaRemaining) / 100;

    return {
      tenantId: tenant.id,
      allocation,
      nextAllocation: Date.now() + (60 * 1000) / schedule.priority, // Higher priority = more frequent
      resources: [],
    };
  }

  private async checkAllSLACompliance(): Promise<void> {
    const activeTenantIds = this.tenantIdsByStatus.get("active") ?? new Set<string>();
    for (const tenantId of activeTenantIds) {
      await this.checkSLACompliance(tenantId);
    }
  }

  private initializeIndexes(): void {
    for (const status of ["active", "suspended", "terminated", "trial", "pending"] as const) {
      this.tenantIdsByStatus.set(status, new Set<string>());
    }

    for (const status of ["normal", "warning", "critical"] as const) {
      this.allocationKeysByStatus.set(status, new Set<string>());
    }

    for (const status of ["active", "resolved"] as const) {
      this.alertIdsByResolvedStatus.set(status, new Set<string>());
    }
  }

  private setTenant(tenant: Tenant): void {
    const existing = this.tenants.get(tenant.id);
    this.tenants.set(tenant.id, tenant);
    this.updateTenantStatusIndex(tenant.id, existing?.status, tenant.status);
  }

  private updateTenantStatusIndex(
    tenantId: string,
    previousStatus: TenantStatus | undefined,
    nextStatus: TenantStatus
  ): void {
    if (previousStatus) {
      this.tenantIdsByStatus.get(previousStatus)?.delete(tenantId);
    }

    if (!this.tenantIdsByStatus.has(nextStatus)) {
      this.tenantIdsByStatus.set(nextStatus, new Set<string>());
    }

    this.tenantIdsByStatus.get(nextStatus)?.add(tenantId);
  }

  private setResourceAllocation(allocation: ResourceAllocation): void {
    const key = `${allocation.tenantId}-${allocation.resourceType}`;
    const previous = this.resourceAllocations.get(key);
    this.resourceAllocations.set(key, allocation);

    if (!this.allocationKeysByTenant.has(allocation.tenantId)) {
      this.allocationKeysByTenant.set(allocation.tenantId, new Set<string>());
    }
    this.allocationKeysByTenant.get(allocation.tenantId)?.add(key);

    if (!this.allocationKeysByResource.has(allocation.resourceType)) {
      this.allocationKeysByResource.set(allocation.resourceType, new Set<string>());
    }
    this.allocationKeysByResource.get(allocation.resourceType)?.add(key);

    const nextStatus = this.getAllocationStatus(allocation.utilization);
    if (previous) {
      const previousStatus = this.getAllocationStatus(previous.utilization);
      if (previousStatus !== nextStatus) {
        this.allocationKeysByStatus.get(previousStatus)?.delete(key);
      }
    }
    this.allocationKeysByStatus.get(nextStatus)?.add(key);
  }

  private getAllocationStatus(utilization: number): AllocationStatus {
    if (utilization >= 0.9) {
      return "critical";
    }
    if (utilization >= 0.75) {
      return "warning";
    }
    return "normal";
  }

  private getResourceUtilization(
    tenantId?: string,
    resourceType?: ResourceType,
    status?: AllocationStatus
  ): ResourceAllocation[] {
    let candidateKeys: Set<string> | undefined;

    if (tenantId) {
      candidateKeys = this.allocationKeysByTenant.get(tenantId);
    }
    if (resourceType) {
      const resourceKeys = this.allocationKeysByResource.get(resourceType);
      candidateKeys = this.intersectStringSets(candidateKeys, resourceKeys);
    }
    if (status) {
      const statusKeys = this.allocationKeysByStatus.get(status);
      candidateKeys = this.intersectStringSets(candidateKeys, statusKeys);
    }

    const keys = candidateKeys ?? new Set(this.resourceAllocations.keys());
    const allocations: ResourceAllocation[] = [];
    for (const key of keys) {
      const allocation = this.resourceAllocations.get(key);
      if (allocation) {
        allocations.push(allocation);
      }
    }

    return allocations;
  }

  private setAlert(alert: PerformanceAlert): void {
    const previous = this.activeAlerts.get(alert.id);
    this.activeAlerts.set(alert.id, alert);

    if (!this.alertIdsByTenant.has(alert.tenantId)) {
      this.alertIdsByTenant.set(alert.tenantId, new Set<string>());
    }
    this.alertIdsByTenant.get(alert.tenantId)?.add(alert.id);

    if (previous) {
      const previousResolvedStatus = this.getAlertResolvedStatus(previous.resolved);
      this.alertIdsByResolvedStatus.get(previousResolvedStatus)?.delete(alert.id);
      this.alertIdsByTenantAndResolvedStatus
        .get(this.getTenantAlertStatusKey(previous.tenantId, previousResolvedStatus))
        ?.delete(alert.id);
    }

    const resolvedStatus = this.getAlertResolvedStatus(alert.resolved);
    this.alertIdsByResolvedStatus.get(resolvedStatus)?.add(alert.id);

    const tenantResolvedKey = this.getTenantAlertStatusKey(alert.tenantId, resolvedStatus);
    if (!this.alertIdsByTenantAndResolvedStatus.has(tenantResolvedKey)) {
      this.alertIdsByTenantAndResolvedStatus.set(tenantResolvedKey, new Set<string>());
    }
    this.alertIdsByTenantAndResolvedStatus.get(tenantResolvedKey)?.add(alert.id);
  }

  private getAlertResolvedStatus(resolved: boolean): AlertResolvedStatus {
    return resolved ? "resolved" : "active";
  }

  private getTenantAlertStatusKey(
    tenantId: string,
    resolvedStatus: AlertResolvedStatus
  ): string {
    return `${tenantId}|${resolvedStatus}`;
  }

  private getAlertIdsByScope(
    tenantId?: string,
    resolvedStatus: AlertResolvedStatus | "all" = "active"
  ): Set<string> {
    if (tenantId && resolvedStatus !== "all") {
      const ids = this.alertIdsByTenantAndResolvedStatus.get(
        this.getTenantAlertStatusKey(tenantId, resolvedStatus)
      );
      return ids ? new Set(ids) : new Set<string>();
    }

    if (tenantId) {
      const ids = this.alertIdsByTenant.get(tenantId);
      return ids ? new Set(ids) : new Set<string>();
    }

    if (resolvedStatus !== "all") {
      const ids = this.alertIdsByResolvedStatus.get(resolvedStatus);
      return ids ? new Set(ids) : new Set<string>();
    }

    return new Set(this.activeAlerts.keys());
  }

  private intersectStringSets(
    left: Set<string> | undefined,
    right: Set<string> | undefined
  ): Set<string> | undefined {
    if (!left && !right) {
      return undefined;
    }
    if (!left) {
      return right ? new Set(right) : undefined;
    }
    if (!right) {
      return new Set(left);
    }

    const smaller = left.size <= right.size ? left : right;
    const larger = smaller === left ? right : left;
    const intersection = new Set<string>();
    for (const key of smaller) {
      if (larger.has(key)) {
        intersection.add(key);
      }
    }
    return intersection;
  }

  private cleanupOldMetrics(): void {
    const cutoff = Date.now() - this.config.metricsRetention;

    for (const [tenantId, metrics] of this.tenantMetrics.entries()) {
      const filtered = metrics.filter((m) => m.timestamp > cutoff);
      this.tenantMetrics.set(tenantId, filtered);
    }
  }

  private getDefaultQuotas(): ResourceQuotas {
    return {
      maxConcurrentAgents: 5,
      maxAgentExecutionsPerHour: 100,
      maxAgentMemoryUsage: 256,
      maxAgentExecutionTime: 300,
      maxStorageSize: 10,
      maxApiCallsPerDay: 10000,
      maxBandwidthPerHour: 1,
      maxCollaborativeTeams: 3,
      maxTeamMembers: 5,
      maxSharedContextSize: 50,
      maxSecurityContexts: 10,
      maxAuditRetentionDays: 30,
      maxConcurrentSessions: 5,
    };
  }

  private getDefaultSLA(): ServiceLevelAgreement {
    return {
      availability: 99.0,
      responseTime: { p50: 500, p90: 1000, p95: 1500, p99: 2000 },
      throughput: { requestsPerSecond: 10, concurrentConnections: 5, dataTransferRate: 1 },
      errorRate: 1.0,
      supportResponseTime: { critical: 48, high: 72, medium: 120, low: 168 },
      compensation: {
        serviceCredits: true,
        refundPolicy: "Standard policy",
        downtimeThreshold: 1.0,
        creditCalculation: "Standard calculation",
      },
      monitoring: {
        metrics: ["response_time", "error_rate"],
        alerting: true,
        reporting: true,
        dashboard: false,
        apiAccess: false,
      },
    };
  }

  private getDefaultAlertThresholds(): Record<string, number> {
    return {
      cpu_utilization: 0.8,
      memory_utilization: 0.85,
      storage_utilization: 0.9,
      error_rate: 0.05,
      response_time_p95: 1000,
    };
  }
}

// ============================================================================
// Supporting Types
// ============================================================================

export interface TenantManagerConfig {
  defaultQuotas: ResourceQuotas;
  defaultSLA: ServiceLevelAgreement;
  monitoringInterval: number;
  metricsRetention: number;
  alertThresholds: Record<string, number>;
  fairSchedulingAlgorithm: string;
  resourceCleanupInterval: number;
}

export interface ResourceAvailability {
  available: boolean;
  reason: string;
  availableAmount: number;
}

export interface SchedulingResult {
  tenantId: string;
  allocation: number;
  nextAllocation: number;
  resources: unknown[];
}
