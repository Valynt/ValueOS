/**
 * useRealization
 *
 * Fetches the latest realization report for a value case and provides
 * a mutation to invoke the RealizationAgent.
 *
 * Also includes V1 surface hooks for baseline, checkpoints, and case approval.
 * Reference: openspec/changes/frontend-v1-surfaces/tasks.md §4.5
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, apiClient } from "@/api/client/unified-api-client";
import { useTenant } from "@/contexts/TenantContext";

// ---------------------------------------------------------------------------
// Legacy Types
// ---------------------------------------------------------------------------

export interface Milestone {
  id: string;
  title: string;
  description: string;
  target_date: string;
  owner: string;
  status: "not_started" | "in_progress" | "completed" | "blocked";
  dependencies: string[];
  success_criteria: string[];
}

export interface KpiTarget {
  kpi_name: string;
  current_value: number;
  target_value: number;
  unit: string;
  measurement_frequency: string;
  data_source: string;
  owner: string;
}

export interface Risk {
  id: string;
  description: string;
  probability: "high" | "medium" | "low";
  impact: "high" | "medium" | "low";
  mitigation: string;
  owner: string;
}

export interface RealizationReport {
  id: string;
  organization_id: string;
  value_case_id: string;
  session_id: string | null;
  milestones: Milestone[];
  kpi_targets: KpiTarget[];
  risks: Risk[];
  implementation_timeline_weeks: number | null;
  resource_requirements: string | null;
  success_criteria: string[];
  confidence: "high" | "medium" | "low" | null;
  hallucination_check: boolean | null;
  source_agent: string;
  created_at: string;
  updated_at: string;
}

export interface AgentRunResponse {
  jobId: string;
  agentId: string;
  status: string;
  result?: Record<string, unknown>;
  confidence?: string;
  duration_ms?: number;
}

// ---------------------------------------------------------------------------
// V1 Surface Types
// ---------------------------------------------------------------------------

export type CheckpointStatus = "pending" | "measured" | "missed" | "exceeded";

export interface KPITarget {
  id: string;
  metricName: string;
  baseline: number;
  target: number;
  unit: string;
  timeline: {
    startDate: string;
    targetDate: string;
  };
  source: string;
  progress: number; // 0-100
}

export interface Checkpoint {
  id: string;
  date: string;
  expectedRange: {
    min: number;
    max: number;
  };
  actualValue?: number;
  status: CheckpointStatus;
  notes?: string;
}

export interface BaselineData {
  caseId: string;
  scenarioName: string;
  approvalDate?: string;
  version: string;
  kpiTargets: KPITarget[];
  assumptions: Array<{
    id: string;
    name: string;
    value: number;
    unit: string;
    source: string;
  }>;
  handoffNotes: {
    dealContext: string;
    buyerPriorities: string;
    implementationAssumptions: string;
    keyRisks: string;
  };
}

// ---------------------------------------------------------------------------
// Legacy Hooks
// ---------------------------------------------------------------------------

export function useRealizationReport(caseId: string | undefined) {
  return useQuery<RealizationReport | null>({
    queryKey: ["realization", caseId],
    queryFn: async () => {
      const result = await apiClient.get<{ data: RealizationReport }>(
        `/api/v1/cases/${caseId}/realization`,
      );
      if (!result.success) throw new Error(result.error?.message ?? "Request failed");
      return result.data?.data ?? null;
    },
    enabled: !!caseId,
    staleTime: 30_000,
    retry: (failureCount, error) => {
      if (error instanceof Error && error.message.includes("HTTP 404")) return false;
      return failureCount < 2;
    },
  });
}

export function useRunRealizationAgent(caseId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation<AgentRunResponse, Error, Record<string, unknown> | undefined>({
    mutationFn: async (context) => {
      const res = await apiClient.post<{ data: AgentRunResponse }>(
        `/api/v1/cases/${caseId}/realization/run`,
        { context: context ?? {} },
      );
      if (!res.success) throw new Error(res.error?.message ?? "Request failed");
      if (!res.data?.data) throw new Error("Empty response from realization/run");
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["realization", caseId] });
    },
  });
}

// ---------------------------------------------------------------------------
// V1 Surface Hooks — Baseline, Checkpoints, Approval
// ---------------------------------------------------------------------------

/**
 * Fetch baseline data for a case.
 * GET /api/cases/:caseId/baseline
 */
export function useBaseline(caseId: string | undefined) {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  return useQuery<BaselineData>({
    queryKey: ["baseline", caseId, tenantId],
    queryFn: async () => {
      const response = await api.getBaseline(caseId!);
      if (!response.success || !response.data) {
        throw new Error(response.error?.message || "Failed to fetch baseline");
      }
      return response.data as BaselineData;
    },
    enabled: !!caseId && !!tenantId,
    staleTime: 60_000, // Baseline rarely changes
  });
}

/**
 * Fetch checkpoints for a case baseline.
 * GET /api/cases/:caseId/baseline/checkpoints
 */
export function useCheckpoints(caseId: string | undefined) {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  return useQuery<Checkpoint[]>({
    queryKey: ["checkpoints", caseId, tenantId],
    queryFn: async () => {
      const response = await api.getCheckpoints(caseId!);
      if (!response.success || !response.data) {
        throw new Error(response.error?.message || "Failed to fetch checkpoints");
      }
      return response.data as Checkpoint[];
    },
    enabled: !!caseId && !!tenantId,
    staleTime: 30_000,
  });
}

/**
 * Approve a case and lock the baseline.
 * POST /api/cases/:caseId/approve
 */
export function useApproveCase(caseId: string | undefined) {
  const queryClient = useQueryClient();
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  return useMutation({
    mutationFn: async () => {
      const response = await api.approveCase(caseId!);
      if (!response.success) {
        throw new Error(response.error?.message || "Failed to approve case");
      }
      return response.data;
    },
    onSuccess: () => {
      // Invalidate baseline to reflect approval
      queryClient.invalidateQueries({ queryKey: ["baseline", caseId, tenantId] });
      // Also invalidate case data as status changes
      queryClient.invalidateQueries({ queryKey: ["case", caseId, tenantId] });
    },
  });
}

