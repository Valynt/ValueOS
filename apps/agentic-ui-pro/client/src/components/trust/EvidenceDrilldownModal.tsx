/**
 * EvidenceDrilldownModal
 *
 * Deep-dive into evidence, audit trail, and confidence calculation for any claim.
 * Accessible from ConfidenceBadge clicks. "Trust but verify" — educational, not defensive.
 *
 * Tabs:
 * 1. Sources — Source documents with excerpts
 * 2. Audit Trail — Derivation chain with confidence per step
 * 3. Calculation — Assumptions, formulas, sensitivity
 */

import { useState } from 'react';
import { BookOpen, Calculator, Database, X, FileText, ChevronRight, CheckCircle2, AlertCircle, PieChart, GitBranch, Shield, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Evidence, ValueNode, DerivationStep } from '@/types/agent-ux';
import { ConfidenceBadge } from './ConfidenceBadge';
import { useAgentUXStore } from '@/lib/agent-ux-store';

interface EvidenceDrilldownModalProps {
  isOpen: boolean;
  onClose: () => void;
  node?: ValueNode;
  claimText?: string;
  claimValue?: number;
  derivationChain?: DerivationStep[];
}

type Tab = 'sources' | 'audit' | 'calculation';

const TAB_CONFIG: Record<Tab, { label: string; icon: typeof Database }> = {
  sources: { label: 'Sources', icon: FileText },
  audit: { label: 'Audit Trail', icon: BookOpen },
  calculation: { label: 'Calculation', icon: Calculator },
};

const SOURCE_TYPE_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  'customer-confirmed': { color: 'text-emerald-300', bg: 'bg-emerald-500/10', label: 'Customer' },
  'internally-observed': { color: 'text-blue-300', bg: 'bg-blue-500/10', label: 'Internal' },
  'benchmark-derived': { color: 'text-violet-300', bg: 'bg-violet-500/10', label: 'Benchmark' },
  'inferred': { color: 'text-amber-300', bg: 'bg-amber-500/10', label: 'Inferred' },
  'externally-researched': { color: 'text-cyan-300', bg: 'bg-cyan-500/10', label: 'Research' },
  'sec-filing': { color: 'text-rose-300', bg: 'bg-rose-500/10', label: 'SEC' },
  'unsupported': { color: 'text-white/40', bg: 'bg-white/10', label: 'Assumed' },
};

function SourceItem({ evidence, index }: { evidence: Evidence; index: number }) {
  const config = SOURCE_TYPE_CONFIG[evidence.sourceType] || SOURCE_TYPE_CONFIG.unsupported;

  return (
    <div className="p-4 rounded-xl bg-white/3 border border-white/6">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
          <span className="text-xs font-medium text-white/40">{index + 1}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded', config.bg, config.color)}>
              {config.label}
            </span>
            <span className="text-xs text-white/50">{evidence.source}</span>
            {evidence.isStale && (
              <span className="text-[10px] text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded">
                Stale
              </span>
            )}
          </div>
          <blockquote className="text-sm text-white/70 leading-relaxed border-l-2 border-white/10 pl-3 mt-2">
            &ldquo;{evidence.excerpt || evidence.citation}&rdquo;
          </blockquote>
          <div className="flex items-center gap-3 mt-2 text-[10px] text-white/30">
            <span>Retrieved: {new Date(evidence.retrievedAt).toLocaleDateString()}</span>
            <span>Weight: {Math.round(evidence.weight * 100)}%</span>
          </div>
          {evidence.confidence && (
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[10px] text-white/40">Source confidence:</span>
              <ConfidenceBadge score={evidence.confidence} size="sm" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CoverageBreakdown({ evidence }: { evidence: Evidence[] }) {
  // Group evidence by source type
  const byType = evidence.reduce((acc, e) => {
    const type = e.sourceType || 'unsupported';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const total = evidence.length;
  const types = Object.keys(byType);

  if (total === 0) return null;

  return (
    <div className="p-4 rounded-xl bg-white/3 border border-white/6 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <PieChart className="w-4 h-4 text-violet-400" />
        <span className="text-xs font-medium text-white/80">Coverage Breakdown</span>
      </div>
      <div className="space-y-2">
        {types.map(type => {
          const count = byType[type];
          const percent = Math.round((count / total) * 100);
          const config = SOURCE_TYPE_CONFIG[type] || SOURCE_TYPE_CONFIG.unsupported;
          return (
            <div key={type} className="flex items-center gap-3">
              <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded w-20', config.bg, config.color)}>
                {config.label}
              </span>
              <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full', config.bg.replace('bg-', 'bg-'))}
                  style={{ width: `${percent}%` }}
                />
              </div>
              <span className="text-xs text-white/50 w-12 text-right">{count} ({percent}%)</span>
            </div>
          );
        })}
      </div>
      <div className="mt-3 pt-3 border-t border-white/10 flex items-center gap-2 text-[10px] text-white/40">
        <Shield className="w-3 h-3" />
        <span>{total} total source{total !== 1 ? 's' : ''} across {types.length} categor{types.length !== 1 ? 'ies' : 'y'}</span>
      </div>
    </div>
  );
}

function SourceIndependence({ evidence }: { evidence: Evidence[] }) {
  // Check for source independence issues
  const sources = evidence.map(e => e.source);
  const uniqueSources = new Set(sources);
  const hasDuplicates = sources.length !== uniqueSources.size;

  // Check for related sources (same base domain/organization)
  const relatedGroups: string[][] = [];
  const processed = new Set<string>();

  evidence.forEach(e => {
    if (processed.has(e.source)) return;
    const related = evidence.filter(other =>
      other.id !== e.id &&
      (other.source.includes(e.source) || e.source.includes(other.source))
    );
    if (related.length > 0) {
      relatedGroups.push([e.source, ...related.map(r => r.source)]);
      processed.add(e.source);
      related.forEach(r => processed.add(r.source));
    }
  });

  const isIndependent = !hasDuplicates && relatedGroups.length === 0 && evidence.length >= 2;

  return (
    <div className={cn(
      "p-4 rounded-xl border mb-4",
      isIndependent
        ? "bg-emerald-500/8 border-emerald-500/20"
        : "bg-amber-500/8 border-amber-500/20"
    )}>
      <div className="flex items-center gap-2 mb-3">
        <GitBranch className={cn("w-4 h-4", isIndependent ? "text-emerald-400" : "text-amber-400")} />
        <span className="text-xs font-medium text-white/80">Source Independence</span>
        {isIndependent ? (
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 ml-auto" />
        ) : (
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 ml-auto" />
        )}
      </div>

      {isIndependent ? (
        <p className="text-xs text-white/60">
          Sources are independent and corroborate from different origins. High confidence in cross-validation.
        </p>
      ) : (
        <div className="space-y-2">
          {hasDuplicates && (
            <div className="flex items-start gap-2 text-xs text-amber-300">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>Duplicate sources detected — some evidence may be double-counted</span>
            </div>
          )}
          {relatedGroups.length > 0 && (
            <div className="flex items-start gap-2 text-xs text-amber-300">
              <GitBranch className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>Related sources detected — {relatedGroups.length} group{relatedGroups.length !== 1 ? 's' : ''} may share common origin</span>
            </div>
          )}
          {evidence.length < 2 && (
            <div className="flex items-start gap-2 text-xs text-amber-300">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>Single source — cross-validation not possible</span>
            </div>
          )}
        </div>
      )}

      {/* Source audit trail */}
      <div className="mt-3 pt-3 border-t border-white/10">
        <div className="text-[10px] text-white/40 uppercase tracking-wider mb-2">Source Audit</div>
        <div className="space-y-1">
          {Array.from(new Set(evidence.map(e => e.source))).map((source, i) => (
            <div key={source} className="flex items-center gap-2 text-xs">
              <span className="text-white/30 w-4">{i + 1}.</span>
              <span className="text-white/60">{source}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AuditStep({ step, index, isLast }: { step: DerivationStep; index: number; isLast: boolean }) {
  const statusIcon = step.confidence >= 0.7 ? CheckCircle2 : AlertCircle;
  const statusColor = step.confidence >= 0.7 ? 'text-emerald-400' : 'text-amber-400';
  const Icon = statusIcon;

  return (
    <div className="relative">
      {!isLast && (
        <div className="absolute left-4 top-12 w-px h-6 bg-white/10" />
      )}
      <div className="flex items-start gap-3 p-3 rounded-lg bg-white/3 border border-white/6">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
          <span className="text-xs font-bold text-white/50">{index + 1}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-white/80">{step.label}</span>
            <div className="flex items-center gap-1.5">
              <Icon className={cn('w-3.5 h-3.5', statusColor)} />
              <ConfidenceBadge score={step.confidence} size="sm" />
            </div>
          </div>
          <div className="text-sm font-mono font-bold text-white mt-1">{step.value}</div>
          <div className="flex items-center gap-3 mt-2 text-[10px] text-white/30">
            <span>Source: {step.source}</span>
            {step.agentId && <span>via {step.agentId}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

function CalculationView({ node }: { node?: ValueNode }) {
  if (!node) {
    return (
      <div className="text-center py-12 text-white/40">
        <Calculator className="w-8 h-8 mx-auto mb-3 opacity-50" />
        <p className="text-sm">Calculation details not available</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Formula */}
      {node.formula && (
        <div className="p-4 rounded-xl bg-white/3 border border-white/6">
          <div className="text-[10px] text-white/40 uppercase tracking-wider mb-2">Formula</div>
          <code className="text-sm font-mono text-violet-300 bg-violet-500/10 px-3 py-2 rounded-lg block">
            {node.formula}
          </code>
        </div>
      )}

      {/* Assumptions */}
      <div className="space-y-2">
        <div className="text-[10px] text-white/40 uppercase tracking-wider">Key Assumptions</div>
        {node.assumptions.length === 0 ? (
          <div className="text-sm text-white/30 py-4 text-center">No assumptions recorded</div>
        ) : (
          node.assumptions.map((assumption) => (
            <div
              key={assumption.id}
              className="flex items-center justify-between p-3 rounded-lg bg-white/3 border border-white/6"
            >
              <div>
                <div className="text-sm text-white/80">{assumption.label}</div>
                <div className="text-[10px] text-white/40 mt-0.5">
                  {assumption.plausibilityFlag === 'aggressive' && 'Aggressive estimate'}
                  {assumption.plausibilityFlag === 'base' && 'Base estimate'}
                  {assumption.plausibilityFlag === 'conservative' && 'Conservative estimate'}
                  {assumption.plausibilityFlag === 'unrealistic' && 'Unrealistic estimate'}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn(
                  'text-sm font-mono font-bold',
                  assumption.plausibilityFlag === 'aggressive' ? 'text-amber-300' :
                    assumption.plausibilityFlag === 'conservative' ? 'text-blue-300' :
                      'text-white/60'
                )}>
                  {assumption.value}{assumption.unit ? ` ${assumption.unit}` : ''}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Sensitivity note */}
      <div className="p-3 rounded-lg bg-white/2 border border-white/5">
        <div className="flex items-center gap-2 text-[10px] text-white/40">
          <AlertCircle className="w-3 h-3" />
          <span>Sensitivity: ±{((1 - node.confidence) * 100).toFixed(0)}% variance possible based on assumption accuracy</span>
        </div>
      </div>
    </div>
  );
}

export function EvidenceDrilldownModal({
  isOpen,
  onClose,
  node,
  claimText,
  claimValue,
  derivationChain,
}: EvidenceDrilldownModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>('sources');

  if (!isOpen) return null;

  const evidence = node?.evidence || [];
  const auditChain = derivationChain || [];

  const TabIcon = TAB_CONFIG[activeTab].icon;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-x-4 top-8 bottom-8 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-[640px] bg-[#0f0f12] rounded-2xl border border-white/10 shadow-2xl z-50 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 bg-white/3">
          <div className="flex items-center gap-3">
            <Database className="w-5 h-5 text-violet-400" />
            <div>
              <h3 className="text-sm font-semibold text-white">Evidence & Confidence</h3>
              {claimText && (
                <p className="text-xs text-white/50 truncate max-w-[300px]">{claimText}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/8 text-white/40 hover:text-white/80 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/8">
          {(Object.keys(TAB_CONFIG) as Tab[]).map((tab) => {
            const Icon = TAB_CONFIG[tab].icon;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 px-4 py-3 text-xs font-medium transition-colors',
                  activeTab === tab
                    ? 'text-white bg-white/5 border-b-2 border-violet-500'
                    : 'text-white/40 hover:text-white/60 hover:bg-white/3'
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {TAB_CONFIG[tab].label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* Summary Card */}
          <div className="p-4 rounded-xl bg-violet-500/8 border border-violet-500/20 mb-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] text-violet-300/70 uppercase tracking-wider">Overall Confidence</div>
                <div className="flex items-center gap-2 mt-1">
                  <ConfidenceBadge score={node?.confidence || 0.75} size="md" />
                  <span className="text-xs text-white/50">
                    Based on {evidence.length} source{evidence.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
              {claimValue !== undefined && (
                <div className="text-right">
                  <div className="text-lg font-bold text-white font-mono">
                    ${(claimValue / 1_000_000).toFixed(2)}M
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Tab Content */}
          {activeTab === 'sources' && (
            <div className="space-y-3">
              {evidence.length === 0 ? (
                <div className="text-center py-12 text-white/40">
                  <FileText className="w-8 h-8 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No source evidence recorded</p>
                </div>
              ) : (
                <>
                  <CoverageBreakdown evidence={evidence} />
                  <SourceIndependence evidence={evidence} />
                  <div className="text-[10px] text-white/40 uppercase tracking-wider mb-2">Source Documents</div>
                  {evidence.map((e, i) => (
                    <SourceItem key={e.id} evidence={e} index={i} />
                  ))}
                </>
              )}
            </div>
          )}

          {activeTab === 'audit' && (
            <div className="space-y-1">
              {auditChain.length === 0 ? (
                <div className="text-center py-12 text-white/40">
                  <BookOpen className="w-8 h-8 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">Audit trail not available</p>
                </div>
              ) : (
                auditChain.map((step, i) => (
                  <AuditStep
                    key={i}
                    step={step}
                    index={i}
                    isLast={i === auditChain.length - 1}
                  />
                ))
              )}
            </div>
          )}

          {activeTab === 'calculation' && <CalculationView node={node} />}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/8 bg-white/3 flex items-center justify-between">
          <div className="text-[10px] text-white/30">
            Last updated: {new Date().toLocaleDateString()}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-white/8 hover:bg-white/12 text-white/70 hover:text-white text-xs font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </>
  );
}
