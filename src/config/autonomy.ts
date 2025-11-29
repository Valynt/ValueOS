/**
 * Autonomy and approval guardrail configuration
 */

const env = typeof import.meta !== 'undefined' ? (import.meta as any).env ?? {} : process.env ?? {};

const getEnv = (key: string, defaultValue: string) => (env[key] ?? defaultValue) as string;

export interface AutonomyConfig {
  killSwitchEnabled: boolean;
  maxCostUsd: number;
  maxDurationMs: number;
  requireApprovalForDestructive: boolean;
  serviceIdentityToken?: string;
  agentAutonomyLevels?: Record<string, 'observe' | 'assist' | 'act'>;
  destructiveActions?: string[];
}

export function getAutonomyConfig(): AutonomyConfig {
  return {
    killSwitchEnabled: getEnv('AUTONOMY_KILL_SWITCH', 'false') === 'true',
    maxCostUsd: Number(getEnv('AUTONOMY_MAX_COST_USD', '50')),
    maxDurationMs: Number(getEnv('AUTONOMY_MAX_DURATION_MS', `${5 * 60 * 1000}`)),
    requireApprovalForDestructive: getEnv('AUTONOMY_REQUIRE_APPROVAL', 'false') === 'true',
    serviceIdentityToken: getEnv('SERVICE_IDENTITY_TOKEN', ''),
    agentAutonomyLevels: JSON.parse(getEnv('AGENT_AUTONOMY_LEVELS', '{}')),
    destructiveActions: getEnv('DESTRUCTIVE_ACTIONS', '').split(',').map((v) => v.trim()).filter(Boolean),
  };
}

export default getAutonomyConfig;
