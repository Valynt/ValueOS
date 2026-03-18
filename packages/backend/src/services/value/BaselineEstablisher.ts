import { logger } from "../../lib/logger.js";
import { supabase } from "../../lib/supabase.js";

/**
 * Source type priority for baseline establishment
 * Higher number = higher priority
 */
const SOURCE_PRIORITY: Record<string, number> = {
  "customer-confirmed": 5,
  "crm-derived": 4,
  "call-derived": 3,
  "benchmark-derived": 2,
  "inferred": 1,
};

/**
 * Baseline metric with source classification
 */
export interface BaselineMetric {
  id: string;
  metricName: string;
  currentValue: number;
  unit: string;
  sourceType: string;
  sourceClassification: "tier-1" | "tier-2" | "tier-3";
  confidenceScore: number;
  requiresConfirmation: boolean;
  originalValue?: number;
  confirmedBy?: string;
  confirmedAt?: string;
}

/**
 * Baseline establishment result
 */
export interface BaselineResult {
  metrics: BaselineMetric[];
  flaggedForConfirmation: BaselineMetric[];
  establishmentDate: string;
}

/**
 * Baseline data source
 */
export interface BaselineSource {
  sourceType: string;
  metricName: string;
  value: number;
  unit: string;
  confidenceScore: number;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

/**
 * Establishes baselines for value drivers using priority-based source selection.
 * Tags metrics with source classification and flags those requiring confirmation.
 */
export class BaselineEstablisher {
  /**
   * Establish baselines for a set of value drivers
   */
  async establishBaselines(
    tenantId: string,
    caseId: string,
    valueDrivers: string[],
    sources: BaselineSource[]
  ): Promise<BaselineResult> {
    logger.info("Establishing baselines", {
      tenantId,
      caseId,
      valueDriverCount: valueDrivers.length,
      sourceCount: sources.length,
    });

    const metrics: BaselineMetric[] = [];
    const flaggedForConfirmation: BaselineMetric[] = [];

    for (const driver of valueDrivers) {
      const metric = await this.findBestBaseline(tenantId, caseId, driver, sources);

      if (metric) {
        metrics.push(metric);

        // Flag benchmark-derived and inferred baselines
        if (metric.requiresConfirmation) {
          flaggedForConfirmation.push(metric);
        }
      }
    }

    logger.info("Baseline establishment complete", {
      tenantId,
      caseId,
      metricCount: metrics.length,
      flaggedCount: flaggedForConfirmation.length,
    });

    return {
      metrics,
      flaggedForConfirmation,
      establishmentDate: new Date().toISOString(),
    };
  }

  /**
   * Find the best baseline for a value driver using priority-based selection
   */
  private async findBestBaseline(
    tenantId: string,
    caseId: string,
    valueDriver: string,
    sources: BaselineSource[]
  ): Promise<BaselineMetric | null> {
    // Filter sources matching this value driver
    const matchingSources = sources.filter(
      (s) =>
        s.metricName.toLowerCase().includes(valueDriver.toLowerCase()) ||
        valueDriver.toLowerCase().includes(s.metricName.toLowerCase())
    );

    if (matchingSources.length === 0) {
      logger.warn(`No baseline sources found for value driver: ${valueDriver}`, {
        tenantId,
        caseId,
      });
      return null;
    }

    // Sort by priority (highest first), then by confidence
    const sorted = matchingSources.sort((a, b) => {
      const priorityA = SOURCE_PRIORITY[a.sourceType] || 0;
      const priorityB = SOURCE_PRIORITY[b.sourceType] || 0;

      if (priorityB !== priorityA) {
        return priorityB - priorityA;
      }

      return b.confidenceScore - a.confidenceScore;
    });

    const bestSource = sorted[0];
    const sourceClassification = this.classifySource(bestSource.sourceType);

    const metric: BaselineMetric = {
      id: this.generateMetricId(),
      metricName: valueDriver,
      currentValue: bestSource.value,
      unit: bestSource.unit,
      sourceType: bestSource.sourceType,
      sourceClassification,
      confidenceScore: bestSource.confidenceScore,
      requiresConfirmation: this.requiresConfirmation(bestSource.sourceType),
    };

    // Persist to database
    await this.persistBaseline(tenantId, caseId, metric);

    return metric;
  }

  /**
   * Classify source into tier
   */
  private classifySource(sourceType: string): "tier-1" | "tier-2" | "tier-3" {
    const priority = SOURCE_PRIORITY[sourceType] || 0;

    if (priority >= 4) return "tier-1";
    if (priority >= 2) return "tier-2";
    return "tier-3";
  }

  /**
   * Determine if baseline requires customer confirmation
   */
  private requiresConfirmation(sourceType: string): boolean {
    return sourceType === "benchmark-derived" || sourceType === "inferred";
  }

  /**
   * Persist baseline metric to database
   */
  private async persistBaseline(
    tenantId: string,
    caseId: string,
    metric: BaselineMetric
  ): Promise<void> {
    const { error } = await supabase.from("baselines").insert({
      id: metric.id,
      tenant_id: tenantId,
      case_id: caseId,
      metric_name: metric.metricName,
      current_value: metric.currentValue,
      unit: metric.unit,
      source_type: metric.sourceType,
      source_classification: metric.sourceClassification,
      confidence_score: metric.confidenceScore,
      requires_confirmation: metric.requiresConfirmation,
      created_at: new Date().toISOString(),
    });

    if (error) {
      logger.error(`Failed to persist baseline: ${error.message}`, {
        tenantId,
        caseId,
        metricId: metric.id,
      });
      // Don't throw - allow continuation
    }
  }

  /**
   * Confirm a baseline metric (customer confirmation)
   */
  async confirmBaseline(
    metricId: string,
    userId: string,
    confirmedValue?: number
  ): Promise<{ success: boolean; metric?: BaselineMetric }> {
    const { data: existing } = await supabase
      .from("baselines")
      .select("*")
      .eq("id", metricId)
      .single();

    if (!existing) {
      return { success: false };
    }

    const updates: Record<string, unknown> = {
      source_type: "customer-confirmed",
      source_classification: "tier-1",
      requires_confirmation: false,
      confirmed_by: userId,
      confirmed_at: new Date().toISOString(),
    };

    if (confirmedValue !== undefined) {
      updates.original_value = existing.current_value;
      updates.current_value = confirmedValue;
    }

    const { data, error } = await supabase
      .from("baselines")
      .update(updates)
      .eq("id", metricId)
      .select()
      .single();

    if (error) {
      logger.error(`Failed to confirm baseline: ${error.message}`, { metricId });
      return { success: false };
    }

    const metric: BaselineMetric = {
      id: data.id,
      metricName: data.metric_name,
      currentValue: data.current_value,
      unit: data.unit,
      sourceType: data.source_type,
      sourceClassification: data.source_classification,
      confidenceScore: data.confidence_score,
      requiresConfirmation: data.requires_confirmation,
      originalValue: data.original_value,
      confirmedBy: data.confirmed_by,
      confirmedAt: data.confirmed_at,
    };

    return { success: true, metric };
  }

  /**
   * Retrieve baselines for a case
   */
  async getBaselines(
    tenantId: string,
    caseId: string
  ): Promise<BaselineMetric[]> {
    const { data, error } = await supabase
      .from("baselines")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("case_id", caseId);

    if (error) {
      logger.error(`Failed to fetch baselines: ${error.message}`, {
        tenantId,
        caseId,
      });
      return [];
    }

    return (data || []).map((row) => ({
      id: row.id,
      metricName: row.metric_name,
      currentValue: row.current_value,
      unit: row.unit,
      sourceType: row.source_type,
      sourceClassification: row.source_classification,
      confidenceScore: row.confidence_score,
      requiresConfirmation: row.requires_confirmation,
      originalValue: row.original_value,
      confirmedBy: row.confirmed_by,
      confirmedAt: row.confirmed_at,
    }));
  }

  /**
   * Generate unique metric ID
   */
  private generateMetricId(): string {
    return `base_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
}

// Export singleton instance
export const baselineEstablisher = new BaselineEstablisher();
