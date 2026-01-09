/**
 * Quantum View Template
 * 
 * Multi-dimensional analysis visualization for complex value relationships.
 * Shows value from multiple perspectives simultaneously.
 * 
 * Dimensions:
 * - Time: Short-term vs Long-term value
 * - Scope: Department vs Enterprise impact
 * - Certainty: Measured vs Projected value
 * - Category: Revenue / Cost / Risk
 */

import React, { useMemo, useState } from 'react';
import type { FinancialData, MetricData, OutcomeData, TemplateProps } from './index';

type Dimension = 'time' | 'scope' | 'certainty' | 'category';
type TimeFrame = 'short' | 'medium' | 'long';
type Scope = 'team' | 'department' | 'enterprise';
type Certainty = 'measured' | 'projected' | 'aspirational';

interface DimensionValue {
  id: string;
  label: string;
  value: number;
  percentage: number;
  items: Array<{ name: string; value: number }>;
}

interface QuantumData {
  dimension: Dimension;
  label: string;
  values: DimensionValue[];
  total: number;
}

export interface QuantumViewProps extends TemplateProps {
  /** Initial dimension to display */
  initialDimension?: Dimension;
  /** Show dimension selector */
  showDimensionSelector?: boolean;
  /** Enable comparison mode */
  comparisonMode?: boolean;
  /** Custom time horizons */
  timeHorizons?: { short: string; medium: string; long: string };
}

export const QuantumView: React.FC<QuantumViewProps> = ({
  dataSource,
  interactive = true,
  onMetricClick,
  onOutcomeClick,
  className = '',
  initialDimension = 'category',
  showDimensionSelector = true,
  comparisonMode = false,
  timeHorizons = { short: '0-6 months', medium: '6-12 months', long: '12+ months' },
}) => {
  const [activeDimension, setActiveDimension] = useState<Dimension>(initialDimension);
  const [comparisonDimension, setComparisonDimension] = useState<Dimension | null>(null);

  // Build quantum data for each dimension
  const quantumData = useMemo((): Record<Dimension, QuantumData> => {
    const financials = dataSource.financials || {
      totalValue: 0,
      revenueImpact: 0,
      costSavings: 0,
      riskReduction: 0,
    };
    const outcomes = dataSource.outcomes || [];
    const total = financials.totalValue;

    // Time dimension - distribute value across time horizons
    const timeDimension: QuantumData = {
      dimension: 'time',
      label: 'Value Timeline',
      total,
      values: [
        {
          id: 'short',
          label: timeHorizons.short,
          value: Math.round(total * 0.25),
          percentage: 25,
          items: outcomes.slice(0, 2).map(o => ({ name: o.name, value: o.impact || 0 })),
        },
        {
          id: 'medium',
          label: timeHorizons.medium,
          value: Math.round(total * 0.45),
          percentage: 45,
          items: outcomes.slice(2, 5).map(o => ({ name: o.name, value: o.impact || 0 })),
        },
        {
          id: 'long',
          label: timeHorizons.long,
          value: Math.round(total * 0.30),
          percentage: 30,
          items: outcomes.slice(5).map(o => ({ name: o.name, value: o.impact || 0 })),
        },
      ],
    };

    // Scope dimension - team, department, enterprise
    const scopeDimension: QuantumData = {
      dimension: 'scope',
      label: 'Impact Scope',
      total,
      values: [
        {
          id: 'team',
          label: 'Team Level',
          value: Math.round(total * 0.20),
          percentage: 20,
          items: [{ name: 'Direct user productivity', value: Math.round(total * 0.15) }],
        },
        {
          id: 'department',
          label: 'Department Level',
          value: Math.round(total * 0.35),
          percentage: 35,
          items: [{ name: 'Process efficiency', value: Math.round(total * 0.25) }],
        },
        {
          id: 'enterprise',
          label: 'Enterprise Level',
          value: Math.round(total * 0.45),
          percentage: 45,
          items: [{ name: 'Strategic transformation', value: Math.round(total * 0.40) }],
        },
      ],
    };

    // Certainty dimension
    const certaintyDimension: QuantumData = {
      dimension: 'certainty',
      label: 'Value Certainty',
      total,
      values: [
        {
          id: 'measured',
          label: 'Measured',
          value: Math.round(total * 0.30),
          percentage: 30,
          items: outcomes
            .filter(o => o.impact && o.impact > 0)
            .slice(0, 2)
            .map(o => ({ name: o.name, value: o.impact || 0 })),
        },
        {
          id: 'projected',
          label: 'Projected',
          value: Math.round(total * 0.50),
          percentage: 50,
          items: outcomes
            .slice(0, 3)
            .map(o => ({ name: o.name, value: o.impact || 0 })),
        },
        {
          id: 'aspirational',
          label: 'Aspirational',
          value: Math.round(total * 0.20),
          percentage: 20,
          items: outcomes
            .slice(3, 5)
            .map(o => ({ name: o.name, value: o.impact || 0 })),
        },
      ],
    };

    // Category dimension (using actual financial data)
    const categoryDimension: QuantumData = {
      dimension: 'category',
      label: 'Value Categories',
      total,
      values: [
        {
          id: 'revenue',
          label: 'Revenue Impact',
          value: financials.revenueImpact,
          percentage: total > 0 ? Math.round((financials.revenueImpact / total) * 100) : 0,
          items: outcomes
            .filter(o => o.category === 'revenue')
            .map(o => ({ name: o.name, value: o.impact || 0 })),
        },
        {
          id: 'cost',
          label: 'Cost Savings',
          value: financials.costSavings,
          percentage: total > 0 ? Math.round((financials.costSavings / total) * 100) : 0,
          items: outcomes
            .filter(o => o.category === 'cost')
            .map(o => ({ name: o.name, value: o.impact || 0 })),
        },
        {
          id: 'risk',
          label: 'Risk Reduction',
          value: financials.riskReduction,
          percentage: total > 0 ? Math.round((financials.riskReduction / total) * 100) : 0,
          items: outcomes
            .filter(o => o.category === 'risk')
            .map(o => ({ name: o.name, value: o.impact || 0 })),
        },
      ],
    };

    return {
      time: timeDimension,
      scope: scopeDimension,
      certainty: certaintyDimension,
      category: categoryDimension,
    };
  }, [dataSource, timeHorizons]);

  // Get dimension config
  const dimensions: Record<Dimension, { label: string; icon: string }> = {
    time: { label: 'Timeline', icon: '⏱' },
    scope: { label: 'Scope', icon: '🎯' },
    certainty: { label: 'Certainty', icon: '📊' },
    category: { label: 'Category', icon: '💰' },
  };

  // Get color for dimension value
  const getValueColor = (dimension: Dimension, index: number): string => {
    const colors: Record<Dimension, string[]> = {
      time: ['bg-blue-500', 'bg-blue-400', 'bg-blue-300'],
      scope: ['bg-amber-500', 'bg-amber-400', 'bg-amber-300'],
      certainty: ['bg-emerald-500', 'bg-emerald-400', 'bg-emerald-300'],
      category: ['bg-green-500', 'bg-blue-500', 'bg-amber-500'],
    };
    return colors[dimension][index] || 'bg-gray-400';
  };

  // Format currency
  const formatCurrency = (value: number): string => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toLocaleString()}`;
  };

  const activeData = quantumData[activeDimension];
  const comparisonData = comparisonDimension ? quantumData[comparisonDimension] : null;

  return (
    <div className={`quantum-view-template ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Quantum Value View</h2>
          <p className="text-sm text-gray-500 mt-1">Multi-dimensional value analysis</p>
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-500">Total Value</div>
          <div className="text-2xl font-bold text-emerald-600">
            {formatCurrency(activeData.total)}
          </div>
        </div>
      </div>

      {/* Dimension Selector */}
      {showDimensionSelector && (
        <div className="flex gap-2 mb-6 p-1 bg-gray-100 rounded-lg">
          {(Object.keys(dimensions) as Dimension[]).map((dim) => (
            <button
              key={dim}
              onClick={() => setActiveDimension(dim)}
              className={`
                flex-1 px-4 py-2 rounded-md text-sm font-medium
                transition-all duration-200
                ${activeDimension === dim
                  ? 'bg-white text-gray-900 shadow'
                  : 'text-gray-600 hover:text-gray-900'
                }
              `}
            >
              <span className="mr-1">{dimensions[dim].icon}</span>
              {dimensions[dim].label}
            </button>
          ))}
        </div>
      )}

      {/* Main Visualization */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Bar Chart View */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-medium text-gray-700 mb-4">{activeData.label}</h3>
          
          {/* Stacked Bar */}
          <div className="h-8 rounded-full overflow-hidden flex mb-4">
            {activeData.values.map((value, i) => (
              <div
                key={value.id}
                className={`${getValueColor(activeDimension, i)} transition-all duration-300`}
                style={{ width: `${value.percentage}%` }}
                title={`${value.label}: ${formatCurrency(value.value)}`}
              />
            ))}
          </div>

          {/* Value Breakdown */}
          <div className="space-y-3">
            {activeData.values.map((value, i) => (
              <div
                key={value.id}
                className={`
                  p-3 rounded-lg border border-gray-100
                  ${interactive ? 'hover:bg-gray-50 cursor-pointer' : ''}
                  transition-colors duration-150
                `}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${getValueColor(activeDimension, i)}`} />
                    <span className="font-medium text-gray-800">{value.label}</span>
                  </div>
                  <span className="text-lg font-semibold text-gray-900">
                    {formatCurrency(value.value)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm text-gray-500">
                  <span>{value.percentage}% of total</span>
                  <span>{value.items.length} items</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Breakdown Details */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-medium text-gray-700 mb-4">Value Breakdown</h3>
          
          <div className="space-y-4">
            {activeData.values.map((value, i) => (
              <div key={value.id}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-2 h-2 rounded-full ${getValueColor(activeDimension, i)}`} />
                  <span className="text-sm font-medium text-gray-700">{value.label}</span>
                </div>
                
                {value.items.length > 0 ? (
                  <div className="pl-4 space-y-1">
                    {value.items.slice(0, 5).map((item, j) => (
                      <div
                        key={j}
                        className="flex justify-between text-sm text-gray-600"
                      >
                        <span className="truncate">{item.name}</span>
                        <span className="font-medium ml-2">
                          {item.value > 0 ? formatCurrency(item.value) : '-'}
                        </span>
                      </div>
                    ))}
                    {value.items.length > 5 && (
                      <div className="text-xs text-gray-400">
                        +{value.items.length - 5} more items
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="pl-4 text-sm text-gray-400 italic">
                    No items in this category
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="mt-6 grid grid-cols-4 gap-4">
        {(Object.keys(dimensions) as Dimension[]).map((dim) => {
          const data = quantumData[dim];
          const maxValue = Math.max(...data.values.map(v => v.value));
          const topCategory = data.values.find(v => v.value === maxValue);
          
          return (
            <div
              key={dim}
              onClick={() => setActiveDimension(dim)}
              className={`
                p-4 rounded-lg border cursor-pointer transition-all duration-200
                ${activeDimension === dim
                  ? 'border-blue-300 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
                }
              `}
            >
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                {dimensions[dim].icon} {dimensions[dim].label}
              </div>
              <div className="font-semibold text-gray-900">
                {topCategory?.label || 'N/A'}
              </div>
              <div className="text-sm text-gray-500">
                {topCategory ? formatCurrency(topCategory.value) : '-'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default QuantumView;
