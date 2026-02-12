import type { LLMProvider } from "../lib/agent-fabric/llm-types";
import type { LLMGatingConfig } from "../lib/llm-gating/types";

// Use a local helper to avoid relying on global ImportMeta typings
const env = (import.meta as any)?.env ?? {};

// Together AI is the only supported provider
const provider: LLMProvider = "together";

const gatingEnabledEnv = env.VITE_LLM_GATING_ENABLED;
const gatingEnabled = gatingEnabledEnv === "false" ? false : true;

// ============================================================================
// LLM Gating Configuration (Based on Gated Attention Research)
// ============================================================================

/**
 * Comprehensive LLM Gating Configuration
 *
 * Applies findings from "Gated Attention for Large Language Models"
 * - Architectural Gating: MoE/sparse attention model selection
 * - Application Gating: Pre/post invocation security gates
 */
export const llmGatingConfig: LLMGatingConfig = {
  // Master switch
  enabled: gatingEnabled,

  // Cost Gate (R5: Wallet Draining mitigation)
  cost: {
    enabled: env.VITE_LLM_COST_GATE_ENABLED !== "false",
    warningThreshold: parseFloat(env.VITE_LLM_COST_WARNING_THRESHOLD || "70"),
    downgradeThreshold: parseFloat(
      env.VITE_LLM_COST_DOWNGRADE_THRESHOLD || "85"
    ),
    blockThreshold: parseFloat(env.VITE_LLM_COST_BLOCK_THRESHOLD || "95"),
    perRequestLimit: parseFloat(env.VITE_LLM_COST_PER_REQUEST_LIMIT || "1.0"),
    allowGracePeriod: env.VITE_LLM_ALLOW_GRACE_PERIOD !== "false",
  },

  // Compliance Gate (R2: Cross-Tenant Data Leakage mitigation)
  compliance: {
    enablePIIDetection: env.VITE_LLM_PII_DETECTION_ENABLED !== "false",
    blockingPIITypes: ["ssn", "credit_card", "api_key", "password"],
    allowRedactedPII: env.VITE_LLM_ALLOW_REDACTED_PII !== "false",
    enableManifestoRules: env.VITE_LLM_MANIFESTO_RULES_ENABLED !== "false",
    enableTenantIsolation: env.VITE_LLM_TENANT_ISOLATION_ENABLED !== "false",
  },

  // Confidence Gate (R4: LLM Hallucination mitigation)
  confidence: {
    minConfidenceScore: parseFloat(env.VITE_LLM_MIN_CONFIDENCE_SCORE || "0.6"),
    enableReflection: env.VITE_LLM_REFLECTION_ENABLED !== "false",
    maxReflectionAttempts: parseInt(
      env.VITE_LLM_MAX_REFLECTION_ATTEMPTS || "2",
      10
    ),
    enableKnowledgeFabricVerification:
      env.VITE_LLM_KNOWLEDGE_FABRIC_VERIFICATION !== "false",
  },

  // Hallucination Gate (R4: LLM Hallucination mitigation)
  hallucination: {
    enabled: env.VITE_LLM_HALLUCINATION_GATE_ENABLED !== "false",
    maxRiskScore: parseFloat(env.VITE_LLM_MAX_HALLUCINATION_RISK || "0.4"),
    enablePromptInjectionDetection:
      env.VITE_LLM_PROMPT_INJECTION_DETECTION !== "false",
    enableSystemOverrideDetection:
      env.VITE_LLM_SYSTEM_OVERRIDE_DETECTION !== "false",
    actionOnHallucination: (env.VITE_LLM_HALLUCINATION_ACTION || "block") as
      | "warn"
      | "block"
      | "retry",
  },

  // Model Selection (Architectural Gating from research paper)
  modelSelection: {
    // Prefer MoE models (like Mixtral) for complex multi-step reasoning
    preferMoEForComplexTasks: env.VITE_LLM_PREFER_MOE !== "false",
    // Prefer gated attention models for RAG (reduces attention sink issues)
    preferGatedAttentionForRAG:
      env.VITE_LLM_PREFER_GATED_ATTENTION_RAG !== "false",
    // Automatically downgrade to cheaper model on budget pressure
    enableAutomaticDowngrade: env.VITE_LLM_AUTO_DOWNGRADE !== "false",
  },
};

// ============================================================================
// Semantic Memory Configuration
// ============================================================================

/**
 * Similarity Thresholds for Vector Search
 *
 * Tuning Guide:
 * - Higher threshold (0.85+): Precise matches only, fewer false positives
 * - Medium threshold (0.65-0.85): Balanced precision/recall
 * - Lower threshold (0.50-0.65): Broad matches, more recall
 *
 * Recommendation: Start with 0.70 and adjust based on:
 * - False positive rate (too many irrelevant results → increase threshold)
 * - False negative rate (missing relevant results → decrease threshold)
 */
export interface SemanticSearchConfig {
  /** Minimum cosine similarity (0-1) to consider a match */
  defaultThreshold: number;
  /** Thresholds per memory type */
  typeThresholds: {
    value_proposition: number;
    target_definition: number;
    opportunity: number;
    integrity_check: number;
    workflow_result: number;
  };
  /** Maximum results to return */
  maxResults: number;
  /** Embedding model */
  embeddingModel: string;
  /** Embedding dimensions */
  embeddingDimension: number;
}

export const semanticMemoryConfig: SemanticSearchConfig = {
  // Default threshold for all searches
  defaultThreshold: parseFloat(env.VITE_SEMANTIC_THRESHOLD || "0.70"),

  // Memory type-specific thresholds
  typeThresholds: {
    // Value props need high precision (customer-facing)
    value_proposition: 0.75,

    // Target definitions are critical (financial)
    target_definition: 0.8,

    // Opportunities can be broader (discovery phase)
    opportunity: 0.65,

    // Integrity checks need exact matches
    integrity_check: 0.85,

    // Workflow results for learning
    workflow_result: 0.7,
  },

  maxResults: parseInt(env.VITE_SEMANTIC_MAX_RESULTS || "10", 10),

  // Together AI embedding model
  embeddingModel: "togethercomputer/m2-bert-80M-8k-retrieval",
  embeddingDimension: 768,
};

// ============================================================================
// Agent Confidence Thresholds
// ============================================================================

/**
 * Confidence thresholds for agent output validation
 *
 * Source: src/lib/agent-fabric/agents/BaseAgent.ts
 */
export interface ConfidenceThresholds {
  /** Minimum confidence for "medium" rating */
  medium: number;
  /** Minimum confidence for "high" rating */
  high: number;
  /** Minimum confidence to allow writes to database */
  writeThreshold: number;
}

export const agentConfidenceThresholds: ConfidenceThresholds = {
  // Medium confidence (proceed with warning)
  medium: parseFloat(env.VITE_AGENT_CONFIDENCE_MEDIUM || "0.70"),

  // High confidence (ideal)
  high: parseFloat(env.VITE_AGENT_CONFIDENCE_HIGH || "0.85"),

  // Minimum to allow DB writes (blocks low confidence)
  writeThreshold: parseFloat(env.VITE_AGENT_WRITE_THRESHOLD || "0.65"),
};

/**
 * Agent-specific confidence requirements
 *
 * Financial agents need higher confidence than discovery agents
 */
export const agentSpecificThresholds: Record<string, ConfidenceThresholds> = {
  // Critical financial agents
  target: {
    medium: 0.75,
    high: 0.9,
    writeThreshold: 0.7,
  },
  financial_modeling: {
    medium: 0.8,
    high: 0.92,
    writeThreshold: 0.75,
  },
  integrity: {
    medium: 0.85,
    high: 0.95,
    writeThreshold: 0.8,
  },

  // Discovery agents (more permissive)
  opportunity: {
    medium: 0.65,
    high: 0.8,
    writeThreshold: 0.6,
  },
  company_intelligence: {
    medium: 0.6,
    high: 0.75,
    writeThreshold: 0.55,
  },

  // Balanced agents
  expansion: {
    medium: 0.7,
    high: 0.85,
    writeThreshold: 0.65,
  },
  realization: {
    medium: 0.7,
    high: 0.85,
    writeThreshold: 0.65,
  },
  value_mapping: {
    medium: 0.7,
    high: 0.85,
    writeThreshold: 0.65,
  },
};

/**
 * Get confidence threshold for a specific agent
 */
export function getAgentConfidenceThreshold(
  agentName: string
): ConfidenceThresholds {
  return agentSpecificThresholds[agentName] || agentConfidenceThresholds;
}

// ============================================================================
// Hallucination Detection
// ============================================================================

/**
 * Configuration for hallucination detection
 *
 * Used in BaseAgent.secureInvoke() to validate LLM outputs
 */
export const hallucinationDetectionConfig = {
  /** Enable self-verification questions */
  enabled: env.VITE_HALLUCINATION_DETECTION_ENABLED !== "false",

  /** Number of verification questions to ask */
  verificationQuestions: parseInt(
    env.VITE_HALLUCINATION_VERIFICATION_COUNT || "3",
    10
  ),

  /** Minimum consistency score (0-1) */
  consistencyThreshold: parseFloat(
    env.VITE_HALLUCINATION_CONSISTENCY_THRESHOLD || "0.80"
  ),

  /** Verification prompt template */
  verificationPrompt: (claim: string, context: string) => `
    Given the following context:
    ${context}

    Verify the accuracy of this claim:
    ${claim}

    Is this claim supported by the context? Answer with:
    - "VERIFIED" if fully supported
    - "PARTIAL" if partially supported
    - "UNSUPPORTED" if not supported
  `,
};

// ============================================================================
// Performance Optimization
// ============================================================================

/**
 * Caching and performance settings
 */
export const performanceConfig = {
  /** Cache semantic search results (seconds) */
  searchCacheTTL: parseInt(env.VITE_SEMANTIC_CACHE_TTL || "300", 10), // 5 minutes

  /** Enable query result memoization */
  enableMemoization: env.VITE_ENABLE_MEMOIZATION !== "false",

  /** Batch size for bulk embedding generation */
  embeddingBatchSize: parseInt(env.VITE_EMBEDDING_BATCH_SIZE || "10", 10),

  /** Timeout for LLM calls (ms) */
  llmTimeout: parseInt(env.VITE_LLM_TIMEOUT || "30000", 10), // 30 seconds
};

// ============================================================================
// Exports
// ============================================================================

export const llmConfig = {
  provider,
  gatingEnabled,
  gating: llmGatingConfig,
  semanticMemory: semanticMemoryConfig,
  confidence: agentConfidenceThresholds,
  hallucinationDetection: hallucinationDetectionConfig,
  performance: performanceConfig,
};

/**
 * Get semantic threshold for a specific memory type
 */
export function getSemanticThreshold(
  memoryType: keyof SemanticSearchConfig["typeThresholds"]
): number {
  return (
    semanticMemoryConfig.typeThresholds[memoryType] ||
    semanticMemoryConfig.defaultThreshold
  );
}

/**
 * Validate similarity score meets threshold
 */
export function meetsThreshold(
  similarity: number,
  memoryType?: keyof SemanticSearchConfig["typeThresholds"]
): boolean {
  const threshold = memoryType
    ? getSemanticThreshold(memoryType)
    : semanticMemoryConfig.defaultThreshold;
  return similarity >= threshold;
}

/**
 * Calculate adjusted threshold based on context
 *
 * Use for dynamic threshold adjustment based on:
 * - Query specificity (more specific = higher threshold)
 * - Result count (fewer results = lower threshold to ensure recall)
 * - User preference (power users may want precision)
 */
export function calculateAdjustedThreshold(
  baseThreshold: number,
  options: {
    querySpecificity?: "low" | "medium" | "high";
    resultCount?: number;
    userPreference?: "precision" | "balanced" | "recall";
  }
): number {
  let adjusted = baseThreshold;

  // Adjust for query specificity
  if (options.querySpecificity === "high") {
    adjusted += 0.05; // More precise query = higher threshold
  } else if (options.querySpecificity === "low") {
    adjusted -= 0.05; // Broader query = lower threshold
  }

  // Adjust for result count
  if (options.resultCount !== undefined && options.resultCount < 3) {
    adjusted = Math.max(0.5, adjusted - 0.1); // Ensure some results
  }

  // Adjust for user preference
  if (options.userPreference === "precision") {
    adjusted += 0.1;
  } else if (options.userPreference === "recall") {
    adjusted -= 0.1;
  }

  // Clamp to valid range
  return Math.max(0.3, Math.min(0.95, adjusted));
}
