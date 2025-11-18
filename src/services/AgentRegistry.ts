import { LifecycleStage, WorkflowStage } from '../types/workflow';

export type AgentHealthStatus = 'healthy' | 'degraded' | 'offline';

export interface AgentRegistration {
  id: string;
  name: string;
  lifecycle_stage: LifecycleStage;
  capabilities: string[];
  region?: string;
  endpoint?: string;
  metadata?: Record<string, any>;
}

export interface AgentState {
  load: number;
  status: AgentHealthStatus;
  last_heartbeat: number;
  consecutive_failures: number;
  sticky_sessions: Set<string>;
}

export type AgentRecord = AgentRegistration & AgentState;

export interface RoutingContext {
  session_id?: string;
  region?: string;
  required_capabilities?: string[];
  previous_agent_id?: string;
  [key: string]: any;
}

export class AgentRegistry {
  private agents: Map<string, AgentRecord> = new Map();
  private heartbeatTimeoutMs: number;

  constructor(heartbeatTimeoutMs = 30000) {
    this.heartbeatTimeoutMs = heartbeatTimeoutMs;
  }

  registerAgent(registration: AgentRegistration): AgentRecord {
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
    agent.load = Math.min(1, agent.load + 0.1);
    agent.last_heartbeat = Date.now();
  }

  recordRelease(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (!agent) return;
    agent.load = Math.max(0, agent.load - 0.05);
    agent.last_heartbeat = Date.now();
  }

  recordFailure(agentId: string): AgentRecord | undefined {
    const agent = this.agents.get(agentId);
    if (!agent) return undefined;

    agent.consecutive_failures += 1;
    if (agent.consecutive_failures >= 3) {
      agent.status = 'offline';
    } else if (agent.consecutive_failures >= 2) {
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

  getAgentsByLifecycle(lifecycle_stage: LifecycleStage, includeDegraded = false): AgentRecord[] {
    const now = Date.now();
    return Array.from(this.agents.values())
      .filter(agent => agent.lifecycle_stage === lifecycle_stage)
      .filter(agent => {
        const stale = now - agent.last_heartbeat > this.heartbeatTimeoutMs;
        if (stale) {
          agent.status = 'offline';
        }
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
