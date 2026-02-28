/**
 * Agent Capability Registry
 *
 * CONSOLIDATION: Centralized registry for agent capabilities, discovery,
 * and dynamic capability management across the agent ecosystem.
 *
 * Provides runtime capability discovery, versioning, and dependency management
 * for all agents in the ValueOS system.
 */

import { v4 as uuidv4 } from "uuid";

import { logger } from "../../../utils/logger";
import { AgentType } from "../../agent-types";
import { AgentCapability } from "../core/IAgent";

// ============================================================================
// Registry Types
// ============================================================================

export interface AgentCapabilityRegistration {
  /** Registration ID */
  id: string;
  /** Agent type */
  agentType: AgentType;
  /** Capability definition */
  capability: AgentCapability;
  /** Registration timestamp */
  registeredAt: Date;
  /** Registration source */
  source: string;
  /** Capability version */
  version: string;
  /** Capability dependencies */
  dependencies: CapabilityDependency[];
  /** Capability metadata */
  metadata: CapabilityMetadata;
  /** Registration status */
  status: "active" | "deprecated" | "disabled" | "pending";
  /** Health status */
  health: CapabilityHealth;
}

export interface CapabilityDependency {
  /** Dependency ID */
  id: string;
  /** Dependency type */
  type: "capability" | "service" | "resource" | "data";
  /** Dependency name */
  name: string;
  /** Dependency version requirement */
  versionRequirement: string;
  /** Optional dependency */
  optional: boolean;
  /** Dependency status */
  status: "satisfied" | "missing" | "version_mismatch" | "unhealthy";
}

export interface CapabilityMetadata {
  /** Capability owner */
  owner: string;
  /** Capability team */
  team: string;
  /** Capability documentation URL */
  documentationUrl?: string;
  /** Capability support contact */
  supportContact?: string;
  /** Capability tags */
  tags: string[];
  /** Capability environment */
  environment: "development" | "staging" | "production";
  /** Capability region */
  region?: string;
  /** Capability SLA */
  sla?: {
    availability: number;
    responseTime: number;
    errorRate: number;
  };
}

export interface CapabilityHealth {
  /** Overall health status */
  status: "healthy" | "degraded" | "unhealthy" | "unknown";
  /** Last health check */
  lastCheck: Date;
  /** Response time in milliseconds */
  responseTime: number;
  /** Success rate percentage */
  successRate: number;
  /** Error count */
  errorCount: number;
  /** Uptime percentage */
  uptime: number;
  /** Health check details */
  details: Record<string, unknown>;
}

export interface CapabilityQuery {
  /** Agent type filter */
  agentType?: AgentType;
  /** Capability category filter */
  category?: string;
  /** Capability name filter */
  name?: string;
  /** Input type filter */
  inputType?: string;
  /** Output type filter */
  outputType?: string;
  /** Tag filter */
  tags?: string[];
  /** Status filter */
  status?: "active" | "deprecated" | "disabled" | "pending";
  /** Health status filter */
  healthStatus?: "healthy" | "degraded" | "unhealthy" | "unknown";
  /** Version filter */
  version?: string;
  /** Text search */
  search?: string;
}

export interface CapabilityDiscoveryResult {
  /** Query used */
  query: CapabilityQuery;
  /** Total results */
  total: number;
  /** Capabilities found */
  capabilities: AgentCapabilityRegistration[];
  /** Facets */
  facets: CapabilityFacets;
  /** Query execution time */
  executionTime: number;
}

export interface CapabilityFacets {
  /** Agent types */
  agentTypes: Array<{ value: AgentType; count: number }>;
  /** Categories */
  categories: Array<{ value: string; count: number }>;
  /** Statuses */
  statuses: Array<{ value: string; count: number }>;
  /** Health statuses */
  healthStatuses: Array<{ value: string; count: number }>;
  /** Tags */
  tags: Array<{ value: string; count: number }>;
}

export interface CapabilityVersion {
  /** Version number */
  version: string;
  /** Release date */
  releaseDate: Date;
  /** Changelog */
  changelog: string;
  /** Breaking changes */
  breakingChanges: boolean;
  /** Migration guide */
  migrationGuide?: string;
  /** Compatibility matrix */
  compatibility: Record<string, "compatible" | "incompatible" | "partial">;
}

export interface CapabilityMetrics {
  /** Capability ID */
  capabilityId: string;
  /** Usage metrics */
  usage: {
    totalInvocations: number;
    successfulInvocations: number;
    failedInvocations: number;
    avgExecutionTime: number;
    lastInvocation: Date;
  };
  /** Performance metrics */
  performance: {
    p50ResponseTime: number;
    p90ResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    throughput: number;
  };
  /** Error metrics */
  errors: {
    errorRate: number;
    topErrors: Array<{
      type: string;
      count: number;
      lastOccurrence: Date;
    }>;
  };
  /** Resource metrics */
  resources: {
    avgMemoryUsage: number;
    avgCpuUsage: number;
    networkIO: number;
  };
}

// ============================================================================
// Registry Implementation
// ============================================================================

/**
 * Agent Capability Registry
 *
 * Central registry for managing agent capabilities with discovery,
 * health monitoring, and metrics collection
 */
export class AgentCapabilityRegistry {
  private static instance: AgentCapabilityRegistry;
  private capabilities: Map<string, AgentCapabilityRegistration> = new Map();
  private capabilityIndex: Map<string, Set<string>> = new Map();
  private metrics: Map<string, CapabilityMetrics> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private healthCheckIntervalMs: number = 30000; // 30 seconds

  private constructor() {
    this.initializeIndexes();
    this.startHealthChecks();
    logger.info("AgentCapabilityRegistry initialized");
  }

  /**
   * Get singleton instance
   */
  static getInstance(): AgentCapabilityRegistry {
    if (!AgentCapabilityRegistry.instance) {
      AgentCapabilityRegistry.instance = new AgentCapabilityRegistry();
    }
    return AgentCapabilityRegistry.instance;
  }

  /**
   * Register a new capability
   */
  registerCapability(
    agentType: AgentType,
    capability: AgentCapability,
    metadata: CapabilityMetadata,
    source: string = "manual"
  ): string {
    const registrationId = uuidv4();
    const registration: AgentCapabilityRegistration = {
      id: registrationId,
      agentType,
      capability,
      registeredAt: new Date(),
      source,
      version: "1.0.0",
      dependencies: [],
      metadata,
      status: "active",
      health: {
        status: "unknown",
        lastCheck: new Date(),
        responseTime: 0,
        successRate: 0,
        errorCount: 0,
        uptime: 0,
        details: {},
      },
    };

    // Store registration
    this.capabilities.set(registrationId, registration);

    // Update indexes
    this.updateIndexes(registration);

    // Initialize metrics
    this.metrics.set(registrationId, {
      capabilityId: registrationId,
      usage: {
        totalInvocations: 0,
        successfulInvocations: 0,
        failedInvocations: 0,
        avgExecutionTime: 0,
        lastInvocation: new Date(),
      },
      performance: {
        p50ResponseTime: 0,
        p90ResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        throughput: 0,
      },
      errors: {
        errorRate: 0,
        topErrors: [],
      },
      resources: {
        avgMemoryUsage: 0,
        avgCpuUsage: 0,
        networkIO: 0,
      },
    });

    logger.info("Capability registered", {
      registrationId,
      agentType,
      capabilityName: capability.name,
      category: capability.category,
    });

    return registrationId;
  }

  /**
   * Discover capabilities based on query
   */
  discoverCapabilities(query: CapabilityQuery): CapabilityDiscoveryResult {
    const startTime = Date.now();
    let capabilities = Array.from(this.capabilities.values());

    // Apply filters
    if (query.agentType) {
      capabilities = capabilities.filter((c) => c.agentType === query.agentType);
    }

    if (query.category) {
      capabilities = capabilities.filter((c) => c.capability.category === query.category);
    }

    if (query.name) {
      capabilities = capabilities.filter((c) =>
        c.capability.name.toLowerCase().includes(query.name!.toLowerCase())
      );
    }

    if (query.inputType) {
      capabilities = capabilities.filter((c) => c.capability.inputTypes.includes(query.inputType!));
    }

    if (query.outputType) {
      capabilities = capabilities.filter((c) =>
        c.capability.outputTypes.includes(query.outputType!)
      );
    }

    if (query.tags && query.tags.length > 0) {
      capabilities = capabilities.filter((c) =>
        query.tags!.some((tag) => c.metadata.tags.includes(tag))
      );
    }

    if (query.status) {
      capabilities = capabilities.filter((c) => c.status === query.status);
    }

    if (query.healthStatus) {
      capabilities = capabilities.filter((c) => c.health.status === query.healthStatus);
    }

    if (query.version) {
      capabilities = capabilities.filter((c) => c.version === query.version);
    }

    if (query.search) {
      const searchTerm = query.search.toLowerCase();
      capabilities = capabilities.filter(
        (c) =>
          c.capability.name.toLowerCase().includes(searchTerm) ||
          c.capability.description.toLowerCase().includes(searchTerm) ||
          c.metadata.tags.some((tag) => tag.toLowerCase().includes(searchTerm))
      );
    }

    // Sort by relevance (active, healthy capabilities first)
    capabilities.sort((a, b) => {
      const statusScore = { active: 3, pending: 2, deprecated: 1, disabled: 0 };
      const healthScore = { healthy: 3, degraded: 2, unknown: 1, unhealthy: 0 };

      const aScore = statusScore[a.status] + healthScore[a.health.status];
      const bScore = statusScore[b.status] + healthScore[b.health.status];

      return bScore - aScore;
    });

    const executionTime = Date.now() - startTime;
    const facets = this.calculateFacets(capabilities);

    logger.debug("Capability discovery completed", {
      query,
      total: capabilities.length,
      executionTime,
    });

    return {
      query,
      total: capabilities.length,
      capabilities,
      facets,
      executionTime,
    };
  }

  /**
   * Get capability by ID
   */
  getCapability(registrationId: string): AgentCapabilityRegistration | undefined {
    return this.capabilities.get(registrationId);
  }

  /**
   * Get capabilities for agent type
   */
  getCapabilitiesForAgent(agentType: AgentType): AgentCapabilityRegistration[] {
    return Array.from(this.capabilities.values()).filter(
      (c) => c.agentType === agentType && c.status === "active"
    );
  }

  /**
   * Update capability status
   */
  updateCapabilityStatus(
    registrationId: string,
    status: "active" | "deprecated" | "disabled" | "pending"
  ): void {
    const registration = this.capabilities.get(registrationId);
    if (!registration) {
      logger.warn("Attempted to update non-existent capability", { registrationId });
      return;
    }

    const oldStatus = registration.status;
    registration.status = status;

    // Update indexes
    this.updateIndexes(registration);

    logger.info("Capability status updated", {
      registrationId,
      oldStatus,
      newStatus: status,
    });
  }

  /**
   * Update capability health
   */
  updateCapabilityHealth(registrationId: string, health: Partial<CapabilityHealth>): void {
    const registration = this.capabilities.get(registrationId);
    if (!registration) {
      logger.warn("Attempted to update health for non-existent capability", { registrationId });
      return;
    }

    registration.health = {
      ...registration.health,
      ...health,
      lastCheck: new Date(),
    };

    logger.debug("Capability health updated", {
      registrationId,
      healthStatus: registration.health.status,
      responseTime: registration.health.responseTime,
    });
  }

  /**
   * Record capability usage
   */
  recordCapabilityUsage(
    registrationId: string,
    executionTime: number,
    success: boolean,
    errorType?: string
  ): void {
    const metrics = this.metrics.get(registrationId);
    if (!metrics) {
      logger.warn("Attempted to record usage for non-existent capability", { registrationId });
      return;
    }

    // Update usage metrics
    metrics.usage.totalInvocations++;
    metrics.usage.lastInvocation = new Date();

    if (success) {
      metrics.usage.successfulInvocations++;
    } else {
      metrics.usage.failedInvocations++;

      if (errorType) {
        const existingError = metrics.errors.topErrors.find((e) => e.type === errorType);
        if (existingError) {
          existingError.count++;
          existingError.lastOccurrence = new Date();
        } else {
          metrics.errors.topErrors.push({
            type: errorType,
            count: 1,
            lastOccurrence: new Date(),
          });
        }
      }
    }

    // Update average execution time
    const totalSuccessful = metrics.usage.successfulInvocations;
    const currentAvg = metrics.usage.avgExecutionTime;
    metrics.usage.avgExecutionTime =
      (currentAvg * (totalSuccessful - 1) + executionTime) / totalSuccessful;

    // Update error rate
    metrics.errors.errorRate = metrics.usage.failedInvocations / metrics.usage.totalInvocations;

    logger.debug("Capability usage recorded", {
      registrationId,
      executionTime,
      success,
      totalInvocations: metrics.usage.totalInvocations,
    });
  }

  /**
   * Get capability metrics
   */
  getCapabilityMetrics(registrationId: string): CapabilityMetrics | undefined {
    return this.metrics.get(registrationId);
  }

  /**
   * Get registry statistics
   */
  getRegistryStatistics(): {
    totalCapabilities: number;
    activeCapabilities: number;
    capabilitiesByAgentType: Record<AgentType, number>;
    capabilitiesByCategory: Record<string, number>;
    healthyCapabilities: number;
    degradedCapabilities: number;
    unhealthyCapabilities: number;
    totalUsage: number;
    avgResponseTime: number;
    errorRate: number;
  } {
    const capabilities = Array.from(this.capabilities.values());
    const activeCapabilities = capabilities.filter((c) => c.status === "active");

    const capabilitiesByAgentType = capabilities.reduce(
      (acc, c) => {
        acc[c.agentType] = (acc[c.agentType] || 0) + 1;
        return acc;
      },
      {} as Record<AgentType, number>
    );

    const capabilitiesByCategory = capabilities.reduce(
      (acc, c) => {
        acc[c.capability.category] = (acc[c.capability.category] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const healthyCapabilities = capabilities.filter((c) => c.health.status === "healthy").length;
    const degradedCapabilities = capabilities.filter((c) => c.health.status === "degraded").length;
    const unhealthyCapabilities = capabilities.filter(
      (c) => c.health.status === "unhealthy"
    ).length;

    const allMetrics = Array.from(this.metrics.values());
    const totalUsage = allMetrics.reduce((sum, m) => sum + m.usage.totalInvocations, 0);
    const avgResponseTime =
      allMetrics.length > 0
        ? allMetrics.reduce((sum, m) => sum + m.usage.avgExecutionTime, 0) / allMetrics.length
        : 0;
    const errorRate =
      allMetrics.length > 0
        ? allMetrics.reduce((sum, m) => sum + m.errors.errorRate, 0) / allMetrics.length
        : 0;

    return {
      totalCapabilities: capabilities.length,
      activeCapabilities: activeCapabilities.length,
      capabilitiesByAgentType,
      capabilitiesByCategory,
      healthyCapabilities,
      degradedCapabilities,
      unhealthyCapabilities,
      totalUsage,
      avgResponseTime,
      errorRate,
    };
  }

  /**
   * Unregister capability
   */
  unregisterCapability(registrationId: string): boolean {
    const registration = this.capabilities.get(registrationId);
    if (!registration) {
      logger.warn("Attempted to unregister non-existent capability", { registrationId });
      return false;
    }

    // Remove from storage
    this.capabilities.delete(registrationId);
    this.metrics.delete(registrationId);

    // Update indexes
    this.removeFromIndexes(registration);

    logger.info("Capability unregistered", {
      registrationId,
      agentType: registration.agentType,
      capabilityName: registration.capability.name,
    });

    return true;
  }

  /**
   * Reset registry
   */
  reset(): void {
    this.capabilities.clear();
    this.capabilityIndex.clear();
    this.metrics.clear();
    this.initializeIndexes();
    logger.info("Agent capability registry reset");
  }

  /**
   * Shutdown registry
   */
  shutdown(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    logger.info("Agent capability registry shutdown");
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Initialize capability indexes
   */
  private initializeIndexes(): void {
    this.capabilityIndex.set("agentType", new Set());
    this.capabilityIndex.set("category", new Set());
    this.capabilityIndex.set("status", new Set());
    this.capabilityIndex.set("health", new Set());
    this.capabilityIndex.set("tags", new Set());
  }

  /**
   * Update capability indexes
   */
  private updateIndexes(registration: AgentCapabilityRegistration): void {
    // Agent type index
    const agentTypeIndex = this.capabilityIndex.get("agentType")!;
    agentTypeIndex.add(registration.agentType);

    // Category index
    const categoryIndex = this.capabilityIndex.get("category")!;
    categoryIndex.add(registration.capability.category);

    // Status index
    const statusIndex = this.capabilityIndex.get("status")!;
    statusIndex.add(registration.status);

    // Health index
    const healthIndex = this.capabilityIndex.get("health")!;
    healthIndex.add(registration.health.status);

    // Tags index
    const tagsIndex = this.capabilityIndex.get("tags")!;
    registration.metadata.tags.forEach((tag) => tagsIndex.add(tag));
  }

  /**
   * Remove from capability indexes
   */
  private removeFromIndexes(registration: AgentCapabilityRegistration): void {
    // Note: This is a simplified implementation
    // In a production system, you'd maintain reverse indexes for efficient removal
  }

  /**
   * Calculate facets for query results
   */
  private calculateFacets(capabilities: AgentCapabilityRegistration[]): CapabilityFacets {
    const agentTypes = new Map<AgentType, number>();
    const categories = new Map<string, number>();
    const statuses = new Map<string, number>();
    const healthStatuses = new Map<string, number>();
    const tags = new Map<string, number>();

    capabilities.forEach((capability) => {
      // Agent types
      agentTypes.set(capability.agentType, (agentTypes.get(capability.agentType) || 0) + 1);

      // Categories
      categories.set(
        capability.capability.category,
        (categories.get(capability.capability.category) || 0) + 1
      );

      // Statuses
      statuses.set(capability.status, (statuses.get(capability.status) || 0) + 1);

      // Health statuses
      healthStatuses.set(
        capability.health.status,
        (healthStatuses.get(capability.health.status) || 0) + 1
      );

      // Tags
      capability.metadata.tags.forEach((tag) => {
        tags.set(tag, (tags.get(tag) || 0) + 1);
      });
    });

    return {
      agentTypes: Array.from(agentTypes.entries()).map(([value, count]) => ({ value, count })),
      categories: Array.from(categories.entries()).map(([value, count]) => ({ value, count })),
      statuses: Array.from(statuses.entries()).map(([value, count]) => ({ value, count })),
      healthStatuses: Array.from(healthStatuses.entries()).map(([value, count]) => ({
        value,
        count,
      })),
      tags: Array.from(tags.entries()).map(([value, count]) => ({ value, count })),
    };
  }

  /**
   * Start health check monitoring
   */
  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks();
    }, this.healthCheckIntervalMs);
  }

  /**
   * Perform health checks on all capabilities
   */
  private async performHealthChecks(): Promise<void> {
    const capabilities = Array.from(this.capabilities.values()).filter(
      (c) => c.status === "active"
    );

    for (const capability of capabilities) {
      try {
        // Simulate health check - in production, this would call actual health endpoints
        const health = await this.checkCapabilityHealth(capability);
        this.updateCapabilityHealth(capability.id, health);
      } catch (error) {
        logger.error("Health check failed for capability", {
          registrationId: capability.id,
          error: (error as Error).message,
        });

        this.updateCapabilityHealth(capability.id, {
          status: "unhealthy",
          details: { error: (error as Error).message },
        });
      }
    }
  }

  /**
   * Check individual capability health
   */
  private async checkCapabilityHealth(
    registration: AgentCapabilityRegistration
  ): Promise<Partial<CapabilityHealth>> {
    // Simulate health check - in production, this would:
    // 1. Call the agent's health endpoint
    // 2. Measure response time
    // 3. Check recent error rates
    // 4. Verify dependencies

    const metrics = this.metrics.get(registration.id);
    const startTime = Date.now();

    // Simulate health check call
    await new Promise((resolve) => setTimeout(resolve, Math.random() * 100));

    const responseTime = Date.now() - startTime;

    // Calculate health status based on metrics
    let status: "healthy" | "degraded" | "unhealthy" | "unknown" = "healthy";

    if (metrics) {
      const errorRate = metrics.errors.errorRate;
      const avgResponseTime = metrics.usage.avgExecutionTime;

      if (errorRate > 0.1 || avgResponseTime > 10000) {
        status = "unhealthy";
      } else if (errorRate > 0.05 || avgResponseTime > 5000) {
        status = "degraded";
      }
    }

    return {
      status,
      responseTime,
      successRate: metrics
        ? metrics.usage.successfulInvocations / metrics.usage.totalInvocations
        : 0,
      errorCount: metrics ? metrics.usage.failedInvocations : 0,
      uptime: 99.9, // Simulated
      details: {
        lastCheck: new Date(),
        checkDuration: responseTime,
      },
    };
  }
}

// ============================================================================
// Export Singleton
// ============================================================================

export const agentCapabilityRegistry = AgentCapabilityRegistry.getInstance();
