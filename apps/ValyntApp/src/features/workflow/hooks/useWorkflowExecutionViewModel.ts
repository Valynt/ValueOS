import { useQuery } from "@tanstack/react-query";

import {
  isBackendWorkflowState,
  WORKFLOW_STATUS_PRESENTATION,
  type WorkflowViewState,
} from "./workflowExecutionPresentation";

import { api } from "@/api/client/unified-api-client";
import { useTenant } from "@/contexts/TenantContext";

interface WorkflowExecutionApiPayload {
  status?: string;
  state?: string;
  currentStage?: string;
  confidence?: number;
  confidenceScore?: number;
  updatedAt?: string;
  lastUpdatedAt?: string;
}

interface WorkflowMetadataPayload {
  status?: string;
  currentStepId?: string;
  currentStage?: string;
  updatedAt?: string;
}

interface WorkflowExecutionViewModel {
  backendState: WorkflowViewState;
  statusLabel: string;
  statusMessage: string;
  statusIconClassName: string;
  confidenceBarClassName: string;
  confidencePercent: number;
  confidenceLabel: string;
  ctaText: string;
  currentStageKey: string | null;
  lastUpdatedLabel: string;
}

interface WorkflowExecutionResource {
  status: WorkflowViewState;
  currentStage: string | null;
  confidencePercent: number;
  updatedAt: string | null;
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function resolveConfidencePercent(payload: WorkflowExecutionApiPayload): number {
  if (typeof payload.confidence === "number") return clampPercent(payload.confidence);
  if (typeof payload.confidenceScore === "number") {
    if (payload.confidenceScore <= 1) return clampPercent(payload.confidenceScore * 100);
    return clampPercent(payload.confidenceScore);
  }
  return 0;
}

function formatLastUpdated(updatedAt: string | null): string {
  if (!updatedAt) return "No execution activity yet";

  const date = new Date(updatedAt);
  if (Number.isNaN(date.getTime())) return "Execution update time unavailable";

  const deltaMs = Date.now() - date.getTime();
  if (deltaMs < 60_000) return "Updated just now";

  const deltaMinutes = Math.floor(deltaMs / 60_000);
  if (deltaMinutes < 60) return `Last updated ${deltaMinutes}m ago`;

  const deltaHours = Math.floor(deltaMinutes / 60);
  if (deltaHours < 24) return `Last updated ${deltaHours}h ago`;

  const deltaDays = Math.floor(deltaHours / 24);
  return `Last updated ${deltaDays}d ago`;
}

function unwrapData<TData>(response: { success?: boolean; data?: unknown }): TData | null {
  if (!response.success || !response.data) return null;

  const payload = response.data as { data?: unknown };
  if (payload.data && typeof payload.data === "object") {
    return payload.data as TData;
  }

  if (typeof response.data === "object") {
    return response.data as TData;
  }

  return null;
}

async function fetchWorkflowExecutionResource(workflowId: string): Promise<WorkflowExecutionResource> {
  const [statusResponse, workflowResponse] = await Promise.all([
    api.getWorkflowStatus(workflowId),
    api.getWorkflow(workflowId),
  ]);

  const statusPayload = unwrapData<WorkflowExecutionApiPayload>(statusResponse);
  const workflowPayload = unwrapData<WorkflowMetadataPayload>(workflowResponse);

  const rawState = statusPayload?.state ?? statusPayload?.status ?? workflowPayload?.status;
  const status: WorkflowViewState = isBackendWorkflowState(rawState) ? rawState : "never_run";

  return {
    status,
    currentStage: statusPayload?.currentStage ?? workflowPayload?.currentStage ?? workflowPayload?.currentStepId ?? null,
    confidencePercent: statusPayload ? resolveConfidencePercent(statusPayload) : 0,
    updatedAt: statusPayload?.updatedAt ?? statusPayload?.lastUpdatedAt ?? workflowPayload?.updatedAt ?? null,
  };
}

export function useWorkflowExecutionViewModel(workflowId: string | undefined) {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id ?? null;

  return useQuery<WorkflowExecutionViewModel>({
    queryKey: ["workflow-execution-view-model", tenantId, workflowId],
    enabled: Boolean(tenantId && workflowId),
    refetchInterval: 15_000,
    queryFn: async () => {
      const resource = await fetchWorkflowExecutionResource(workflowId!);
      const presentation = WORKFLOW_STATUS_PRESENTATION[resource.status];

      return {
        backendState: resource.status,
        statusLabel: presentation.label,
        statusMessage: presentation.userMessage,
        statusIconClassName: presentation.iconClassName,
        confidenceBarClassName: presentation.confidenceClassName,
        confidencePercent: resource.confidencePercent,
        confidenceLabel: `${resource.confidencePercent}%`,
        ctaText: presentation.ctaText,
        currentStageKey: resource.currentStage,
        lastUpdatedLabel: formatLastUpdated(resource.updatedAt),
      };
    },
    placeholderData: {
      backendState: "never_run",
      statusLabel: WORKFLOW_STATUS_PRESENTATION.never_run.label,
      statusMessage: WORKFLOW_STATUS_PRESENTATION.never_run.userMessage,
      statusIconClassName: WORKFLOW_STATUS_PRESENTATION.never_run.iconClassName,
      confidenceBarClassName: WORKFLOW_STATUS_PRESENTATION.never_run.confidenceClassName,
      confidencePercent: 0,
      confidenceLabel: "0%",
      ctaText: WORKFLOW_STATUS_PRESENTATION.never_run.ctaText,
      currentStageKey: null,
      lastUpdatedLabel: "No execution activity yet",
    },
  });
}

export type { WorkflowExecutionViewModel };
