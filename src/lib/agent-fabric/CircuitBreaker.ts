// Re-export SafetyGovernor as legacy CircuitBreaker for backward compatibility
export {
  SafetyGovernor as AgentCircuitBreaker,
  SafetyLimits,
  DEFAULT_SAFETY_LIMITS,
  ExecutionMetrics,
  SafetyError,
  withSafetyGovernor as withCircuitBreaker,
  trackLLMCall,
  trackRecursion,
} from "./SafetyGovernor";

// Legacy aliases for backward compatibility
