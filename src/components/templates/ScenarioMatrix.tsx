/**
 * Scenario Matrix Template
 * 
 * What-if comparison views allowing side-by-side scenario analysis.
 * Supports Conservative, Expected, and Optimistic scenarios.
 * 
 * Visual Structure:
 * ┌─────────────┬─────────────┬─────────────┐
 * │ CONSERVATIVE│  EXPECTED   │ OPTIMISTIC  │
 * │    (Base)   │  (Target)   │  (Stretch)  │
 * ├─────────────┼─────────────┼─────────────┤
 * │   KPI 1     │   KPI 1     │   KPI 1     │
 * │   KPI 2     │   KPI 2     │   KPI 2     │
 * │   ...       │   ...       │   ...       │
 * ├─────────────┼─────────────┼─────────────┤
 * │   $XXX,XXX  │   $XXX,XXX  │   $XXX,XXX  │
 * └─────────────┴─────────────┴─────────────┘
 */

import React, { useMemo, useState } from 'react';
import type { FinancialData, MetricData, TemplateProps } from './index';

type ScenarioType = 'conservative' | 'expected' | 'optimistic';

interface Scenario {
  id: ScenarioType;
  name: string;
  description: string;
  modifier: number; // Multiplier applied to base values
  color: string;
  metrics: MetricData[];
  financials: FinancialData;
  probability?: number;
}

interface ScenarioInput {
  type: ScenarioType;
  name?: string;
  modifier?: number;
  probability?: number;
}

export interface ScenarioMatrixProps extends TemplateProps {
  /** Custom scenario configurations */
  scenarios?: ScenarioInput[];
  /** Show probability-weighted expected value */
  showWeightedValue?: boolean;
  /** Allow scenario selection */
  selectable?: boolean;
  /** Selected scenario (controlled) */
  selectedScenario?: ScenarioType;
  /** Callback when scenario is selected */
  onScenarioSelect?: (scenario: ScenarioType) => void;
}

export const ScenarioMatrix: React.FC<ScenarioMatrixProps> = ({
  dataSource,
  interactive = true,
  onMetricClick,
  className = '',
  scenarios: customScenarios,
  showWeightedValue = true,
  selectable = true,
  selectedScenario,
  onScenarioSelect,
}) => {
  const [internalSelected, setInternalSelected] = useState<ScenarioType>('expected');
  const selected = selectedScenario ?? internalSelected;

  // Default scenario configurations
  const defaultScenarios: ScenarioInput[] = [
    { type: 'conservative', name: 'Conservative', modifier: 0.7, probability: 0.25 },
    { type: 'expected', name: 'Expected', modifier: 1.0, probability: 0.50 },
    { type: 'optimistic', name: 'Optimistic', modifier: 1.4, probability: 0.25 },
  ];

  // Build scenarios from base data
  const scenarioData = useMemo((): Scenario[] => {
    const configs = customScenarios?.length ? customScenarios : defaultScenarios;
    const baseFinancials = dataSource.financials || {
      totalValue: 0,
      revenueImpact: 0,
      costSavings: 0,
      riskReduction: 0,
    };

    return configs.map(config => {
      const modifier = config.modifier || 1.0;
      const colors: Record<ScenarioType, string> = {
        conservative: 'amber',
        expected: 'blue',
        optimistic: 'emerald',
      };

      // Apply modifier to metrics
      const modifiedMetrics: MetricData[] = (dataSource.metrics || []).map(m => ({
        ...m,
        target: m.target !== undefined ? Math.round(m.target * modifier) : undefined,
        value: Math.round(m.value * modifier),
      }));

      // Apply modifier to financials
      const modifiedFinancials: FinancialData = {
        totalValue: Math.round(baseFinancials.totalValue * modifier),
        revenueImpact: Math.round(baseFinancials.revenueImpact * modifier),
        costSavings: Math.round(baseFinancials.costSavings * modifier),
        riskReduction: Math.round(baseFinancials.riskReduction * modifier),
        roi: baseFinancials.roi !== undefined ? Math.round(baseFinancials.roi * modifier) : undefined,
        paybackPeriod: baseFinancials.paybackPeriod,
        npv: baseFinancials.npv !== undefined ? Math.round(baseFinancials.npv * modifier) : undefined,
      };

      return {
        id: config.type,
        name: config.name || config.type.charAt(0).toUpperCase() + config.type.slice(1),
        description: getScenarioDescription(config.type),
        modifier,
        color: colors[config.type],
        metrics: modifiedMetrics,
        financials: modifiedFinancials,
        probability: config.probability,
      };
    });
  }, [dataSource, customScenarios]);

  // Calculate weighted expected value
  const weightedValue = useMemo(() => {
    if (!showWeightedValue) return null;
    let total = 0;
    let probabilitySum = 0;
    
    scenarioData.forEach(s => {
      if (s.probability) {
        total += s.financials.totalValue * s.probability;
        probabilitySum += s.probability;
      }
    });

    return probabilitySum > 0 ? Math.round(total) : null;
  }, [scenarioData, showWeightedValue]);

  // Handle scenario selection
  const handleSelect = (scenario: ScenarioType) => {
    if (!selectable) return;
    if (onScenarioSelect) {
      onScenarioSelect(scenario);
    } else {
      setInternalSelected(scenario);
    }
  };

  // Format currency
  const formatCurrency = (value: number): string => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toLocaleString()}`;
  };

  // Get scenario description
  function getScenarioDescription(type: ScenarioType): string {
    const descriptions: Record<ScenarioType, string> = {
      conservative: 'Minimum expected results with highest certainty',
      expected: 'Most likely outcome based on analysis',
      optimistic: 'Best case with favorable conditions',
    };
    return descriptions[type];
  }

  // Get color classes
  const getColorClasses = (color: string, isSelected: boolean) => {
    const colorMap: Record<string, { bg: string; border: string; text: string; header: string }> = {
      amber: {
        bg: isSelected ? 'bg-amber-100' : 'bg-amber-50',
        border: 'border-amber-300',
        text: 'text-amber-700',
        header: 'bg-amber-200',
      },
      blue: {
        bg: isSelected ? 'bg-blue-100' : 'bg-blue-50',
        border: 'border-blue-300',
        text: 'text-blue-700',
        header: 'bg-blue-200',
      },
      emerald: {
        bg: isSelected ? 'bg-emerald-100' : 'bg-emerald-50',
        border: 'border-emerald-300',
        text: 'text-emerald-700',
        header: 'bg-emerald-200',
      },
    };
    return colorMap[color] || colorMap.blue;
  };

  return (
    <div className={`scenario-matrix-template ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Scenario Analysis</h2>
          <p className="text-sm text-gray-500 mt-1">Compare outcomes across different scenarios</p>
        </div>
        {weightedValue !== null && (
          <div className="text-right">
            <div className="text-sm text-gray-500">Probability-Weighted Value</div>
            <div className="text-xl font-bold text-blue-600">{formatCurrency(weightedValue)}</div>
          </div>
        )}
      </div>

      {/* Scenario Cards */}
      <div className="grid grid-cols-3 gap-4">
        {scenarioData.map((scenario) => {
          const isSelected = selected === scenario.id;
          const colors = getColorClasses(scenario.color, isSelected);

          return (
            <div
              key={scenario.id}
              onClick={() => handleSelect(scenario.id)}
              className={`
                scenario-card rounded-xl overflow-hidden border-2
                ${colors.border}
                ${selectable ? 'cursor-pointer' : ''}
                ${isSelected ? 'ring-2 ring-offset-2 ring-current shadow-lg' : ''}
                transition-all duration-200
              `}
            >
              {/* Card Header */}
              <div className={`${colors.header} px-4 py-3`}>
                <div className="flex items-center justify-between">
                  <h3 className={`font-semibold ${colors.text}`}>{scenario.name}</h3>
                  {scenario.probability !== undefined && (
                    <span className={`text-sm ${colors.text}`}>
                      {(scenario.probability * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-600 mt-1">{scenario.description}</p>
              </div>

              {/* Card Body */}
              <div className={`${colors.bg} px-4 py-4`}>
                {/* Total Value */}
                <div className="text-center mb-4 pb-4 border-b border-gray-200">
                  <div className={`text-3xl font-bold ${colors.text}`}>
                    {formatCurrency(scenario.financials.totalValue)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Total Value</div>
                </div>

                {/* Financial Breakdown */}
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Revenue</span>
                    <span className="font-medium">{formatCurrency(scenario.financials.revenueImpact)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Cost Savings</span>
                    <span className="font-medium">{formatCurrency(scenario.financials.costSavings)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Risk Reduction</span>
                    <span className="font-medium">{formatCurrency(scenario.financials.riskReduction)}</span>
                  </div>
                  {scenario.financials.roi !== undefined && (
                    <div className="flex justify-between text-sm pt-2 border-t border-gray-200">
                      <span className="text-gray-600">ROI</span>
                      <span className="font-semibold">{scenario.financials.roi}%</span>
                    </div>
                  )}
                </div>

                {/* Metrics Preview */}
                {scenario.metrics.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">
                      Key Metrics
                    </div>
                    <div className="space-y-1">
                      {scenario.metrics.slice(0, 3).map(metric => (
                        <div
                          key={metric.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (interactive && onMetricClick) onMetricClick(metric);
                          }}
                          className={`
                            flex justify-between text-xs
                            ${interactive && onMetricClick ? 'hover:bg-white/50 rounded px-1 -mx-1 cursor-pointer' : ''}
                          `}
                        >
                          <span className="text-gray-600 truncate">{metric.name}</span>
                          <span className="font-medium">
                            {metric.value} {metric.unit}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Selection Indicator */}
              {selectable && (
                <div className={`${colors.header} px-4 py-2 flex items-center justify-center`}>
                  <div className={`
                    w-4 h-4 rounded-full border-2
                    ${isSelected ? 'bg-current border-current' : 'border-gray-400 bg-white'}
                  `}>
                    {isSelected && (
                      <svg className="w-full h-full text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <span className="ml-2 text-sm text-gray-600">
                    {isSelected ? 'Selected' : 'Select'}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Comparison Summary */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Value Range:</span>
          <span className="font-medium">
            {formatCurrency(Math.min(...scenarioData.map(s => s.financials.totalValue)))}
            {' – '}
            {formatCurrency(Math.max(...scenarioData.map(s => s.financials.totalValue)))}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ScenarioMatrix;
