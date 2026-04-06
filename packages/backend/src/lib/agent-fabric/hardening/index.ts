/**
 * Agent Hardening Layer — public API
 *
 * Import from this barrel rather than from individual files.
 */

// Types
export type {
  RequestEnvelope,
  ConfidenceScore,
  ConfidenceBreakdown,
  ConfidenceThresholds,
  HardenedInvokeOptions,
  HardenedInvokeResult,
  TokenUsage,
  GovernanceVerdict,
  GovernanceDecision,
  IntegrityIssueRecord,
  AgentExecutionLog,
  ReasoningTraceEntry,
  ToolUsageRecord,
  SafetyScanResult,
  SafetyVerdict,
  InjectionSignal,
  ToolViolation,
  FailureScenario,
  FailureResponse,
} from "./AgentHardeningTypes.js";

export { CONFIDENCE_THRESHOLDS, FAILURE_RESPONSES } from "./AgentHardeningTypes.js";

// Safety
export {
  PromptSanitizer,
  ToolAccessGuard,
  OutputValidator,
  SafetyLayer,
  safetyLayer,
} from "./AgentSafetyLayer.js";
export type { SanitizeResult, OutputValidationResult, SafetyCheckInput } from "./AgentSafetyLayer.js";

// Governance
export {
  GovernanceLayer,
  evaluateConfidence,
  runIntegrityVeto,
  createHITLCheckpoint,
} from "./AgentGovernanceLayer.js";
export type {
  ConfidenceEvaluationResult,
  GovernanceCheckInput,
  GovernanceCheckResult,
  IntegrityVetoInput,
  IntegrityVetoResult,
  IntegrityVetoServicePort,
  HITLCheckpointPort,
  HITLCheckpointResult,
} from "./AgentGovernanceLayer.js";

// Observability
export {
  ExecutionLogBuilder,
  ObservabilityLayer,
  observabilityLayer,
  estimateCostUsd,
} from "./AgentObservabilityLayer.js";

// Runner
export {
  HardenedAgentRunner,
  GovernanceVetoError,
} from "./HardenedAgentRunner.js";
export type { HardenedAgentRunnerConfig, AgentExecuteFn } from "./HardenedAgentRunner.js";

// Reference implementation
export {
  HardenedDiscoveryAgent,
  createHardenedDiscoveryAgent,
  buildRequestEnvelope,
  DiscoveryOutputSchema,
} from "./HardenedDiscoveryAgent.js";
export type { DiscoveryOutput, HardenedDiscoveryAgentDeps } from "./HardenedDiscoveryAgent.js";
