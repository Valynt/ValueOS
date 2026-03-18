/**
 * PrecedentRetrievalService
 *
 * Finds prior completed value cases in same tenant matching
 * industry/use-case/deal characteristics. Returns top-3 similar cases.
 * Ensures tenant-scoped queries (no cross-tenant leakage).
 *
 * Reference: openspec/changes/deal-assembly-pipeline/tasks.md §6
 */

import { z } from "zod";
import { logger } from "../lib/logger.js";
import { supabase } from "../lib/supabase.js";

export const PrecedentCaseSchema = z.object({
  id: z.string().uuid(),
  case_name: z.string(),
  industry: z.string(),
  use_case: z.string(),
  deal_size: z.number().optional(),
  outcome_status: z.enum(["won", "lost", "open", "abandoned"]),
  similarity_score: z.number().min(0).max(1),
  value_drivers: z.array(z.string()),
  key_metrics: z.record(z.unknown()),
  created_at: z.string().datetime(),
});

export type PrecedentCase = z.infer<typeof PrecedentCaseSchema>;

export interface PrecedentQuery {
  tenantId: string;
  industry?: string;
  useCase?: string;
  dealSizeRange?: { min: number; max: number };
  excludeCaseId?: string; // Exclude current case from results
}

export class PrecedentRetrievalService {
  /**
   * Find similar precedent cases within the same tenant.
   * Task: 6.1, 6.2, 6.3
   */
  async findSimilarCases(query: PrecedentQuery): Promise<PrecedentCase[]> {
    logger.info("Finding precedent cases", {
      tenantId: query.tenantId,
      industry: query.industry,
      useCase: query.useCase,
    });

    // Build base query - always tenant-scoped
    let dbQuery = supabase
      .from("value_cases")
      .select("id, title, industry, use_case, deal_size, status, value_drivers, metrics, created_at")
      .eq("tenant_id", query.tenantId) // Critical: tenant isolation
      .in("status", ["completed", "won", "validated"])
      .order("created_at", { ascending: false })
      .limit(20); // Get more than needed for ranking

    // Apply filters
    if (query.industry) {
      dbQuery = dbQuery.ilike("industry", `%${query.industry}%`);
    }

    if (query.useCase) {
      dbQuery = dbQuery.ilike("use_case", `%${query.useCase}%`);
    }

    if (query.dealSizeRange) {
      dbQuery = dbQuery
        .gte("deal_size", query.dealSizeRange.min)
        .lte("deal_size", query.dealSizeRange.max);
    }

    if (query.excludeCaseId) {
      dbQuery = dbQuery.neq("id", query.excludeCaseId);
    }

    const { data, error } = await dbQuery;

    if (error) {
      logger.error("Precedent retrieval failed", { error: error.message });
      throw new Error(`Failed to retrieve precedent cases: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Calculate similarity scores and rank
    const scoredCases = data.map((c) => ({
      ...c,
      similarity_score: this.calculateSimilarity(query, c),
    }));

    // Sort by similarity and return top 3
    const topCases = scoredCases
      .sort((a, b) => b.similarity_score - a.similarity_score)
      .slice(0, 3)
      .map((c) => ({
        id: c.id,
        case_name: c.title,
        industry: c.industry || "Unknown",
        use_case: c.use_case || "Unknown",
        deal_size: c.deal_size,
        outcome_status: this.mapStatus(c.status),
        similarity_score: c.similarity_score,
        value_drivers: c.value_drivers || [],
        key_metrics: c.metrics || {},
        created_at: c.created_at,
      }));

    logger.info(`Found ${topCases.length} precedent cases`, {
      tenantId: query.tenantId,
      topScore: topCases[0]?.similarity_score,
    });

    return topCases;
  }

  /**
   * Calculate similarity score between query and a case.
   */
  private calculateSimilarity(query: PrecedentQuery, caseData: Record<string, unknown>): number {
    let score = 0;
    let factors = 0;

    // Industry match (weight: 0.4)
    if (query.industry && caseData.industry) {
      const industryMatch = String(caseData.industry).toLowerCase() === query.industry.toLowerCase();
      score += industryMatch ? 0.4 : 0.1;
      factors++;
    }

    // Use case match (weight: 0.4)
    if (query.useCase && caseData.use_case) {
      const useCaseMatch = String(caseData.use_case).toLowerCase().includes(query.useCase.toLowerCase()) ||
        query.useCase.toLowerCase().includes(String(caseData.use_case).toLowerCase());
      score += useCaseMatch ? 0.4 : 0.1;
      factors++;
    }

    // Deal size similarity (weight: 0.2)
    if (query.dealSizeRange && caseData.deal_size) {
      const dealSize = Number(caseData.deal_size);
      const midPoint = (query.dealSizeRange.min + query.dealSizeRange.max) / 2;
      const deviation = Math.abs(dealSize - midPoint) / midPoint;
      score += Math.max(0, 0.2 - deviation * 0.2);
      factors++;
    }

    // Default score if no factors matched
    if (factors === 0) return 0.3;

    return Math.min(1, score);
  }

  /**
   * Map internal status to outcome status.
   */
  private mapStatus(status: string): "won" | "lost" | "open" | "abandoned" {
    switch (status) {
      case "completed":
      case "won":
      case "validated":
        return "won";
      case "lost":
        return "lost";
      case "archived":
      case "cancelled":
        return "abandoned";
      default:
        return "open";
    }
  }
}
