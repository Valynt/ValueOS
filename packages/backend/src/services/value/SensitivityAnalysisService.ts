import { logger } from "../../lib/logger.js";
import { supabase } from "../../lib/supabase.js";
import Decimal from "decimal.js";

/**
 * Sensitivity result for a single assumption variation
 */
export interface SensitivityResult {
  assumptionId: string;
  assumptionName: string;
  baseValue: number;
  variationPercent: number;
  newValue: number;
  impactOnRoi: number;
  impactOnNpv: number;
  leverageScore: number;
}

/**
 * Complete sensitivity analysis for a case
 */
export interface CaseSensitivityAnalysis {
  caseId: string;
  organizationId: string;
  scenarioType: "conservative" | "base" | "upside";
  topLeverageAssumptions: SensitivityResult[];
  allResults: SensitivityResult[];
  analyzedAt: string;
}

/**
 * Assumption input for sensitivity analysis
 */
export interface AssumptionInput {
  id: string;
  name: string;
  value: number;
  unit: string;
  category?: string;
}

/**
 * Financial model function type for computing NPV/ROI
 */
export type FinancialModelFunction = (
  assumptions: Record<string, number>
) => { roi: number; npv: number };

/**
 * SensitivityAnalysis service performs what-if analysis on value model assumptions.
 * Varies key assumptions by ±20% to identify highest-leverage drivers.
 */
export class SensitivityAnalysisService {
  private readonly variationPercentages = [-20, -10, 10, 20];

  /**
   * Run sensitivity analysis for a set of assumptions.
   * Varies each assumption by ±20% while holding others constant.
   */
  async analyzeSensitivity(
    caseId: string,
    organizationId: string,
    assumptions: AssumptionInput[],
    baseAssumptions: Record<string, number>,
    modelFunction: FinancialModelFunction,
    scenarioType: "conservative" | "base" | "upside" = "base"
  ): Promise<CaseSensitivityAnalysis> {
    logger.info("Running sensitivity analysis", {
      caseId,
      assumptionCount: assumptions.length,
      scenarioType,
    });

    // Compute base case metrics
    const baseMetrics = modelFunction(baseAssumptions);

    const allResults: SensitivityResult[] = [];

    // Analyze each assumption
    for (const assumption of assumptions) {
      // Skip assumptions with zero value
      if (assumption.value === 0) continue;

      for (const variationPercent of this.variationPercentages) {
        // Create modified assumptions
        const modifiedAssumptions = { ...baseAssumptions };
        const variationFactor = 1 + variationPercent / 100;
        modifiedAssumptions[assumption.id] = assumption.value * variationFactor;

        // Compute metrics with modified assumption
        const modifiedMetrics = modelFunction(modifiedAssumptions);

        // Calculate impact
        const impactOnRoi = modifiedMetrics.roi - baseMetrics.roi;
        const impactOnNpv = modifiedMetrics.npv - baseMetrics.npv;

        // Calculate leverage score (normalized impact per 1% change)
        const leverageScore =
          Math.abs(impactOnNpv) / Math.abs(variationPercent);

        allResults.push({
          assumptionId: assumption.id,
          assumptionName: assumption.name,
          baseValue: assumption.value,
          variationPercent,
          newValue: modifiedAssumptions[assumption.id],
          impactOnRoi,
          impactOnNpv,
          leverageScore,
        });
      }
    }

    // Aggregate by assumption and calculate average leverage
    const leverageByAssumption = new Map<
      string,
      { name: string; avgLeverage: number; maxImpact: number }
    >();

    for (const result of allResults) {
      const existing = leverageByAssumption.get(result.assumptionId);
      if (existing) {
        existing.avgLeverage =
          (existing.avgLeverage + result.leverageScore) / 2;
        existing.maxImpact = Math.max(
          existing.maxImpact,
          Math.abs(result.impactOnNpv)
        );
      } else {
        leverageByAssumption.set(result.assumptionId, {
          name: result.assumptionName,
          avgLeverage: result.leverageScore,
          maxImpact: Math.abs(result.impactOnNpv),
        });
      }
    }

    // Sort by average leverage and get top 3
    const sortedAssumptions = Array.from(leverageByAssumption.entries())
      .sort((a, b) => b[1].avgLeverage - a[1].avgLeverage)
      .slice(0, 3);

    // Build top leverage results
    const topLeverageAssumptions: SensitivityResult[] = sortedAssumptions.map(
      ([id, data]) => {
        const bestResult = allResults
          .filter((r) => r.assumptionId === id)
          .sort((a, b) => b.leverageScore - a.leverageScore)[0];
        return bestResult || ({} as SensitivityResult);
      }
    );

    const analysis: CaseSensitivityAnalysis = {
      caseId,
      organizationId,
      scenarioType,
      topLeverageAssumptions,
      allResults,
      analyzedAt: new Date().toISOString(),
    };

    // Persist results
    await this.persistAnalysis(analysis);

    logger.info("Sensitivity analysis complete", {
      caseId,
      topAssumptionCount: topLeverageAssumptions.length,
      totalResultCount: allResults.length,
    });

    return analysis;
  }

  /**
   * Persist sensitivity analysis to database.
   */
  private async persistAnalysis(
    analysis: CaseSensitivityAnalysis
  ): Promise<void> {
    const { error } = await supabase
      .from("sensitivity_analyses")
      .insert({
        id: `sens_${Date.now()}_${analysis.caseId.slice(0, 8)}`,
        organization_id: analysis.organizationId,
        case_id: analysis.caseId,
        scenario_type: analysis.scenarioType,
        top_leverage_assumptions: analysis.topLeverageAssumptions,
        all_results: analysis.allResults.slice(0, 100), // Limit storage
        analyzed_at: analysis.analyzedAt,
      });

    if (error) {
      logger.error("Failed to persist sensitivity analysis", {
        caseId: analysis.caseId,
        error: error.message,
      });
    }
  }

  /**
   * Retrieve sensitivity analysis for a case.
   */
  async getAnalysis(
    caseId: string,
    organizationId: string,
    scenarioType?: "conservative" | "base" | "upside"
  ): Promise<CaseSensitivityAnalysis | null> {
    let query = supabase
      .from("sensitivity_analyses")
      .select("*")
      .eq("case_id", caseId)
      .eq("organization_id", organizationId)
      .order("analyzed_at", { ascending: false })
      .limit(1);

    if (scenarioType) {
      query = query.eq("scenario_type", scenarioType);
    }

    const { data, error } = await query.single();

    if (error || !data) {
      return null;
    }

    return {
      caseId: data.case_id,
      organizationId: data.organization_id,
      scenarioType: data.scenario_type,
      topLeverageAssumptions: data.top_leverage_assumptions,
      allResults: data.all_results,
      analyzedAt: data.analyzed_at,
    };
  }

  /**
   * Generate SDUI component data for sensitivity visualization.
   */
  generateSDUIComponent(
    analysis: CaseSensitivityAnalysis
  ): Record<string, unknown> {
    return {
      type: "component",
      component: "SensitivityTornado",
      version: 1,
      props: {
        title: `Sensitivity Analysis - ${
          analysis.scenarioType.charAt(0).toUpperCase() +
          analysis.scenarioType.slice(1)
        } Scenario`,
        assumptions: analysis.topLeverageAssumptions.map((a) => ({
          id: a.assumptionId,
          name: a.assumptionName,
          baseValue: a.baseValue,
          impactRange: {
            low: a.impactOnNpv * -1, // Negative variation impact
            high: a.impactOnNpv, // Positive variation impact
          },
          leverageScore: a.leverageScore,
        })),
        unit: "USD",
        interpretation: `Top ${analysis.topLeverageAssumptions.length} highest-leverage assumptions identified. ` +
          `Varying these by ±20% has the largest impact on NPV.`,
      },
    };
  }

  /**
   * Simple model function for testing/demo purposes.
   * Computes ROI and NPV from basic assumptions.
   */
  static createSimpleModel(
    investment: number,
    discountRate: number
  ): FinancialModelFunction {
    return (assumptions: Record<string, number>) => {
      const totalBenefit = Object.values(assumptions).reduce(
        (sum, val) => sum + (typeof val === "number" ? val : 0),
        0
      );
      const npv = totalBenefit / (1 + discountRate) - investment;
      const roi = investment > 0 ? (totalBenefit - investment) / investment : 0;
      return { roi, npv };
    };
  }
}

// Export singleton instance
export const sensitivityAnalysisService = new SensitivityAnalysisService();
