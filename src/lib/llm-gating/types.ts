/**
 * LLM Gating Types
 *
 * Type definitions for the comprehensive LLM gating system based on
 * "Gated Attention for Large Language Models" research findings.
 *
 * Two gating dimensions:
 * 1. Architectural Gating: Model selection based on MoE/sparse attention capabilities
 * 2. Application Gating: Pre/post invocation gates for cost, compliance, and safety
 */

// ============================================================================
// Model Architecture Traits
// ============================================================================

/**
 * Model architecture characteristics relevant for gating decisions
 */
export interface ModelArchitectureTraits {
  /** Model uses Mixture-of-Experts (MoE) architecture */
  hasMoE: boolean;
  /** Model uses gated attention mechanism */
  hasGatedAttention: boolean;
  /** Model uses sparse attention (reduced computation per token) */
  hasSparseAttention: boolean;
  /** Maximum effective context window (considers attention sink issues) */
  effectiveContextLength: number;
  /** Relative cost tier: 0=free, 1=low, 2=medium, 3=high, 4=premium */
  costTier: 0 | 1 | 2 | 3 | 4;
  /** Recommended for RAG/long-document processing */
  recommendedForRAG: boolean;
  /** Recommended for fine-tuning stability */
  recommendedForFineTuning: boolean;
}

/**
 * Model selection preference based on task requirements
 */
export interface ModelSelectionCriteria {
  /** Task requires long context handling (>4k tokens) */
  requiresLongContext: boolean;
  /** Task involves RAG/document retrieval */
  isRAGTask: boolean;
  /** Task is latency-sensitive */
  latencySensitive: boolean;
  /** Maximum acceptable cost tier */
  maxCostTier: number;
  /** Minimum required context length */
  minContextLength?: number;
}

// ============================================================================
// Gate Results
// ============================================================================

/**
 * Result of a gate check
 */
export interface GateResult {
  /** Whether the gate allows the operation to proceed */
  allowed: boolean;
  /** Gate identifier */
  gateId: string;
  /** Human-readable reason for the decision */
  reason: string;
  /** Severity of the gate decision */
  severity: 'info' | 'warning' | 'error' | 'critical';
  /** Suggested action if gate is tripped */
  suggestedAction?: GateSuggestedAction;
  /** Additional metadata for logging/audit */
  metadata?: Record<string, unknown>;
}

/**
 * Suggested action when a gate is tripped
 */
export interface GateSuggestedAction {
  type: 'fallback' | 'retry' | 'block' | 'downgrade' | 'queue' | 'manual_review';
  /** For fallback/downgrade: alternative model to use */
  alternativeModel?: string;
  /** For retry: delay in milliseconds */
  retryDelayMs?: number;
  /** For queue: priority level */
  queuePriority?: number;
  /** Message to include in audit log */
  auditMessage?: string;
}

/**
 * Combined result of all pre-invocation gates
 */
export interface PreInvocationGateResult {
  /** Whether all gates allow the invocation */
  allowed: boolean;
  /** Individual gate results */
  gates: GateResult[];
  /** Model to use (may be downgraded from original request) */
  selectedModel: string;
  /** Whether original model was changed */
  modelDowngraded: boolean;
  /** Total time spent in gate checks (ms) */
  gateCheckDurationMs: number;
}

/**
 * Combined result of all post-invocation gates
 */
export interface PostInvocationGateResult {
  /** Whether all gates allow the output */
  allowed: boolean;
  /** Individual gate results */
  gates: GateResult[];
  /** Sanitized/modified output (if gates applied transformations) */
  processedOutput?: string;
  /** Whether output was modified by gates */
  outputModified: boolean;
  /** Confidence adjustment factor (0-1, where 1 = no adjustment) */
  confidenceMultiplier: number;
}

// ============================================================================
// Gate Contexts
// ============================================================================

/**
 * Context for pre-invocation gate checks
 */
export interface PreInvocationContext {
  /** Organization/tenant ID */
  organizationId: string;
  /** User ID */
  userId: string;
  /** Session ID */
  sessionId?: string;
  /** Requested model */
  requestedModel: string;
  /** Estimated input tokens */
  estimatedInputTokens: number;
  /** Estimated output tokens */
  estimatedOutputTokens: number;
  /** The input/prompt content (for compliance checks) */
  inputContent: string;
  /** Task type hint for model selection */
  taskType?: string;
  /** Whether this is a RAG-based request */
  isRAG?: boolean;
  /** Agent making the request */
  agentId?: string;
  /** Request trace ID for observability */
  traceId?: string;
}

/**
 * Context for post-invocation gate checks
 */
export interface PostInvocationContext {
  /** Pre-invocation context */
  preContext: PreInvocationContext;
  /** Raw LLM output */
  rawOutput: string;
  /** Tokens actually used (input) */
  actualInputTokens: number;
  /** Tokens actually used (output) */
  actualOutputTokens: number;
  /** Response latency (ms) */
  latencyMs: number;
  /** Model that was actually used */
  modelUsed: string;
  /** LLM-reported confidence (if available) */
  reportedConfidence?: number;
}

// ============================================================================
// Cost Gate Types
// ============================================================================

/**
 * Cost budget status for a tenant
 */
export interface TenantBudgetStatus {
  /** Organization ID */
  organizationId: string;
  /** Current billing period */
  period: {
    start: Date;
    end: Date;
  };
  /** Budget limit for period (USD) */
  budgetLimit: number;
  /** Amount used so far (USD) */
  usedAmount: number;
  /** Remaining budget (USD) */
  remainingBudget: number;
  /** Usage percentage (0-100) */
  usagePercentage: number;
  /** Whether in grace period */
  inGracePeriod: boolean;
  /** Grace period remaining (hours), if applicable */
  gracePeriodRemainingHours?: number;
  /** Hard limit (cannot exceed even with grace) */
  hardLimit: number;
}

/**
 * Cost gate configuration
 */
export interface CostGateConfig {
  /** Enable cost-based gating */
  enabled: boolean;
  /** Warning threshold (percentage of budget) */
  warningThreshold: number;
  /** Downgrade threshold (percentage, triggers model downgrade) */
  downgradeThreshold: number;
  /** Block threshold (percentage, blocks non-essential requests) */
  blockThreshold: number;
  /** Per-request cost limit (USD) */
  perRequestLimit: number;
  /** Allow grace period usage */
  allowGracePeriod: boolean;
}

// ============================================================================
// Compliance Gate Types
// ============================================================================

/**
 * PII detection result
 */
export interface PIIDetectionResult {
  /** Whether PII was detected */
  hasPII: boolean;
  /** Types of PII found */
  piiTypes: PIIType[];
  /** Locations of PII in input */
  locations: PIILocation[];
  /** Whether PII is properly redacted */
  isRedacted: boolean;
}

/**
 * Types of PII that can be detected
 */
export type PIIType =
  | 'email'
  | 'phone'
  | 'ssn'
  | 'credit_card'
  | 'address'
  | 'name'
  | 'date_of_birth'
  | 'ip_address'
  | 'api_key'
  | 'password'
  | 'other';

/**
 * Location of detected PII
 */
export interface PIILocation {
  type: PIIType;
  startIndex: number;
  endIndex: number;
  maskedValue?: string;
}

/**
 * Compliance gate configuration
 */
export interface ComplianceGateConfig {
  /** Enable PII detection gate */
  enablePIIDetection: boolean;
  /** PII types that trigger blocking (vs warning) */
  blockingPIITypes: PIIType[];
  /** Allow requests with properly redacted PII */
  allowRedactedPII: boolean;
  /** Enable manifesto rule checking */
  enableManifestoRules: boolean;
  /** Cross-tenant data isolation verification */
  enableTenantIsolation: boolean;
}

// ============================================================================
// Confidence/Integrity Gate Types
// ============================================================================

/**
 * Integrity check result
 */
export interface IntegrityCheckResult {
  /** Overall integrity score (0-1) */
  score: number;
  /** Whether output passed integrity checks */
  passed: boolean;
  /** Individual check results */
  checks: {
    /** Check name */
    name: string;
    /** Check passed */
    passed: boolean;
    /** Score for this check (0-1) */
    score: number;
    /** Details/reason */
    details: string;
  }[];
  /** Whether knowledge fabric verification was performed */
  knowledgeFabricVerified: boolean;
}

/**
 * Confidence gate configuration
 */
export interface ConfidenceGateConfig {
  /** Minimum confidence score to accept output (0-1) */
  minConfidenceScore: number;
  /** Enable reflection loop on low confidence */
  enableReflection: boolean;
  /** Maximum reflection attempts */
  maxReflectionAttempts: number;
  /** Enable knowledge fabric verification */
  enableKnowledgeFabricVerification: boolean;
}

// ============================================================================
// Hallucination Gate Types
// ============================================================================

/**
 * Hallucination detection result
 */
export interface HallucinationDetectionResult {
  /** Whether potential hallucination was detected */
  hasHallucination: boolean;
  /** Hallucination risk score (0-1, higher = more likely) */
  riskScore: number;
  /** Types of hallucination indicators found */
  indicators: HallucinationIndicator[];
  /** Whether prompt injection was detected */
  hasPromptInjection: boolean;
  /** System override attempt detected */
  hasSystemOverride: boolean;
}

/**
 * Types of hallucination indicators
 */
export interface HallucinationIndicator {
  type:
    | 'factual_inconsistency'
    | 'temporal_error'
    | 'entity_confusion'
    | 'source_fabrication'
    | 'logical_contradiction'
    | 'prompt_injection'
    | 'system_override';
  confidence: number;
  description: string;
  location?: { start: number; end: number };
}

/**
 * Hallucination gate configuration
 */
export interface HallucinationGateConfig {
  /** Enable hallucination detection */
  enabled: boolean;
  /** Maximum acceptable hallucination risk score */
  maxRiskScore: number;
  /** Enable prompt injection detection */
  enablePromptInjectionDetection: boolean;
  /** Enable system override detection */
  enableSystemOverrideDetection: boolean;
  /** Action on confirmed hallucination */
  actionOnHallucination: 'warn' | 'block' | 'retry';
}

// ============================================================================
// Master Gating Configuration
// ============================================================================

/**
 * Master LLM gating configuration
 */
export interface LLMGatingConfig {
  /** Master switch for all gating */
  enabled: boolean;
  /** Cost gate configuration */
  cost: CostGateConfig;
  /** Compliance gate configuration */
  compliance: ComplianceGateConfig;
  /** Confidence gate configuration */
  confidence: ConfidenceGateConfig;
  /** Hallucination gate configuration */
  hallucination: HallucinationGateConfig;
  /** Model selection preferences */
  modelSelection: {
    /** Prefer MoE models for complex tasks */
    preferMoEForComplexTasks: boolean;
    /** Prefer gated attention models for RAG */
    preferGatedAttentionForRAG: boolean;
    /** Automatic model downgrade on budget pressure */
    enableAutomaticDowngrade: boolean;
  };
}

/**
 * Default gating configuration
 */
export const DEFAULT_GATING_CONFIG: LLMGatingConfig = {
  enabled: true,
  cost: {
    enabled: true,
    warningThreshold: 70,
    downgradeThreshold: 85,
    blockThreshold: 95,
    perRequestLimit: 1.0,
    allowGracePeriod: true,
  },
  compliance: {
    enablePIIDetection: true,
    blockingPIITypes: ['ssn', 'credit_card', 'api_key', 'password'],
    allowRedactedPII: true,
    enableManifestoRules: true,
    enableTenantIsolation: true,
  },
  confidence: {
    minConfidenceScore: 0.6,
    enableReflection: true,
    maxReflectionAttempts: 2,
    enableKnowledgeFabricVerification: true,
  },
  hallucination: {
    enabled: true,
    maxRiskScore: 0.4,
    enablePromptInjectionDetection: true,
    enableSystemOverrideDetection: true,
    actionOnHallucination: 'block',
  },
  modelSelection: {
    preferMoEForComplexTasks: true,
    preferGatedAttentionForRAG: true,
    enableAutomaticDowngrade: true,
  },
};

// ============================================================================
// Gate Interface
// ============================================================================

/**
 * Interface for individual gates
 */
export interface ILLMGate<TContext, TResult extends GateResult> {
  /** Unique gate identifier */
  readonly id: string;
  /** Gate name for display */
  readonly name: string;
  /** Check the gate */
  check(context: TContext): Promise<TResult>;
  /** Whether the gate is enabled */
  isEnabled(): boolean;
}

/**
 * Pre-invocation gate interface
 */
export type IPreInvocationGate = ILLMGate<PreInvocationContext, GateResult>;

/**
 * Post-invocation gate interface
 */
export type IPostInvocationGate = ILLMGate<PostInvocationContext, GateResult>;

// ============================================================================
// Policy Violation Error
// ============================================================================

/**
 * Error thrown when a policy violation is detected
 */
export class PolicyViolationError extends Error {
  public readonly violations: GateResult[];
  public readonly gateId: string;
  public readonly severity: 'warning' | 'error' | 'critical';

  constructor(
    message: string,
    violations: GateResult[],
    gateId: string,
    severity: 'warning' | 'error' | 'critical' = 'error'
  ) {
    super(message);
    this.name = 'PolicyViolationError';
    this.violations = violations;
    this.gateId = gateId;
    this.severity = severity;
  }
}
