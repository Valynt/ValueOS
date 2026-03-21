/**
 * Shared mapping utilities for the Value Graph.
 *
 * Centralises category → VgValueDriverType and unit → VgMetricUnit conversions
 * so OpportunityAgent and FinancialModelingAgent stay in sync.
 */

import type { VgMetricUnit, VgValueDriverType } from '@valueos/shared';

/**
 * Maps a free-text category string to the fixed VgValueDriverType taxonomy.
 * Unknown categories default to 'cost_reduction'.
 */
export function mapCategoryToValueDriverType(category: string): VgValueDriverType {
  const mapping: Record<string, VgValueDriverType> = {
    revenue_growth: 'revenue_growth',
    revenue: 'revenue_growth',
    cost_reduction: 'cost_reduction',
    cost_savings: 'cost_reduction',
    efficiency: 'cost_reduction',
    productivity: 'cost_reduction',
    operational_efficiency: 'cost_reduction',
    risk_mitigation: 'risk_mitigation',
    risk: 'risk_mitigation',
    capital_efficiency: 'capital_efficiency',
  };
  return mapping[category] ?? 'cost_reduction';
}

/**
 * Maps a free-text unit string to the VgMetricUnit enum.
 * Unknown units default to 'usd'.
 */
export function mapUnitToVgMetricUnit(unit: string): VgMetricUnit {
  const mapping: Record<string, VgMetricUnit> = {
    usd: 'usd',
    USD: 'usd',
    dollars: 'usd',
    percent: 'percent',
    '%': 'percent',
    hours: 'hours',
    hrs: 'hours',
    headcount: 'headcount',
    hc: 'headcount',
    days: 'days',
    count: 'count',
    score: 'score',
  };
  return mapping[unit] ?? 'usd';
}
