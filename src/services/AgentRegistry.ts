/**
 * Agent Registry
 * 
 * CONSOLIDATION: Updated to use canonical agent types from src/types/agent.ts
 * 
 * This registry manages all agent registrations, health status, and routing.
 */

import { logger } from '../lib/logger';
import { WorkflowStage } from '../types/workflow';
import { 
  LifecycleStage, 
  AgentHealthStatus,
  AgentRegistration as CanonicalAgentRegistration,
  AgentRecord as CanonicalAgentRecord 
} from '../types/agent';

// Re-export canonical types for backward compatibility
export type { AgentHealthStatus } from '../types/agent';

/**
 * Agent registration interface (uses canonical types with snake_case for DB compat)
 */
export interface AgentRegistration {
  id: string;
  name: string;
  lifecycle_stage: LifecycleStage;
  capabilities: string[];
  region?: string;
  endpoint?: string;
  metadata?: Record<string, any>;
}

/**
 * Agent state (runtime)
 */
export interface AgentState {
  load: number;
  status: AgentHealthStatus;
  last_heartbeat: number;
  consecutive_failures: number;
  sticky_sessions: Set<string>;
}

/**
 * Agent record combines registration and state
 */
export type AgentRecord = AgentRegistration & AgentState;

/**
 * Convert from canonical to registry format
 */
export function fromCanonicalRegistration(canonical: CanonicalAgentRegistration): AgentRegistration {
  return {
    id: canonical.id,
    name: canonical.name,
    lifecycle_stage: canonical.lifecycleStage,
    capabilities: canonical.capabilities,
    region: canonical.region,
    endpoint: canonical.endpoint,
    metadata: canonical.metadata,
  };
}

/**
 * Convert from registry to canonical format
 */
export function toCanonicalRecord(record: AgentRecord): CanonicalAgentRecord {
  return {
    id: record.id,
    name: record.name,
    lifecycleStage: record.lifecycle_stage,
    capabilities: record.capabilities,
    region: record.region,
    endpoint: record.endpoint,
    metadata: record.metadata,
    load: record.load,
    status: record.status,
    lastHeartbeat: record.last_heartbeat,
    consecutiveFailures: record.consecutive_failures,
    stickySessions: record.sticky_sessions,
  };
}

export interface RoutingContext {
  session_id?: string;
  region?: string;
  required_capabilities?: string[];
  previous_agent_id?: string;
  [key: string]: any;
}

const LOAD_INCREMENT_PER_ASSIGNMENT = 0.1;
const LOAD_DECREMENT_PER_RELEASE = 0.05;
const OFFLINE_FAILURE_THRESHOLD = 3;
const DEGRADED_FAILURE_THRESHOLD = 2;

export class AgentRegistry {
  private agents: Map<string, AgentRecord> = new Map();
  private heartbeatTimeoutMs: number;

  constructor(heartbeatTimeoutMs = 30000) {
    this.heartbeatTimeoutMs = heartbeatTimeoutMs;
  }

  registerAgent(registration: AgentRegistration): AgentRecord {
    // Check if agent already exists to avoid silent overwrite
    const existingAgent = this.agents.get(registration.id);
    if (existingAgent) {
      throw new Error(`Agent with ID '${registration.id}' is already registered`);
    }

    const record: AgentRecord = {
      ...registration,
      load: 0,
      status: 'healthy',
      last_heartbeat: Date.now(),
      consecutive_failures: 0,
      sticky_sessions: new Set()
    };

    this.agents.set(registration.id, record);
    return record;
  }

  getAgent(agentId: string): AgentRecord | undefined {
    return this.agents.get(agentId);
  }

  updateHeartbeat(agentId: string, load?: number, status?: AgentHealthStatus): AgentRecord | undefined {
    const agent = this.agents.get(agentId);
    if (!agent) return undefined;

    agent.last_heartbeat = Date.now();
    if (typeof load === 'number') {
      agent.load = Math.max(0, Math.min(1, load));
    }
    if (status) {
      agent.status = status;
    }
    agent.consecutive_failures = 0;
    return agent;
  }

  recordAssignment(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (!agent) return;
    agent.load = Math.min(1, agent.load + LOAD_INCREMENT_PER_ASSIGNMENT);
    agent.last_heartbeat = Date.now();
  }

  recordRelease(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (!agent) return;
    agent.load = Math.max(0, agent.load - LOAD_DECREMENT_PER_RELEASE);
    agent.last_heartbeat = Date.now();
  }

  recordFailure(agentId: string): AgentRecord | undefined {
    const agent = this.agents.get(agentId);
    if (!agent) return undefined;

    agent.consecutive_failures += 1;
    if (agent.consecutive_failures >= OFFLINE_FAILURE_THRESHOLD) {
      agent.status = 'offline';
    } else if (agent.consecutive_failures >= DEGRADED_FAILURE_THRESHOLD) {
      agent.status = 'degraded';
    }
    agent.last_heartbeat = Date.now();
    return agent;
  }

  markHealthy(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (!agent) return;
    agent.status = 'healthy';
    agent.consecutive_failures = 0;
    agent.last_heartbeat = Date.now();
  }

  // Separate method to update agent health status based on heartbeat
  private updateAgentHealthStatus(agent: AgentRecord): void {
    const now = Date.now();
    const stale = now - agent.last_heartbeat > this.heartbeatTimeoutMs;
    if (stale) {
      agent.status = 'offline';
    }
  }

  getAgentsByLifecycle(lifecycle_stage: LifecycleStage, includeDegraded = false): AgentRecord[] {
    // First, update health status for all agents
    for (const agent of this.agents.values()) {
      this.updateAgentHealthStatus(agent);
    }

    // Then filter and sort
    return Array.from(this.agents.values())
      .filter(agent => agent.lifecycle_stage === lifecycle_stage)
      .filter(agent => {
        if (agent.status === 'offline') return false;
        if (!includeDegraded && agent.status !== 'healthy') return false;
        return true;
      })
      .sort((a, b) => a.load - b.load);
  }

  markStickySession(sessionId: string, agentId: string): void {
    const agent = this.agents.get(agentId);
    if (!agent) return;
    agent.sticky_sessions.add(sessionId);
  }

  releaseStickySession(sessionId: string, agentId: string): void {
    const agent = this.agents.get(agentId);
    if (!agent) return;
    agent.sticky_sessions.delete(sessionId);
  }

  getStickyAgent(sessionId?: string): AgentRecord | undefined {
    if (!sessionId) return undefined;
    return Array.from(this.agents.values()).find(agent => agent.sticky_sessions.has(sessionId));
  }

  describeStageCapabilities(stage: WorkflowStage, context: RoutingContext): string[] {
    return stage.required_capabilities || context.required_capabilities || [];
  }
}
