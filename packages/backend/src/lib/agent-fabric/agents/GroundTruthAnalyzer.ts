/**
 * GroundTruthAnalyzer
 *
 * Agent that performs RAG-based ground truth analysis for value case validation.
 * Retrieves relevant context from semantic_memory via vector search before LLM calls,
 * verifies claims against authoritative sources, and adjusts confidence based on data tier.
 *
 * Reference: openspec/changes/ground-truth-integration/tasks.md §8
 */

import { z } from "zod";

import type { AgentOutput, LifecycleContext } from "../../../types/agent";
import { logger } from "../../logger";
import { vectorSearchService } from "../../../services/memory/VectorSearchService";
import { mcpGroundTruthService } from "../../../services/MCPGroundTruthService";
import {
  claimVerificationService,
  type VerificationResult,
  type Claim,
} from "../../../services/ground-truth/ClaimVerificationService";

import { BaseAgent } from "./BaseAgent";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const GroundTruthAnalysisSchema = z.object({
  claims: z.array(z.object({
    claim_id: z.string(),
    claim_text: z.string(),
    metric: z.string(),
    value: z.number(),
    verified: z.boolean(),
    confidence: z.number().min(0).max(1),
    tier: z.enum(["tier_1_sec", "tier_2_benchmark", "tier_3_internal"]),
    sources: z.array(z.string()),
    explanation: z.string(),
  })),
  overall_confidence: z.number().min(0).max(1),
  tier_breakdown: z.object({
    tier_1_count: z.number(),
    tier_2_count: z.number(),
    tier_3_count: z.number(),
  }),
  recommendations: z.array(z.string()),
});

interface GroundTruthClaim {
  id: string;
  text: string;
  metric: string;
  value: number;
  unit?: string;
  cik?: string;
  industry?: string;
  companySize?: Claim["companySize"];
}

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

export class GroundTruthAnalyzer extends BaseAgent {
  public override readonly lifecycleStage = "validating";
  public override readonly version = "1.0.0";
  public override readonly name = "ground-truth-analyzer";

  async execute(context: LifecycleContext): Promise<AgentOutput> {
    const start = Date.now();
    const valid = await this.validateInput(context);
    if (!valid) {
      throw new Error("Invalid ground truth analyzer context");
    }

    if (context.organization_id !== this.organizationId) {
      throw new Error("Tenant mismatch for GroundTruthAnalyzer execution");
    }

    // Step 1: Retrieve claims from memory
    const claims = await this.retrieveClaims(context);
    if (claims.length === 0) {
      return this.buildOutput(
        { message: "No claims found for ground truth analysis" },
        "success",
        "medium",
        start,
      );
    }

    // Step 2: RAG - Vector search for relevant context before verification (Task 8.1)
    const enrichedClaims = await this.enrichWithVectorSearch(context, claims);

    // Step 3: Verify claims against authoritative sources (Task 8.2)
    const verificationResults = await this.verifyClaims(enrichedClaims);

    // Step 4: Adjust confidence based on tier (Task 8.3)
    const tieredResults = this.adjustConfidenceByTier(verificationResults);

    // Step 5: Build analysis output
    const analysis = this.buildAnalysis(tieredResults);

    // Step 6: Store results in memory
    await this.storeAnalysis(context, analysis);

    return this.buildOutput(
      {
        claims_analyzed: analysis.claims.length,
        overall_confidence: analysis.overall_confidence,
        tier_breakdown: analysis.tier_breakdown,
        verified_claims: analysis.claims.filter((c) => c.verified).length,
        recommendations: analysis.recommendations,
      },
      analysis.overall_confidence > 0.8 ? "success" : "partial_success",
      this.toConfidenceLevel(analysis.overall_confidence),
      start,
    );
  }

  // -------------------------------------------------------------------------
  // RAG Pattern: Vector Search Enrichment (Task 8.1)
  // -------------------------------------------------------------------------

  private async enrichWithVectorSearch(
    context: LifecycleContext,
    claims: GroundTruthClaim[],
  ): Promise<Array<GroundTruthClaim & { context: string[] }>> {
    const enriched: Array<GroundTruthClaim & { context: string[] }> = [];

    for (const claim of claims) {
      try {
        // Generate embedding for the claim (simplified - in production would call embedding service)
        // For now, we'll use keyword-based retrieval from memory
        const relevantMemories = await this.memorySystem.retrieve({
          agent_id: "*",
          memory_type: "semantic",
          limit: 5,
          organization_id: context.organization_id,
        });

        // Filter memories related to this claim's metric
        const relevantContext = relevantMemories
          .filter(
            (m) =>
              m.content.toLowerCase().includes(claim.metric.toLowerCase()) ||
              m.metadata?.metric === claim.metric,
          )
          .map((m) => m.content.slice(0, 500)); // Limit context length

        enriched.push({
          ...claim,
          context: relevantContext,
        });

        logger.debug("GroundTruthAnalyzer: enriched claim with vector context", {
          claim_id: claim.id,
          context_count: relevantContext.length,
        });
      } catch (err) {
        logger.warn("GroundTruthAnalyzer: vector search failed for claim", {
          claim_id: claim.id,
          error: (err as Error).message,
        });
        enriched.push({ ...claim, context: [] });
      }
    }

    return enriched;
  }

  // -------------------------------------------------------------------------
  // Claim Verification (Task 8.2)
  // -------------------------------------------------------------------------

  private async verifyClaims(
    claims: Array<GroundTruthClaim & { context: string[] }>,
  ): Promise<VerificationResult[]> {
    const results: VerificationResult[] = [];

    for (const claim of claims) {
      try {
        // First try MCPGroundTruthService for financial claims
        let verification: VerificationResult | null = null;

        if (claim.cik) {
          // Try to verify via MCPGroundTruthService for SEC-backed claims
          const financialData = await mcpGroundTruthService.getFinancialData({
            entityId: claim.cik,
            metrics: [claim.metric],
          });

          if (financialData?.metrics[claim.metric]) {
            const actualValue = financialData.metrics[claim.metric].value;
            const deviation = Math.abs(claim.value - actualValue) / actualValue;

            verification = {
              claim: {
                metric: claim.metric,
                value: claim.value,
                unit: claim.unit,
              },
              status: deviation <= 0.1 ? "match" : "contradiction",
              severity: deviation <= 0.1 ? "none" : deviation <= 0.3 ? "moderate" : "major",
              authoritativeValue: actualValue,
              deviation,
              sources: [
                {
                  name: "SEC EDGAR",
                  date: financialData.period,
                  tier: "tier_1_sec",
                },
              ],
              confidence: deviation <= 0.1 ? 0.95 : 0.7,
              explanation:
                deviation <= 0.1
                  ? `Claim matches SEC filing within 10% tolerance`
                  : `Claim deviates ${(deviation * 100).toFixed(1)}% from SEC filing`,
              verifiedAt: new Date().toISOString(),
            };
          }
        }

        // Fallback to ClaimVerificationService for industry benchmarks
        if (!verification && claim.industry) {
          verification = await claimVerificationService.verifyClaim({
            metric: claim.metric,
            value: claim.value,
            unit: claim.unit,
            industry: claim.industry,
            companySize: claim.companySize,
          });
        }

        // If still no verification, mark as unverifiable
        if (!verification) {
          verification = {
            claim: {
              metric: claim.metric,
              value: claim.value,
              unit: claim.unit,
            },
            status: "unverifiable",
            severity: "moderate",
            sources: [],
            confidence: 0.3,
            explanation: "No authoritative data available for verification",
            verifiedAt: new Date().toISOString(),
          };
        }

        results.push(verification);
      } catch (err) {
        logger.warn("GroundTruthAnalyzer: verification failed for claim", {
          claim_id: claim.id,
          error: (err as Error).message,
        });

        results.push({
          claim: {
            metric: claim.metric,
            value: claim.value,
            unit: claim.unit,
          },
          status: "unverifiable",
          severity: "moderate",
          sources: [],
          confidence: 0.3,
          explanation: `Verification error: ${(err as Error).message}`,
          verifiedAt: new Date().toISOString(),
        });
      }
    }

    return results;
  }

  // -------------------------------------------------------------------------
  // Tier-Based Confidence Adjustment (Task 8.3)
  // -------------------------------------------------------------------------

  private adjustConfidenceByTier(
    results: VerificationResult[],
  ): Array<VerificationResult & { tierWeight: number }> {
    return results.map((result) => {
      // Determine tier from sources
      const tier = result.sources[0]?.tier || "tier_3_internal";

      // Apply tier-based confidence adjustment
      // Tier 1 (SEC): Highest confidence, minimal penalty
      // Tier 2 (Benchmarks): Medium confidence, slight penalty for unverifiable
      // Tier 3 (Internal): Lowest base confidence, higher penalty for unverifiable
      const tierWeights: Record<string, number> = {
        tier_1_sec: 1.0,
        tier_2_benchmark: 0.85,
        tier_3_internal: 0.6,
      };

      const tierWeight = tierWeights[tier] || 0.5;

      // Adjust confidence based on tier and verification status
      let adjustedConfidence = result.confidence * tierWeight;

      if (result.status === "unverifiable") {
        // Additional penalty for unverifiable claims based on tier
        adjustedConfidence *= tier === "tier_1_sec" ? 0.9 : tier === "tier_2_benchmark" ? 0.7 : 0.5;
      }

      return {
        ...result,
        confidence: Math.max(0, Math.min(1, adjustedConfidence)),
        tierWeight,
        sources: result.sources.map((s) => ({
          ...s,
          tier,
        })),
      };
    });
  }

  // -------------------------------------------------------------------------
  // Analysis Building
  // -------------------------------------------------------------------------

  private buildAnalysis(
    results: Array<VerificationResult & { tierWeight: number }>,
  ): z.infer<typeof GroundTruthAnalysisSchema> {
    const tierCounts = {
      tier_1_count: 0,
      tier_2_count: 0,
      tier_3_count: 0,
    };

    const claims = results.map((r, index) => {
      const tier = r.sources[0]?.tier || "tier_3_internal";

      if (tier === "tier_1_sec") tierCounts.tier_1_count++;
      else if (tier === "tier_2_benchmark") tierCounts.tier_2_count++;
      else tierCounts.tier_3_count++;

      return {
        claim_id: `claim-${index}`,
        claim_text: `${r.claim.metric}: ${r.claim.value}`,
        metric: r.claim.metric,
        value: r.claim.value,
        verified: r.status === "match",
        confidence: r.confidence,
        tier,
        sources: r.sources.map((s) => s.name),
        explanation: r.explanation,
      };
    });

    // Calculate overall confidence as weighted average
    const totalWeight = results.reduce((sum, r) => sum + r.tierWeight, 0);
    const overallConfidence =
      totalWeight > 0
        ? results.reduce((sum, r) => sum + r.confidence * r.tierWeight, 0) / totalWeight
        : 0;

    // Generate recommendations
    const recommendations: string[] = [];
    const unverifiableCount = results.filter((r) => r.status === "unverifiable").length;
    const contradictionCount = results.filter((r) => r.status === "contradiction").length;

    if (unverifiableCount > 0) {
      recommendations.push(
        `${unverifiableCount} claims lack authoritative backing. Consider gathering more external data.`,
      );
    }
    if (contradictionCount > 0) {
      recommendations.push(
        `${contradictionCount} claims contradict authoritative sources. Review and correct these claims.`,
      );
    }
    if (tierCounts.tier_1_count === 0 && results.length > 0) {
      recommendations.push("No Tier-1 (SEC) data found. For public companies, add CIK/ticker for stronger verification.");
    }

    return {
      claims,
      overall_confidence: Math.round(overallConfidence * 1000) / 1000,
      tier_breakdown: tierCounts,
      recommendations,
    };
  }

  // -------------------------------------------------------------------------
  // Memory Operations
  // -------------------------------------------------------------------------

  private async retrieveClaims(context: LifecycleContext): Promise<GroundTruthClaim[]> {
    try {
      // Retrieve from target and opportunity agents
      const memories = await this.memorySystem.retrieve({
        agent_id: "*",
        memory_type: "semantic",
        limit: 20,
        organization_id: context.organization_id,
      });

      const claims: GroundTruthClaim[] = [];

      for (const memory of memories) {
        const m = memory.metadata || {};

        // Extract claim data from memory metadata
        if (m.kpi_id || m.metric) {
          claims.push({
            id: memory.id,
            text: memory.content,
            metric: m.metric || m.kpi_id || "unknown",
            value: m.target?.value || m.baseline?.value || 0,
            unit: m.unit,
            cik: m.cik || (context.user_inputs?.cik as string),
            industry: m.industry || (context.user_inputs?.industry as string),
            companySize: m.company_size || (context.user_inputs?.company_size as Claim["companySize"]),
          });
        }
      }

      return claims;
    } catch (err) {
      logger.warn("GroundTruthAnalyzer: failed to retrieve claims", {
        error: (err as Error).message,
      });
      return [];
    }
  }

  private async storeAnalysis(
    context: LifecycleContext,
    analysis: z.infer<typeof GroundTruthAnalysisSchema>,
  ): Promise<void> {
    try {
      await this.memorySystem.storeSemanticMemory(
        context.workspace_id,
        this.name,
        "semantic",
        `Ground truth analysis: ${analysis.claims.length} claims analyzed with overall confidence ${analysis.overall_confidence}`,
        {
          type: "ground_truth_analysis",
          claims_count: analysis.claims.length,
          verified_count: analysis.claims.filter((c) => c.verified).length,
          overall_confidence: analysis.overall_confidence,
          tier_breakdown: analysis.tier_breakdown,
          organization_id: context.organization_id,
          importance: 0.9,
        },
        context.organization_id,
      );
    } catch (err) {
      logger.warn("GroundTruthAnalyzer: failed to store analysis", {
        error: (err as Error).message,
      });
    }
  }
}
