/**
 * Agent Fabric Stub
 * TODO(ticket:VOS-DEBT-1427 owner:team-valueos date:2026-02-13): Import from packages/agents when available
 */

export interface AgentConfig {
  id: string;
  name: string;
  type: string;
  capabilities: string[];
}

export interface AgentExecutionResult {
  success: boolean;
  output?: unknown;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface AgentFabric {
  registerAgent(config: AgentConfig): void;
  executeAgent(agentId: string, input: unknown): Promise<AgentExecutionResult>;
  listAgents(): AgentConfig[];
}

class AgentFabricImpl implements AgentFabric {
  private agents = new Map<string, AgentConfig>();

  registerAgent(config: AgentConfig): void {
    this.agents.set(config.id, config);
  }

  async executeAgent(agentId: string, input: unknown): Promise<AgentExecutionResult> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      return { success: false, error: `Agent ${agentId} not found` };
    }

    const allowLocalStub = process.env.AGENT_FABRIC_ALLOW_STUB === "true";
    const isProduction = process.env.NODE_ENV === "production";

    if (isProduction || !allowLocalStub) {
      throw new Error(
        "Agent fabric stub is disabled. Configure a real agent executor before release builds."
      );
    }

    return {
      success: true,
      output: { agentId, input },
      metadata: { mode: "dev-stub", guarded: true },
    };
  }

  listAgents(): AgentConfig[] {
    return Array.from(this.agents.values());
  }
}

export const agentFabric = new AgentFabricImpl();
export default agentFabric;
