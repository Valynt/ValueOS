/**
 * Causal Truth Service
 *
 * Provides agents with access to proven causal relationships from the causal truth database.
 * Enables evidence-based value predictions and confidence calibration.
 */

import { logger } from "../lib/logger";
import fs from "fs/promises";

// ============================================================================
// Types
// ============================================================================

export interface CausalRelationship {
  id: string;
  driver_action: string;
  target_kpi: string;
  direction: "INCREASE" | "DECREASE";
  mechanism: string;
  impact_distribution: {
    p10: number;
    p50: number;
    p90: number;
    unit: string;
  };
  elasticity_curve: string;
  time_to_realize: string | null;
  confidence_score: number;
  contextual_validity: string[];
  side_effects: string[];
  cascading_effects: CascadingEffect[];
  evidence: Evidence[];
  status: "REVIEWED" | "DRAFT";
}

export interface CascadingEffect {
  downstream_kpi: string;
  via_formula: string | null;
  expected_uplift: {
    p10: number;
    p50: number;
    p90: number;
    unit: string;
  };
}

export interface Evidence {
  source_name: string;
  tier: "Tier 1: Gold Standard" | "Tier 2: Consultant Library" | "Tier 3: Market Reality";
  quote: string;
  url: string | null;
  discount_factor_applied: number;
}

export interface CausalImpact {
  action: string;
  targetKpi: string;
  impact: {
    p10: number;
    p50: number;
    p90: number;
    unit: string;
  };
  confidence: number;
  evidence: Evidence[];
  mechanism: string;
  cascadingEffects: CascadingEffect[];
}

export interface CausalQuery {
  action?: string;
  kpi?: string;
  context?: {
    industry?: string;
    companySize?: string;
    region?: string;
  };
  minConfidence?: number;
}

// ============================================================================
// CausalTruthService Implementation
// ============================================================================

export class CausalTruthService {
  private relationships: CausalRelationship[] = [];
  private actionIndex = new Map<string, CausalRelationship[]>();
  private kpiIndex = new Map<string, CausalRelationship[]>();
  private initialized = false;

  constructor(private dataPath: string = "/home/ino/ValueOS/casual/data/causal_truth_db.json") {}

  /**
   * Initialize the service by loading and indexing the causal truth database
   */
  async initialize(): Promise<void> {
    try {
      const data = await fs.readFile(this.dataPath, "utf-8");
      const causalDb = JSON.parse(data);

      this.relationships = causalDb.relationships || [];
      this.buildIndexes();

      this.initialized = true;
      logger.info("CausalTruthService initialized", {
        totalRelationships: this.relationships.length,
        dataPath: this.dataPath,
      });
    } catch (error) {
      logger.error("Failed to initialize CausalTruthService", {
        message: error instanceof Error ? error.message : String(error),
        dataPath: this.dataPath,
      });
      throw error;
    }
  }

  /**
   * Get causal impact for a specific action and KPI
   */
  getCausalImpact(
    action: string,
    kpi: string,
    context?: CausalQuery["context"]
  ): CausalImpact | null {
    this.ensureInitialized();

    // Find matching relationships
    const matches = this.findMatchingRelationships(action, kpi, context);

    if (matches.length === 0) {
      logger.debug("No causal relationships found", { action, kpi, context });
      return null;
    }

    // Use the highest confidence match
    const bestMatch = matches.reduce((best, current) =>
      current.confidence_score > best.confidence_score ? current : best
    );

    return {
      action: bestMatch.driver_action,
      targetKpi: bestMatch.target_kpi,
      impact: bestMatch.impact_distribution,
      confidence: bestMatch.confidence_score,
      evidence: bestMatch.evidence,
      mechanism: bestMatch.mechanism,
      cascadingEffects: bestMatch.cascading_effects,
    };
  }

  /**
   * Get all causal impacts for an action (across all KPIs)
   */
  getImpactsForAction(action: string, context?: CausalQuery["context"]): CausalImpact[] {
    this.ensureInitialized();

    const relationships = this.actionIndex.get(action) || [];
    const filtered = this.filterByContext(relationships, context);

    return filtered.map((rel) => ({
      action: rel.driver_action,
      targetKpi: rel.target_kpi,
      impact: rel.impact_distribution,
      confidence: rel.confidence_score,
      evidence: rel.evidence,
      mechanism: rel.mechanism,
      cascadingEffects: rel.cascading_effects,
    }));
  }

  /**
   * Get all causal impacts for a KPI (from all actions)
   */
  getImpactsForKpi(kpi: string, context?: CausalQuery["context"]): CausalImpact[] {
    this.ensureInitialized();

    const relationships = this.kpiIndex.get(kpi) || [];
    const filtered = this.filterByContext(relationships, context);

    return filtered.map((rel) => ({
      action: rel.driver_action,
      targetKpi: rel.target_kpi,
      impact: rel.impact_distribution,
      confidence: rel.confidence_score,
      evidence: rel.evidence,
      mechanism: rel.mechanism,
      cascadingEffects: rel.cascading_effects,
    }));
  }

  /**
   * Search for causal relationships matching a query
   */
  search(query: CausalQuery): CausalImpact[] {
    this.ensureInitialized();

    let relationships = this.relationships;

    // Filter by action
    if (query.action) {
      relationships = relationships.filter((rel) =>
        rel.driver_action.toLowerCase().includes(query.action!.toLowerCase())
      );
    }

    // Filter by KPI
    if (query.kpi) {
      relationships = relationships.filter((rel) =>
        rel.target_kpi.toLowerCase().includes(query.kpi!.toLowerCase())
      );
    }

    // Filter by context
    relationships = this.filterByContext(relationships, query.context);

    // Filter by minimum confidence
    if (query.minConfidence) {
      relationships = relationships.filter((rel) => rel.confidence_score >= query.minConfidence!);
    }

    return relationships.map((rel) => ({
      action: rel.driver_action,
      targetKpi: rel.target_kpi,
      impact: rel.impact_distribution,
      confidence: rel.confidence_score,
      evidence: rel.evidence,
      mechanism: rel.mechanism,
      cascadingEffects: rel.cascading_effects,
    }));
  }

  /**
   * Get evidence sources for a specific action/KPI pair
   */
  getEvidenceSources(action: string, kpi: string): Evidence[] {
    this.ensureInitialized();

    const impact = this.getCausalImpact(action, kpi);
    return impact?.evidence || [];
  }

  /**
   * Get cascading effects for a specific action/KPI pair
   */
  getCascadingEffects(action: string, kpi: string): CascadingEffect[] {
    this.ensureInitialized();

    const impact = this.getCausalImpact(action, kpi);
    return impact?.cascadingEffects || [];
  }

  /**
   * Get all available driver actions
   */
  getAvailableActions(): string[] {
    this.ensureInitialized();
    return Array.from(this.actionIndex.keys());
  }

  /**
   * Get all available KPIs
   */
  getAvailableKpis(): string[] {
    this.ensureInitialized();
    return Array.from(this.kpiIndex.keys());
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error("CausalTruthService not initialized. Call initialize() first.");
    }
  }

  private buildIndexes(): void {
    this.actionIndex.clear();
    this.kpiIndex.clear();

    for (const relationship of this.relationships) {
      // Index by action
      const actionKey = relationship.driver_action;
      if (!this.actionIndex.has(actionKey)) {
        this.actionIndex.set(actionKey, []);
      }
      this.actionIndex.get(actionKey)!.push(relationship);

      // Index by KPI
      const kpiKey = relationship.target_kpi;
      if (!this.kpiIndex.has(kpiKey)) {
        this.kpiIndex.set(kpiKey, []);
      }
      this.kpiIndex.get(kpiKey)!.push(relationship);
    }

    logger.debug("Built causal truth indexes", {
      actionCount: this.actionIndex.size,
      kpiCount: this.kpiIndex.size,
    });
  }

  private findMatchingRelationships(
    action: string,
    kpi: string,
    context?: CausalQuery["context"]
  ): CausalRelationship[] {
    // Exact matches first
    const exactMatches = this.relationships.filter(
      (rel) =>
        rel.driver_action.toLowerCase() === action.toLowerCase() &&
        rel.target_kpi.toLowerCase() === kpi.toLowerCase()
    );

    if (exactMatches.length > 0) {
      return this.filterByContext(exactMatches, context);
    }

    // Partial matches
    const partialMatches = this.relationships.filter(
      (rel) =>
        rel.driver_action.toLowerCase().includes(action.toLowerCase()) ||
        rel.target_kpi.toLowerCase().includes(kpi.toLowerCase())
    );

    return this.filterByContext(partialMatches, context);
  }

  private filterByContext(
    relationships: CausalRelationship[],
    context?: CausalQuery["context"]
  ): CausalRelationship[] {
    if (!context) return relationships;

    return relationships.filter((rel) => {
      // Filter by contextual validity
      if (context.industry && rel.contextual_validity.length > 0) {
        const industryMatch = rel.contextual_validity.some((validity) =>
          validity.toLowerCase().includes(context.industry!.toLowerCase())
        );
        if (!industryMatch) return false;
      }

      if (context.companySize && rel.contextual_validity.length > 0) {
        const sizeMatch = rel.contextual_validity.some((validity) =>
          validity.toLowerCase().includes(context.companySize!.toLowerCase())
        );
        if (!sizeMatch) return false;
      }

      return true;
    });
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let causalTruthServiceInstance: CausalTruthService | null = null;

export function getCausalTruthService(): CausalTruthService {
  if (!causalTruthServiceInstance) {
    causalTruthServiceInstance = new CausalTruthService();
  }
  return causalTruthServiceInstance;
}
