/**
 * Research Job Hooks
 *
 * React Query hooks for the onboarding research job lifecycle:
 * creating jobs, polling status, listing suggestions, and accepting/rejecting.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { ResearchJob, ResearchSuggestion, SuggestionEntityType } from "./types";

const RESEARCH_KEY = "research-job";
const SUGGESTIONS_KEY = "research-suggestions";

function getClient() {
  if (!supabase) throw new Error("Supabase client not initialized");
  return supabase;
}

// ---- Create Research Job ----

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
      const sb = getClient();

      const { data, error } = await sb
        .from("company_research_jobs")
        .insert({
          tenant_id: tenantId,
          context_id: input.contextId,
          input_website: input.website,
          input_industry: input.industry ?? null,
          input_company_size: input.companySize ?? null,
          input_sales_motion: input.salesMotion ?? null,
          status: "queued",
          entity_status: {
            product: "pending",
            competitor: "pending",
            persona: "pending",
            claim: "pending",
            capability: "pending",
            value_pattern: "pending",
          },
        })
        .select()
        .single();

      if (error) throw error;
      return data as ResearchJob;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [RESEARCH_KEY] });
    },
  });
}

// ---- Poll Job Status ----

export function useResearchJobStatus(jobId: string | null) {
  return useQuery<ResearchJob | null>({
    queryKey: [RESEARCH_KEY, jobId],
    enabled: !!jobId,
    refetchInterval: (query) => {
      const data = query.state.data;
      // Stop polling when job is completed or failed
      if (data && (data.status === "completed" || data.status === "failed")) {
        return false;
      }
      return 2000; // Poll every 2 seconds
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

// ---- List Suggestions ----

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

// ---- Accept Suggestion ----

export function useAcceptSuggestion(tenantId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: { suggestionId: string; contextId: string; entityType: string; payload: Record<string, unknown> }) => {
      const sb = getClient();

      // Write to canonical table
      const tableMap: Record<string, string> = {
        product: "company_products",
        competitor: "company_competitors",
        persona: "company_personas",
        claim: "company_claim_governance",
        capability: "company_capabilities",
        value_pattern: "company_value_patterns",
      };

      const targetTable = tableMap[input.entityType];
      if (targetTable) {
        const { error: insertErr } = await sb
          .from(targetTable)
          .insert({
            ...input.payload,
            tenant_id: tenantId,
            context_id: input.contextId,
          });

        if (insertErr) throw insertErr;
      }

      // Mark suggestion as accepted
      const { data, error } = await sb
        .from("company_research_suggestions")
        .update({
          status: "accepted",
          accepted_at: new Date().toISOString(),
        })
        .eq("id", input.suggestionId)
        .select()
        .single();

      if (error) throw error;
      return data as ResearchSuggestion;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [SUGGESTIONS_KEY] });
      qc.invalidateQueries({ queryKey: ["company-context"] });
    },
  });
}

// ---- Reject Suggestion ----

export function useRejectSuggestion(_tenantId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (suggestionId: string) => {
      const sb = getClient();

      const { data, error } = await sb
        .from("company_research_suggestions")
        .update({ status: "rejected" })
        .eq("id", suggestionId)
        .select()
        .single();

      if (error) throw error;
      return data as ResearchSuggestion;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [SUGGESTIONS_KEY] });
    },
  });
}

// ---- Bulk Accept ----

export function useBulkAcceptSuggestions(tenantId: string) {
  const qc = useQueryClient();
  const acceptMutation = useAcceptSuggestion(tenantId);

  return useMutation({
    mutationFn: async (suggestions: Array<{ id: string; contextId: string; entityType: string; payload: Record<string, unknown> }>) => {
      const results = await Promise.allSettled(
        suggestions.map((s) =>
          acceptMutation.mutateAsync({
            suggestionId: s.id,
            contextId: s.contextId,
            entityType: s.entityType,
            payload: s.payload,
          })
        )
      );

      const accepted = results.filter((r) => r.status === "fulfilled").length;
      return { accepted, total: suggestions.length };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [SUGGESTIONS_KEY] });
      qc.invalidateQueries({ queryKey: ["company-context"] });
    },
  });
}
