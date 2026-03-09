import { AgentAPI, AgentType } from "../services/AgentAPI";
import { getConfig } from "../config/environment";
import { logger } from "./logger";

export interface AgentHealthStatus {
  agent: AgentType;
  available: boolean;
  responseTime?: number;
  lastChecked: Date;
}

export interface SystemHealth {
  healthy: boolean;
  agents: AgentHealthStatus[];
  availableAgents: number;
  unavailableAgents: number;
}

export interface AgentInitOptions {
  healthCheckTimeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  onProgress?: (status: AgentHealthStatus) => void;
}

const CHECKED_AGENTS: AgentType[] = [
  "opportunity",
  "target",
  "integrity",
  "realization",
  "expansion",
  "financial-modeling",
];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function checkOne(
  api: AgentAPI,
  agent: AgentType,
  retryAttempts: number,
  retryDelay: number,
  onProgress?: (status: AgentHealthStatus) => void
): Promise<AgentHealthStatus> {
  for (let attempt = 0; attempt <= retryAttempts; attempt++) {
    if (attempt > 0) {
      await sleep(retryDelay);
    }

    const start = Date.now();
    try {
      const res = await api.invokeAgent({ agent, query: "health check", context: { metadata: { healthCheck: true } } });
      const status: AgentHealthStatus = {
        agent,
        available: res.success,
        responseTime: Date.now() - start,
        lastChecked: new Date(),
      };
      onProgress?.(status);
      if (status.available) return status;
    } catch {
      // swallow and retry
    }
  }

  const status: AgentHealthStatus = { agent, available: false, lastChecked: new Date() };
  onProgress?.(status);
  return status;
}

/**
 * Check health of all agents, honouring retryAttempts and retryDelay from
 * options. Previously these fields were declared in AgentInitOptions but
 * ignored inside the function body, causing transient failures during
 * bootstrap to go unretried.
 */
export async function initializeAgents(options: AgentInitOptions = {}): Promise<SystemHealth> {
  const config = getConfig();
  const {
    healthCheckTimeout = 5000,
    retryAttempts = 3,
    retryDelay = 1000,
    onProgress,
  } = options;

  const api = new AgentAPI({ baseUrl: config.agents.apiUrl, timeout: healthCheckTimeout });

  const statuses: AgentHealthStatus[] = [];
  for (const agent of CHECKED_AGENTS) {
    logger.debug("Checking agent health", { agent });
    const status = await checkOne(api, agent, retryAttempts, retryDelay, onProgress);
    statuses.push(status);
  }

  const availableAgents = statuses.filter((s) => s.available).length;
  return {
    healthy: availableAgents === statuses.length,
    agents: statuses,
    availableAgents,
    unavailableAgents: statuses.length - availableAgents,
  };
}
