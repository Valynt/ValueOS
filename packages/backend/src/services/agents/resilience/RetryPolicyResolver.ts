import type { AgentType } from "../../agent-types.js";
import type { RetryError, RetryOptions, RetryPolicy } from "./AgentRetryTypes.js";

export function resolveRetryOptions(
  policy: RetryPolicy | undefined,
  getDefaultRetryOptions: () => RetryOptions,
  customOptions?: Partial<RetryOptions>
): RetryOptions {
  const defaultOptions = policy?.defaultOptions || getDefaultRetryOptions();
  return {
    ...defaultOptions,
    ...customOptions,
  };
}

export function shouldRetryForError(
  error: RetryError,
  options: RetryOptions,
  _attemptNumber: number
): boolean {
  if (options.nonRetryableErrors.includes(error.type)) {
    return false;
  }

  if (options.retryableErrors.includes(error.type)) {
    return true;
  }

  if (error.severity === "critical") {
    return false;
  }

  const retryablePatterns = [
    /timeout/i,
    /network/i,
    /connection/i,
    /temporary/i,
    /rate.?limit/i,
    /too.?many.?requests/i,
    /service.?unavailable/i,
  ];

  return retryablePatterns.some(pattern => pattern.test(error.message));
}

export function findRetryPolicy(
  retryPolicies: Map<string, RetryPolicy>,
  agentType: AgentType
): RetryPolicy | undefined {
  for (const policy of retryPolicies.values()) {
    if (policy.agentTypes.includes(agentType) && policy.enabled) {
      return policy;
    }
  }

  return undefined;
}
