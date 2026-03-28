/**
 * AgentUXBridge — Main Experience Page
 *
 * The full agent-to-UX bridge assembled into one coherent experience.
 * Implements all 5 critical aspects:
 *
 * 1. State → Experience Mapping (WorkflowProgressBar + state-driven panels)
 * 2. Agent Output → User Artifacts (ValueModelPanel + ArtifactsPanel)
 * 3. Workflow → User Journey (4-phase navigation)
 * 4. Confidence → Trust Layer (DefensibilityScoreCard + ProvenanceDrawer)
 * 5. Async Systems → Smooth Flow (ActivityFeed + StreamingText + HumanCheckpoint)
 */

import { useState } from 'react';
import {
  Activity,
  BarChart3,
  Bot,
  CheckCircle2,
  ChevronRight,
  FileText,
  Layers,
  Play,
  RefreshCw,
  Shield,
  Sparkles,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAgentUXStore } from '@/lib/agent-ux-store';
import { WorkflowProgressBar } from '@/components/async/WorkflowProgressBar';
import { ActivityFeed } from '@/components/async/ActivityFeed';
import { HumanCheckpointPanel } from '@/components/async/HumanCheckpointPanel';
import { DiscoveryPanel } from '@/components/panels/DiscoveryPanel';
import { ValueModelPanel } from '@/components/panels/ValueModelPanel';
import { IntegrityPanel } from '@/components/panels/IntegrityPanel';
import { ArtifactsPanel } from '@/components/panels/ArtifactsPanel';
import { ProvenanceDrawer } from '@/components/trust/ProvenanceDrawer';
import { DefensibilityScoreCard } from '@/components/trust/DefensibilityScoreCard';
import { STATE_EXPERIENCE_MAP } from '@/types/agent-ux';

// ─── PANEL NAVIGATION ─────────────────────────────────────────────────────────

const PANELS = [
  { id: 'discovery', label: 'Discover', icon: Zap, phase: 1 },
  { id: 'model', label: 'Analyze', icon: BarChart3, phase: 2 },
  { id: 'integrity', label: 'Validate', icon: Shield, phase: 3 },
  { id: 'artifacts', label: 'Decide', icon: FileText, phase: 4 },
  { id: 'checkpoint', label: 'Approve', icon: CheckCircle2, phase: 5 },
] as const;

type PanelId = typeof PANELS[number]['id'];

// ─── HEADER ───────────────────────────────────────────────────────────────────

function Header() {
  const { workflowState, isRunning, startWorkflow, resetWorkflow, opportunity } = useAgentUXStore();
  const experience = STATE_EXPERIENCE_MAP[workflowState];

  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-white/8 bg-[#0a0a0d]/80 backdrop-blur-sm sticky top-0 z-30">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-4 h-4 text-violet-400" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white">ValueOS</span>
            <span className="text-white/20">·</span>
            <span className="text-sm text-white/50 truncate">
              {opportunity?.name || 'New Value Case'}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={cn(
              'w-1.5 h-1.5 rounded-full flex-shrink-0',
              workflowState === 'FINALIZED' ? 'bg-emerald-400' :
                isRunning ? 'bg-violet-400 animate-pulse' :
                  'bg-white/20'
            )} />
            <span className="text-xs text-white/40">
              {isRunning && workflowState !== 'FINALIZED'
                ? experience.activeVerb
                : workflowState === 'FINALIZED'
                  ? 'Ready for presentation'
                  : experience.label}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {isRunning && (
          <button
            onClick={resetWorkflow}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-white/40 hover:text-white/60 hover:bg-white/5 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reset
          </button>
        )}
        {!isRunning && (
          <button
            onClick={startWorkflow}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-500 hover:bg-violet-400 text-white text-sm font-medium transition-colors shadow-lg shadow-violet-500/20"
          >
            <Play className="w-3.5 h-3.5" />
            Run Demo
          </button>
        )}
      </div>
    </div>
  );
}

// ─── PANEL SIDEBAR ────────────────────────────────────────────────────────────

function PanelNav({
  activePanel,
  onSelect,
  pendingCheckpoint,
  workflowState,
}: {
  activePanel: PanelId;
  onSelect: (id: PanelId) => void;
  pendingCheckpoint: boolean;
  workflowState: string;
}) {
  const stateOrder = ['INITIATED', 'DRAFTING', 'VALIDATING', 'COMPOSING', 'REFINING', 'FINALIZED'];
  const currentIdx = stateOrder.indexOf(workflowState);

  const panelStateMap: Record<PanelId, number> = {
    discovery: 0,
    model: 1,
    integrity: 2,
    artifacts: 3,
    checkpoint: 4,
  };

  return (
    <nav className="flex flex-col gap-1 p-2">
      {PANELS.map((panel) => {
        const Icon = panel.icon;
        const isActive = activePanel === panel.id;
        const isAvailable = currentIdx >= panelStateMap[panel.id];
        const hasBadge = panel.id === 'checkpoint' && pendingCheckpoint;

        return (
          <button
            key={panel.id}
            onClick={() => isAvailable && onSelect(panel.id)}
            disabled={!isAvailable}
            className={cn(
              'relative flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-all text-left',
              isActive
                ? 'bg-violet-500/15 text-violet-300 border border-violet-500/25'
                : isAvailable
                  ? 'text-white/50 hover:text-white/80 hover:bg-white/5'
                  : 'text-white/20 cursor-not-allowed'
            )}
          >
            <Icon className={cn('w-4 h-4 flex-shrink-0', isActive ? 'text-violet-400' : '')} />
            <span className="font-medium">{panel.label}</span>
            {hasBadge && (
              <span className="ml-auto w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            )}
            {isActive && <ChevronRight className="ml-auto w-3 h-3 text-violet-400/60" />}
          </button>
        );
      })}
    </nav>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export function AgentUXBridge() {
  const {
    workflowState,
    progress,
    isRunning,
    opportunity,
    hypotheses,
    valueGraph,
    defensibilityScore,
    artifacts,
    pendingCheckpoint,
    activities,
    streams,
    selectedArtifactId,
    selectedNodeId,
    activePanel,
    showActivityFeed,
    showTrustPanel,
    focusMode,
    startWorkflow,
    resetWorkflow,
    approveCheckpoint,
    rejectCheckpoint,
    resolveDataGap,
    acceptHypothesis,
    rejectHypothesis,
    editArtifact,
    selectArtifact,
    selectNode,
    setActivePanel,
    toggleActivityFeed,
    toggleTrustPanel,
    toggleFocusMode,
  } = useAgentUXStore();

  const executiveSummaryStream = streams['executive_summary'];

  return (
    <div className="min-h-screen bg-[#0a0a0d] text-white flex flex-col">
      {/* Header */}
      <Header />

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar — navigation + progress */}
        <aside className="w-52 flex-shrink-0 border-r border-white/6 flex flex-col bg-[#0c0c10]">
          <PanelNav
            activePanel={activePanel as PanelId}
            onSelect={(id) => setActivePanel(id)}
            pendingCheckpoint={!!pendingCheckpoint}
            workflowState={workflowState}
          />

          {/* Progress */}
          {isRunning && (
            <div className="mt-auto p-3 border-t border-white/6">
              <WorkflowProgressBar
                progress={progress}
                workflowState={workflowState}
              />
            </div>
          )}

          {/* Trust panel toggle */}
          {defensibilityScore && (
            <div className="p-3 border-t border-white/6">
              <button
                onClick={toggleTrustPanel}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors',
                  showTrustPanel ? 'bg-violet-500/15 text-violet-300' : 'text-white/40 hover:text-white/60 hover:bg-white/5'
                )}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Trust Panel</span>
                <span className="ml-auto font-mono font-bold">
                  {Math.round(defensibilityScore.global * 100)}%
                </span>
              </button>
            </div>
          )}

          {/* Activity feed toggle */}
          <div className="p-3 border-t border-white/6">
            <button
              onClick={toggleActivityFeed}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors',
                showActivityFeed ? 'bg-white/8 text-white/70' : 'text-white/30 hover:text-white/50 hover:bg-white/5'
              )}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Agent Feed</span>
              {isRunning && activities.length > 0 && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              )}
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          {/* Empty state */}
          {!isRunning && !opportunity && (
            <div className="flex flex-col items-center justify-center h-full gap-6 p-8">
              <div className="w-16 h-16 rounded-2xl bg-violet-500/15 flex items-center justify-center">
                <Bot className="w-8 h-8 text-violet-400" />
              </div>
              <div className="text-center max-w-md">
                <h2 className="text-xl font-semibold text-white mb-2">New Value Case</h2>
                <p className="text-sm text-white/50 leading-relaxed">
                  Build a CFO-defensible business case with AI-assisted discovery,
                  modeling, and validation.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 max-w-lg w-full">
                {[
                  { icon: Zap, title: 'Discover', desc: 'Auto-extract opportunity signals' },
                  { icon: BarChart3, title: 'Model', desc: 'Build financial scenarios' },
                  { icon: Shield, title: 'Validate', desc: 'Stress-test assumptions' },
                  { icon: FileText, title: 'Export', desc: 'Generate executive artifacts' },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.title} className="p-3 rounded-xl border border-white/8 bg-white/2">
                      <Icon className="w-4 h-4 text-violet-400 mb-2" />
                      <div className="text-xs font-medium text-white/80 mb-0.5">{item.title}</div>
                      <div className="text-[11px] text-white/40">{item.desc}</div>
                    </div>
                  );
                })}
              </div>

              {/* Resume option if there's persisted state */}
              {workflowState !== 'INITIATED' && workflowState !== 'FINALIZED' && (
                <div className="w-full max-w-md p-4 rounded-xl border border-amber-500/20 bg-amber-500/8">
                  <div className="flex items-center gap-3">
                    <RefreshCw className="w-5 h-5 text-amber-400" />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-amber-300">Resume previous session?</div>
                      <div className="text-xs text-white/50">Continue from {workflowState.toLowerCase()}</div>
                    </div>
                    <button
                      onClick={() => {
                        // Restore persisted state and continue
                        startWorkflow();
                      }}
                      className="px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 text-xs font-medium hover:bg-amber-500/30 transition-colors"
                    >
                      Resume
                    </button>
                  </div>
                </div>
              )}

              <button
                onClick={startWorkflow}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-violet-500 hover:bg-violet-400 text-white font-medium transition-colors shadow-lg shadow-violet-500/25"
              >
                <Play className="w-4 h-4" />
                Start New Value Case
              </button>
            </div>
          )}

          {/* Panel content */}
          {(isRunning || opportunity) && (
            <div className="p-6 max-w-3xl">
              {/* Checkpoint panel takes priority */}
              {activePanel === 'checkpoint' && pendingCheckpoint && (
                <div className="space-y-4">
                  <div className="text-xs text-white/40 font-medium uppercase tracking-wider">Human Decision Required</div>
                  <HumanCheckpointPanel
                    checkpoint={pendingCheckpoint}
                    onDecide={(optionId) => {
                      if (optionId === 'approve') approveCheckpoint();
                      else rejectCheckpoint();
                    }}
                  />
                </div>
              )}

              {activePanel === 'discovery' && (
                <div className="space-y-4">
                  <div className="text-xs text-white/40 font-medium uppercase tracking-wider">Phase 1 · Discover</div>
                  <DiscoveryPanel
                    opportunity={opportunity}
                    isLoading={isRunning && !opportunity}
                    onResolveGap={resolveDataGap}
                  />
                </div>
              )}

              {activePanel === 'model' && (
                <div className="space-y-4">
                  <div className="text-xs text-white/40 font-medium uppercase tracking-wider">Phase 2 · Analyze</div>
                  <ValueModelPanel
                    valueGraph={valueGraph}
                    hypotheses={hypotheses}
                    isLoading={isRunning && !valueGraph}
                    onSelectNode={selectNode}
                    selectedNodeId={selectedNodeId}
                    onAcceptHypothesis={acceptHypothesis}
                    onRejectHypothesis={rejectHypothesis}
                  />
                </div>
              )}

              {activePanel === 'integrity' && (
                <div className="space-y-4">
                  <div className="text-xs text-white/40 font-medium uppercase tracking-wider">Phase 3 · Validate</div>
                  <IntegrityPanel
                    defensibilityScore={defensibilityScore}
                    isLoading={isRunning && !defensibilityScore}
                  />
                </div>
              )}

              {activePanel === 'artifacts' && (
                <div className="space-y-4">
                  <div className="text-xs text-white/40 font-medium uppercase tracking-wider">Phase 4 · Decide</div>
                  <ArtifactsPanel
                    artifacts={artifacts}
                    selectedArtifactId={selectedArtifactId}
                    streamText={executiveSummaryStream?.text}
                    isStreaming={executiveSummaryStream ? !executiveSummaryStream.isComplete : false}
                    isLoading={isRunning && artifacts.length === 0}
                    onSelectArtifact={selectArtifact}
                    onEditArtifact={editArtifact}
                  />
                </div>
              )}

              {/* Finalized state */}
              {workflowState === 'FINALIZED' && activePanel !== 'checkpoint' && (
                <div className="mt-4 p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/8">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <div>
                      <div className="text-sm font-semibold text-emerald-300">Business Case Finalized</div>
                      <div className="text-xs text-white/50 mt-0.5">
                        Ready for customer presentation and CS handoff
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>

        {/* Right sidebar — trust panel + activity feed */}
        <aside className={cn(
          'flex-shrink-0 border-l border-white/6 flex flex-col bg-[#0c0c10] transition-all',
          focusMode ? 'w-0 overflow-hidden' : (showTrustPanel || showActivityFeed) ? 'w-72' : 'w-0 overflow-hidden'
        )}>
          {showTrustPanel && defensibilityScore && !focusMode && (
            <div className="p-3 border-b border-white/6">
              <DefensibilityScoreCard score={defensibilityScore} compact />
            </div>
          )}

          {showActivityFeed && !focusMode && (
            <div className="flex-1 overflow-hidden">
              <ActivityFeed
                activities={activities}
                isRunning={isRunning && workflowState !== 'REFINING' && workflowState !== 'FINALIZED'}
              />
            </div>
          )}
        </aside>
      </div>

      {/* Provenance drawer */}
      <ProvenanceDrawer artifacts={artifacts} />
    </div>
  );
}
