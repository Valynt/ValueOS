export interface AgentIdentity { id: string; name: string; role: string; permissions: string[]; }
export function createAgentIdentity(_params: Partial<AgentIdentity>): AgentIdentity {
  return { id: "", name: "", role: "", permissions: [], ..._params };
}
export default AgentIdentity;
