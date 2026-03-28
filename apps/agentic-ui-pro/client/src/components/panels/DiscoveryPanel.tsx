/**
 * DiscoveryPanel
 *
 * Phase 1: Discover — shows assembled opportunity context.
 * Users review auto-assembled signals and fill identified gaps.
 * "Review and Steer, Not Fill and Submit"
 */

import { useState } from 'react';
import { AlertCircle, Building2, CheckCircle2, ChevronDown, ChevronRight, Database, FileText, Mic, Phone, TrendingUp, User, Users, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MissingDataFlag, OpportunityContext, PainSignal, Stakeholder } from '@/types/agent-ux';
import { SkeletonCard } from '@/components/async/StreamingText';

interface DiscoveryPanelProps {
  opportunity: OpportunityContext | null;
  isLoading: boolean;
  onResolveGap: (flagId: string, value: string) => void;
  className?: string;
}

const SOURCE_ICONS = {
  crm: Database,
  'call-transcript': Mic,
  email: FileText,
  'sec-filing': FileText,
  'web-research': TrendingUp,
  manual: User,
};

const SENTIMENT_CONFIG = {
  positive: { color: 'text-emerald-300', bg: 'bg-emerald-500/10', label: 'Positive' },
  neutral: { color: 'text-blue-300', bg: 'bg-blue-500/10', label: 'Neutral' },
  negative: { color: 'text-rose-300', bg: 'bg-rose-500/10', label: 'Skeptical' },
  unknown: { color: 'text-white/40', bg: 'bg-white/5', label: 'Unknown' },
};

const ROLE_CONFIG = {
  champion: { color: 'text-emerald-300', bg: 'bg-emerald-500/10', label: 'Champion' },
  'economic-buyer': { color: 'text-amber-300', bg: 'bg-amber-500/10', label: 'Economic Buyer' },
  'technical-buyer': { color: 'text-blue-300', bg: 'bg-blue-500/10', label: 'Technical Buyer' },
  blocker: { color: 'text-rose-300', bg: 'bg-rose-500/10', label: 'Blocker' },
  influencer: { color: 'text-violet-300', bg: 'bg-violet-500/10', label: 'Influencer' },
};

function StakeholderCard({ stakeholder }: { stakeholder: Stakeholder }) {
  const sentiment = SENTIMENT_CONFIG[stakeholder.sentiment];
  const role = ROLE_CONFIG[stakeholder.role];
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-white/3 border border-white/6">
      <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
        <User className="w-4 h-4 text-white/50" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-white">{stakeholder.name}</span>
          <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded', role.bg, role.color)}>
            {role.label}
          </span>
        </div>
        <div className="text-xs text-white/50 mt-0.5">{stakeholder.title}</div>
        <div className="flex items-center gap-1 mt-1">
          <span className={cn('text-[10px] px-1.5 py-0.5 rounded', sentiment.bg, sentiment.color)}>
            {sentiment.label}
          </span>
          <span className="text-[10px] text-white/30">via {stakeholder.source}</span>
        </div>
      </div>
    </div>
  );
}

function PainSignalCard({ signal }: { signal: PainSignal }) {
  const severityConfig = {
    critical: { color: 'text-rose-300', bg: 'bg-rose-500/10', border: 'border-rose-500/20' },
    significant: { color: 'text-amber-300', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
    minor: { color: 'text-blue-300', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
  };
  const config = severityConfig[signal.severity];
  return (
    <div className={cn('p-3 rounded-lg border', config.bg, config.border)}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-white/80 leading-relaxed flex-1">{signal.description}</p>
        <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded flex-shrink-0', config.bg, config.color)}>
          {signal.severity}
        </span>
      </div>
      <div className="flex items-center gap-2 mt-1.5">
        <span className="text-[10px] text-white/30">Source: {signal.source}</span>
        {signal.mentionCount > 1 && (
          <span className="text-[10px] text-white/30">· {signal.mentionCount} mentions</span>
        )}
      </div>
    </div>
  );
}

function DataGapItem({ flag, onResolve }: { flag: MissingDataFlag; onResolve: (value: string) => void }) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState('');

  const impactConfig = {
    blocking: { color: 'text-rose-300', bg: 'bg-rose-500/10' },
    high: { color: 'text-amber-300', bg: 'bg-amber-500/10' },
    medium: { color: 'text-blue-300', bg: 'bg-blue-500/10' },
    low: { color: 'text-white/40', bg: 'bg-white/5' },
  };
  const config = impactConfig[flag.impact];

  if (flag.resolved) {
    return (
      <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-500/8 border border-emerald-500/20">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-xs text-white/70">{flag.field}</div>
          <div className="text-xs font-medium text-emerald-300">{flag.resolvedValue}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-2.5 rounded-lg bg-white/3 border border-white/8">
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-1.5">
          <AlertCircle className={cn('w-3 h-3 flex-shrink-0', config.color)} />
          <span className="text-xs font-medium text-white/80">{flag.field}</span>
        </div>
        <span className={cn('text-[10px] px-1.5 py-0.5 rounded', config.bg, config.color)}>
          {flag.impact} impact
        </span>
      </div>
      <div className="text-xs text-white/40 mb-2">{flag.description}</div>

      {isEditing ? (
        <div className="flex gap-2">
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Enter value..."
            className="flex-1 text-xs bg-white/8 border border-white/15 rounded px-2 py-1.5 text-white placeholder:text-white/25 focus:outline-none focus:border-violet-500/50"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && value.trim()) {
                onResolve(value.trim());
                setIsEditing(false);
              }
              if (e.key === 'Escape') setIsEditing(false);
            }}
          />
          <button
            onClick={() => { if (value.trim()) { onResolve(value.trim()); setIsEditing(false); } }}
            className="text-xs px-2 py-1.5 rounded bg-violet-500/20 text-violet-300 hover:bg-violet-500/30 transition-colors"
          >
            Save
          </button>
        </div>
      ) : (
        <button
          onClick={() => setIsEditing(true)}
          className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
        >
          + Fill this gap
        </button>
      )}
    </div>
  );
}

export function DiscoveryPanel({ opportunity, isLoading, onResolveGap, className }: DiscoveryPanelProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>('pain-signals');

  if (isLoading && !opportunity) {
    return (
      <div className={cn('space-y-3', className)}>
        <SkeletonCard label="Fetching CRM data..." />
        <SkeletonCard label="Analyzing call transcripts..." />
        <SkeletonCard label="Retrieving SEC filings..." />
      </div>
    );
  }

  if (!opportunity) return null;

  const unresolvedGaps = opportunity.missingDataFlags.filter(f => !f.resolved);
  const resolvedGaps = opportunity.missingDataFlags.filter(f => f.resolved);

  const sections = [
    { id: 'pain-signals', label: 'Pain Signals', count: opportunity.painSignals.length, icon: Zap },
    { id: 'stakeholders', label: 'Stakeholders', count: opportunity.stakeholders.length, icon: Users },
    { id: 'data-gaps', label: 'Data Gaps', count: unresolvedGaps.length, icon: AlertCircle, badge: unresolvedGaps.length > 0 ? 'action-needed' : 'resolved' },
    { id: 'sources', label: 'Sources', count: opportunity.sources.length, icon: Database },
  ];

  return (
    <div className={cn('space-y-3', className)}>
      {/* Opportunity header */}
      <div className="p-4 rounded-xl border border-white/8 bg-white/3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-500/15 flex items-center justify-center flex-shrink-0">
            <Building2 className="w-5 h-5 text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-white truncate">{opportunity.accountName}</div>
            <div className="text-xs text-white/50 mt-0.5">{opportunity.name}</div>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-xs text-white/40">{opportunity.industry}</span>
              <span className="text-xs text-white/40">{(opportunity.employees / 1000).toFixed(0)}K employees</span>
              <span className="text-xs text-white/40">${(opportunity.revenue / 1_000_000_000).toFixed(1)}B revenue</span>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-xs text-white/40">Stage</div>
            <div className="text-xs font-medium text-amber-300">{opportunity.stage}</div>
          </div>
        </div>

        {/* Sources summary */}
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/6 flex-wrap">
          {opportunity.sources.map((source) => {
            const Icon = SOURCE_ICONS[source.type] || Database;
            return (
              <div key={source.type} className="flex items-center gap-1 text-[10px] text-white/40">
                <Icon className="w-2.5 h-2.5" />
                <span>{source.name}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Collapsible sections */}
      {sections.map((section) => {
        const Icon = section.icon;
        const isExpanded = expandedSection === section.id;

        return (
          <div key={section.id} className="rounded-xl border border-white/8 bg-white/2 overflow-hidden">
            <button
              onClick={() => setExpandedSection(isExpanded ? null : section.id)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/3 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Icon className={cn('w-4 h-4', section.id === 'data-gaps' && unresolvedGaps.length > 0 ? 'text-amber-400' : 'text-white/40')} />
                <span className="text-sm font-medium text-white/80">{section.label}</span>
                <span className="text-xs text-white/30 bg-white/6 px-1.5 py-0.5 rounded-full">{section.count}</span>
                {section.badge === 'action-needed' && (
                  <span className="text-[10px] text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded-full">Action needed</span>
                )}
              </div>
              {isExpanded ? <ChevronDown className="w-4 h-4 text-white/30" /> : <ChevronRight className="w-4 h-4 text-white/30" />}
            </button>

            {isExpanded && (
              <div className="px-4 pb-4 space-y-2">
                {section.id === 'pain-signals' && opportunity.painSignals.map((signal) => (
                  <PainSignalCard key={signal.id} signal={signal} />
                ))}

                {section.id === 'stakeholders' && opportunity.stakeholders.map((stakeholder) => (
                  <StakeholderCard key={stakeholder.id} stakeholder={stakeholder} />
                ))}

                {section.id === 'data-gaps' && (
                  <>
                    {unresolvedGaps.map((flag) => (
                      <DataGapItem
                        key={flag.id}
                        flag={flag}
                        onResolve={(value) => onResolveGap(flag.id, value)}
                      />
                    ))}
                    {resolvedGaps.map((flag) => (
                      <DataGapItem
                        key={flag.id}
                        flag={flag}
                        onResolve={(value) => onResolveGap(flag.id, value)}
                      />
                    ))}
                    {unresolvedGaps.length === 0 && resolvedGaps.length === 0 && (
                      <div className="text-xs text-white/30 text-center py-2">No data gaps identified</div>
                    )}
                  </>
                )}

                {section.id === 'sources' && opportunity.sources.map((source) => {
                  const Icon = SOURCE_ICONS[source.type] || Database;
                  return (
                    <div key={source.type} className="flex items-center gap-3 p-2.5 rounded-lg bg-white/3">
                      <Icon className="w-4 h-4 text-white/40 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-white/70">{source.name}</div>
                        <div className="text-[10px] text-white/30">{source.itemCount} items retrieved</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
