/**
 * Research Job Hooks
 *
 * React Query hooks for the onboarding research job lifecycle.
 * All mutations go through the backend API (POST /api/onboarding/...)
 * so the BullMQ worker pipeline is triggered. Read queries still use
 * Supabase directly for real-time polling efficiency.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { ResearchJob, ResearchSuggestion, SuggestionEntityType } from "./types";

const RESEARCH_KEY = "research-job";
const SUGGESTIONS_KEY = "research-suggestions";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getClient() {
  if (!supabase) throw new Error("Supabase client not initialized");
  return supabase;
}

/** Get the current session's access token for backend API calls. */
async function getAccessToken(): Promise<string> {
  const sb = getClient();
  const { data } = await sb.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not authenticated");
  return token;
}

/** Typed fetch wrapper that hits the backend API with auth. */
async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? `API error ${res.status}`);
  }

  const json = await res.json();
  return json.data as T;
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
      return apiFetch<ResearchJob>("/api/onboarding/research", {
        method: "POST",
        body: JSON.stringify(input),
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
      return apiFetch<ResearchSuggestion>(
        `/api/onboarding/suggestions/${input.suggestionId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ status: "accepted" }),
        },
      );
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
      return apiFetch<ResearchSuggestion>(
        `/api/onboarding/suggestions/${suggestionId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ status: "rejected" }),
        },
      );
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
      return apiFetch<{ results: Array<{ id: string; success: boolean }>; accepted: number; total: number }>(
        "/api/onboarding/suggestions/bulk-accept",
        {
          method: "POST",
          body: JSON.stringify({ ids }),
        },
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [SUGGESTIONS_KEY] });
      qc.invalidateQueries({ queryKey: ["company-context"] });
    },
  });
}
