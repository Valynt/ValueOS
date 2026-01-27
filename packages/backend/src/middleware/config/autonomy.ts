// packages/backend/src/middleware/config/autonomy.ts
export interface AutonomyConfig {
  enabled: boolean;
  maxAutonomousActions: number;
  requireApproval: boolean;
}

export const autonomyConfig: AutonomyConfig = {
  enabled: true,
  maxAutonomousActions: 10,
  requireApproval: false,
};