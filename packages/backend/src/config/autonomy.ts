/**
 * Autonomy Configuration
 */

export interface AutonomyConfig {
  max_autonomous_actions: number;
  require_approval_threshold: number;
  enabled: boolean;
}

export const AUTONOMY_CONFIG: AutonomyConfig = {
  max_autonomous_actions: 10,
  require_approval_threshold: 0.8,
  enabled: true,
};

export function getAutonomyConfig(): AutonomyConfig {
  return { ...AUTONOMY_CONFIG };
}
