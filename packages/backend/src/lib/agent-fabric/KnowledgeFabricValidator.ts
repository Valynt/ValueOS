/**
 * Knowledge Fabric Validator
 *
 * Replaces regex-based hallucination detection with semantic cross-referencing.
 * Queries SemanticMemoryService for contradicting facts and validates claims
 * against GroundTruth benchmarks (ESO KPIs, VMRT traces).
 */

import type {
  GroundTruthIntegrationService,
  ValidationResult as GTValidationResult,
} from "../../services/GroundTruthIntegrationService.js";
import { logger } from "../logger.js";

import type { MemorySystem } from "./MemorySystem.js";

// ============================================================================
// Types
// ============================================================================

export interface HallucinationCheckResult {
  /** Whether the content passed validation (no hallucinations detected) */
  passed: boolean;
  /** Overall confidence in the validation (0-1) */
  confidence: number;
  /** Individual contradiction findings from memory cross-referencing */
  contradictions: Contradiction[];
  /** Benchmark misalignments from GroundTruth */
  benchmarkMisalignments: BenchmarkMisalignment[];
  /** Source of the check for audit trail */
  method: "knowledge_fabric";
}

export interface Contradiction {
  /** The claim from the LLM response that conflicts */
  claim: string;
  /** The existing fact from memory that contradicts it */
  existingFact: string;
  /** Semantic similarity between the claim and the contradicting fact */
  similarity: number;
  /** Memory source (agent_id that stored the original fact) */
  source: string;
}

export interface BenchmarkMisalignment {
  /** The metric ID that was checked */
  metricId: string;
  /** The claimed value extracted from the response */
  claimedValue: number;
  /** Benchmark validation result */
  validation: GTValidationResult;
}

export interface KnowledgeFabricValidatorConfig {
  /** Similarity threshold above which a memory match is considered a potential contradiction (default: 0.75) */
  contradictionThreshold?: number;
  /** Max memories to retrieve for cross-referencing (default: 10) */
  maxMemoryResults?: number;
  /** Whether to check GroundTruth benchmarks (default: true) */
  enableBenchmarkCheck?: boolean;
  /** Minimum number of contradictions to fail validation (default: 1) */
  contradictionFailThreshold?: number;
}

// Regex patterns to extract numeric metric claims from LLM output.
// Matches patterns like: "metric_name: 42.5" or "metric_name = 42.5"
const METRIC_CLAIM_PATTERN =
  /(?:ESO-KPI-[\w-]+|[\w_]+_(?:rate|cost|score|time|revenue|savings|reduction|improvement))\s*[:=]\s*([\d.]+)/gi;

// ============================================================================
// Validator
// ============================================================================

export class KnowledgeFabricValidator {
  private readonly memorySystem: MemorySystem;
  private readonly groundTruth: GroundTruthIntegrationService | null;
  private readonly config: Required<KnowledgeFabricValidatorConfig>;

  constructor(
    memorySystem: MemorySystem,
    groundTruth: GroundTruthIntegrationService | null,
    config: KnowledgeFabricValidatorConfig = {}
  ) {
    this.memorySystem = memorySystem;
    this.groundTruth = groundTruth;
    this.config = {
      contradictionThreshold: config.contradictionThreshold ?? 0.75,
      maxMemoryResults: config.maxMemoryResults ?? 10,
      enableBenchmarkCheck: config.enableBenchmarkCheck ?? true,
      contradictionFailThreshold: config.contradictionFailThreshold ?? 1,
    };
  }

  /**
   * Validate LLM output against the Knowledge Fabric.
   *
   * 1. Cross-reference response content against tenant-scoped semantic memory
   *    to find contradicting facts.
   * 2. Extract metric claims and validate against GroundTruth benchmarks.
   */
  async validate(
    content: string,
    organizationId: string,
    agentId: string
  ): Promise<HallucinationCheckResult> {
    const [contradictions, benchmarkMisalignments] = await Promise.all([
      this.findContradictions(content, organizationId, agentId),
      this.checkBenchmarks(content),
    ]);

    const contradictionCount = contradictions.length;
    const misalignmentCount = benchmarkMisalignments.length;

    // Confidence degrades with each contradiction/misalignment found
    const contradictionPenalty = Math.min(contradictionCount * 0.15, 0.6);
    const misalignmentPenalty = Math.min(misalignmentCount * 0.1, 0.3);
    const confidence = Math.max(0, 1 - contradictionPenalty - misalignmentPenalty);

    const passed =
      contradictionCount < this.config.contradictionFailThreshold &&
      misalignmentCount === 0;

    if (!passed) {
      logger.warn("KnowledgeFabricValidator: hallucination detected", {
        agent_id: agentId,
        organization_id: organizationId,
        contradiction_count: contradictionCount,
        misalignment_count: misalignmentCount,
        confidence,
      });
    }

    return {
      passed,
      confidence,
      contradictions,
      benchmarkMisalignments,
      method: "knowledge_fabric",
    };
  }

  // --------------------------------------------------------------------------
  // Memory Cross-Referencing
  // --------------------------------------------------------------------------

  /**
   * Query semantic memory for facts that contradict the LLM response.
   *
   * Strategy: retrieve recent memories from the same agent and related agents,
   * then check if any stored facts semantically conflict with claims in the
   * new response. A high-similarity match with opposing sentiment/values
   * indicates a contradiction.
   */
  private async findContradictions(
    content: string,
    organizationId: string,
    agentId: string
  ): Promise<Contradiction[]> {
    const contradictions: Contradiction[] = [];

    try {
      // Retrieve recent memories from the same agent and related agents
      const relatedAgents = this.getRelatedAgents(agentId);
      const agentsToCheck = [agentId, ...relatedAgents];

      for (const checkAgentId of agentsToCheck) {
        const memories = await this.memorySystem.retrieve({
          agent_id: checkAgentId,
          organization_id: organizationId,
          memory_type: "semantic",
          limit: this.config.maxMemoryResults,
        });

        for (const memory of memories) {
          const contradiction = this.detectContradiction(
            content,
            memory.content,
            checkAgentId
          );
          if (contradiction) {
            contradictions.push(contradiction);
          }
        }
      }
    } catch (err) {
      // Memory retrieval failure should not block the pipeline — log and continue
      logger.warn("KnowledgeFabricValidator: memory cross-reference failed", {
        error: (err as Error).message,
        agent_id: agentId,
      });
    }

    return contradictions;
  }

  /**
   * Detect if the LLM response contradicts an existing memory entry.
   *
   * Uses numeric value comparison: if both the response and the memory
   * reference the same metric/KPI but with significantly different values,
   * that's a contradiction.
   */
  private detectContradiction(
    responseContent: string,
    memoryContent: string,
    sourceAgentId: string
  ): Contradiction | null {
    // Extract numeric claims from both texts
    const responseClaims = this.extractNumericClaims(responseContent);
    const memoryClaims = this.extractNumericClaims(memoryContent);

    for (const [responseMetric, responseValue] of responseClaims) {
      const memoryValue = memoryClaims.get(responseMetric);
      if (memoryValue === undefined) continue;

      // Check for significant divergence (>30% difference)
      const divergence = Math.abs(responseValue - memoryValue) / Math.max(Math.abs(memoryValue), 1);
      if (divergence > 0.3) {
        return {
          claim: `${responseMetric}: ${responseValue}`,
          existingFact: `${responseMetric}: ${memoryValue} (from ${sourceAgentId})`,
          similarity: 1 - Math.min(divergence, 1),
          source: sourceAgentId,
        };
      }
    }

    // Check for direct textual contradictions via negation patterns
    const negationContradiction = this.detectNegationContradiction(
      responseContent,
      memoryContent,
      sourceAgentId
    );
    if (negationContradiction) return negationContradiction;

    return null;
  }

  /**
   * Detect contradictions where the response negates a previously established fact.
   * E.g., memory says "KPI is achievable" but response says "KPI is not achievable".
   */
  private detectNegationContradiction(
    responseContent: string,
    memoryContent: string,
    sourceAgentId: string
  ): Contradiction | null {
    const negationPairs: Array<[RegExp, RegExp]> = [
      [/\b(?:is|are|was|were)\s+achievable\b/i, /\b(?:is|are|was|were)\s+(?:not\s+achievable|unachievable)\b/i],
      [/\bsupported\b/i, /\bunsupported\b/i],
      [/\bverified\b/i, /\bunverified\b/i],
      [/\bvalid(?:ated)?\b/i, /\binvalid(?:ated)?\b/i],
      [/\bconfirmed\b/i, /\bunconfirmed\b/i],
      [/\bfeasible\b/i, /\b(?:infeasible|not\s+feasible)\b/i],
    ];

    for (const [positive, negative] of negationPairs) {
      const memoryPositive = positive.test(memoryContent);
      const responseNegative = negative.test(responseContent);
      const memoryNegative = negative.test(memoryContent);
      const responsePositive = positive.test(responseContent);

      if ((memoryPositive && responseNegative) || (memoryNegative && responsePositive)) {
        // Extract the relevant sentence from each for context
        const responseSentence = this.extractRelevantSentence(responseContent, negative) ||
          this.extractRelevantSentence(responseContent, positive) || responseContent.substring(0, 200);
        const memorySentence = this.extractRelevantSentence(memoryContent, positive) ||
          this.extractRelevantSentence(memoryContent, negative) || memoryContent.substring(0, 200);

        return {
          claim: responseSentence,
          existingFact: memorySentence,
          similarity: this.config.contradictionThreshold,
          source: sourceAgentId,
        };
      }
    }

    return null;
  }

  // --------------------------------------------------------------------------
  // GroundTruth Benchmark Checking
  // --------------------------------------------------------------------------

  /**
   * Extract metric claims from the response and validate against GroundTruth benchmarks.
   */
  private async checkBenchmarks(content: string): Promise<BenchmarkMisalignment[]> {
    if (!this.config.enableBenchmarkCheck || !this.groundTruth) {
      return [];
    }

    const misalignments: BenchmarkMisalignment[] = [];
    const claims = this.extractMetricClaims(content);

    for (const { metricId, value } of claims) {
      try {
        const validation = await this.groundTruth.validateClaim(metricId, value);
        if (!validation.valid) {
          misalignments.push({
            metricId,
            claimedValue: value,
            validation,
          });
        }
      } catch {
        // Unknown metric — skip, not every metric ID will be in GroundTruth
      }
    }

    return misalignments;
  }

  // --------------------------------------------------------------------------
  // Extraction Helpers
  // --------------------------------------------------------------------------

  /**
   * Extract numeric claims from text. Returns a map of metric_name -> value.
   */
  private extractNumericClaims(text: string): Map<string, number> {
    const claims = new Map<string, number>();

    // Match patterns like "baseline: 45.5" or "target: 32"
    const patterns = [
      /\b(baseline|target|current|projected|estimated|actual)\s*[:=]\s*([\d.]+)/gi,
      /\b([\w_]+)\s*[:=]\s*([\d.]+)\s*(?:currency|%|percent|units?|months?)/gi,
    ];

    for (const pattern of patterns) {
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(text)) !== null) {
        const key = match[1]!.toLowerCase();
        const value = parseFloat(match[2]!);
        if (!isNaN(value)) {
          claims.set(key, value);
        }
      }
    }

    return claims;
  }

  /**
   * Extract metric claims that match known GroundTruth metric ID patterns.
   */
  private extractMetricClaims(text: string): Array<{ metricId: string; value: number }> {
    const claims: Array<{ metricId: string; value: number }> = [];
    let match: RegExpExecArray | null;

    // Reset lastIndex for global regex
    METRIC_CLAIM_PATTERN.lastIndex = 0;

    while ((match = METRIC_CLAIM_PATTERN.exec(text)) !== null) {
      const fullMatch = match[0]!;
      // Extract the metric ID (everything before the : or =)
      const separatorIdx = fullMatch.search(/\s*[:=]/);
      if (separatorIdx === -1) continue;

      const metricId = fullMatch.substring(0, separatorIdx).trim();
      const value = parseFloat(match[1]!);

      if (!isNaN(value) && metricId) {
        claims.push({ metricId, value });
      }
    }

    return claims;
  }

  /**
   * Extract the sentence containing a regex match for context in contradiction reports.
   */
  private extractRelevantSentence(text: string, pattern: RegExp): string | null {
    const match = pattern.exec(text);
    if (!match || match.index === undefined) return null;

    // Find sentence boundaries around the match
    const start = Math.max(0, text.lastIndexOf(".", match.index) + 1);
    const end = text.indexOf(".", match.index + match[0].length);
    const sentenceEnd = end === -1 ? Math.min(text.length, match.index + 200) : end + 1;

    return text.substring(start, sentenceEnd).trim();
  }

  /**
   * Map an agent to its related agents whose memories should be cross-referenced.
   * Follows the lifecycle DAG: discovery -> targeting -> opportunity -> integrity.
   */
  private getRelatedAgents(agentId: string): string[] {
    const relationships: Record<string, string[]> = {
      target: ["opportunity", "integrity"],
      opportunity: ["target", "integrity"],
      integrity: ["target", "opportunity"],
      narrative: ["target", "opportunity", "integrity"],
      composer: ["narrative", "integrity"],
      discovery: ["target"],
    };

    return relationships[agentId] ?? [];
  }
}
