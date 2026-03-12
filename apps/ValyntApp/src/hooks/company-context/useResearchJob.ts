/**
 * Research Job Hooks
 *
 * React Query hooks for the onboarding research job lifecycle.
 * All mutations go through the backend API (POST /api/onboarding/...)
 * so the BullMQ worker pipeline is triggered. Read queries still use
 * Supabase directly for real-time polling efficiency.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { ResearchJob, ResearchSuggestion, SuggestionEntityType } from "./types";

import { apiClient } from "@/api/client/unified-api-client";
import { supabase } from "@/lib/supabase";

const RESEARCH_KEY = "research-job";
const SUGGESTIONS_KEY = "research-suggestions";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getClient() {
  if (!supabase) throw new Error("Supabase client not initialized");
  return supabase;
}

/**
 * Typed API wrapper for endpoints returning { data }.
 */
async function apiRequest<T>(
  path: string,
  init?: { method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH"; body?: unknown },
): Promise<T> {
  const method = init?.method ?? "GET";

  let response:
    | Awaited<ReturnType<(typeof apiClient)["get"]<{ data: T }>>>
    | Awaited<ReturnType<(typeof apiClient)["post"]<{ data: T }>>>
    | Awaited<ReturnType<(typeof apiClient)["put"]<{ data: T }>>>
    | Awaited<ReturnType<(typeof apiClient)["delete"]<{ data: T }>>>
    | Awaited<ReturnType<(typeof apiClient)["patch"]<{ data: T }>>>;

  switch (method) {
    case "GET":
      response = await apiClient.get<{ data: T }>({
        url: path,
      });
      break;
    case "POST":
      response = await apiClient.post<{ data: T }>({
        url: path,
        data: init?.body,
      });
      break;
    case "PUT":
      response = await apiClient.put<{ data: T }>({
        url: path,
        data: init?.body,
      });
      break;
    case "DELETE":
      response = await apiClient.delete<{ data: T }>({
        url: path,
        data: init?.body,
      });
      break;
    case "PATCH":
      response = await apiClient.patch<{ data: T }>({
        url: path,
        data: init?.body,
      });
      break;
    default:
      throw new Error(`Unsupported HTTP method: ${method}`);
  }
  if (!response.success) {
    throw new Error(response.error?.message ?? "Request failed");
  }

  if (response.data === undefined || response.data === null) {
    throw new Error("No data returned from API");
  }

  return response.data.data;
}

// ---------------------------------------------------------------------------
// Create Research Job — goes through the backend API so BullMQ picks it up
// ---------------------------------------------------------------------------

export function useCreateResearchJob(tenantId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      contextId: string;
      website: string;
      industry?: string;
      companySize?: string;
      salesMotion?: string;
    }) => {
      return apiRequest<ResearchJob>("/api/onboarding/research", {
        method: "POST",
        body: input,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [RESEARCH_KEY] });
    },
  });
}

// ---------------------------------------------------------------------------
// Poll Job Status — reads directly from Supabase for low-latency polling
// ---------------------------------------------------------------------------

export function useResearchJobStatus(jobId: string | null) {
  return useQuery<ResearchJob | null>({
    queryKey: [RESEARCH_KEY, jobId],
    enabled: !!jobId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data && (data.status === "completed" || data.status === "failed")) {
        return false;
      }
      return 2000;
    },
    queryFn: async () => {
      const sb = getClient();

      const { data, error } = await sb
        .from("company_research_jobs")
        .select("*")
        .eq("id", jobId!)
        .single();

      if (error) throw error;
      return data as ResearchJob;
    },
  });
}

// ---------------------------------------------------------------------------
// List Suggestions
// ---------------------------------------------------------------------------

export function useResearchSuggestions(
  jobId: string | null,
  entityType?: SuggestionEntityType,
) {
  return useQuery<ResearchSuggestion[]>({
    queryKey: [SUGGESTIONS_KEY, jobId, entityType],
    enabled: !!jobId,
    queryFn: async () => {
      const sb = getClient();

      let query = sb
        .from("company_research_suggestions")
        .select("*")
        .eq("job_id", jobId!)
        .order("confidence_score", { ascending: false });

      if (entityType) {
        query = query.eq("entity_type", entityType);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as ResearchSuggestion[];
    },
  });
}

// ---------------------------------------------------------------------------
// Accept Suggestion — goes through backend API for transactional writes
// ---------------------------------------------------------------------------

export function useAcceptSuggestion(_tenantId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      suggestionId: string;
      contextId: string;
      entityType: string;
      payload: Record<string, unknown>;
    }) => {
      return apiRequest<ResearchSuggestion>(`/api/onboarding/suggestions/${input.suggestionId}`, {
        method: "PATCH",
        body: { status: "accepted" },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [SUGGESTIONS_KEY] });
      qc.invalidateQueries({ queryKey: ["company-context"] });
    },
  });
}

// ---------------------------------------------------------------------------
// Reject Suggestion
// ---------------------------------------------------------------------------

export function useRejectSuggestion(_tenantId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (suggestionId: string) => {
      return apiRequest<ResearchSuggestion>(`/api/onboarding/suggestions/${suggestionId}`, {
        method: "PATCH",
        body: { status: "rejected" },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [SUGGESTIONS_KEY] });
    },
  });
}

// ---------------------------------------------------------------------------
// Bulk Accept
// ---------------------------------------------------------------------------

export function useBulkAcceptSuggestions(_tenantId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (
      suggestions: Array<{
        id: string;
        contextId: string;
        entityType: string;
        payload: Record<string, unknown>;
      }>,
    ) => {
      const ids = suggestions.map((s) => s.id);
      return apiRequest<{ results: Array<{ id: string; success: boolean }>; accepted: number; total: number }>(
        "/api/onboarding/suggestions/bulk-accept",
        { method: "POST", body: { ids } },
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [SUGGESTIONS_KEY] });
      qc.invalidateQueries({ queryKey: ["company-context"] });
    },
  });
}
