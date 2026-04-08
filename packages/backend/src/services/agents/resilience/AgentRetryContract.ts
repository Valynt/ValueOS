export type ContractComplianceFailureType = "parse" | "schema" | "business_rule" | "unknown";

export interface ContractComplianceViolation {
  path?: string;
  message: string;
  code?: string;
}

export interface ContractComplianceValidationResult<TOutput> {
  approved: boolean;
  output?: TOutput;
  failureType?: ContractComplianceFailureType;
  details?: string;
  violations?: ContractComplianceViolation[];
}

export interface ContractAwareRetryPayload<TOutput> {
  generator: (input: { prompt: string; attempt: number }) => Promise<string>;
  complianceEngine: {
    validate: (
      rawOutput: string,
      payload: {
        outputSchema: unknown;
        originalSchema: unknown;
      }
    ) => Promise<ContractComplianceValidationResult<TOutput>>;
  };
  outputSchema: unknown;
  originalSchema?: unknown;
  initialPrompt: string;
  agentPolicy: { maxRetries: number };
}

export interface ContractAwareRetryError {
  code:
    | "PARSE_VALIDATION_FAILED"
    | "SCHEMA_VALIDATION_FAILED"
    | "BUSINESS_RULE_VALIDATION_FAILED"
    | "GENERATOR_EXECUTION_FAILED"
    | "COMPLIANCE_ENGINE_FAILED"
    | "UNKNOWN_COMPLIANCE_ERROR";
  message: string;
  retryable: boolean;
  attemptsUsed: number;
  violations?: ContractComplianceViolation[];
}

export interface AgentResult<TOutput> {
  approved: boolean;
  output?: TOutput;
  retryCount: number;
  error?: ContractAwareRetryError;
}

/**
 * Build a targeted repair prompt for parse/schema violations.
 */
export function buildRepairPrompt<TOutput>(
  originalSchema: unknown,
  validation: ContractComplianceValidationResult<TOutput>
): string {
  const violationDetails =
    validation.violations?.map((violation, index) => {
      const location = violation.path ? ` at ${violation.path}` : "";
      const code = violation.code ? ` (${violation.code})` : "";
      return `${index + 1}. ${violation.message}${location}${code}`;
    }) ?? [];

  const detailsSection =
    violationDetails.length > 0
      ? violationDetails.join("\n")
      : validation.details ?? "No additional violation details provided.";

  return [
    "Repair the previous response.",
    "Return only valid JSON with no markdown, no prose, and no backticks.",
    "The output must conform exactly to this schema:",
    JSON.stringify(originalSchema, null, 2),
    "Violations to fix:",
    detailsSection,
  ].join("\n\n");
}

export async function executeContractAwareRetry<TOutput>(
  payload: ContractAwareRetryPayload<TOutput>
): Promise<AgentResult<TOutput>> {
  const maxRetries = Math.max(0, payload.agentPolicy.maxRetries);
  let prompt = payload.initialPrompt;
  let lastValidationFailure: ContractComplianceValidationResult<TOutput> | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let rawOutput: string;
    try {
      rawOutput = await payload.generator({ prompt, attempt });
    } catch (error) {
      return {
        approved: false,
        retryCount: attempt,
        error: {
          code: "GENERATOR_EXECUTION_FAILED",
          message: (error as Error).message,
          retryable: false,
          attemptsUsed: attempt + 1,
        },
      };
    }

    let validation: ContractComplianceValidationResult<TOutput>;
    try {
      validation = await payload.complianceEngine.validate(rawOutput, {
        outputSchema: payload.outputSchema,
        originalSchema: payload.originalSchema ?? payload.outputSchema,
      });
    } catch (error) {
      return {
        approved: false,
        retryCount: attempt,
        error: {
          code: "COMPLIANCE_ENGINE_FAILED",
          message: (error as Error).message,
          retryable: false,
          attemptsUsed: attempt + 1,
        },
      };
    }

    if (validation.approved && validation.output !== undefined) {
      return {
        approved: true,
        output: validation.output,
        retryCount: attempt,
      };
    }

    lastValidationFailure = validation;
    const failureType = validation.failureType ?? "unknown";
    const details = validation.details ?? "Output compliance validation failed.";

    switch (failureType) {
      case "business_rule":
        return {
          approved: false,
          retryCount: attempt,
          error: {
            code: "BUSINESS_RULE_VALIDATION_FAILED",
            message: details,
            retryable: false,
            attemptsUsed: attempt + 1,
            violations: validation.violations,
          },
        };

      case "parse":
      case "schema":
        if (attempt >= maxRetries) {
          return {
            approved: false,
            retryCount: attempt,
            error: {
              code:
                failureType === "parse"
                  ? "PARSE_VALIDATION_FAILED"
                  : "SCHEMA_VALIDATION_FAILED",
              message: details,
              retryable: true,
              attemptsUsed: attempt + 1,
              violations: validation.violations,
            },
          };
        }

        prompt = buildRepairPrompt(payload.originalSchema ?? payload.outputSchema, validation);
        continue;

      case "unknown":
      default:
        return {
          approved: false,
          retryCount: attempt,
          error: {
            code: "UNKNOWN_COMPLIANCE_ERROR",
            message: details,
            retryable: false,
            attemptsUsed: attempt + 1,
            violations: validation.violations,
          },
        };
    }
  }

  return {
    approved: false,
    retryCount: maxRetries,
    error: {
      code: "UNKNOWN_COMPLIANCE_ERROR",
      message: lastValidationFailure?.details ?? "Contract-aware retry exhausted.",
      retryable: false,
      attemptsUsed: maxRetries + 1,
      violations: lastValidationFailure?.violations,
    },
  };
}
