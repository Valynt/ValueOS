/**
 * Impact Cascade Template
 * 
 * Value driver waterfall visualization showing how capabilities flow 
 * through outcomes to financial impact.
 * 
 * Visual Structure:
 * [Capability] → [Outcome] → [KPI Improvement] → [Financial Impact]
 *      ↓              ↓              ↓                   ↓
 *   Multiple      Quantified      Measurable          Revenue/
 *   Features      Benefits        Targets             Cost/Risk
 */

import React, { useMemo } from 'react';
import type { TemplateProps, MetricData, OutcomeData } from './index';

interface CascadeNode {
  id: string;
  label: string;
  type: 'capability' | 'outcome' | 'kpi' | 'financial';
  value?: number;
  unit?: string;
  children: CascadeNode[];
}

interface CascadeLevel {
  title: string;
  nodes: CascadeNode[];
  totalValue: number;
}

export interface ImpactCascadeProps extends TemplateProps {
  /** Show connecting lines between nodes */
  showConnections?: boolean;
  /** Animate the cascade flow */
  animated?: boolean;
  /** Color scheme */
  colorScheme?: 'default' | 'monochrome' | 'gradient';
}

export const ImpactCascadeTemplate: React.FC<ImpactCascadeProps> = ({
  dataSource,
  interactive = true,
  onMetricClick,
  onOutcomeClick,
  className = '',
  showConnections = true,
  animated = true,
  colorScheme = 'default',
}) => {
  // Build cascade levels from data source
  const cascadeLevels = useMemo(() => {
    const levels: CascadeLevel[] = [];

    // Level 1: Capabilities (derived from outcomes)
    const capabilities = new Map<string, CascadeNode>();
    dataSource.outcomes?.forEach(outcome => {
      const capabilityId = `cap-${outcome.category}`;
      if (!capabilities.has(capabilityId)) {
        capabilities.set(capabilityId, {
          id: capabilityId,
          label: `${outcome.category.charAt(0).toUpperCase() + outcome.category.slice(1)} Capabilities`,
          type: 'capability',
          children: [],
        });
      }
    });

    levels.push({
      title: 'Capabilities',
      nodes: Array.from(capabilities.values()),
      totalValue: 0,
    });

    // Level 2: Outcomes
    const outcomeNodes: CascadeNode[] = (dataSource.outcomes || []).map(outcome => ({
      id: outcome.id,
      label: outcome.name,
      type: 'outcome' as const,
      value: outcome.impact,
      unit: '$',
      children: [],
    }));

    levels.push({
      title: 'Business Outcomes',
      nodes: outcomeNodes,
      totalValue: outcomeNodes.reduce((sum, n) => sum + (n.value || 0), 0),
    });

    // Level 3: KPIs
    const kpiNodes: CascadeNode[] = (dataSource.metrics || []).map(metric => ({
      id: metric.id,
      label: metric.name,
      type: 'kpi' as const,
      value: metric.target ? ((metric.target - (metric.baseline || metric.value)) / (metric.baseline || metric.value) * 100) : 0,
      unit: '%',
      children: [],
    }));

    levels.push({
      title: 'KPI Improvements',
      nodes: kpiNodes,
      totalValue: kpiNodes.length,
    });

    // Level 4: Financial Impact
    const financialNodes: CascadeNode[] = [];
    if (dataSource.financials) {
      if (dataSource.financials.revenueImpact > 0) {
        financialNodes.push({
          id: 'fin-revenue',
          label: 'Revenue Impact',
          type: 'financial',
          value: dataSource.financials.revenueImpact,
          unit: '$',
          children: [],
        });
      }
      if (dataSource.financials.costSavings > 0) {
        financialNodes.push({
          id: 'fin-cost',
          label: 'Cost Savings',
          type: 'financial',
          value: dataSource.financials.costSavings,
          unit: '$',
          children: [],
        });
      }
      if (dataSource.financials.riskReduction > 0) {
        financialNodes.push({
          id: 'fin-risk',
          label: 'Risk Reduction',
          type: 'financial',
          value: dataSource.financials.riskReduction,
          unit: '$',
          children: [],
        });
      }
    }

    levels.push({
      title: 'Financial Impact',
      nodes: financialNodes,
      totalValue: dataSource.financials?.totalValue || 0,
    });

    return levels;
  }, [dataSource]);

  // Get color for node type
  const getNodeColor = (type: CascadeNode['type']): string => {
    if (colorScheme === 'monochrome') {
      return 'bg-gray-100 border-gray-300';
    }
    
    const colors: Record<CascadeNode['type'], string> = {
      capability: 'bg-blue-50 border-blue-300 hover:bg-blue-100',
      outcome: 'bg-green-50 border-green-300 hover:bg-green-100',
      kpi: 'bg-amber-50 border-amber-300 hover:bg-amber-100',
      financial: 'bg-emerald-50 border-emerald-400 hover:bg-emerald-100',
    };
    return colors[type];
  };

  // Format value for display
  const formatValue = (value: number | undefined, unit: string | undefined): string => {
    if (value === undefined) return '';
    if (unit === '$') {
      return `$${value.toLocaleString()}`;
    }
    if (unit === '%') {
      return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
    }
    return `${value} ${unit || ''}`;
  };

  // Handle node click
  const handleNodeClick = (node: CascadeNode) => {
    if (!interactive) return;
    
    if (node.type === 'kpi' && onMetricClick) {
      const metric = dataSource.metrics?.find(m => m.id === node.id);
      if (metric) onMetricClick(metric);
    } else if (node.type === 'outcome' && onOutcomeClick) {
      const outcome = dataSource.outcomes?.find(o => o.id === node.id);
      if (outcome) onOutcomeClick(outcome);
    }
  };

  return (
    <div className={`impact-cascade-template ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Impact Cascade</h2>
        <div className="text-sm text-gray-500">
          Total Value: <span className="font-semibold text-emerald-600">
            ${dataSource.financials?.totalValue?.toLocaleString() || '0'}
          </span>
        </div>
      </div>

      {/* Cascade Levels */}
      <div className="flex flex-col gap-8">
        {cascadeLevels.map((level, levelIndex) => (
          <div key={level.title} className="cascade-level">
            {/* Level Header */}
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium text-gray-600">
                {levelIndex + 1}
              </div>
              <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wide">
                {level.title}
              </h3>
              {level.totalValue > 0 && (
                <span className="ml-auto text-sm text-gray-500">
                  {level.title === 'Financial Impact' 
                    ? `$${level.totalValue.toLocaleString()}`
                    : `${level.nodes.length} items`}
                </span>
              )}
            </div>

            {/* Nodes */}
            <div className="flex flex-wrap gap-3">
              {level.nodes.map((node, nodeIndex) => (
                <div
                  key={node.id}
                  onClick={() => handleNodeClick(node)}
                  className={`
                    cascade-node
                    px-4 py-3 rounded-lg border-2 
                    ${getNodeColor(node.type)}
                    ${interactive ? 'cursor-pointer' : ''}
                    ${animated ? 'transition-all duration-200' : ''}
                    min-w-[140px]
                  `}
                  style={{
                    animationDelay: animated ? `${levelIndex * 100 + nodeIndex * 50}ms` : undefined,
                  }}
                >
                  <div className="text-sm font-medium text-gray-800">{node.label}</div>
                  {node.value !== undefined && (
                    <div className="text-lg font-semibold text-gray-900 mt-1">
                      {formatValue(node.value, node.unit)}
                    </div>
                  )}
                </div>
              ))}

              {level.nodes.length === 0 && (
                <div className="text-sm text-gray-400 italic px-4 py-3">
                  No data available
                </div>
              )}
            </div>

            {/* Connection Arrow to next level */}
            {showConnections && levelIndex < cascadeLevels.length - 1 && (
              <div className="flex justify-center mt-4">
                <svg className="w-6 h-6 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Summary Footer */}
      {dataSource.financials && (
        <div className="mt-8 pt-6 border-t border-gray-200">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-600">
                ${dataSource.financials.totalValue.toLocaleString()}
              </div>
              <div className="text-xs text-gray-500 uppercase tracking-wide">Total Value</div>
            </div>
            {dataSource.financials.roi !== undefined && (
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {dataSource.financials.roi}%
                </div>
                <div className="text-xs text-gray-500 uppercase tracking-wide">ROI</div>
              </div>
            )}
            {dataSource.financials.paybackPeriod && (
              <div className="text-center">
                <div className="text-2xl font-bold text-amber-600">
                  {dataSource.financials.paybackPeriod}
                </div>
                <div className="text-xs text-gray-500 uppercase tracking-wide">Payback</div>
              </div>
            )}
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-700">
                {dataSource.outcomes?.length || 0}
              </div>
              <div className="text-xs text-gray-500 uppercase tracking-wide">Outcomes</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImpactCascadeTemplate;
