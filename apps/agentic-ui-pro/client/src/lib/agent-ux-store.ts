/**
 * Agent-UX Bridge Store
 *
 * Central Zustand store that connects the agent simulation layer to the UI.
 * Every piece of state here has a direct UI representation — no orphaned state.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  AgentActivity,
  DefensibilityScore,
  ExecutiveArtifact,
  HumanCheckpoint,
  OpportunityContext,
  StreamToken,
  ValueGraph,
  ValueHypothesis,
  WorkflowProgress,
  WorkflowState,
} from '@/types/agent-ux';
import { STATE_EXPERIENCE_MAP } from '@/types/agent-ux';
import { agentSimulator } from './agent-simulator';

interface StreamState {
  [field: string]: {
    text: string;
    isComplete: boolean;
  };
}

interface AgentUXStore {
  // ── Core workflow state ──────────────────────────────────────────────────
  workflowState: WorkflowState;
  progress: WorkflowProgress | null;
  isRunning: boolean;

  // ── Domain objects ───────────────────────────────────────────────────────
  opportunity: OpportunityContext | null;
  hypotheses: ValueHypothesis[];
  valueGraph: ValueGraph | null;
  defensibilityScore: DefensibilityScore | null;
  artifacts: ExecutiveArtifact[];
  pendingCheckpoint: HumanCheckpoint | null;

  // ── Activity feed ────────────────────────────────────────────────────────
  activities: AgentActivity[];
  maxActivities: number;

  // ── Streaming state ──────────────────────────────────────────────────────
  streams: StreamState;

  // ── UI state ─────────────────────────────────────────────────────────────
  selectedArtifactId: string | null;
  selectedNodeId: string | null;
  activePanel: 'discovery' | 'model' | 'integrity' | 'artifacts' | 'checkpoint';
  showActivityFeed: boolean;
  showTrustPanel: boolean;
  showProvenance: boolean;
  provenanceClaimId: string | null;

  // ── Actions ──────────────────────────────────────────────────────────────
  startWorkflow: () => void;
  resetWorkflow: () => void;
  approveCheckpoint: () => void;
  rejectCheckpoint: () => void;
  resolveDataGap: (flagId: string, value: string) => void;
  acceptHypothesis: (id: string) => void;
  rejectHypothesis: (id: string) => void;
  editArtifact: (artifactId: string, section: string, content: string) => void;
  selectArtifact: (id: string | null) => void;
  selectNode: (id: string | null) => void;
  setActivePanel: (panel: AgentUXStore['activePanel']) => void;
  toggleActivityFeed: () => void;
  toggleTrustPanel: () => void;
  openProvenance: (claimId: string) => void;
  closeProvenance: () => void;

  // ── Computed ─────────────────────────────────────────────────────────────
  getStateExperience: () => typeof STATE_EXPERIENCE_MAP[WorkflowState];
  getReadinessLabel: () => string;
  getProgressPercent: () => number;
}

export const useAgentUXStore = create<AgentUXStore>()(
  persist(
    (set, get) => ({
      // Initial state
      workflowState: 'INITIATED',
      progress: null,
      isRunning: false,
      opportunity: null,
      hypotheses: [],
      valueGraph: null,
      defensibilityScore: null,
      artifacts: [],
      pendingCheckpoint: null,
      activities: [],
      maxActivities: 100,
      streams: {},
      selectedArtifactId: null,
      selectedNodeId: null,
      activePanel: 'discovery',
      showActivityFeed: true,
      showTrustPanel: false,
      showProvenance: false,
      provenanceClaimId: null,

      // ── Actions ────────────────────────────────────────────────────────────

      startWorkflow: () => {
        const { isRunning } = get();
        if (isRunning) return;

        // Load seed data immediately for instant context
        const opportunity = agentSimulator.getSeedOpportunity();
        const hypotheses = agentSimulator.getSeedHypotheses();

        set({
          isRunning: true,
          opportunity,
          hypotheses,
          activities: [],
          streams: {},
          pendingCheckpoint: null,
          valueGraph: null,
          defensibilityScore: null,
          artifacts: [],
          workflowState: 'INITIATED',
          activePanel: 'discovery',
        });

        // Subscribe to simulator events
        const unsubscribe = agentSimulator.on((event) => {
          switch (event.type) {
            case 'activity':
              set((state) => ({
                activities: [event.data, ...state.activities].slice(0, state.maxActivities),
              }));
              break;

            case 'progress':
              set({ progress: event.data });
              break;

            case 'state_change':
              set({ workflowState: event.data.to });
              // Auto-navigate to appropriate panel
              const panelMap: Record<string, AgentUXStore['activePanel']> = {
                INITIATED: 'discovery',
                DRAFTING: 'model',
                VALIDATING: 'integrity',
                COMPOSING: 'artifacts',
                REFINING: 'artifacts',
                FINALIZED: 'artifacts',
              };
              const panel = panelMap[event.data.to];
              if (panel) set({ activePanel: panel });
              break;

            case 'stream_token':
              set((state) => {
                const field = event.data.field;
                const existing = state.streams[field] || { text: '', isComplete: false };
                return {
                  streams: {
                    ...state.streams,
                    [field]: {
                      text: existing.text + event.data.token,
                      isComplete: event.data.isComplete,
                    },
                  },
                };
              });
              break;

            case 'checkpoint':
              set({
                pendingCheckpoint: event.data,
                activePanel: 'checkpoint',
              });
              break;

            case 'graph_update':
              set({ valueGraph: event.data });
              break;

            case 'defensibility_update':
              set({
                defensibilityScore: event.data,
                showTrustPanel: true,
              });
              break;
          }
        });

        // Start the simulation
        agentSimulator.start().then(() => {
          // Load artifacts after composing
          const artifacts = agentSimulator.getSeedArtifacts();
          set({ artifacts, selectedArtifactId: artifacts[0]?.id ?? null });
          unsubscribe();
        }).catch(() => {
          unsubscribe();
        });
      },

      resetWorkflow: () => {
        agentSimulator.reset();
        set({
          workflowState: 'INITIATED',
          progress: null,
          isRunning: false,
          opportunity: null,
          hypotheses: [],
          valueGraph: null,
          defensibilityScore: null,
          artifacts: [],
          pendingCheckpoint: null,
          activities: [],
          streams: {},
          selectedArtifactId: null,
          selectedNodeId: null,
          activePanel: 'discovery',
          showTrustPanel: false,
          showProvenance: false,
          provenanceClaimId: null,
        });
      },

      approveCheckpoint: () => {
        agentSimulator.approveCheckpoint().then(() => {
          const artifacts = agentSimulator.getSeedArtifacts();
          set({
            pendingCheckpoint: null,
            workflowState: 'FINALIZED',
            artifacts,
            activePanel: 'artifacts',
          });
        });
      },

      rejectCheckpoint: () => {
        set({
          pendingCheckpoint: null,
          workflowState: 'REFINING',
          activePanel: 'model',
        });
      },

      resolveDataGap: (flagId, value) => {
        set((state) => {
          if (!state.opportunity) return state;
          return {
            opportunity: {
              ...state.opportunity,
              missingDataFlags: state.opportunity.missingDataFlags.map((f) =>
                f.id === flagId ? { ...f, resolved: true, resolvedValue: value } : f
              ),
            },
          };
        });
      },

      acceptHypothesis: (id) => {
        set((state) => ({
          hypotheses: state.hypotheses.map((h) =>
            h.id === id ? { ...h, status: 'accepted' } : h
          ),
        }));
      },

      rejectHypothesis: (id) => {
        set((state) => ({
          hypotheses: state.hypotheses.map((h) =>
            h.id === id ? { ...h, status: 'rejected' } : h
          ),
        }));
      },

      editArtifact: (artifactId, section, content) => {
        set((state) => ({
          artifacts: state.artifacts.map((a) =>
            a.id === artifactId
              ? {
                  ...a,
                  content: a.content.replace(section, content),
                  editHistory: [
                    ...a.editHistory,
                    {
                      userId: 'current-user',
                      timestamp: new Date().toISOString(),
                      section,
                      before: section,
                      after: content,
                    },
                  ],
                }
              : a
          ),
        }));
      },

      selectArtifact: (id) => set({ selectedArtifactId: id }),
      selectNode: (id) => set({ selectedNodeId: id }),
      setActivePanel: (panel) => set({ activePanel: panel }),
      toggleActivityFeed: () => set((s) => ({ showActivityFeed: !s.showActivityFeed })),
      toggleTrustPanel: () => set((s) => ({ showTrustPanel: !s.showTrustPanel })),
      openProvenance: (claimId) => set({ showProvenance: true, provenanceClaimId: claimId }),
      closeProvenance: () => set({ showProvenance: false, provenanceClaimId: null }),

      // ── Computed ────────────────────────────────────────────────────────────

      getStateExperience: () => {
        return STATE_EXPERIENCE_MAP[get().workflowState];
      },

      getReadinessLabel: () => {
        const score = get().defensibilityScore?.global ?? 0;
        if (score >= 0.85) return 'Presentation Ready';
        if (score >= 0.7) return 'Needs Minor Review';
        if (score >= 0.5) return 'Needs Significant Review';
        return 'Not Ready';
      },

      getProgressPercent: () => {
        return get().progress?.percentComplete ?? 0;
      },
    }),
    {
      name: 'agent-ux-store',
      partialize: (state) => ({
        workflowState: state.workflowState,
        opportunity: state.opportunity,
        hypotheses: state.hypotheses,
        valueGraph: state.valueGraph,
        defensibilityScore: state.defensibilityScore,
        artifacts: state.artifacts,
        selectedArtifactId: state.selectedArtifactId,
        activePanel: state.activePanel,
      }),
    }
  )
);
