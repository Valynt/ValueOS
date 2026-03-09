/**
 * Agent health check via backend API.
 *
 * Replaces the direct AgentInitializer service call. The frontend has no
 * business instantiating agents — it checks their health through the API.
 */

export interface AgentHealthStatus {
  agent: string;
  available: boolean;
  responseTime?: number;
}

export interface SystemHealth {
  healthy: boolean;
  agents: AgentHealthStatus[];
  totalAgents: number;
  availableAgents: number;
  unavailableAgents: number;
  averageResponseTime: number;
}

export interface AgentInitOptions {
  healthCheckTimeout?: number;
  failFast?: boolean;
  retryAttempts?: number;
  retryDelay?: number;
  onProgress?: (status: AgentHealthStatus) => void;
  onComplete?: (health: SystemHealth) => void;
  onError?: (error: Error, health: SystemHealth) => void;
}

const FALLBACK_HEALTH: SystemHealth = {
  healthy: false,
  agents: [],
  totalAgents: 0,
  availableAgents: 0,
  unavailableAgents: 0,
  averageResponseTime: 0,
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function initializeAgents(options: AgentInitOptions = {}): Promise<SystemHealth> {
  const {
    healthCheckTimeout = 5000,
    retryAttempts = 3,
    retryDelay = 1000,
  } = options;

  for (let attempt = 0; attempt <= retryAttempts; attempt++) {
    if (attempt > 0) {
      await sleep(retryDelay);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), healthCheckTimeout);

    try {
      const res = await fetch("/health/dependencies", { signal: controller.signal });
      clearTimeout(timer);

      if (!res.ok) continue;

      // Backend health endpoint returns service statuses; map to SystemHealth shape.
      const data = (await res.json()) as Record<string, unknown>;
      const agentStatus = data["agents"] as { available?: boolean } | undefined;
      const available = agentStatus?.available !== false;

      const health: SystemHealth = {
        healthy: available,
        agents: [],
        totalAgents: 1,
        availableAgents: available ? 1 : 0,
        unavailableAgents: available ? 0 : 1,
        averageResponseTime: 0,
      };

      options.onComplete?.(health);
      return health;
    } catch {
      clearTimeout(timer);
      // Retry on network/abort errors up to retryAttempts.
    }
  }

  options.onError?.(new Error("Agent health check failed"), FALLBACK_HEALTH);
  return FALLBACK_HEALTH;
}
