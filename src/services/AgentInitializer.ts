/**
 * Agent Initializer
 * 
 * Production-ready initialization and health checking for the Agent Fabric.
 * Ensures all agents are available before the application starts.
 * 
 * SEC-004: Uses secure logger to prevent sensitive data leakage
 */

import { AgentAPI, AgentType } from './AgentAPI';
import { getConfig, isProduction } from '../config/environment';
import { logger } from '../lib/logger';

/**
 * Agent health status
 */
export interface AgentHealthStatus {
  agent: AgentType;
  available: boolean;
  responseTime?: number;
  error?: string;
  lastChecked: Date;
}

/**
 * Overall system health
 */
export interface SystemHealth {
  healthy: boolean;
  agents: AgentHealthStatus[];
  totalAgents: number;
  availableAgents: number;
  unavailableAgents: number;
  averageResponseTime: number;
}

/**
 * Agent initialization options
 */
export interface AgentInitOptions {
  /**
   * Timeout for health checks (ms)
   * @default 5000
   */
  healthCheckTimeout?: number;

  /**
   * Whether to fail fast if any agent is unavailable
   * @default true in production, false in development
   */
  failFast?: boolean;

  /**
   * Retry attempts for failed health checks
   * @default 3
   */
  retryAttempts?: number;

  /**
   * Delay between retry attempts (ms)
   * @default 1000
   */
  retryDelay?: number;

  /**
   * Callback for health check progress
   */
  onProgress?: (status: AgentHealthStatus) => void;

  /**
   * Callback for initialization complete
   */
  onComplete?: (health: SystemHealth) => void;

  /**
   * Callback for initialization failure
   */
  onError?: (error: Error, health: SystemHealth) => void;
}

/**
 * Agent types to check
 */
const AGENT_TYPES: AgentType[] = [
  'opportunity',
  'target',
  'realization',
  'expansion',
  'integrity',
  'company-intelligence',
  'financial-modeling',
  'value-mapping',
];

/**
 * Simple health check query for each agent
 */
const HEALTH_CHECK_QUERIES: Record<AgentType, string> = {
  'opportunity': 'health check',
  'target': 'health check',
  'realization': 'health check',
  'expansion': 'health check',
  'integrity': 'health check',
  'company-intelligence': 'health check',
  'financial-modeling': 'health check',
  'value-mapping': 'health check',
};

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check health of a single agent
 */
async function checkAgentHealth(
  agentAPI: AgentAPI,
  agent: AgentType,
  timeout: number
): Promise<AgentHealthStatus> {
  const startTime = Date.now();

  try {
    // Make a simple health check request
    const response = await agentAPI.query({
      agent,
      query: HEALTH_CHECK_QUERIES[agent],
      context: {
        metadata: { healthCheck: true },
      },
    });

    const responseTime = Date.now() - startTime;

    return {
      agent,
      available: response.success,
      responseTime,
      lastChecked: new Date(),
    };
  } catch (error) {
    return {
      agent,
      available: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      lastChecked: new Date(),
    };
  }
}

/**
 * Check health of a single agent with retries
 */
async function checkAgentHealthWithRetry(
  agentAPI: AgentAPI,
  agent: AgentType,
  timeout: number,
  retryAttempts: number,
  retryDelay: number,
  onProgress?: (status: AgentHealthStatus) => void
): Promise<AgentHealthStatus> {
  let lastStatus: AgentHealthStatus | null = null;

  for (let attempt = 0; attempt <= retryAttempts; attempt++) {
    if (attempt > 0) {
      logger.debug('Retrying agent health check', {
        agent,
        attempt,
        maxAttempts: retryAttempts,
      });
      await sleep(retryDelay);
    }

    const status = await checkAgentHealth(agentAPI, agent, timeout);
    lastStatus = status;

    // Report progress
    onProgress?.(status);

    // If successful, return immediately
    if (status.available) {
      return status;
    }
  }

  // Return last status after all retries
  return lastStatus!;
}

/**
 * Initialize and health check all agents
 */
export async function initializeAgents(
  options: AgentInitOptions = {}
): Promise<SystemHealth> {
  const config = getConfig();
  const {
    healthCheckTimeout = 5000,
    failFast = isProduction(),
    retryAttempts = 3,
    retryDelay = 1000,
    onProgress,
    onComplete,
    onError,
  } = options;

  logger.info('Initializing Agent Fabric', {
    environment: config.app.env,
    failFast,
    healthCheckTimeout,
    retryAttempts,
    // NEVER log: API URLs, secrets, tokens
  });

  // Create AgentAPI instance
  const agentAPI = new AgentAPI({
    baseUrl: config.agents.apiUrl,
    timeout: healthCheckTimeout,
    enableCircuitBreaker: config.agents.circuitBreaker.enabled,
    failureThreshold: config.agents.circuitBreaker.threshold,
    cooldownPeriod: config.agents.circuitBreaker.cooldown,
    enableLogging: config.agents.logging,
  });

  // Check health of all agents
  const healthStatuses: AgentHealthStatus[] = [];

  for (const agent of AGENT_TYPES) {
    logger.debug('Checking agent health', { agent });

    const status = await checkAgentHealthWithRetry(
      agentAPI,
      agent,
      healthCheckTimeout,
      retryAttempts,
      retryDelay,
      onProgress
    );

    healthStatuses.push(status);

    if (status.available) {
      logger.info('Agent available', {
        agent,
        responseTime: status.responseTime,
      });
    } else {
      logger.error('Agent unavailable', undefined, {
        agent,
        // NEVER log: error details (may contain sensitive info)
      });
    }
  }

  // Calculate system health
  const availableAgents = healthStatuses.filter((s) => s.available).length;
  const unavailableAgents = healthStatuses.length - availableAgents;
  const averageResponseTime =
    healthStatuses
      .filter((s) => s.responseTime !== undefined)
      .reduce((sum, s) => sum + (s.responseTime || 0), 0) /
    (availableAgents || 1);

  const systemHealth: SystemHealth = {
    healthy: availableAgents === healthStatuses.length,
    agents: healthStatuses,
    totalAgents: healthStatuses.length,
    availableAgents,
    unavailableAgents,
    averageResponseTime,
  };

  // Log summary
  logger.info('Agent Fabric health check complete', {
    totalAgents: systemHealth.totalAgents,
    availableAgents: systemHealth.availableAgents,
    unavailableAgents: systemHealth.unavailableAgents,
    averageResponseTime: Math.round(systemHealth.averageResponseTime),
    healthy: systemHealth.healthy,
  });

  // Handle completion
  onComplete?.(systemHealth);

  // Handle failure
  if (!systemHealth.healthy) {
    const error = new Error(
      `Agent Fabric initialization failed: ${unavailableAgents} of ${systemHealth.totalAgents} agents unavailable`
    );

    onError?.(error, systemHealth);

    if (failFast) {
      throw error;
    }
  }

  return systemHealth;
}

/**
 * Get current agent health status
 */
export async function getAgentHealth(
  timeout: number = 5000
): Promise<SystemHealth> {
  return initializeAgents({
    healthCheckTimeout: timeout,
    failFast: false,
    retryAttempts: 0,
  });
}

/**
 * Check if a specific agent is available
 */
export async function isAgentAvailable(
  agent: AgentType,
  timeout: number = 5000
): Promise<boolean> {
  const config = getConfig();
  const agentAPI = new AgentAPI({
    baseUrl: config.agents.apiUrl,
    timeout,
  });

  const status = await checkAgentHealth(agentAPI, agent, timeout);
  return status.available;
}

/**
 * Wait for agents to become available
 */
export async function waitForAgents(
  maxWaitTime: number = 60000,
  checkInterval: number = 5000
): Promise<SystemHealth> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitTime) {
    logger.debug('Checking agent availability');

    const health = await getAgentHealth(checkInterval);

    if (health.healthy) {
      logger.info('All agents available');
      return health;
    }

    logger.debug('Waiting for agents', {
      unavailableAgents: health.unavailableAgents,
      waitTime: checkInterval,
    });
    await sleep(checkInterval);
  }

  throw new Error(`Agents did not become available within ${maxWaitTime}ms`);
}

/**
 * Initialize agents with progress reporting
 */
export async function initializeAgentsWithProgress(): Promise<SystemHealth> {
  const statuses: AgentHealthStatus[] = [];

  return initializeAgents({
    onProgress: (status) => {
      statuses.push(status);
      const progress = (statuses.length / AGENT_TYPES.length) * 100;
      logger.debug('Agent initialization progress', {
        progress: Math.round(progress),
        completed: statuses.length,
        total: AGENT_TYPES.length,
      });
    },
    onComplete: (health) => {
      logger.info('Agent initialization complete', {
        totalAgents: health.totalAgents,
        availableAgents: health.availableAgents,
      });
    },
    onError: (error, health) => {
      logger.error('Agent initialization failed', error, {
        availableAgents: health.availableAgents,
        unavailableAgents: health.unavailableAgents,
      });
    },
  });
}

/**
 * Export singleton instance
 */
let agentHealthCache: SystemHealth | null = null;
let lastHealthCheck: Date | null = null;
const HEALTH_CACHE_TTL = 60000; // 1 minute

/**
 * Get cached agent health or perform new check
 */
export async function getCachedAgentHealth(
  forceRefresh: boolean = false
): Promise<SystemHealth> {
  const now = new Date();

  if (
    !forceRefresh &&
    agentHealthCache &&
    lastHealthCheck &&
    now.getTime() - lastHealthCheck.getTime() < HEALTH_CACHE_TTL
  ) {
    return agentHealthCache;
  }

  agentHealthCache = await getAgentHealth();
  lastHealthCheck = now;

  return agentHealthCache;
}

/**
 * Clear health cache
 */
export function clearHealthCache(): void {
  agentHealthCache = null;
  lastHealthCheck = null;
}
