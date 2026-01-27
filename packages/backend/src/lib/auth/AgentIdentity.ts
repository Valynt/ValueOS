/**
 * Agent Identity Management
 */

export interface AgentIdentity {
  agent_id: string;
  agent_type: string;
  organization_id: string;
  permissions: string[];
  issued_at: string;
  expires_at: string;
}

export function createAgentIdentity(agentId: string, agentType: string, orgId: string): AgentIdentity {
  return {
    agent_id: agentId,
    agent_type: agentType,
    organization_id: orgId,
    permissions: [],
    issued_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
}
