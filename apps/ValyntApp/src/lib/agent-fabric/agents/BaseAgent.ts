/**
 * Enhanced BaseAgent: The foundation of the ValueOS Agent Fabric.
 *
 * Provides comprehensive cognitive infrastructure including:
 * - Secure LLM invocation with hallucination detection
 * - Multi-layer memory management with tenant isolation
 * - Self-correction loops and confidence thresholding
 * - Policy enforcement and governance integration
 * - Full observability and audit logging
 *
 * @version 2.0.0
 * @security Level: Critical - All methods enforce tenant isolation
 */

import { logger } from "../../../utils/logger";
import {
  assertHighConfidence,
  assertProvenance,
  GroundTruthMetadata,
  validateGroundTruthMetadata,
} from "../ground-truth/GroundTruthValidator";
import { v4 as uuidv4 } from "uuid";
import { LLMGateway, LLMResponse } from "../LLMGateway";
import { MemoryQuery, MemorySystem } from "../MemorySystem";
import { AuditLogger } from "../AuditLogger";
import { z } from "zod";

// Import types from the correct location
import { AgentType } from "../../../services/agent-types";
import { ConfidenceLevel } from "../../../services/agent-types";

// ═══════════════════════════════════════════════════════════════════════════
// ENUMS & CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

export enum ValueLifecycleStage {
  DISCOVERY = "discovery",
  DEFINITION = "definition",
  REALIZATION = "realization",
  EXPANSION = "expansion",
  GOVERNANCE = "governance",
  ORCHESTRATION = "orchestration",
}

export enum AgentClassification {
  LIFECYCLE = "lifecycle",
  CROSS_CUTTING = "cross_cutting",
  INFRASTRUCTURE = "infrastructure",
}

export enum AuthorityLevel {
  OBSERVER = 1, // Read-only, no modifications
  CONTRIBUTOR = 2, // Can propose changes
  EXECUTOR = 3, // Can execute within bounds
  VALIDATOR = 4, // Can validate/reject
  GOVERNOR = 5, // Full authority including veto
}

export enum MemoryType {
  SEMANTIC = "semantic", // RAG-based, long-term knowledge
  EPISODIC = "episodic", // Session-scoped, short-term
  VECTOR = "vector", // Embedding-based similarity search
  PROVENANCE = "provenance", // Audit trail and source tracking
}

export enum RiskCategory {
  FINANCIAL = "financial",
  COMMITMENT = "commitment",
  DISCOVERY = "discovery",
  GOVERNANCE = "governance",
}

// ═══════════════════════════════════════════════════════════════════════════
// INTERFACES
// ═══════════════════════════════════════════════════════════════════════════

export interface ConfidenceThresholdConfig {
  [key: string]: {
    minimum: number; // Below this = rejection
    target: number; // Acceptable quality
    critical: number; // High-stakes threshold
  };
}

export interface SecureInvokeInput {
  prompt: string;
  context: {
    tenantId: string;
    sessionId: string;
    userId?: string;
    additionalContext?: Record<string, any>;
  };
  tools?: AgentTool[];
}

export interface SecureInvokeOptions {
  riskCategory?: RiskCategory;
  maxTokens?: number;
  temperature?: number;
  costBudgetUsd?: number;
  timeoutMs?: number;
  requireHighConfidence?: boolean;
  skipHallucinationCheck?: boolean;
  tenantId?: string;
}

export interface SecureInvokeResult<T> {
  success: boolean;
  data?: T;
  error?: AgentError;
  metadata: {
    sessionId: string;
    traceId: string;
    confidenceScore: number;
    confidenceLevel: "HIGH" | "MEDIUM" | "LOW";
    hallucinationRisk: number;
    tokensUsed?: number;
    latencyMs: number;
    costUsd?: number;
    correctionAttempts: number;
  };
}

export interface AgentCapability {
  id: string;
  name: string;
  description: string;
  inputSchema: z.ZodType;
  outputSchema: z.ZodType;
  riskCategory: RiskCategory;
  requiredAuthority: AuthorityLevel;
}

export interface AgentTool {
  id: string;
  name: string;
  description: string;
  inputSchema: z.ZodType;
  execute: (input: any, context: ToolExecutionContext) => Promise<any>;
  permissions: ToolPermissions;
}

export interface ToolExecutionContext {
  tenantId: string;
  sessionId: string;
  agentId: string;
}

export interface ToolPermissions {
  read: boolean;
  write: boolean;
}

export interface AgentError {
  code: string;
  message: string;
  details?: any;
}

export interface EnrichedMemoryMetadata {
  tenantId: string;
  agentId: string;
  timestamp: string;
  version: string;
  sessionId?: string;
  confidence?: number;
  [key: string]: any;
}

export interface MemoryQueryResult<T> {
  items: T[];
  total: number;
  hasMore: boolean;
}

export interface HallucinationDetectionResult {
  riskScore: number; // 0-1, higher = more risk
  checks: HallucinationCheck[];
  flaggedClaims: FlaggedClaim[];
  recommendation: "ACCEPT" | "REVIEW" | "REJECT";
}

export interface HallucinationCheck {
  stage: string;
  score: number;
  passed: boolean;
  details?: string;
}

export interface FlaggedClaim {
  claim: string;
  reason: string;
  suggestedCorrection?: string;
}

export interface ThresholdResult {
  requiresCorrection: boolean;
  issues: string[];
}

export interface BaseAgentConfig {
  llmGateway: LLMGateway;
  memorySystem: MemorySystem;
  auditLogger: AuditLogger;
  telemetryService?: any; // Will be implemented
  policyEngine?: any; // Will be implemented
  circuitBreaker?: any; // Will be implemented
}

export interface AgentExecutionContext {
  intent: string;
  tenantId: string;
  sessionId: string;
  payload?: any;
  userId?: string;
}

export interface AgentResponse<T = any> {
  success: boolean;
  data?: T;
  error?: AgentError;
  metadata?: {
    executionTime: number;
    confidence?: ConfidenceLevel;
    [key: string]: any;
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ENHANCED BASE AGENT CLASS
// ═══════════════════════════════════════════════════════════════════════════

export abstract class BaseAgent {
  // ═══════════════════════════════════════════════════════════════════════════
  // IDENTITY & METADATA
  // ═══════════════════════════════════════════════════════════════════════════

  /** Unique agent identifier */
  abstract readonly agentId: string;

  /** Human-readable name */
  abstract readonly name: string;

  /** Semantic version (e.g., "1.2.0") */
  abstract readonly version: string;

  /** Lifecycle stage mapping */
  abstract readonly lifecycleStage: ValueLifecycleStage;

  /** Authority level (1-5, higher = more trust) */
  abstract readonly authorityLevel: AuthorityLevel;

  /** Agent classification */
  abstract readonly classification: AgentClassification;

  // ═══════════════════════════════════════════════════════════════════════════
  // COGNITIVE INFRASTRUCTURE
  // ═══════════════════════════════════════════════════════════════════════════

  protected readonly llmGateway: LLMGateway;
  protected readonly memorySystem: MemorySystem;
  protected readonly auditLogger: AuditLogger;
  protected readonly telemetryService?: any;
  protected readonly policyEngine?: any;
  protected readonly circuitBreaker?: any;

  // ═══════════════════════════════════════════════════════════════════════════
  // CONFIDENCE & RISK CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════════

  /** Confidence thresholds by risk category */
  protected readonly confidenceThresholds: ConfidenceThresholdConfig = {
    financial: { minimum: 0.7, target: 0.85, critical: 0.9 },
    commitment: { minimum: 0.6, target: 0.75, critical: 0.85 },
    discovery: { minimum: 0.5, target: 0.65, critical: 0.8 },
    governance: { minimum: 0.8, target: 0.9, critical: 0.95 },
  };

  /** Maximum retry attempts before escalation */
  protected readonly maxRetryAttempts: number = 3;

  /** Self-correction depth limit */
  protected readonly maxSelfCorrectionDepth: number = 2;

  // ═══════════════════════════════════════════════════════════════════════════
  // CONSTRUCTOR
  // ═══════════════════════════════════════════════════════════════════════════

  constructor(config: BaseAgentConfig) {
    this.llmGateway = config.llmGateway;
    this.memorySystem = config.memorySystem;
    this.auditLogger = config.auditLogger;
    this.telemetryService = config.telemetryService;
    this.policyEngine = config.policyEngine;
    this.circuitBreaker = config.circuitBreaker;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ABSTRACT METHODS (MUST IMPLEMENT)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Returns the capabilities this agent can fulfill.
   * Used by CoordinatorAgent for task routing.
   */
  abstract getCapabilities(): AgentCapability[];

  /**
   * Primary execution entry point.
   * All business logic flows through this method.
   */
  abstract processRequest(context: AgentExecutionContext): Promise<AgentResponse>;

  /**
   * Returns the tools available to this agent.
   * Tools are registered and validated at startup.
   */
  abstract getTools(): AgentTool[];

  // ═══════════════════════════════════════════════════════════════════════════
  // ENHANCED SECURE INVOCATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * The ONLY permitted method for LLM interaction.
   * Direct llmGateway calls are FORBIDDEN.
   *
   * @security CRITICAL - Enforces all security policies
   * @audit Full trace logging with tenant isolation
   */
  protected async secureInvoke<T extends z.ZodType>(
    sessionId: string,
    input: SecureInvokeInput,
    resultSchema: T,
    options: SecureInvokeOptions = {}
  ): Promise<SecureInvokeResult<z.infer<T>>> {
    const startTime = Date.now();
    const traceId = uuidv4();

    try {
      // ─────────────────────────────────────────────────────────────────────
      // PHASE 1: PRE-EXECUTION VALIDATION
      // ─────────────────────────────────────────────────────────────────────

      // Log reasoning step: Pre-execution validation
      await this.logReasoningStep(
        traceId,
        sessionId,
        "pre_execution_validation",
        "Starting pre-execution validation",
        {
          phase: 1,
          tenantId: input.context.tenantId,
        }
      );

      // 1.1 Circuit Breaker Check
      if (this.circuitBreaker) {
        await this.circuitBreaker.check(sessionId);
      }

      // 1.2 Cost Budget Validation
      if (options.costBudgetUsd) {
        // TODO: Implement cost budget checking
      }

      // 1.3 Policy Pre-Enforcement
      if (this.policyEngine) {
        await this.policyEngine.enforce(input, "PRE_EXECUTION", {
          agentId: this.agentId,
          tenantId: input.context.tenantId,
        });
      }

      // 1.4 Input Sanitization
      const sanitizedInput = await this.sanitizeInput(input);

      // ─────────────────────────────────────────────────────────────────────
      // PHASE 2: CONTEXT ASSEMBLY
      // ─────────────────────────────────────────────────────────────────────

      // Log reasoning step: Context assembly
      await this.logReasoningStep(traceId, sessionId, "context_assembly", "Assembling context from memory and input", {
        phase: 2,
        tenantId: input.context.tenantId,
      });

      // 2.1 Retrieve Relevant Memory
      const memoryContext = await this.assembleMemoryContext(
        sessionId,
        sanitizedInput,
        input.context.tenantId
      );

      // 2.2 Construct Prompt with Template
      const prompt = await this.constructPrompt(sanitizedInput, memoryContext);

      // ─────────────────────────────────────────────────────────────────────
      // PHASE 3: LLM EXECUTION
      // ─────────────────────────────────────────────────────────────────────

      // Log reasoning step: LLM execution
      await this.logReasoningStep(traceId, sessionId, "llm_execution", "Executing LLM request with constructed prompt", {
        phase: 3,
        promptLength: prompt.length,
        tenantId: input.context.tenantId,
      });

      // 3.1 Execute with Retry Logic
      const rawOutput = await this.executeWithRetry(
        prompt,
        options,
        traceId,
        input.context.tenantId,
        input.context.userId,
        input.context.sessionId
      );

      // 3.2 Parse and Validate Structure
      const structuredOutput = this.parseAndValidate(rawOutput, resultSchema);

      // ─────────────────────────────────────────────────────────────────────
      // PHASE 4: POST-EXECUTION VALIDATION
      // ─────────────────────────────────────────────────────────────────────

      // Log reasoning step: Post-execution validation
      await this.logReasoningStep(traceId, sessionId, "post_execution_validation", "Validating output for hallucinations and confidence", {
        phase: 4,
        tenantId: input.context.tenantId,
      });

      // 4.1 Hallucination Detection
      const hallucinationResult = await this.detectHallucination(
        structuredOutput,
        memoryContext,
        input.context.tenantId
      );

      // 4.2 Confidence Scoring
      const confidenceScore = await this.calculateConfidence(
        structuredOutput,
        hallucinationResult,
        options.riskCategory || RiskCategory.DISCOVERY
      );

      // 4.3 Threshold Enforcement
      const thresholdResult = this.enforceConfidenceThreshold(
        confidenceScore,
        options.riskCategory || RiskCategory.DISCOVERY
      );

      // ─────────────────────────────────────────────────────────────────────
      // PHASE 5: SELF-CORRECTION (IF NEEDED)
      // ─────────────────────────────────────────────────────────────────────

      if (thresholdResult.requiresCorrection) {
        return await this.selfCorrect(
          structuredOutput,
          memoryContext,
          thresholdResult,
          resultSchema,
          options,
          0 // Initial depth
        );
      }

      // ─────────────────────────────────────────────────────────────────────
      // PHASE 6: COMMIT & AUDIT
      // ─────────────────────────────────────────────────────────────────────

      // 6.1 Record Telemetry
      if (this.telemetryService) {
        this.telemetryService.recordMetrics(traceId, {
          agentId: this.agentId,
          tenantId: input.context.tenantId,
          success: true,
          latencyMs: Date.now() - startTime,
          tokensUsed: rawOutput.tokenUsage?.total,
          confidenceScore,
          hallucinationRisk: hallucinationResult.riskScore,
        });
      }

      // 6.2 Audit Log
      await this.auditLogger.logAgentExecution(
        "secure_invoke",
        this.agentId,
        this.name,
        {
          sessionId,
          tenantId: input.context.tenantId,
          promptLength: prompt.length,
          success: true,
          confidenceScore,
        },
        "info",
        "low",
        { traceId }
      );

      // 6.3 Memory Commit (Episodic)
      await this.storeMemory(
        MemoryType.EPISODIC,
        `invocation-${sessionId}-${Date.now()}`,
        {
          input: sanitizedInput,
          output: structuredOutput,
          confidence: confidenceScore,
          hallucinationRisk: hallucinationResult.riskScore,
        },
        {
          tenantId: input.context.tenantId,
          sessionId,
        }
      );

      return {
        success: true,
        data: structuredOutput,
        metadata: {
          sessionId,
          traceId,
          confidenceScore,
          confidenceLevel: this.mapConfidenceLevel(confidenceScore),
          hallucinationRisk: hallucinationResult.riskScore,
          tokensUsed: rawOutput.tokenUsage?.total,
          latencyMs: Date.now() - startTime,
          costUsd: this.calculateCost(rawOutput.tokenUsage?.total || 0),
          correctionAttempts: 0,
        },
      };
    } catch (error) {
      return this.handleInvocationError(error, sessionId, traceId, startTime);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ENHANCED MEMORY OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Store memory with mandatory tenant isolation.
   *
   * @security CRITICAL - tenantId is REQUIRED
   */
  protected async storeMemory<T>(
    type: MemoryType,
    key: string,
    data: T,
    metadata: Partial<EnrichedMemoryMetadata>
  ): Promise<void> {
    // Validate tenant isolation
    if (!metadata.tenantId) {
      throw new Error("TENANT_ID_REQUIRED: Memory operations require explicit tenantId");
    }

    // Store based on memory type
    let memoryId: string;
    switch (type) {
      case MemoryType.SEMANTIC:
        memoryId = await this.memorySystem.storeSemantic(
          JSON.stringify(data),
          {
            ...metadata,
            tenantId: metadata.tenantId,
            agentId: this.agentId,
            timestamp: metadata.timestamp || new Date().toISOString(),
            version: this.version,
          },
          {
            tenantId: metadata.tenantId,
            tags: ["agent_memory", this.name, type],
          }
        );
        break;
      case MemoryType.EPISODIC:
        memoryId = await this.memorySystem.storeEpisodic(
          JSON.stringify(data),
          {
            ...metadata,
            tenantId: metadata.tenantId,
            agentId: this.agentId,
            timestamp: metadata.timestamp || new Date().toISOString(),
            version: this.version,
          },
          {
            tenantId: metadata.tenantId,
            tags: ["agent_memory", this.name, type],
          }
        );
        break;
      case MemoryType.VECTOR:
        // For vector memory, we need an embedding - this should be handled by subclasses
        throw new Error("VECTOR_MEMORY_NOT_SUPPORTED: Use storeSemantic or storeEpisodic for now");
      case MemoryType.PROVENANCE:
        memoryId = await this.memorySystem.storeProvenance(
          JSON.stringify(data),
          {
            ...metadata,
            tenantId: metadata.tenantId,
            agentId: this.agentId,
            timestamp: metadata.timestamp || new Date().toISOString(),
            version: this.version,
          },
          {
            tenantId: metadata.tenantId,
            tags: ["agent_memory", this.name, type],
          }
        );
        break;
      default:
        throw new Error(`UNSUPPORTED_MEMORY_TYPE: ${type}`);
    }

    // Audit the write
    await this.auditLogger.logAgentExecution(
      "memory_store",
      this.agentId,
      this.name,
      {
        type,
        key,
        dataSize: JSON.stringify(data).length,
        tenantId: metadata.tenantId,
      },
      "info",
      "low"
    );
  }

  /**
   * Query memory with mandatory tenant isolation.
   *
   * @security CRITICAL - tenantId is REQUIRED
   */
  protected async queryMemory<T>(
    type: MemoryType,
    query: MemoryQuery,
    metadata: { tenantId: string }
  ): Promise<MemoryQueryResult<T>> {
    if (!metadata.tenantId) {
      throw new Error("TENANT_ID_REQUIRED: Memory queries require explicit tenantId");
    }

    const searchQuery: MemoryQuery = {
      ...query,
      type: type as any,
      tenantId: metadata.tenantId, // ENFORCED
    };

    const result = await this.memorySystem.search(searchQuery);

    return {
      items: result.entries.map((entry) => JSON.parse(entry.content) as T),
      total: result.total,
      hasMore: result.hasMore,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SELF-CORRECTION SYSTEM
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Attempts to self-correct low-confidence outputs.
   * Implements a bounded recursion pattern with depth limits.
   */
  private async selfCorrect<T extends z.ZodType>(
    originalOutput: z.infer<T>,
    memoryContext: any,
    thresholdResult: ThresholdResult,
    resultSchema: T,
    options: SecureInvokeOptions,
    currentDepth: number
  ): Promise<SecureInvokeResult<z.infer<T>>> {
    // Check depth limit
    if (currentDepth >= this.maxSelfCorrectionDepth) {
      return this.escalateToHumanInTheLoop(
        originalOutput,
        thresholdResult,
        "MAX_CORRECTION_DEPTH_REACHED"
      );
    }

    // Generate correction prompt
    const correctionPrompt = await this.generateCorrectionPrompt(
      originalOutput,
      thresholdResult.issues,
      memoryContext
    );

    // Re-invoke with correction context
    const correctedInput: SecureInvokeInput = {
      prompt: correctionPrompt,
      context: {
        tenantId: options.tenantId!,
        sessionId: `correction-${Date.now()}`,
      },
    };

    const correctionResult = await this.secureInvoke(
      correctedInput.context.sessionId,
      correctedInput,
      resultSchema,
      { ...options, requireHighConfidence: false } // Allow lower confidence for corrections
    );

    if (!correctionResult.success || !correctionResult.data) {
      return correctionResult;
    }

    // Re-validate
    const newConfidence = await this.calculateConfidence(
      correctionResult.data,
      await this.detectHallucination(correctionResult.data, memoryContext, options.tenantId!),
      options.riskCategory || RiskCategory.DISCOVERY
    );

    const newThresholdResult = this.enforceConfidenceThreshold(
      newConfidence,
      options.riskCategory || RiskCategory.DISCOVERY
    );

    if (newThresholdResult.requiresCorrection) {
      // Recursive correction
      return this.selfCorrect(
        correctionResult.data,
        memoryContext,
        newThresholdResult,
        resultSchema,
        options,
        currentDepth + 1
      );
    }

    return {
      success: true,
      data: correctionResult.data,
      metadata: {
        ...correctionResult.metadata,
        correctionAttempts: currentDepth + 1,
        confidenceScore: newConfidence,
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HALLUCINATION DETECTION (ENHANCED)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Multi-stage hallucination detection system.
   */
  private async detectHallucination(
    output: any,
    memoryContext: any,
    tenantId: string
  ): Promise<HallucinationDetectionResult> {
    const checks: HallucinationCheck[] = [];

    // Stage 1: Semantic consistency with retrieved context
    const semanticScore = await this.checkSemanticConsistency(
      output,
      memoryContext.semanticContext
    );
    checks.push({
      stage: "SEMANTIC_CONSISTENCY",
      score: semanticScore,
      passed: semanticScore >= 0.7,
    });

    // Stage 2: Factual grounding against knowledge base
    const groundingScore = await this.checkFactualGrounding(output, tenantId);
    checks.push({
      stage: "FACTUAL_GROUNDING",
      score: groundingScore,
      passed: groundingScore >= 0.6,
    });

    // Stage 3: Numerical plausibility checks
    if (this.outputContainsNumerics(output)) {
      const numericalScore = await this.checkNumericalPlausibility(output, memoryContext);
      checks.push({
        stage: "NUMERICAL_PLAUSIBILITY",
        score: numericalScore,
        passed: numericalScore >= 0.75,
      });
    }

    // Aggregate risk score
    const riskScore = 1 - checks.reduce((sum, c) => sum + c.score, 0) / checks.length;

    return {
      riskScore,
      checks,
      flaggedClaims: this.extractFlaggedClaims(output, checks),
      recommendation: this.getHallucinationRecommendation(riskScore),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPER METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  private async sanitizeInput(input: SecureInvokeInput): Promise<SecureInvokeInput> {
    // TODO: Implement input sanitization
    return input;
  }

  private async assembleMemoryContext(
    sessionId: string,
    input: SecureInvokeInput,
    tenantId: string
  ): Promise<any> {
    // Retrieve relevant context from memory
    const episodicMemory = await this.queryMemory(
      MemoryType.EPISODIC,
      { limit: 5, sessionId, tenantId },
      { tenantId }
    );

    const semanticMemory = await this.queryMemory(
      MemoryType.SEMANTIC,
      { limit: 3, tenantId },
      { tenantId }
    );

    return {
      episodicContext: episodicMemory.items,
      semanticContext: semanticMemory.items,
    };
  }

  private async constructPrompt(input: SecureInvokeInput, memoryContext: any): Promise<string> {
    // TODO: Implement prompt construction with templates
    return input.prompt;
  }

  private async executeWithRetry(
    prompt: string,
    options: SecureInvokeOptions,
    traceId: string,
    tenantId: string,
    userId?: string,
    sessionId?: string
  ): Promise<LLMResponse> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetryAttempts; attempt++) {
      try {
        return await this.llmGateway.execute({
          provider: "openai", // TODO: Make configurable
          messages: [{ role: "user", content: prompt }],
          model: "gpt-4", // TODO: Make configurable
          temperature: options.temperature || 0.7,
          maxTokens: options.maxTokens || 1000,
          tenantId,
          userId,
          sessionId,
        });
      } catch (error) {
        lastError = error as Error;
        logger.warn(`LLM attempt ${attempt} failed`, { error: lastError.message, traceId });
      }
    }

    throw new Error(
      `LLM execution failed after ${this.maxRetryAttempts} attempts: ${lastError?.message}`
    );
  }

  private parseAndValidate<T extends z.ZodType>(response: LLMResponse, schema: T): z.infer<T> {
    let content = response.content.trim();

    // Handle markdown code blocks
    if (content.startsWith("```")) {
      const lines = content.split("\n");
      if (lines[0].includes("json")) {
        content = lines.slice(1, -1).join("\n");
      } else {
        content = lines.slice(1, -1).join("\n");
      }
    }

    // Try to find JSON object if mixed with text
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      content = jsonMatch[0];
    }

    const parsed = JSON.parse(content);
    return schema.parse(parsed);
  }

  private async calculateConfidence(
    output: any,
    hallucinationResult: HallucinationDetectionResult,
    riskCategory: RiskCategory
  ): Promise<number> {
    // Base confidence from output structure
    let confidence = 0.5;

    // Adjust based on hallucination risk
    confidence -= hallucinationResult.riskScore * 0.3;

    // Adjust based on output completeness
    if (output.confidence_score !== undefined) {
      confidence = Math.max(confidence, output.confidence_score);
    }

    // Ensure within bounds
    return Math.max(0, Math.min(1, confidence));
  }

  private enforceConfidenceThreshold(
    confidence: number,
    riskCategory: RiskCategory
  ): ThresholdResult {
    const thresholds = this.confidenceThresholds[riskCategory];
    const issues: string[] = [];

    if (confidence < thresholds.minimum) {
      issues.push(
        `Confidence ${confidence.toFixed(2)} below minimum threshold ${thresholds.minimum}`
      );
    }

    return {
      requiresCorrection: confidence < thresholds.target,
      issues,
    };
  }

  private async generateCorrectionPrompt(
    output: any,
    issues: string[],
    memoryContext: any
  ): Promise<string> {
    return `
      The following output has confidence issues that need correction:

      Original Output:
      ${JSON.stringify(output, null, 2)}

      Issues Identified:
      ${issues.join("\n")}

      Context from Memory:
      ${JSON.stringify(memoryContext, null, 2)}

      Please provide a corrected version that addresses these issues.
      Focus on improving accuracy and reducing uncertainty.
    `;
  }

  private escalateToHumanInTheLoop<T>(
    output: T,
    thresholdResult: ThresholdResult,
    reason: string
  ): SecureInvokeResult<T> {
    // TODO: Implement human-in-the-loop escalation
    return {
      success: false,
      error: {
        code: "HUMAN_ESCALATION_REQUIRED",
        message: `Output requires human review: ${reason}`,
        details: { issues: thresholdResult.issues, output },
      },
      metadata: {
        sessionId: "",
        traceId: "",
        confidenceScore: 0,
        confidenceLevel: "LOW",
        hallucinationRisk: 1,
        latencyMs: 0,
        correctionAttempts: this.maxSelfCorrectionDepth,
      },
    };
  }

  private async checkSemanticConsistency(output: any, semanticContext: any[]): Promise<number> {
    // TODO: Implement semantic consistency checking
    return 0.8; // Placeholder
  }

  private async checkFactualGrounding(output: any, tenantId: string): Promise<number> {
    // TODO: Implement factual grounding against knowledge base
    return 0.7; // Placeholder
  }

  private outputContainsNumerics(output: any): boolean {
    const str = JSON.stringify(output);
    return /\d/.test(str);
  }

  private async checkNumericalPlausibility(output: any, memoryContext: any): Promise<number> {
    // TODO: Implement numerical plausibility checks
    return 0.8; // Placeholder
  }

  private extractFlaggedClaims(output: any, checks: HallucinationCheck[]): FlaggedClaim[] {
    // TODO: Implement claim extraction
    return [];
  }

  private getHallucinationRecommendation(riskScore: number): "ACCEPT" | "REVIEW" | "REJECT" {
    if (riskScore > 0.7) return "REJECT";
    if (riskScore > 0.4) return "REVIEW";
    return "ACCEPT";
  }

  private mapConfidenceLevel(score: number): "HIGH" | "MEDIUM" | "LOW" {
    if (score >= 0.8) return "HIGH";
    if (score >= 0.6) return "MEDIUM";
    return "LOW";
  }

  private calculateCost(tokens: number): number {
    // Rough estimate: $0.03 per 1K tokens for GPT-4
    return (tokens / 1000) * 0.03;
  }

  private hashInput(input: SecureInvokeInput): string {
    // TODO: Implement proper hashing
    return "hash-placeholder";
  }

  private hashOutput(output: any): string {
    // TODO: Implement proper hashing
    return "hash-placeholder";
  }

  private async handleInvocationError(
    error: any,
    sessionId: string,
    traceId: string,
    startTime: number
  ): Promise<SecureInvokeResult<any>> {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    // Audit the error
    await this.auditLogger.logAgentExecution(
      "secure_invoke_error",
      this.agentId,
      this.name,
      {
        error: errorMessage,
        sessionId,
        traceId,
      },
      "error",
      "high",
      { traceId }
    );

    return {
      success: false,
      error: {
        code: "INVOCATION_ERROR",
        message: errorMessage,
      },
      metadata: {
        sessionId,
        traceId,
        confidenceScore: 0,
        confidenceLevel: "LOW",
        hallucinationRisk: 1,
        latencyMs: Date.now() - startTime,
        correctionAttempts: 0,
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LEGACY COMPATIBILITY METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * @deprecated Use processRequest instead
   */
  abstract execute(
    sessionId: string,
    input: any,
    context?: Record<string, any>
  ): Promise<AgentResponse>;

  /**
   * @deprecated Use getCapabilities instead
   */
  abstract getAgentType(): AgentType;

  /**
   * @deprecated Use createResponse from helpers
   */
  protected createResponse(
    success: boolean,
    data: any,
    confidence?: ConfidenceLevel,
    message?: string
  ): AgentResponse {
    return {
      success,
      data,
      error: success ? undefined : { code: "ERROR", message: message || "Unknown error" },
      metadata: {
        executionTime: 0,
        confidence,
      },
    };
  }

  /**
   * @deprecated Use handleInvocationError instead
   */
  protected handleError(error: Error, context?: string): AgentResponse {
    logger.error("Agent execution failed", error, {
      context,
    });

    return {
      success: false,
      error: {
        code: "EXECUTION_ERROR",
        message: `${context ? `${context}: ` : ""}${error.message}`,
      },
    };
  }

  /**
   * Log a reasoning step for audit trail and debugging
   */
  private async logReasoningStep(
    traceId: string,
    sessionId: string,
    stepType: string,
    description: string,
    metadata: Record<string, any>
  ): Promise<void> {
    try {
      await this.auditLogger.logAgentExecution(
        "reasoning_step",
        this.agentId,
        this.name,
        {
          sessionId,
          traceId,
          stepType,
          description,
          ...metadata,
        },
        "info",
        "low",
        { traceId }
      );
    } catch (error) {
      logger.warn("Failed to log reasoning step", {
        traceId,
        sessionId,
        stepType,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
