/**
 * ValueModelPanel
 *
 * Phase 2: Analyze — shows the value tree and financial scenarios.
 * Translates raw agent-built financial models into scannable business artifacts.
 */

import { useState } from 'react';
import { BarChart3, ChevronDown, ChevronRight, DollarSign, Info, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ValueGraph, ValueHypothesis, ValueNode } from '@/types/agent-ux';
import { ConfidenceBadge } from '@/components/trust/ConfidenceBadge';
import { EvidencePanel } from '@/components/trust/EvidencePanel';
import { SkeletonCard } from '@/components/async/StreamingText';
import { HeadlineValueCard } from '@/components/artifacts/HeadlineValueCard';

interface ValueModelPanelProps {
  valueGraph: ValueGraph | null;
  hypotheses: ValueHypothesis[];
  isLoading: boolean;
  onSelectNode: (nodeId: string | null) => void;
  selectedNodeId: string | null;
  onAcceptHypothesis: (id: string) => void;
  onRejectHypothesis: (id: string) => void;
  className?: string;
}

const CATEGORY_CONFIG = {
  efficiency: { color: 'text-blue-300', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
  revenue: { color: 'text-emerald-300', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  risk: { color: 'text-amber-300', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  'cost-avoidance': { color: 'text-violet-300', bg: 'bg-violet-500/10', border: 'border-violet-500/20' },
  strategic: { color: 'text-cyan-300', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20' },
};

function formatValue(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
}

function ValueNodeCard({
  node,
  isSelected,
  onSelect,
}: {
  node: ValueNode;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const [showEvidence, setShowEvidence] = useState(false);
  const config = CATEGORY_CONFIG[node.category];

  return (
    <div
      className={cn(
        'rounded-xl border transition-all cursor-pointer',
        isSelected
          ? 'border-violet-500/40 bg-violet-500/8 ring-1 ring-violet-500/20'
          : 'border-white/8 bg-white/3 hover:bg-white/5 hover:border-white/15'
      )}
      onClick={onSelect}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded', config.bg, config.color)}>
                {node.category}
              </span>
              <ConfidenceBadge score={node.confidence} size="sm" />
            </div>
            <div className="text-sm font-semibold text-white">{node.label}</div>
            {node.formula && (
              <div className="text-[10px] text-white/30 font-mono mt-0.5 truncate">{node.formula}</div>
            )}
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-lg font-bold text-white font-mono">{formatValue(node.value)}</div>
            <div className="text-[10px] text-white/40">{node.unit}</div>
          </div>
        </div>

        {/* Assumptions */}
        {node.assumptions.length > 0 && (
          <div className="mt-3 pt-3 border-t border-white/6">
            <div className="text-[10px] text-white/40 font-medium uppercase tracking-wider mb-2">Key Assumptions</div>
            <div className="space-y-1">
              {node.assumptions.map((assumption) => (
                <div key={assumption.id} className="flex items-center justify-between gap-2">
                  <span className="text-xs text-white/60 truncate">{assumption.label}</span>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className={cn(
                      'text-[10px] px-1 py-0.5 rounded',
                      assumption.plausibilityFlag === 'aggressive' ? 'bg-amber-500/10 text-amber-300' :
                        assumption.plausibilityFlag === 'conservative' ? 'bg-blue-500/10 text-blue-300' :
                          'bg-white/5 text-white/40'
                    )}>
                      {assumption.value}{assumption.unit ? ` ${assumption.unit}` : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Evidence toggle */}
        {node.evidence.length > 0 && (
          <button
            onClick={(e) => { e.stopPropagation(); setShowEvidence(!showEvidence); }}
            className="flex items-center gap-1 mt-2 text-[10px] text-white/40 hover:text-white/60 transition-colors"
          >
            {showEvidence ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            {node.evidence.length} evidence source{node.evidence.length !== 1 ? 's' : ''}
          </button>
        )}

        {showEvidence && (
          <div className="mt-2" onClick={(e) => e.stopPropagation()}>
            <EvidencePanel evidence={node.evidence} />
          </div>
        )}
      </div>
    </div>
  );
}

function ScenarioCard({
  scenario,
  label,
  isActive,
  onClick,
}: {
  scenario: { roi: number; npv: number; paybackMonths: number; totalValue: number };
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex-1 p-3 rounded-xl border text-left transition-all',
        isActive
          ? 'border-violet-500/40 bg-violet-500/10 ring-1 ring-violet-500/20'
          : 'border-white/8 bg-white/3 hover:bg-white/5'
      )}
    >
      <div className={cn('text-xs font-medium mb-2', isActive ? 'text-violet-300' : 'text-white/50')}>{label}</div>
      <div className="text-xl font-bold text-white font-mono">{formatValue(scenario.totalValue)}</div>
      <div className="text-[10px] text-white/40 mt-0.5">annual value</div>
      <div className="mt-2 pt-2 border-t border-white/6 grid grid-cols-2 gap-1">
        <div>
          <div className="text-[10px] text-white/30">ROI</div>
          <div className="text-xs font-bold text-white">{scenario.roi}%</div>
        </div>
        <div>
          <div className="text-[10px] text-white/30">Payback</div>
          <div className="text-xs font-bold text-white">{scenario.paybackMonths}mo</div>
        </div>
      </div>
    </button>
  );
}

export function ValueModelPanel({
  valueGraph,
  hypotheses,
  isLoading,
  onSelectNode,
  selectedNodeId,
  onAcceptHypothesis,
  onRejectHypothesis,
  className,
}: ValueModelPanelProps) {
  const [activeScenario, setActiveScenario] = useState<'conservative' | 'base' | 'upside'>('base');
  const [showHypotheses, setShowHypotheses] = useState(true);

  if (isLoading && !valueGraph) {
    return (
      <div className={cn('space-y-3', className)}>
        <SkeletonCard label="Building value tree..." />
        <SkeletonCard label="Fetching benchmarks..." />
        <SkeletonCard label="Calculating scenarios..." />
      </div>
    );
  }

  const pendingHypotheses = hypotheses.filter(h => h.status === 'pending');

  return (
    <div className={cn('space-y-4', className)}>
      {/* Hypotheses review (shown before graph is built) */}
      {pendingHypotheses.length > 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 overflow-hidden">
          <button
            onClick={() => setShowHypotheses(!showHypotheses)}
            className="w-full flex items-center justify-between px-4 py-3"
          >
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-medium text-amber-300">Review Value Hypotheses</span>
              <span className="text-xs bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded-full">{pendingHypotheses.length}</span>
            </div>
            {showHypotheses ? <ChevronDown className="w-4 h-4 text-white/30" /> : <ChevronRight className="w-4 h-4 text-white/30" />}
          </button>
          {showHypotheses && (
            <div className="px-4 pb-4 space-y-2">
              {pendingHypotheses.map((h) => (
                <div key={h.id} className="flex items-center gap-3 p-3 rounded-lg bg-white/3 border border-white/8">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white">{h.driver}</div>
                    <div className="text-xs text-white/50 mt-0.5">
                      {formatValue(h.estimatedImpactMin)} – {formatValue(h.estimatedImpactMax)}
                    </div>
                    <ConfidenceBadge score={h.confidenceScore} size="sm" className="mt-1" />
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => onAcceptHypothesis(h.id)}
                      className="text-xs px-2 py-1 rounded bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 transition-colors"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => onRejectHypothesis(h.id)}
                      className="text-xs px-2 py-1 rounded bg-white/5 text-white/40 hover:bg-white/10 transition-colors"
                    >
                      Skip
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Value graph */}
      {valueGraph && (
        <>
          {/* Headline value cards - Architecture: Raw JSON → ValueHypothesis → HeadlineValueCard */}
          <div>
            <div className="text-xs text-white/40 font-medium uppercase tracking-wider mb-2">Financial Scenarios</div>
            <div className="grid grid-cols-3 gap-3">
              <HeadlineValueCard
                roi={valueGraph.scenarios.conservative.roi}
                paybackMonths={valueGraph.scenarios.conservative.paybackMonths}
                confidence={valueGraph.defensibilityScore}
                scenario="conservative"
                annualValue={valueGraph.scenarios.conservative.totalValue}
                className={activeScenario === 'conservative' ? 'ring-1 ring-violet-500/30' : 'opacity-70'}
                onClick={() => setActiveScenario('conservative')}
              />
              <HeadlineValueCard
                roi={valueGraph.scenarios.base.roi}
                paybackMonths={valueGraph.scenarios.base.paybackMonths}
                confidence={valueGraph.defensibilityScore}
                scenario="base"
                annualValue={valueGraph.scenarios.base.totalValue}
                className={activeScenario === 'base' ? 'ring-1 ring-violet-500/30' : ''}
              />
              <HeadlineValueCard
                roi={valueGraph.scenarios.upside.roi}
                paybackMonths={valueGraph.scenarios.upside.paybackMonths}
                confidence={valueGraph.defensibilityScore}
                scenario="upside"
                annualValue={valueGraph.scenarios.upside.totalValue}
                className={activeScenario === 'upside' ? 'ring-1 ring-violet-500/30' : 'opacity-70'}
              />
            </div>
          </div>

          {/* Value drivers */}
          <div>
            <div className="text-xs text-white/40 font-medium uppercase tracking-wider mb-2">Value Drivers</div>
            <div className="space-y-2">
              {Object.values(valueGraph.nodes)
                .filter(n => n.isLeaf)
                .sort((a, b) => b.value - a.value)
                .map((node) => (
                  <ValueNodeCard
                    key={node.id}
                    node={node}
                    isSelected={selectedNodeId === node.id}
                    onSelect={() => onSelectNode(selectedNodeId === node.id ? null : node.id)}
                  />
                ))}
            </div>
          </div>

          {/* Total */}
          <div className="p-4 rounded-xl border border-violet-500/20 bg-violet-500/8">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-white/40 mb-1">Total Annual Value ({activeScenario})</div>
                <div className="text-2xl font-bold text-white font-mono">
                  {formatValue(valueGraph.scenarios[activeScenario].totalValue)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-white/40 mb-1">NPV (3yr)</div>
                <div className="text-lg font-bold text-violet-300 font-mono">
                  {formatValue(valueGraph.scenarios[activeScenario].npv)}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
