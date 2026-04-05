/**
 * @deprecated Import from `../../types/agent` (domain types) and `../agent-types` (AgentType) directly.
 * This shim remains only for backward compatibility and will be removed after import migration.
 */
export * from "../agent-types.js";
export type {
  AgentConfig,
  AgentOutput,
  AgentHealthStatus,
  AgentMetrics,
  LifecycleContext,
  ConfidenceLevel,
  ModelConfig,
  PromptConfig,
  AgentConstraints,
  AgentParameters,
  AgentError,
  AgentOutputMetadata,
  TokenUsage,
} from "../../types/agent";
