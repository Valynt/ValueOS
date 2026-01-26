/**
 * Secure Agent Output Schema
 */

export interface SecureAgentOutput {
  agent_id: string;
  execution_id: string;
  output: Record<string, any>;
  signature: string;
  timestamp: string;
}
