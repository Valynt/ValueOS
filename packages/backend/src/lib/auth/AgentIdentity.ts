/**
 * Agent Identity Management
 *
 * Permissions are populated from the agent's policy file (allowedTools).
 * Each allowed tool maps to a permission string of the form "tool:<toolName>".
 * BaseAgent checks these before invoking any tool.
 */

import { getAgentPolicyService } from "../../services/policy/AgentPolicyService.js";

export interface AgentIdentity {
  agent_id: string;
  agent_type: string;
  organization_id: string;
  /** Permission strings derived from the agent's policy allowedTools list. */
  permissions: string[];
  issued_at: string;
  expires_at: string;
}

export class PermissionDeniedError extends Error {
  constructor(agentType: string, tool: string) {
    super(`Agent '${agentType}' is not permitted to use tool '${tool}'`);
    this.name = "PermissionDeniedError";
  }
}

/**
 * Maps allowedTools from the agent policy to permission strings.
 * Falls back to an empty array if the policy service is unavailable
 * (e.g. in test environments without policy files).
 */
function resolvePermissions(agentType: string): string[] {
  try {
    const policy = getAgentPolicyService().getPolicy(agentType);
    return policy.allowedTools.map((tool) => `tool:${tool}`);
  } catch {
    return [];
  }
}

export function createAgentIdentity(agentId: string, agentType: string, orgId: string): AgentIdentity {
  return {
    agent_id: agentId,
    agent_type: agentType,
    organization_id: orgId,
    permissions: resolvePermissions(agentType),
    issued_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
}

/** Returns true if the identity has permission to use the given tool. */
export function canUseTool(identity: AgentIdentity, toolName: string): boolean {
  return identity.permissions.includes(`tool:${toolName}`);
}
