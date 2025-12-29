/**
 * Trinity Dashboard Template
 * 
 * 3-pillar ROI view showing Revenue, Cost, and Risk impact.
 * Provides a balanced scorecard for value visualization.
 * 
 * Visual Structure:
 * ┌─────────────┬─────────────┬─────────────┐
 * │   REVENUE   │    COST     │    RISK     │
 * │   Impact    │   Savings   │  Reduction  │
 * ├─────────────┼─────────────┼─────────────┤
 * │   $XXX,XXX  │   $XXX,XXX  │   $XXX,XXX  │
 * │   +XX KPIs  │   +XX KPIs  │   +XX KPIs  │
 * └─────────────┴─────────────┴─────────────┘
 *              TOTAL VALUE: $X.XM
 */

import React, { useMemo } from 'react';
import type { TemplateProps, MetricData, OutcomeData } from './index';

type PillarType = 'revenue' | 'cost' | 'risk';

interface PillarData {
  type: PillarType;
  title: string;
  value: number;
  outcomes: OutcomeData[];
  metrics: MetricData[];
  color: string;
  icon: React.ReactNode;
  trend: 'up' | 'down' | 'neutral';
}

export interface TrinityDashboardProps extends TemplateProps {
  /** Show detailed breakdown per pillar */
  showBreakdown?: boolean;
  /** Compact mode for embedding */
  compact?: boolean;
  /** Highlight the dominant pillar */
  highlightDominant?: boolean;
}

export const TrinityDashboard: React.FC<TrinityDashboardProps> = ({
  dataSource,
  interactive = true,
  onMetricClick,
  onOutcomeClick,
  className = '',
  showBreakdown = true,
  compact = false,
  highlightDominant = true,
}) => {
  // Build pillar data from data source
  const pillars = useMemo((): PillarData[] => {
    const revenueOutcomes = dataSource.outcomes?.filter(o => o.category === 'revenue') || [];
    const costOutcomes = dataSource.outcomes?.filter(o => o.category === 'cost') || [];
    const riskOutcomes = dataSource.outcomes?.filter(o => o.category === 'risk') || [];

    return [
      {
        type: 'revenue',
        title: 'Revenue Impact',
        value: dataSource.financials?.revenueImpact || 0,
        outcomes: revenueOutcomes,
        metrics: dataSource.metrics?.filter(m => m.name.toLowerCase().includes('revenue') || m.name.toLowerCase().includes('sales')) || [],
        color: 'emerald',
        icon: (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        ),
        trend: 'up',
      },
      {
        type: 'cost',
        title: 'Cost Savings',
        value: dataSource.financials?.costSavings || 0,
        outcomes: costOutcomes,
        metrics: dataSource.metrics?.filter(m => m.name.toLowerCase().includes('cost') || m.name.toLowerCase().includes('efficiency')) || [],
        color: 'blue',
        icon: (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
        trend: 'down',
      },
      {
        type: 'risk',
        title: 'Risk Reduction',
        value: dataSource.financials?.riskReduction || 0,
        outcomes: riskOutcomes,
        metrics: dataSource.metrics?.filter(m => m.name.toLowerCase().includes('risk') || m.name.toLowerCase().includes('compliance')) || [],
        color: 'amber',
        icon: (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        ),
        trend: 'down',
      },
    ];
  }, [dataSource]);

  // Find dominant pillar
  const dominantPillar = useMemo(() => {
    return pillars.reduce((max, p) => p.value > max.value ? p : max, pillars[0]);
  }, [pillars]);

  // Calculate total value
  const totalValue = useMemo(() => {
    return pillars.reduce((sum, p) => sum + p.value, 0);
  }, [pillars]);

  // Get color classes
  const getColorClasses = (color: string, isHighlighted: boolean) => ({
    bg: isHighlighted ? `bg-${color}-100` : `bg-${color}-50`,
    border: `border-${color}-300`,
    text: `text-${color}-700`,
    accent: `text-${color}-600`,
  });

  // Format currency
  const formatCurrency = (value: number): string => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    }
    return `$${value.toLocaleString()}`;
  };

  // Handle outcome click
  const handleOutcomeClick = (outcome: OutcomeData) => {
    if (interactive && onOutcomeClick) {
      onOutcomeClick(outcome);
    }
  };

  return (
    <div className={`trinity-dashboard-template ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Value Trinity</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Total Value:</span>
          <span className="text-lg font-bold text-emerald-600">{formatCurrency(totalValue)}</span>
        </div>
      </div>

      {/* Three Pillars */}
      <div className={`grid gap-4 ${compact ? 'grid-cols-3' : 'md:grid-cols-3'}`}>
        {pillars.map((pillar) => {
          const isHighlighted = highlightDominant && pillar.type === dominantPillar.type;
          const colorClasses = {
            emerald: {
              bg: isHighlighted ? 'bg-emerald-100' : 'bg-emerald-50',
              border: 'border-emerald-300',
              text: 'text-emerald-700',
              accent: 'text-emerald-600',
            },
            blue: {
              bg: isHighlighted ? 'bg-blue-100' : 'bg-blue-50',
              border: 'border-blue-300',
              text: 'text-blue-700',
              accent: 'text-blue-600',
            },
            amber: {
              bg: isHighlighted ? 'bg-amber-100' : 'bg-amber-50',
              border: 'border-amber-300',
              text: 'text-amber-700',
              accent: 'text-amber-600',
            },
          }[pillar.color] || {
            bg: 'bg-gray-50',
            border: 'border-gray-300',
            text: 'text-gray-700',
            accent: 'text-gray-600',
          };

          return (
            <div
              key={pillar.type}
              className={`
                pillar-card rounded-xl border-2 p-4
                ${colorClasses.bg} ${colorClasses.border}
                ${isHighlighted ? 'ring-2 ring-offset-2 ring-current' : ''}
                transition-all duration-200
              `}
            >
              {/* Pillar Header */}
              <div className="flex items-center gap-2 mb-3">
                <div className={colorClasses.accent}>{pillar.icon}</div>
                <h3 className={`font-medium ${colorClasses.text}`}>{pillar.title}</h3>
              </div>

              {/* Value */}
              <div className={`text-3xl font-bold ${colorClasses.accent} mb-2`}>
                {formatCurrency(pillar.value)}
              </div>

              {/* Percentage of total */}
              <div className="text-sm text-gray-500 mb-4">
                {totalValue > 0 ? ((pillar.value / totalValue) * 100).toFixed(0) : 0}% of total
              </div>

              {/* Breakdown */}
              {showBreakdown && !compact && (
                <div className="pt-3 border-t border-gray-200">
                  <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">
                    {pillar.outcomes.length} Outcomes
                  </div>
                  <div className="space-y-1">
                    {pillar.outcomes.slice(0, 3).map(outcome => (
                      <div
                        key={outcome.id}
                        onClick={() => handleOutcomeClick(outcome)}
                        className={`
                          text-sm text-gray-700 truncate
                          ${interactive ? 'cursor-pointer hover:text-gray-900' : ''}
                        `}
                      >
                        • {outcome.name}
                      </div>
                    ))}
                    {pillar.outcomes.length > 3 && (
                      <div className="text-xs text-gray-400">
                        +{pillar.outcomes.length - 3} more
                      </div>
                    )}
                    {pillar.outcomes.length === 0 && (
                      <div className="text-xs text-gray-400 italic">No outcomes defined</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary Bar */}
      <div className="mt-6 bg-gray-100 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            {dataSource.financials?.roi !== undefined && (
              <div>
                <span className="text-sm text-gray-500">ROI</span>
                <span className="ml-2 font-semibold text-gray-900">{dataSource.financials.roi}%</span>
              </div>
            )}
            {dataSource.financials?.paybackPeriod && (
              <div>
                <span className="text-sm text-gray-500">Payback</span>
                <span className="ml-2 font-semibold text-gray-900">{dataSource.financials.paybackPeriod}</span>
              </div>
            )}
            {dataSource.financials?.npv !== undefined && (
              <div>
                <span className="text-sm text-gray-500">NPV</span>
                <span className="ml-2 font-semibold text-gray-900">{formatCurrency(dataSource.financials.npv)}</span>
              </div>
            )}
          </div>
          <div className="text-right">
            <span className="text-sm text-gray-500">Total Outcomes</span>
            <span className="ml-2 font-semibold text-gray-900">{dataSource.outcomes?.length || 0}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrinityDashboard;
