/**
 * Agent Batch Manager
 *
 * CONSOLIDATION: Request batching and pooling system for agent operations
 *
 * Provides intelligent request batching, connection pooling, and performance
 * optimization for high-throughput agent operations.
 */

import { v4 as uuidv4 } from "uuid";

import { logger } from "../../../utils/logger";
import { AgentType } from "../../agent-types";
import { AgentRequest, AgentResponse, IAgent } from "../core/IAgent";
import { agentTelemetryService } from "../telemetry/AgentTelemetryService";

// ============================================================================
// Batching Types
// ============================================================================

export interface BatchRequest {
  /** Batch ID */
  id: string;
  /** Agent type */
  agentType: AgentType;
  /** Individual requests in batch */
  requests: IndividualRequest[];
  /** Batch creation timestamp */
  createdAt: Date;
  /** Batch priority */
  priority: BatchPriority;
  /** Batch configuration */
  config: BatchConfig;
  /** Batch metadata */
  metadata: BatchMetadata;
}

export interface IndividualRequest {
  /** Request ID */
  id: string;
  /** Original request */
  request: AgentRequest;
  /** Request priority */
  priority: BatchPriority;
  /** Request timeout */
  timeout: number;
  /** Request callback */
  resolve: (response: AgentResponse) => void;
  reject: (error: Error) => void;
  /** Request creation timestamp */
  createdAt: Date;
}

export type BatchPriority = "low" | "medium" | "high" | "critical";

export interface BatchConfig {
  /** Maximum batch size */
  maxBatchSize: number;
  /** Maximum batch wait time in milliseconds */
  maxWaitTime: number;
  /** Minimum batch size */
  minBatchSize: number;
  /** Batch timeout */
  batchTimeout: number;
  /** Retry configuration */
  retry: BatchRetryConfig;
  /** Compression settings */
  compression: BatchCompressionConfig;
}

export interface BatchRetryConfig {
  /** Enable retry */
  enabled: boolean;
  /** Max retry attempts */
  maxAttempts: number;
  /** Retry delay */
  retryDelay: number;
  /** Retry conditions */
  retryConditions: string[];
}

export interface BatchCompressionConfig {
  /** Enable compression */
  enabled: boolean;
  /** Compression algorithm */
  algorithm: "gzip" | "brotli" | "lz4";
  /** Compression threshold */
  threshold: number;
}

export interface BatchMetadata {
  /** Session ID */
  sessionId?: string;
  /** User ID */
  userId?: string;
  /** Organization ID */
  organizationId?: string;
  /** Request source */
  source: string;
  /** Custom metadata */
  custom?: Record<string, unknown>;
}

export interface BatchResponse {
  /** Batch ID */
  batchId: string;
  /** Individual responses */
  responses: IndividualResponse[];
  /** Batch execution time */
  executionTime: number;
  /** Batch success rate */
  successRate: number;
  /** Batch metadata */
  metadata: BatchMetadata;
}

export interface IndividualResponse {
  /** Request ID */
  requestId: string;
  /** Response */
  response?: AgentResponse;
  /** Error */
  error?: Error;
  /** Execution time */
  executionTime: number;
  /** Success status */
  success: boolean;
}

export interface BatchPool {
  /** Pool ID */
  id: string;
  /** Agent type */
  agentType: AgentType;
  /** Agent instances */
  agents: PooledAgent[];
  /** Pool configuration */
  config: PoolConfig;
  /** Pool statistics */
  statistics: PoolStatistics;
  /** Pool status */
  status: "active" | "inactive" | "draining";
}

export interface PooledAgent {
  /** Agent instance */
  agent: IAgent;
  /** Agent ID */
  id: string;
  /** Current status */
  status: "idle" | "busy" | "unhealthy";
  /** Request count */
  requestCount: number;
  /** Last used timestamp */
  lastUsed: Date;
  /** Health status */
  health: "healthy" | "degraded" | "unhealthy";
  /** Performance metrics */
  metrics: AgentMetrics;
}

export interface PoolConfig {
  /** Minimum pool size */
  minSize: number;
  /** Maximum pool size */
  maxSize: number;
  /** Idle timeout in milliseconds */
  idleTimeout: number;
  /** Health check interval */
  healthCheckInterval: number;
  /** Creation strategy */
  creationStrategy: "eager" | "lazy" | "dynamic";
  /** Destruction strategy */
  destructionStrategy: "immediate" | "delayed";
}

export interface PoolStatistics {
  /** Total requests */
  totalRequests: number;
  /** Successful requests */
  successfulRequests: number;
  /** Failed requests */
  failedRequests;
  /** Average response time */
  avgResponseTime: number;
  /** Pool utilization */
  utilization: number;
  /** Agent turnover */
  agentTurnover: number;
  /** Health check failures */
  healthCheckFailures: number;
}

export interface AgentMetrics {
  /** Average response time */
  avgResponseTime: number;
  /** Success rate */
  successRate: number;
  /** Request count */
  requestCount: number;
  /** Last health check */
  lastHealthCheck: Date;
  /** Error count */
  errorCount: number;
}

export interface BatchingPolicy {
  /** Policy ID */
  id: string;
  /** Policy name */
  name: string;
  /** Policy description */
  description: string;
  /** Agent types this policy applies to */
  agentTypes: AgentType[];
  /** Batching configuration */
  config: BatchConfig;
  /** Pool configuration */
  poolConfig: PoolConfig;
  /** Batching rules */
  rules: BatchingRule[];
  /** Enabled status */
  enabled: boolean;
}

export interface BatchingRule {
  /** Rule ID */
  id: string;
  /** Rule name */
  name: name;
  /** Rule condition */
  condition: BatchingCondition;
  /** Rule action */
  action: BatchingAction;
  /** Rule priority */
  priority: number;
  /** Enabled status */
  enabled: boolean;
}

export interface BatchingCondition {
  /** Condition type */
  type: "request_count" | "time_based" | "priority_based" | "load_based" | "custom";
  /** Condition operator */
  operator: "equals" | "greater_than" | "less_than" | "between";
  /** Condition value */
  value: unknown;
  /** Condition parameters */
  parameters?: Record<string, unknown>;
}

export interface BatchingAction {
  /** Action type */
  type: "batch" | "immediate" | "queue" | "reject";
  /** Action parameters */
  parameters: Record<string, unknown>;
}

// ============================================================================
// Batch Manager Implementation
// ============================================================================

/**
 * Agent Batch Manager
 *
 * Provides intelligent request batching and connection pooling for agents
 */
export class AgentBatchManager {
  private static instance: AgentBatchManager;
  private batchQueues: Map<AgentType, BatchRequest[]> = new Map();
  private agentPools: Map<AgentType, BatchPool> = new Map();
  private batchingPolicies: Map<string, BatchingPolicy> = new Map();
  private activeBatches: Map<string, BatchRequest> = new Map();
  private batchTimers: Map<string, NodeJS.Timeout> = new Map();
  private statistics: BatchStatistics;

  private constructor() {
    this.statistics = this.initializeStatistics();
    this.initializeDefaultPolicies();
    this.startHealthChecks();
    logger.info("AgentBatchManager initialized");
  }

  /**
   * Get singleton instance
   */
  static getInstance(): AgentBatchManager {
    if (!AgentBatchManager.instance) {
      AgentBatchManager.instance = new AgentBatchManager();
    }
    return AgentBatchManager.instance;
  }

  /**
   * Execute request with batching
   */
  async execute(
    request: AgentRequest,
    options?: {
      priority?: BatchPriority;
      timeout?: number;
      forceImmediate?: boolean;
      metadata?: BatchMetadata;
    }
  ): Promise<AgentResponse> {
    const agentType = request.agentType;
    const policy = this.getBatchingPolicy(agentType);

    if (!policy || !policy.enabled || options?.forceImmediate) {
      // Execute immediately without batching
      const agent = await this.getAgent(agentType);
      return await agent.execute(request);
    }

    return new Promise((resolve, reject) => {
      const individualRequest: IndividualRequest = {
        id: uuidv4(),
        request,
        priority: options?.priority || "medium",
        timeout: options?.timeout || policy.config.batchTimeout,
        resolve,
        reject,
        createdAt: new Date(),
      };

      this.enqueueRequest(agentType, individualRequest, policy, options?.metadata);
    });
  }

  /**
   * Execute multiple requests in batch
   */
  async executeBatch(
    requests: AgentRequest[],
    options?: {
      priority?: BatchPriority;
      timeout?: number;
      metadata?: BatchMetadata;
    }
  ): Promise<AgentResponse[]> {
    if (requests.length === 0) {
      return [];
    }

    const agentType = requests[0].agentType;
    const policy = this.getBatchingPolicy(agentType);

    if (!policy || !policy.enabled) {
      // Execute individually without batching
      const promises = requests.map((req) => this.execute(req, options));
      return Promise.all(promises);
    }

    const batchId = uuidv4();
    const batchRequest: BatchRequest = {
      id: batchId,
      agentType,
      requests: requests.map((req) => ({
        id: uuidv4(),
        request: req,
        priority: options?.priority || "medium",
        timeout: options?.timeout || policy.config.batchTimeout,
        resolve: () => {},
        reject: () => {},
        createdAt: new Date(),
      })),
      createdAt: new Date(),
      priority: options?.priority || "medium",
      config: policy.config,
      metadata: options?.metadata || {},
    };

    return new Promise((resolve, reject) => {
      // Set up callbacks for individual requests
      batchRequest.requests.forEach((req, _index) => {
        req.resolve = (_response: AgentResponse) => {
          // This will be called when the batch completes
        };
        req.reject = (_error: Error) => {
          // This will be called when the batch fails
        };
      });

      // Execute batch
      this.executeBatchInternal(batchRequest)
        .then((batchResponse) => {
          // Resolve individual requests
          batchResponse.responses.forEach((response, index) => {
            const req = batchRequest.requests[index];
            if (response.success && response.response) {
              req.resolve(response.response);
            } else {
              req.reject(response.error || new Error("Batch request failed"));
            }
          });
          resolve(
            batchResponse.responses
              .map((r) => r.response)
              .filter((r): r is AgentResponse => r !== undefined)
          );
        })
        .catch(reject);
    });
  }

  /**
   * Get batch statistics
   */
  getBatchStatistics(): BatchStatistics {
    return { ...this.statistics };
  }

  /**
   * Get pool statistics for agent type
   */
  getPoolStatistics(agentType: AgentType): PoolStatistics | undefined {
    const pool = this.agentPools.get(agentType);
    return pool?.statistics;
  }

  /**
   * Get active batches
   */
  getActiveBatches(agentType?: AgentType): BatchRequest[] {
    const batches = Array.from(this.activeBatches.values());
    return agentType ? batches.filter((b) => b.agentType === agentType) : batches;
  }

  /**
   * Cancel batch
   */
  cancelBatch(batchId: string): boolean {
    const batch = this.activeBatches.get(batchId);
    if (!batch) {
      return false;
    }

    // Clear timer
    const timer = this.batchTimers.get(batchId);
    if (timer) {
      clearTimeout(timer);
      this.batchTimers.delete(batchId);
    }

    // Remove from active batches
    this.activeBatches.delete(batchId);

    // Reject all requests
    batch.requests.forEach((req) => {
      req.reject(new Error("Batch cancelled"));
    });

    // Update statistics
    this.statistics.cancelledBatches++;

    logger.info("Batch cancelled", {
      batchId,
      agentType: batch.agentType,
      requestCount: batch.requests.length,
    });

    return true;
  }

  /**
   * Add or update batching policy
   */
  updateBatchingPolicy(policy: BatchingPolicy): void {
    this.batchingPolicies.set(policy.id, policy);

    // Reinitialize queue and pool for affected agent types
    policy.agentTypes.forEach((agentType) => {
      this.reinitializeAgentType(agentType);
    });

    logger.info("Batching policy updated", { policyId: policy.id, agentTypes: policy.agentTypes });
  }

  /**
   * Get batching policy for agent type
   */
  getBatchingPolicy(agentType: AgentType): BatchingPolicy | undefined {
    for (const policy of this.batchingPolicies.values()) {
      if (policy.agentTypes.includes(agentType) && policy.enabled) {
        return policy;
      }
    }
    return undefined;
  }

  /**
   * Warm up agent pool
   */
  async warmUpPool(
    agentType: AgentType,
    targetSize?: number
  ): Promise<{
    success: boolean;
    actualSize: number;
    errors: string[];
  }> {
    const policy = this.getBatchingPolicy(agentType);
    if (!policy) {
      return { success: false, actualSize: 0, errors: ["No batching policy found"] };
    }

    const pool = this.agentPools.get(agentType);
    if (!pool) {
      return { success: false, actualSize: 0, errors: ["No pool found"] };
    }

    const targetPoolSize = targetSize || policy.poolConfig.minSize;
    const errors: string[] = [];

    logger.info("Warming up agent pool", {
      agentType,
      targetSize: targetPoolSize,
      currentSize: pool.agents.length,
    });

    while (pool.agents.length < targetPoolSize && pool.agents.length < policy.poolConfig.maxSize) {
      try {
        await this.createPooledAgent(pool);
      } catch (error) {
        errors.push(`Failed to create agent: ${(error as Error).message}`);
        break;
      }
    }

    return {
      success: errors.length === 0,
      actualSize: pool.agents.length,
      errors,
    };
  }

  /**
   * Reset batch manager
   */
  reset(): void {
    // Cancel all active batches
    const batchIds = Array.from(this.activeBatches.keys());
    batchIds.forEach((id) => this.cancelBatch(id));

    // Clear queues and pools
    this.batchQueues.clear();
    this.agentPools.clear();

    // Reinitialize
    this.statistics = this.initializeStatistics();
    this.initializeDefaultPolicies();

    logger.info("Agent batch manager reset");
  }

  /**
   * Shutdown batch manager
   */
  shutdown(): void {
    // Cancel all active batches
    const batchIds = Array.from(this.activeBatches.keys());
    batchIds.forEach((id) => this.cancelBatch(id));

    // Drain all pools
    this.agentPools.forEach((pool) => {
      pool.status = "draining";
      pool.agents.forEach((agent) => {
        // Mark agents for destruction
        agent.status = "unhealthy";
      });
    });

    logger.info("Agent batch manager shutdown");
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Enqueue request for batching
   */
  private enqueueRequest(
    agentType: AgentType,
    request: IndividualRequest,
    policy: BatchingPolicy,
    metadata?: BatchMetadata
  ): void {
    if (!this.batchQueues.has(agentType)) {
      this.batchQueues.set(agentType, []);
    }

    const queue = this.batchQueues.get(agentType)!;
    queue.push(request);

    // Sort queue by priority
    queue.sort((a, b) => this.getPriorityValue(b.priority) - this.getPriorityValue(a.priority));

    // Check if we should create a batch
    if (this.shouldCreateBatch(agentType, queue, policy)) {
      this.createBatch(agentType, policy, metadata);
    } else {
      // Set timer for batch creation
      this.setBatchTimer(agentType, policy);
    }
  }

  /**
   * Check if batch should be created
   */
  private shouldCreateBatch(
    agentType: AgentType,
    queue: IndividualRequest[],
    policy: BatchingPolicy
  ): boolean {
    // Check minimum batch size
    if (queue.length >= policy.config.minBatchSize) {
      return true;
    }

    // Check for high priority requests
    const hasHighPriority = queue.some((req) => req.priority === "critical");
    if (hasHighPriority) {
      return true;
    }

    return false;
  }

  /**
   * Create batch from queue
   */
  private createBatch(
    agentType: AgentType,
    policy: BatchingPolicy,
    metadata?: BatchMetadata
  ): void {
    const queue = this.batchQueues.get(agentType);
    if (!queue || queue.length === 0) return;

    const batchSize = Math.min(queue.length, policy.config.maxBatchSize);
    const requests = queue.splice(0, batchSize);

    const batchRequest: BatchRequest = {
      id: uuidv4(),
      agentType,
      requests,
      createdAt: new Date(),
      priority: requests[0].priority,
      config: policy.config,
      metadata: metadata || {},
    };

    this.activeBatches.set(batchRequest.id, batchRequest);

    logger.debug("Batch created", {
      batchId: batchRequest.id,
      agentType,
      requestCount: requests.length,
      priority: batchRequest.priority,
    });

    // Execute batch
    this.executeBatchInternal(batchRequest);
  }

  /**
   * Execute batch internally
   */
  private async executeBatchInternal(batch: BatchRequest): Promise<BatchResponse> {
    const startTime = Date.now();

    try {
      // Get pooled agent
      const agent = await this.getAgent(batch.agentType);

      // Combine requests for batch processing
      const combinedRequest = this.combineRequests(batch.requests);

      // Execute batch
      const response = await agent.execute(combinedRequest);

      const executionTime = Date.now() - startTime;

      // Create individual responses
      const responses: IndividualResponse[] = batch.requests.map((req) => ({
        requestId: req.id,
        response: response,
        executionTime: executionTime / batch.requests.length,
        success: true,
      }));

      const successRate = (responses.filter((r) => r.success).length / responses.length) * 100;

      const batchResponse: BatchResponse = {
        batchId: batch.id,
        responses,
        executionTime,
        successRate,
        metadata: batch.metadata,
      };

      // Update statistics
      this.updateStatistics(batch, true, executionTime);

      // Remove from active batches
      this.activeBatches.delete(batch.id);

      // Record batch success in telemetry
      agentTelemetryService.recordTelemetryEvent({
        type: "agent_batch_success",
        agentType: batch.agentType,
        sessionId: batch.metadata.sessionId,
        userId: batch.metadata.userId,
        data: {
          batchId: batch.id,
          requestCount: batch.requests.length,
          executionTime,
          successRate,
        },
        severity: "info",
      });

      return batchResponse;
    } catch (error) {
      const executionTime = Date.now() - startTime;

      // Create error responses
      const responses: IndividualResponse[] = batch.requests.map((req) => ({
        requestId: req.id,
        error: error as Error,
        executionTime: executionTime / batch.requests.length,
        success: false,
      }));

      const batchResponse: BatchResponse = {
        batchId: batch.id,
        responses,
        executionTime,
        successRate: 0,
        metadata: batch.metadata,
      };

      // Update statistics
      this.updateStatistics(batch, false, executionTime);

      // Remove from active batches
      this.activeBatches.delete(batch.id);

      // Record batch failure in telemetry
      agentTelemetryService.recordTelemetryEvent({
        type: "agent_batch_failure",
        agentType: batch.agentType,
        sessionId: batch.metadata.sessionId,
        userId: batch.metadata.userId,
        data: {
          batchId: batch.id,
          requestCount: batch.requests.length,
          executionTime,
          error: (error as Error).message,
        },
        severity: "error",
      });

      throw error;
    }
  }

  /**
   * Combine requests for batch processing
   */
  private combineRequests(requests: IndividualRequest[]): AgentRequest {
    if (requests.length === 0) {
      throw new Error("No requests to combine");
    }

    const firstRequest = requests[0].request;

    // Simple combination strategy - in production would be more sophisticated
    const combinedQuery = requests.map((req) => req.request.query).join(" | ");
    const combinedParameters = requests.reduce((acc, req) => {
      return { ...acc, ...req.request.parameters };
    }, {});

    return {
      ...firstRequest,
      query: combinedQuery,
      parameters: combinedParameters,
    };
  }

  /**
   * Get agent from pool
   */
  private async getAgent(agentType: AgentType): Promise<IAgent> {
    const pool = this.agentPools.get(agentType);

    if (!pool) {
      // Create pool if it doesn't exist
      const policy = this.getBatchingPolicy(agentType);
      if (!policy) {
        throw new Error(`No batching policy found for agent type: ${agentType}`);
      }

      await this.createPool(agentType, policy.poolConfig);
      return this.getAgent(agentType);
    }

    // Find idle agent
    const idleAgent = pool.agents.find((agent) => agent.status === "idle");

    if (idleAgent) {
      idleAgent.status = "busy";
      idleAgent.lastUsed = new Date();
      idleAgent.requestCount++;
      return idleAgent.agent;
    }

    // Create new agent if pool not full
    if (pool.agents.length < pool.config.maxSize) {
      await this.createPooledAgent(pool);
      return this.getAgent(agentType);
    }

    // Wait for agent to become available
    return this.waitForAgent(pool);
  }

  /**
   * Wait for available agent
   */
  private async waitForAgent(pool: BatchPool): Promise<IAgent> {
    const maxWaitTime = 30000; // 30 seconds
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      const idleAgent = pool.agents.find((agent) => agent.status === "idle");
      if (idleAgent) {
        idleAgent.status = "busy";
        idleAgent.lastUsed = new Date();
        idleAgent.requestCount++;
        return idleAgent.agent;
      }

      await this.sleep(100); // Wait 100ms
    }

    throw new Error(`No available agent in pool for ${pool.agentType} after ${maxWaitTime}ms`);
  }

  /**
   * Create agent pool
   */
  private async createPool(agentType: AgentType, config: PoolConfig): Promise<void> {
    if (this.agentPools.has(agentType)) {
      return; // Pool already exists
    }

    const pool: BatchPool = {
      id: uuidv4(),
      agentType,
      agents: [],
      config,
      statistics: this.initializePoolStatistics(),
      status: "active",
    };

    this.agentPools.set(agentType, pool);

    // Create initial agents if using eager strategy
    if (config.creationStrategy === "eager") {
      for (let i = 0; i < config.minSize; i++) {
        await this.createPooledAgent(pool);
      }
    }

    logger.info("Agent pool created", {
      agentType,
      poolId: pool.id,
      minSize: config.minSize,
      maxSize: config.maxSize,
      initialSize: pool.agents.length,
    });
  }

  /**
   * Create pooled agent
   */
  private async createPooledAgent(pool: BatchPool): Promise<void> {
    // This would create a new agent instance
    // For now, we'll simulate this
    const agentId = uuidv4();

    const pooledAgent: PooledAgent = {
      id: agentId,
      agent: null as any, // Would be actual agent instance
      id: agentId,
      status: "idle",
      requestCount: 0,
      lastUsed: new Date(),
      health: "healthy",
      metrics: {
        avgResponseTime: 0,
        successRate: 100,
        requestCount: 0,
        lastHealthCheck: new Date(),
        errorCount: 0,
      },
    };

    pool.agents.push(pooledAgent);

    logger.debug("Pooled agent created", {
      agentType: pool.agentType,
      agentId,
      poolSize: pool.agents.length,
    });
  }

  /**
   * Set batch timer
   */
  private setBatchTimer(agentType: AgentType, policy: BatchingPolicy): void {
    // Clear existing timer
    const existingTimer = this.batchTimers.get(agentType);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer
    const timer = setTimeout(() => {
      this.createBatch(agentType, policy);
    }, policy.config.maxWaitTime);

    this.batchTimers.set(agentType, timer);
  }

  /**
   * Reinitialize agent type
   */
  private reinitializeAgentType(agentType: AgentType): void {
    // Cancel existing batches
    const batches = this.getActiveBatches(agentType);
    batches.forEach((batch) => this.cancelBatch(batch.id));

    // Clear queue
    this.batchQueues.delete(agentType);

    // Clear timers
    const timer = this.batchTimers.get(agentType);
    if (timer) {
      clearTimeout(timer);
      this.batchTimers.delete(agentType);
    }
  }

  /**
   * Start health checks
   */
  private startHealthChecks(): void {
    setInterval(() => {
      this.performHealthChecks();
    }, 30000); // Every 30 seconds
  }

  /**
   * Perform health checks
   */
  private async performHealthChecks(): Promise<void> {
    for (const pool of this.agentPools.values()) {
      if (pool.status !== "active") continue;

      for (const pooledAgent of pool.agents) {
        try {
          // Simulate health check
          const isHealthy = await this.checkAgentHealth(pooledAgent);

          if (isHealthy) {
            pooledAgent.health = "healthy";
            pooledAgent.metrics.lastHealthCheck = new Date();
          } else {
            pooledAgent.health = "unhealthy";
            pool.statistics.healthCheckFailures++;
          }
        } catch (error) {
          pooledAgent.health = "unhealthy";
          pool.statistics.healthCheckFailures++;
          logger.warn("Agent health check failed", {
            agentType: pool.agentType,
            agentId: pooledAgent.id,
            error: (error as Error).message,
          });
        }
      }

      // Update pool statistics
      this.updatePoolStatistics(pool);
    }
  }

  /**
   * Check agent health
   */
  private async checkAgentHealth(pooledAgent: PooledAgent): Promise<boolean> {
    // Simulate health check - in production would call actual health endpoint
    const timeSinceLastUse = Date.now() - pooledAgent.lastUsed.getTime();
    const errorRate =
      pooledAgent.metrics.errorCount / Math.max(pooledAgent.metrics.requestCount, 1);

    return timeSinceLastUse < 300000 && errorRate < 0.1; // 5 minutes idle time, 10% error rate
  }

  /**
   * Update batch statistics
   */
  private updateStatistics(batch: BatchRequest, success: boolean, executionTime: number): void {
    this.statistics.totalBatches++;

    if (success) {
      this.statistics.successfulBatches++;
    } else {
      this.statistics.failedBatches++;
    }

    this.statistics.totalBatchTime += executionTime;
    this.statistics.avgBatchTime = this.statistics.totalBatchTime / this.statistics.totalBatches;
  }

  /**
   * Update pool statistics
   */
  private updatePoolStatistics(pool: BatchPool): void {
    const totalRequests = pool.agents.reduce((sum, agent) => sum + agent.metrics.requestCount, 0);
    const successfulRequests = pool.agents.reduce(
      (sum, agent) => sum + agent.metrics.requestCount * (agent.metrics.successRate / 100),
      0
    );
    const avgResponseTime =
      pool.agents.reduce((sum, agent) => sum + agent.metrics.avgResponseTime, 0) /
      pool.agents.length;

    pool.statistics = {
      ...pool.statistics,
      totalRequests,
      successfulRequests,
      failedRequests: totalRequests - successfulRequests,
      avgResponseTime,
      utilization:
        (pool.agents.filter((a) => a.status === "busy").length / pool.agents.length) * 100,
      agentTurnover: 0, // Would track agent creation/destruction
      healthCheckFailures: pool.statistics.healthCheckFailures,
    };
  }

  /**
   * Initialize statistics
   */
  private initializeStatistics(): BatchStatistics {
    return {
      totalBatches: 0,
      successfulBatches: 0,
      failedBatches: 0,
      cancelledBatches: 0,
      avgBatchSize: 0,
      avgBatchTime: 0,
      totalBatchTime: 0,
      cacheHitRate: 0,
      poolUtilization: 0,
    };
  }

  /**
   * Initialize pool statistics
   */
  private initializePoolStatistics(): PoolStatistics {
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      avgResponseTime: 0,
      utilization: 0,
      agentTurnover: 0,
      healthCheckFailures: 0,
    };
  }

  /**
   * Initialize default batching policies
   */
  private initializeDefaultPolicies(): void {
    const defaultPolicy: BatchingPolicy = {
      id: "default-batching-policy",
      name: "Default Batching Policy",
      description: "Default batching policy for all agents",
      agentTypes: ["opportunity", "target", "expansion", "integrity", "realization"],
      config: {
        maxBatchSize: 10,
        maxWaitTime: 5000,
        minBatchSize: 2,
        batchTimeout: 30000,
        retry: {
          enabled: true,
          maxAttempts: 3,
          retryDelay: 1000,
          retryConditions: ["timeout", "network_error", "rate_limit"],
        },
        compression: {
          enabled: false,
          algorithm: "gzip",
          threshold: 1024,
        },
      },
      poolConfig: {
        minSize: 2,
        maxSize: 10,
        idleTimeout: 300000, // 5 minutes
        healthCheckInterval: 30000, // 30 seconds
        creationStrategy: "lazy",
        destructionStrategy: "delayed",
      },
      rules: [
        {
          id: "batch-by-default",
          name: "Batch by Default",
          condition: {
            type: "request_count",
            operator: "greater_than",
            value: 1,
          },
          action: {
            type: "batch",
            parameters: {},
          },
          priority: 1,
          enabled: true,
        },
      ],
      enabled: true,
    };

    this.batchingPolicies.set(defaultPolicy.id, defaultPolicy);
  }

  /**
   * Get priority value
   */
  private getPriorityValue(priority: BatchPriority): number {
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

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Export Types and Singleton
// ============================================================================

export interface BatchStatistics {
  /** Total batches processed */
  totalBatches: number;
  /** Successful batches */
  successfulBatches: number;
  /** Failed batches */
  failedBatches: number;
  /** Cancelled batches */
  cancelledBatches: number;
  /** Average batch size */
  avgBatchSize: number;
  /** Average batch execution time */
  avgBatchTime: number;
  /** Total batch execution time */
  totalBatchTime: number;
  /** Cache hit rate */
  cacheHitRate: number;
  /** Pool utilization */
  poolUtilization: number;
}

export const agentBatchManager = AgentBatchManager.getInstance();
