/**
 * useIntegrityOutput
 *
 * Fetches and manages IntegrityAgent output for a value case.
 *
 * - GET /api/v1/cases/:caseId/integrity — returns { data: IntegrityOutput | null }
 * - runAgent() — POSTs to /api/agents/integrity/invoke, then invalidates the query
 *
 * Empty state (data: null) means the agent has not run yet for this case.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface IntegrityClaim {
  claim_id: string;
  text: string;
  confidence_score: number;
  evidence_tier?: number;
  flagged: boolean;
  flag_reason?: string;
}

export interface IntegrityOutput {
  id: string;
  case_id: string;
  organization_id: string;
  agent_run_id: string | null;
  claims: IntegrityClaim[];
  overall_confidence: number | null;
  veto_triggered: boolean;
  veto_reason: string | null;
  source_agent: string;
  created_at: string;
  updated_at: string;
}

export interface UseIntegrityOutputReturn {
  data: IntegrityOutput | null;
  isLoading: boolean;
  error: Error | null;
  runAgent: (organizationId: string) => void;
  isRunning: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) {
      headers["Authorization"] = `Bearer ${data.session.access_token}`;
    }
  }
  return headers;
}

async function fetchJSON<T>(url: string): Promise<T> {
  const headers = await getAuthHeaders();
  const res = await fetch(url, { headers, credentials: "include" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as Record<string, string>;
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

async function postJSON<T>(url: string, body: unknown): Promise<T> {
  const headers = await getAuthHeaders();
  const res = await fetch(url, {
    method: "POST",
    headers,
    credentials: "include",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({})) as Record<string, string>;
    throw new Error(errBody.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------

export const integrityOutputKeys = {
  all: ["integrity-output"] as const,
  forCase: (caseId: string) => ["integrity-output", caseId] as const,
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useIntegrityOutput(caseId: string | undefined): UseIntegrityOutputReturn {
  const queryClient = useQueryClient();

  const query = useQuery<IntegrityOutput | null, Error>({
    queryKey: integrityOutputKeys.forCase(caseId ?? ""),
    enabled: !!caseId,
    queryFn: async () => {
      const res = await fetchJSON<{ data: IntegrityOutput | null }>(
        `/api/v1/cases/${caseId}/integrity`,
      );
      return res.data;
    },
  });

  const mutation = useMutation<unknown, Error, string>({
    mutationFn: async (organizationId: string) => {
      const res = await postJSON<{ mode: "direct" | "async"; jobId?: string; result?: unknown }>(
        "/api/agents/integrity/invoke",
        { caseId, organizationId, query: "validate claims" },
      );

      // For async mode, the result is not immediately available — the query
      // invalidation below will re-fetch once the job completes.
      // For direct mode, the result is in res.result but we still re-fetch
      // to get the persisted DB row (canonical source of truth).
      return res;
    },
    onSuccess: () => {
      // Invalidate so the GET query re-fetches the persisted output
      void queryClient.invalidateQueries({
        queryKey: integrityOutputKeys.forCase(caseId ?? ""),
      });
    },
  });

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
    runAgent: (organizationId: string) => mutation.mutate(organizationId),
    isRunning: mutation.isPending,
  };
}
