export { useDebounce, useDebouncedCallback } from "./useDebounce";
export { useMediaQuery, useIsMobile, useIsDesktop } from "./useMediaQuery";
export { useLocalStorage } from "./useLocalStorage";

// V1 Surface Hooks — React Query
export {
  useDealContext,
  useSubmitGapFill,
  useTriggerAssembly,
  type DealContext,
  type GapItem,
  type GapFillInput,
} from "./useDealAssembly";

export {
  useHypotheses,
  useAcceptHypothesis,
  useRejectHypothesis,
  useAssumptions,
  useUpdateAssumption,
  useScenarios,
  useSensitivity,
  type Hypothesis,
  type Assumption,
  type Scenario,
  type SensitivityAnalysis,
} from "./useValueModeling";

export {
  useReadiness,
  useEvidenceGaps,
  usePlausibility,
  type ReadinessData,
  type EvidenceGap,
} from "./useIntegrity";

export {
  useArtifacts,
  useArtifact,
  useEditArtifact,
  useGenerateArtifacts,
  useProvenance,
  type Artifact,
  type ProvenanceChain,
} from "./useExecutiveOutput";

export {
  useBaseline,
  useCheckpoints,
  useApproveCase,
  type BaselineData,
  type Checkpoint,
} from "./useRealization";

export {
  useBillingSummary,
  usePlans,
  usePlanChangePreview,
  useSubmitPlanChange,
  useInvoices,
  useUsage,
  useApprovals,
  useDecideApproval,
  type BillingSummary,
  type Plan,
  type Invoice,
  type ApprovalRequest,
} from "./useBilling";

// Phase 6: Backend Integration — Warmth & Workspace
export { useValueCase, useWarmthHistory } from './queries/useValueCase';
export { useGraphData, useGraphNode } from './queries/useGraphData';
export { useModePreference, useUpdateModePreference } from './queries/useModePreference';
export { useEventSource } from './useEventSource';
export { useWorkspaceEvents } from './useWorkspaceEvents';
export { useWorkspaceData } from './useWorkspaceData';
export { useUpdateNode, useDeleteNode } from './mutations/useUpdateNode';

// Event types
export type {
  WarmthTransitionEvent,
  AgentUpdateEvent,
  CollaborativeEditEvent,
  CheckpointReminderEvent,
  WorkspaceEvent,
} from './events/types';

export {
  isWarmthTransitionEvent,
  isAgentUpdateEvent,
  isCollaborativeEditEvent,
} from './events/types';
