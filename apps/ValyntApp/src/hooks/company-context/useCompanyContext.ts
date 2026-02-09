import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type {
  CompanyContext,
  CompanyProduct,
  CompanyCapability,
  CompanyCompetitor,
  CompanyPersona,
  CompanyValuePattern,
  CompanyClaimGovernance,
  CompanyValueContext,
  OnboardingPhase1Input,
  OnboardingPhase2Input,
  OnboardingPhase3Input,
  OnboardingPhase4Input,
} from "./types";

const QUERY_KEY = "company-context";

function getClient() {
  if (!supabase) throw new Error("Supabase client not initialized");
  return supabase;
}

// ---- Queries ----

export function useCompanyContext(tenantId: string | undefined) {
  return useQuery<CompanyValueContext | null>({
    queryKey: [QUERY_KEY, tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const sb = getClient();

      // Fetch the root context
      const { data: context, error: ctxErr } = await sb
        .from("company_contexts")
        .select("*")
        .eq("tenant_id", tenantId!)
        .is("deleted_at", null)
        .maybeSingle();

      if (ctxErr) throw ctxErr;
      if (!context) return null;

      // Fetch all related data in parallel
      const [products, capabilities, competitors, personas, valuePatterns, claimGovernance] =
        await Promise.all([
          sb.from("company_products").select("*").eq("context_id", context.id).then((r) => r.data ?? []),
          sb.from("company_capabilities").select("*").eq("tenant_id", tenantId!).then((r) => r.data ?? []),
          sb.from("company_competitors").select("*").eq("context_id", context.id).then((r) => r.data ?? []),
          sb.from("company_personas").select("*").eq("context_id", context.id).then((r) => r.data ?? []),
          sb.from("company_value_patterns").select("*").eq("context_id", context.id).then((r) => r.data ?? []),
          sb.from("company_claim_governance").select("*").eq("context_id", context.id).then((r) => r.data ?? []),
        ]);

      return {
        context: context as CompanyContext,
        products: products as CompanyProduct[],
        capabilities: capabilities as CompanyCapability[],
        competitors: competitors as CompanyCompetitor[],
        personas: personas as CompanyPersona[],
        valuePatterns: valuePatterns as CompanyValuePattern[],
        claimGovernance: claimGovernance as CompanyClaimGovernance[],
      };
    },
  });
}

export function useOnboardingStatus(tenantId: string | undefined) {
  return useQuery<CompanyContext["onboarding_status"] | "none">({
    queryKey: [QUERY_KEY, "status", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const sb = getClient();
      const { data, error } = await sb
        .from("company_contexts")
        .select("onboarding_status")
        .eq("tenant_id", tenantId!)
        .is("deleted_at", null)
        .maybeSingle();

      if (error) throw error;
      if (!data) return "none";
      return data.onboarding_status as CompanyContext["onboarding_status"];
    },
  });
}

// ---- Mutations ----

export function useCreateCompanyContext(tenantId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: OnboardingPhase1Input) => {
      const sb = getClient();

      // Create root context
      const { data: context, error: ctxErr } = await sb
        .from("company_contexts")
        .insert({
          tenant_id: tenantId,
          company_name: input.company_name,
          website_url: input.website_url,
          industry: input.industry,
          company_size: input.company_size,
          sales_motion: input.sales_motion,
          onboarding_status: "in_progress",
        })
        .select()
        .single();

      if (ctxErr) throw ctxErr;

      // Create products
      if (input.products.length > 0) {
        const { error: prodErr } = await sb.from("company_products").insert(
          input.products.map((p) => ({
            tenant_id: tenantId,
            context_id: context.id,
            name: p.name,
            description: p.description,
            product_type: p.product_type,
          }))
        );
        if (prodErr) throw prodErr;
      }

      return context as CompanyContext;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY, tenantId] });
    },
  });
}

export function useAddCompetitors(tenantId: string, contextId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: OnboardingPhase2Input) => {
      const sb = getClient();
      const { error } = await sb.from("company_competitors").insert(
        input.competitors.map((c) => ({
          tenant_id: tenantId,
          context_id: contextId,
          name: c.name,
          website_url: c.website_url ?? null,
          relationship: c.relationship,
        }))
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY, tenantId] });
    },
  });
}

export function useAddPersonas(tenantId: string, contextId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: OnboardingPhase3Input) => {
      const sb = getClient();
      const { error } = await sb.from("company_personas").insert(
        input.personas.map((p) => ({
          tenant_id: tenantId,
          context_id: contextId,
          title: p.title,
          persona_type: p.persona_type,
          seniority: p.seniority,
          typical_kpis: p.typical_kpis,
          pain_points: p.pain_points,
        }))
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY, tenantId] });
    },
  });
}

export function useAddClaimGovernance(tenantId: string, contextId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: OnboardingPhase4Input) => {
      const sb = getClient();
      const { error } = await sb.from("company_claim_governance").insert(
        input.claim_governance.map((c) => ({
          tenant_id: tenantId,
          context_id: contextId,
          claim_text: c.claim_text,
          risk_level: c.risk_level,
          category: c.category,
          rationale: c.rationale ?? null,
        }))
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY, tenantId] });
    },
  });
}

export function useCompleteOnboarding(tenantId: string, contextId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const sb = getClient();

      // Snapshot the full context for version history
      const fullContext = await sb
        .from("company_contexts")
        .select("*")
        .eq("id", contextId)
        .single();

      if (fullContext.data) {
        await sb.from("company_context_versions").insert({
          context_id: contextId,
          tenant_id: tenantId,
          version: (fullContext.data.version ?? 0) + 1,
          snapshot: fullContext.data,
          change_reason: "Initial onboarding completed",
        });
      }

      // Mark as completed
      const { error } = await sb
        .from("company_contexts")
        .update({
          onboarding_status: "completed",
          onboarding_completed_at: new Date().toISOString(),
          version: (fullContext.data?.version ?? 0) + 1,
        })
        .eq("id", contextId);

      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY, tenantId] });
    },
  });
}
