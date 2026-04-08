import type { AgentType } from "../../agent-types.js";
import type { RetryOptions, RetryPolicy } from "./AgentRetryTypes.js";

export function getDefaultRetryOptions(): RetryOptions {
  return {
    maxRetries: 3,
    strategy: "exponential_backoff",
    baseDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    jitterFactor: 0.1,
    retryableErrors: [
      "TimeoutError",
      "NetworkError",
      "ConnectionError",
      "ServiceUnavailableError",
      "RateLimitError",
    ],
    nonRetryableErrors: [
      "ValidationError",
      "AuthenticationError",
      "AuthorizationError",
      "NotFoundError",
      "PermissionError",
    ],
    fallbackAgents: [],
    fallbackStrategy: "sequential",
    attemptTimeout: 30000,
    overallTimeout: 120000,
  };
}

export function buildDefaultRetryPolicy(
  defaultOptions: RetryOptions
): RetryPolicy {
  return {
    id: "default-retry-policy",
    name: "Default Retry Policy",
    description: "Default retry policy for all agents",
    agentTypes: ["opportunity", "target", "expansion", "integrity", "realization"],
    defaultOptions,
    errorMappings: {
      TimeoutError: { retryable: true, maxRetries: 3 },
      NetworkError: { retryable: true, maxRetries: 5 },
      ValidationError: { retryable: false },
      AuthenticationError: { retryable: false },
    },
    conditions: [],
    enabled: true,
  };
}

export function mergeRetryOptions(input: {
  agentType: AgentType;
  retryPolicies: Map<string, RetryPolicy>;
  customOptions?: Partial<RetryOptions>;
  defaultOptions: RetryOptions;
}): RetryOptions {
  let policy: RetryPolicy | undefined;

  for (const candidate of input.retryPolicies.values()) {
    if (candidate.agentTypes.includes(input.agentType) && candidate.enabled) {
      policy = candidate;
      break;
    }
  }

  const resolvedDefaultOptions = policy?.defaultOptions || input.defaultOptions;
  return {
    ...resolvedDefaultOptions,
    ...input.customOptions,
  };
}
