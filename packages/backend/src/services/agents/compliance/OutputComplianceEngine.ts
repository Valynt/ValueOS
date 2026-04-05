import { z, type ZodError, type ZodType } from 'zod';

export type OutputComplianceErrorCode =
  | 'EMPTY_OUTPUT'
  | 'NON_JSON_WRAPPER'
  | 'JSON_PARSE_FAILED'
  | 'SCHEMA_VALIDATION_FAILED'
  | 'BUSINESS_RULE_VIOLATION'
  | 'MISSING_EVIDENCE'
  | 'INVALID_CONFIDENCE_VALUE';

export interface OutputComplianceErrorContext {
  readonly contractName?: string;
  readonly agentName?: string;
  readonly executionId?: string;
  readonly traceId?: string;
  readonly confidence?: number;
  readonly confidencePath?: string;
  readonly evidencePath?: string;
  readonly issues?: ReadonlyArray<{
    readonly path: string;
    readonly message: string;
    readonly code?: string;
  }>;
  readonly details?: Record<string, unknown>;
}

export class OutputComplianceError extends Error {
  readonly code: OutputComplianceErrorCode;
  readonly retryable: boolean;
  readonly context: OutputComplianceErrorContext;

  constructor(
    code: OutputComplianceErrorCode,
    message: string,
    context: OutputComplianceErrorContext = {},
    options: {
      cause?: unknown;
      retryable?: boolean;
    } = {}
  ) {
    super(message, { cause: options.cause });
    this.name = 'OutputComplianceError';
    this.code = code;
    this.retryable = options.retryable ?? true;
    this.context = context;
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      retryable: this.retryable,
      context: this.context,
    };
  }
}

export interface AgentContract<TInput, TOutput> {
  readonly name: string;
  readonly version?: string;
  readonly inputSchema?: ZodType<TInput>;
  readonly outputSchema: ZodType<TOutput>;
}

export interface OutputCompliancePolicy {
  readonly highConfidenceThreshold?: number;
  readonly requireEvidenceForHighConfidence?: boolean;
  readonly confidencePaths?: ReadonlyArray<string>;
  readonly evidencePaths?: ReadonlyArray<string>;
  readonly minEvidenceItems?: number;
}

export interface OutputComplianceExecutionContext {
  readonly agentName?: string;
  readonly executionId?: string;
  readonly traceId?: string;
  readonly policy?: OutputCompliancePolicy;
}

export interface AgentResult<TOutput> {
  readonly status: 'success';
  readonly output: TOutput;
  readonly metadata: {
    readonly contractName: string;
    readonly contractVersion?: string;
    readonly validatedAt: string;
    readonly compliancePolicy: Required<OutputCompliancePolicy>;
  };
}

const DEFAULT_POLICY: Required<OutputCompliancePolicy> = {
  highConfidenceThreshold: 0.8,
  requireEvidenceForHighConfidence: true,
  confidencePaths: ['confidence', 'result.confidence', 'metadata.confidence'],
  evidencePaths: ['evidence', 'citations', 'supportingEvidence'],
  minEvidenceItems: 1,
};

export class OutputComplianceEngine {
  validate<TInput, TOutput>(
    rawOutput: string,
    contract: AgentContract<TInput, TOutput>,
    executionContext: OutputComplianceExecutionContext = {}
  ): AgentResult<TOutput> {
    const policy = this.resolvePolicy(executionContext.policy);
    const context = {
      contractName: contract.name,
      agentName: executionContext.agentName,
      executionId: executionContext.executionId,
      traceId: executionContext.traceId,
    } satisfies OutputComplianceErrorContext;

    const parsedOutput = this.parseStrictJson(rawOutput, context);

    const validatedOutput = this.validateSchema(contract.outputSchema, parsedOutput, context);

    this.validateBusinessRules(validatedOutput, policy, context);

    return {
      status: 'success',
      output: validatedOutput,
      metadata: {
        contractName: contract.name,
        contractVersion: contract.version,
        validatedAt: new Date().toISOString(),
        compliancePolicy: policy,
      },
    };
  }

  private parseStrictJson(rawOutput: string, context: OutputComplianceErrorContext): unknown {
    const trimmed = rawOutput.trim();

    if (trimmed.length === 0) {
      throw new OutputComplianceError('EMPTY_OUTPUT', 'LLM output was empty.', context, {
        retryable: true,
      });
    }

    if (trimmed.includes('```')) {
      throw new OutputComplianceError(
        'NON_JSON_WRAPPER',
        'LLM output contains markdown code fences; strict JSON-only output is required.',
        context,
        { retryable: true }
      );
    }

    const startsAsJson = trimmed.startsWith('{') || trimmed.startsWith('[');
    const endsAsJson = trimmed.endsWith('}') || trimmed.endsWith(']');
    if (!startsAsJson || !endsAsJson) {
      throw new OutputComplianceError(
        'NON_JSON_WRAPPER',
        'LLM output must be raw JSON without prose wrappers.',
        {
          ...context,
          details: {
            startsAsJson,
            endsAsJson,
          },
        },
        { retryable: true }
      );
    }

    try {
      return JSON.parse(trimmed) as unknown;
    } catch (error) {
      throw new OutputComplianceError('JSON_PARSE_FAILED', 'Failed to parse LLM output as JSON.', context, {
        cause: error,
        retryable: true,
      });
    }
  }

  private validateSchema<TOutput>(
    schema: ZodType<TOutput>,
    output: unknown,
    context: OutputComplianceErrorContext
  ): TOutput {
    const validation = schema.safeParse(output);
    if (validation.success) {
      return validation.data;
    }

    throw new OutputComplianceError(
      'SCHEMA_VALIDATION_FAILED',
      'LLM output failed contract schema validation.',
      {
        ...context,
        issues: this.formatZodIssues(validation.error),
      },
      {
        cause: validation.error,
        retryable: true,
      }
    );
  }

  private validateBusinessRules<TOutput>(
    output: TOutput,
    policy: Required<OutputCompliancePolicy>,
    context: OutputComplianceErrorContext
  ): void {
    const confidenceValue = this.readFirstNumber(output, policy.confidencePaths);

    if (confidenceValue !== undefined && (confidenceValue < 0 || confidenceValue > 1)) {
      throw new OutputComplianceError(
        'INVALID_CONFIDENCE_VALUE',
        'Confidence must be between 0 and 1.',
        {
          ...context,
          confidence: confidenceValue,
        },
        { retryable: true }
      );
    }

    const isHighConfidence =
      typeof confidenceValue === 'number' && confidenceValue >= policy.highConfidenceThreshold;

    if (!policy.requireEvidenceForHighConfidence || !isHighConfidence) {
      return;
    }

    const evidenceMatch = this.findFirstEvidence(output, policy.evidencePaths);
    if (!evidenceMatch || evidenceMatch.count < policy.minEvidenceItems) {
      throw new OutputComplianceError(
        'MISSING_EVIDENCE',
        'High-confidence output must include supporting evidence.',
        {
          ...context,
          confidence: confidenceValue,
          evidencePath: evidenceMatch?.path,
          details: {
            highConfidenceThreshold: policy.highConfidenceThreshold,
            minEvidenceItems: policy.minEvidenceItems,
            actualEvidenceItems: evidenceMatch?.count ?? 0,
          },
        },
        { retryable: true }
      );
    }
  }

  private readFirstNumber(input: unknown, paths: ReadonlyArray<string>): number | undefined {
    for (const path of paths) {
      const value = this.getValueByPath(input, path);
      if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
      }
    }

    return undefined;
  }

  private findFirstEvidence(
    input: unknown,
    paths: ReadonlyArray<string>
  ): { path: string; count: number } | undefined {
    for (const path of paths) {
      const value = this.getValueByPath(input, path);
      const count = this.evidenceCount(value);
      if (count !== undefined) {
        return { path, count };
      }
    }

    return undefined;
  }

  private evidenceCount(value: unknown): number | undefined {
    if (Array.isArray(value)) {
      return value.length;
    }

    if (typeof value === 'string') {
      return value.trim().length > 0 ? 1 : 0;
    }

    if (value && typeof value === 'object') {
      return Object.keys(value).length;
    }

    return undefined;
  }

  private getValueByPath(input: unknown, path: string): unknown {
    if (!path) {
      return undefined;
    }

    const segments = path.split('.');
    let current: unknown = input;

    for (const segment of segments) {
      if (!current || typeof current !== 'object') {
        return undefined;
      }

      const container = current as Record<string, unknown>;
      if (!Object.prototype.hasOwnProperty.call(container, segment)) {
        return undefined;
      }
      // eslint-disable-next-line security/detect-object-injection -- segment traversal is constrained to configured policy paths.
      current = container[segment];
    }

    return current;
  }

  private resolvePolicy(policy?: OutputCompliancePolicy): Required<OutputCompliancePolicy> {
    return {
      highConfidenceThreshold: policy?.highConfidenceThreshold ?? DEFAULT_POLICY.highConfidenceThreshold,
      requireEvidenceForHighConfidence:
        policy?.requireEvidenceForHighConfidence ?? DEFAULT_POLICY.requireEvidenceForHighConfidence,
      confidencePaths: policy?.confidencePaths ?? DEFAULT_POLICY.confidencePaths,
      evidencePaths: policy?.evidencePaths ?? DEFAULT_POLICY.evidencePaths,
      minEvidenceItems: policy?.minEvidenceItems ?? DEFAULT_POLICY.minEvidenceItems,
    };
  }

  private formatZodIssues(error: ZodError<unknown>): ReadonlyArray<{
    path: string;
    message: string;
    code?: string;
  }> {
    return error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
    }));
  }
}

export const outputComplianceEngine = new OutputComplianceEngine();

export const outputComplianceErrorSchema = z.object({
  name: z.literal('OutputComplianceError'),
  code: z.enum([
    'EMPTY_OUTPUT',
    'NON_JSON_WRAPPER',
    'JSON_PARSE_FAILED',
    'SCHEMA_VALIDATION_FAILED',
    'BUSINESS_RULE_VIOLATION',
    'MISSING_EVIDENCE',
    'INVALID_CONFIDENCE_VALUE',
  ]),
  message: z.string(),
  retryable: z.boolean(),
  context: z
    .object({
      contractName: z.string().optional(),
      agentName: z.string().optional(),
      executionId: z.string().optional(),
      traceId: z.string().optional(),
      confidence: z.number().optional(),
      confidencePath: z.string().optional(),
      evidencePath: z.string().optional(),
      issues: z
        .array(
          z.object({
            path: z.string(),
            message: z.string(),
            code: z.string().optional(),
          })
        )
        .optional(),
      details: z.record(z.string(), z.unknown()).optional(),
    })
    .strict(),
});
