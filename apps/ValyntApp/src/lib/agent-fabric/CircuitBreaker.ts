// Stub — circuit breaker for agent fabric (full implementation in packages/backend)

export interface SafetyLimits {
  maxCostPerSession: number;
  maxExecutionTimeMs: number;
  maxRecursionDepth: number;
}

export const DEFAULT_SAFETY_LIMITS: SafetyLimits = {
  maxCostPerSession: 5,
  maxExecutionTimeMs: 60000,
  maxRecursionDepth: 10,
};
