/**
 * Story Arc Canvas Template
 * 
 * Narrative progression visualization showing the value story journey.
 * Follows classic storytelling arc: Setup → Conflict → Resolution → Outcome
 * 
 * Visual Structure:
 *                    ★ Climax (ROI Revealed)
 *                   /  \
 *                  /    \
 *     Rising     /      \   Falling
 *     Action    /        \  Action
 *              /          \
 *   [Status   /            \  [Value
 *    Quo] ──○/              \○── Realized]
 *           │                │
 *     Pain Points        Outcomes
 */

import React, { useMemo } from 'react';
import type { TemplateProps, OutcomeData } from './index';

interface StoryPhase {
  id: string;
  title: string;
  subtitle: string;
  content: string[];
  position: 'start' | 'rising' | 'climax' | 'falling' | 'end';
  value?: number;
}

export interface StoryArcCanvasProps extends TemplateProps {
  /** Story mode - discovery (pain-focused) or proposal (value-focused) */
  storyMode?: 'discovery' | 'proposal' | 'realization';
  /** Show the arc visualization */
  showArc?: boolean;
  /** Custom phase labels */
  phaseLabels?: Partial<Record<StoryPhase['position'], string>>;
}

export const StoryArcCanvas: React.FC<StoryArcCanvasProps> = ({
  dataSource,
  interactive = true,
  onOutcomeClick,
  className = '',
  storyMode = 'proposal',
  showArc = true,
  phaseLabels = {},
}) => {
  // Build story phases from data source
  const phases = useMemo((): StoryPhase[] => {
    const defaultLabels = {
      start: 'Current State',
      rising: 'Challenges',
      climax: 'Solution',
      falling: 'Implementation',
      end: 'Future State',
    };

    const labels = { ...defaultLabels, ...phaseLabels };

    // Extract pain points from outcomes or metrics
    const painPoints = dataSource.outcomes
      ?.filter(o => o.category === 'cost' || o.category === 'risk')
      .slice(0, 3)
      .map(o => o.description) || ['Inefficient processes', 'Rising costs', 'Competitive pressure'];

    // Extract solution points
    const solutionPoints = dataSource.outcomes
      ?.filter(o => o.category === 'revenue')
      .slice(0, 3)
      .map(o => o.name) || ['Automation', 'Intelligence', 'Integration'];

    // Extract outcome points
    const outcomePoints = dataSource.outcomes
      ?.slice(0, 4)
      .map(o => `${o.name}: ${o.impact ? `$${o.impact.toLocaleString()}` : o.description}`) || [];

    return [
      {
        id: 'start',
        title: labels.start,
        subtitle: 'Where you are today',
        content: painPoints,
        position: 'start',
      },
      {
        id: 'rising',
        title: labels.rising,
        subtitle: 'Growing pressures',
        content: [
          'Manual processes limiting scale',
          'Competitive disadvantage emerging',
          'Customer expectations rising',
        ],
        position: 'rising',
      },
      {
        id: 'climax',
        title: labels.climax,
        subtitle: 'The transformation',
        content: solutionPoints,
        position: 'climax',
        value: dataSource.financials?.totalValue,
      },
      {
        id: 'falling',
        title: labels.falling,
        subtitle: 'The journey',
        content: [
          'Phased rollout approach',
          'Quick wins in 90 days',
          'Full value in 12 months',
        ],
        position: 'falling',
      },
      {
        id: 'end',
        title: labels.end,
        subtitle: 'Value realized',
        content: outcomePoints.length > 0 ? outcomePoints : [
          `${dataSource.financials?.roi || 0}% ROI`,
          `$${(dataSource.financials?.totalValue || 0).toLocaleString()} total value`,
          `${dataSource.financials?.paybackPeriod || '12 months'} payback`,
        ],
        position: 'end',
        value: dataSource.financials?.totalValue,
      },
    ];
  }, [dataSource, phaseLabels]);

  // Get position styles
  const getPositionStyles = (position: StoryPhase['position']) => {
    const styles: Record<StoryPhase['position'], { offset: string; color: string }> = {
      start: { offset: 'mt-16', color: 'border-gray-300 bg-gray-50' },
      rising: { offset: 'mt-8', color: 'border-amber-300 bg-amber-50' },
      climax: { offset: 'mt-0', color: 'border-emerald-400 bg-emerald-100 ring-2 ring-emerald-300' },
      falling: { offset: 'mt-8', color: 'border-blue-300 bg-blue-50' },
      end: { offset: 'mt-16', color: 'border-emerald-300 bg-emerald-50' },
    };
    return styles[position];
  };

  // Format currency
  const formatCurrency = (value: number): string => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toLocaleString()}`;
  };

  return (
    <div className={`story-arc-canvas-template ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Value Story</h2>
          <p className="text-sm text-gray-500 mt-1">Your transformation journey</p>
        </div>
        {dataSource.financials?.totalValue && (
          <div className="text-right">
            <div className="text-sm text-gray-500">Total Value</div>
            <div className="text-2xl font-bold text-emerald-600">
              {formatCurrency(dataSource.financials.totalValue)}
            </div>
          </div>
        )}
      </div>

      {/* Arc Visualization */}
      {showArc && (
        <div className="relative mb-8 h-8">
          <svg className="w-full h-full" viewBox="0 0 100 10" preserveAspectRatio="none">
            {/* Arc path */}
            <path
              d="M 0 8 Q 25 6 50 2 Q 75 6 100 8"
              fill="none"
              stroke="#d1d5db"
              strokeWidth="0.5"
              strokeDasharray="2,1"
            />
            {/* Phase markers */}
            {[0, 25, 50, 75, 100].map((x, i) => {
              const y = i === 2 ? 2 : (i === 1 || i === 3) ? 5 : 8;
              return (
                <circle
                  key={x}
                  cx={x}
                  cy={y}
                  r={i === 2 ? 1.5 : 1}
                  fill={i === 2 ? '#10b981' : '#6b7280'}
                />
              );
            })}
          </svg>
        </div>
      )}

      {/* Story Phases */}
      <div className="grid grid-cols-5 gap-4">
        {phases.map((phase) => {
          const styles = getPositionStyles(phase.position);
          
          return (
            <div
              key={phase.id}
              className={`
                story-phase
                ${styles.offset}
                transition-all duration-300
              `}
            >
              <div
                className={`
                  rounded-lg border-2 p-4
                  ${styles.color}
                  ${phase.position === 'climax' ? 'transform scale-105' : ''}
                `}
              >
                {/* Phase Header */}
                <div className="mb-3">
                  <h3 className="font-semibold text-gray-800 text-sm">{phase.title}</h3>
                  <p className="text-xs text-gray-500">{phase.subtitle}</p>
                </div>

                {/* Phase Content */}
                <ul className="space-y-1">
                  {phase.content.map((item, i) => (
                    <li key={i} className="text-xs text-gray-600 flex items-start gap-1">
                      <span className="text-gray-400 mt-0.5">•</span>
                      <span className="line-clamp-2">{item}</span>
                    </li>
                  ))}
                </ul>

                {/* Value Badge */}
                {phase.value !== undefined && phase.position === 'climax' && (
                  <div className="mt-3 pt-2 border-t border-emerald-200">
                    <div className="text-center">
                      <span className="text-lg font-bold text-emerald-600">
                        {formatCurrency(phase.value)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Connection indicator */}
              {phase.position !== 'end' && (
                <div className="flex justify-end mt-2 pr-2">
                  <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Story Summary */}
      <div className="mt-8 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex items-center gap-4">
          <div className="flex-shrink-0">
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="flex-1">
            <h4 className="font-medium text-gray-900">Your Value Story Summary</h4>
            <p className="text-sm text-gray-600 mt-1">
              Transform from current challenges to {formatCurrency(dataSource.financials?.totalValue || 0)} in realized value
              with a {dataSource.financials?.paybackPeriod || '12 month'} payback period.
            </p>
          </div>
          <div className="flex-shrink-0 text-right">
            <div className="text-2xl font-bold text-emerald-600">
              {dataSource.financials?.roi || 0}%
            </div>
            <div className="text-xs text-gray-500">ROI</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StoryArcCanvas;
