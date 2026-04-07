/**
 * React Query hooks for Journey Orchestrator and Hypothesis Promotion.
 *
 * Covers: journey state fetching, hypothesis-to-assumption promotion.
 * Reference: Sprint 55 Journey-Driven Mode Switch + One-Click Promotion.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/api/client/unified-api-client";
import { useTenant } from "@/contexts/TenantContext";

// ============================================================================
// Types
// ============================================================================

export interface ArtifactSlot {
  id: string;
  label: string;
  component: string;
  region: "header" | "left_rail" | "center_canvas" | "right_panel" | "footer";
  panelTitle: string;
  dataSource: string;
  refreshOn: string[];
  badgeType: "count" | "alerts" | "confidence" | "none";
}

export interface PhaseExitCondition {
  id: string;
  description: string;
  passed: boolean;
  reason?: string;
}

export interface JourneyPhase {
  id: string;
  label: string;
  description: string;
  userGoal: string;
  canLock: boolean;
  experienceMode: string;
  workspaceTitle: string;
  supportsBoardReadyLock: boolean;
  artifactSlots: ArtifactSlot[];
  exitConditions: PhaseExitCondition[];
}

export interface UIState {
  label: string;
  indicator: "idle" | "progress" | "streaming" | "success" | "error" | "blocked";
  userActionable: boolean;
  cta?: { label: string; action_id: string };
  showConfidence: boolean;
  activeAgent?: string | null;
}

export interface AvailableAction {
  id: string;
  label: string;
  surface: "slash_command" | "button" | "inline_edit";
  slashCommand?: string;
  requiresConfirmation: boolean;
  minConfidence: number | null;
}

export interface SlashCommand {
  command: string;
  label: string;
}

export interface WorkspaceHeader {
  title: string;
  phase_label: string;
  user_goal: string;
  confidence_score: number;
  value_case_status: string;
  interaction_mode: "editable" | "locked";
}

export interface WorkspaceRegions {
  header: unknown[];
  left_rail: unknown[];
  center_canvas: unknown[];
  right_panel: unknown[];
  footer: unknown[];
}

export interface JourneyState {
  phase: JourneyPhase;
  uiState: UIState | null;
  availableActions: AvailableAction[];
  slashCommands: SlashCommand[];
  pageSections: unknown[];
  workspaceRegions: WorkspaceRegions;
  workspaceHeader: WorkspaceHeader;
  activeInterrupts: unknown[];
  trustThresholds: {
    always_show_below: number;
    warn_below: number;
    block_below: number;
    min_evidence_tier: string;
  };
  interactionMode: "editable" | "locked";
}

export interface PromoteHypothesisInput {
  value?: number;
  unit?: string;
  sourceType?:
    | "customer-confirmed"
    | "CRM-derived"
    | "call-derived"
    | "note-derived"
    | "benchmark-derived"
    | "externally-researched"
    | "inferred"
    | "manually-overridden";
}

export interface PromoteHypothesisResult {
  assumption: {
    id: string;
    name: string;
    value: number;
    unit: string;
    source: string;
    confidenceScore: number;
    lineage: {
      hypothesis_id: string;
      hypothesis_name: string;
      promoted_by: string;
      promoted_at: string;
      evidence_tier: string;
      impact_range: { min: number; max: number };
    };
  };
  hypothesis: {
    id: string;
    status: string;
    promotedToAssumptionId: string;
  };
}

// ============================================================================
// Journey Orchestrator Hook
// ============================================================================

/**
 * Fetch journey orchestration state for a case.
 * GET /api/cases/:caseId/journey
 */
export function useJourneyOrchestrator(caseId: string | undefined) {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  return useQuery<JourneyState>({
    queryKey: ["journey", caseId, tenantId],
    queryFn: async () => {
      const response = await api.getJourneyState(caseId!);
      if (!response.success || !response.data) {
        throw new Error(response.error?.message || "Failed to fetch journey state");
      }
      return response.data as JourneyState;
    },
    enabled: !!caseId && !!tenantId,
    staleTime: 30_000,
    refetchInterval: (query) => {
      const data = query.state.data;
      // Auto-refetch more frequently when in running states
      if (data?.uiState?.indicator === "progress" || data?.uiState?.indicator === "streaming") {
        return 5_000; // 5 seconds
      }
      return false; // Don't auto-refetch in stable states
    },
  });
}

// ============================================================================
// Hypothesis Promotion Hook
// ============================================================================

/**
 * Promote a hypothesis to a locked assumption.
 * POST /api/cases/:caseId/hypotheses/:hypothesisId/promote
 */
export function usePromoteHypothesisToAssumption() {
  const queryClient = useQueryClient();
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  return useMutation({
    mutationFn: async ({
      caseId,
      hypothesisId,
      input,
    }: {
      caseId: string;
      hypothesisId: string;
      input?: PromoteHypothesisInput;
    }) => {
      const response = await api.promoteHypothesisToAssumption(caseId, hypothesisId, input);
      if (!response.success) {
        throw new Error(response.error?.message || "Failed to promote hypothesis");
      }
      return response.data as PromoteHypothesisResult;
    },
    onSuccess: (_, variables) => {
      // Invalidate hypotheses to show updated status
      queryClient.invalidateQueries({ queryKey: ["hypotheses", variables.caseId, tenantId] });
      // Invalidate assumptions to show new assumption
      queryClient.invalidateQueries({ queryKey: ["assumptions", variables.caseId, tenantId] });
      // Invalidate journey state to refresh available actions
      queryClient.invalidateQueries({ queryKey: ["journey", variables.caseId, tenantId] });
      // Invalidate scenarios as they depend on assumptions
      queryClient.invalidateQueries({ queryKey: ["scenarios", variables.caseId, tenantId] });
      queryClient.invalidateQueries({ queryKey: ["sensitivity", variables.caseId, tenantId] });
    },
  });
}
