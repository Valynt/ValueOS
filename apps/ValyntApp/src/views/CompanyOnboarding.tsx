import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";


import { Phase1Company } from "./onboarding/Phase1Company";
import { Phase2Competitors } from "./onboarding/Phase2Competitors";
import { Phase3Personas } from "./onboarding/Phase3Personas";
import { Phase4Claims } from "./onboarding/Phase4Claims";
import { Phase5Review } from "./onboarding/Phase5Review";

import { useTenant } from "@/contexts/TenantContext";
import {
  useAddClaimGovernance,
  useAddCompetitors,
  useAddPersonas,
  useCompleteOnboarding,
  useCreateCompanyContext,
} from "@/hooks/company-context";
import type {
  OnboardingPhase1Input,
  OnboardingPhase2Input,
  OnboardingPhase3Input,
  OnboardingPhase4Input,
} from "@/hooks/company-context/types";
import {
  useCreateResearchJob,
  useResearchJobStatus,
  useResearchSuggestions,
} from "@/hooks/company-context/useResearchJob";
import { clearOnboardingBypass, markOnboardingBypassed } from "@/lib/onboarding-bypass";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/logger";

const phases = [
  { key: "company", label: "Company", step: 1 },
  { key: "competitors", label: "Competitors", step: 2 },
  { key: "personas", label: "Personas", step: 3 },
  { key: "claims", label: "Claims", step: 4 },
  { key: "review", label: "Review", step: 5 },
];

export default function CompanyOnboarding() {
  const navigate = useNavigate();
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id ?? "default";

  const queryClient = useQueryClient();
  const [phase, setPhase] = useState(1);
  const [contextId, setContextId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [researchJobId, setResearchJobId] = useState<string | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  // Collected data
  const [phase1Data, setPhase1Data] = useState<OnboardingPhase1Input | null>(null);
  const [phase2Data, setPhase2Data] = useState<OnboardingPhase2Input | null>(null);
  const [phase3Data, setPhase3Data] = useState<OnboardingPhase3Input | null>(null);
  const [phase4Data, setPhase4Data] = useState<OnboardingPhase4Input | null>(null);

  // Mutations
  const createContext = useCreateCompanyContext(tenantId);
  const addCompetitors = useAddCompetitors(tenantId, contextId ?? "");
  const addPersonas = useAddPersonas(tenantId, contextId ?? "");
  const addClaimGovernance = useAddClaimGovernance(tenantId, contextId ?? "");
  const completeOnboarding = useCompleteOnboarding(tenantId, contextId ?? "");

  // Research job state
  const createResearchJob = useCreateResearchJob(tenantId);
  const { data: researchJob } = useResearchJobStatus(researchJobId);
  const { data: researchSuggestions } = useResearchSuggestions(researchJobId);

  const handleStartResearch = async (website: string, industry: string, companySize: string | null, salesMotion: string | null, ticker?: string) => {
    if (!contextId) {
      // Create context first if not yet created
      try {
        const ctx = await createContext.mutateAsync({
          company_name: "Pending",
          website_url: website,
          industry,
          company_size: companySize as OnboardingPhase1Input["company_size"],
          sales_motion: salesMotion as OnboardingPhase1Input["sales_motion"],
          products: [],
        });
        setContextId(ctx.id);

        const jobInput: { contextId: string; website: string; industry?: string; companySize?: string; salesMotion?: string; ticker?: string } = {
          contextId: ctx.id,
          website,
        };
        if (industry) jobInput.industry = industry;
        if (companySize) jobInput.companySize = companySize;
        if (salesMotion) jobInput.salesMotion = salesMotion;
        if (ticker) jobInput.ticker = ticker;
        const job = await createResearchJob.mutateAsync(jobInput);
        setResearchJobId(job.id);
      } catch {
        // Silently fail — user can continue manually
      }
    } else {
      try {
        const jobInput2: { contextId: string; website: string; industry?: string; companySize?: string; salesMotion?: string; ticker?: string } = {
          contextId,
          website,
        };
        if (industry) jobInput2.industry = industry;
        if (companySize) jobInput2.companySize = companySize;
        if (salesMotion) jobInput2.salesMotion = salesMotion;
        if (ticker) jobInput2.ticker = ticker;
        const job = await createResearchJob.mutateAsync(jobInput2);
        setResearchJobId(job.id);
      } catch {
        // Silently fail
      }
    }
  };

  const handleSkip = async () => {
    setSubmissionError(null);
    try {
      markOnboardingBypassed(tenantId);

      if (supabase) {
        // Check if a context already exists for this tenant
        const { data: existing } = await supabase
          .from("company_contexts")
          .select("id")
          .eq("tenant_id", tenantId)
          .is("deleted_at", null)
          .maybeSingle();

        if (existing) {
          // Update existing to completed
          await supabase
            .from("company_contexts")
            .update({
              onboarding_status: "completed",
              onboarding_completed_at: new Date().toISOString(),
            })
            .eq("id", existing.id);
        } else {
          // Insert a minimal completed context
          await supabase.from("company_contexts").insert({
            tenant_id: tenantId,
            company_name: currentTenant?.name ?? "My Company",
            onboarding_status: "completed",
            onboarding_completed_at: new Date().toISOString(),
          });
        }

        // Invalidate all company-context queries so the gate re-reads
        await queryClient.invalidateQueries({ queryKey: ["company-context"] });
      }
      navigate("/dashboard");
    } catch (err) {
      logger.error("Skip onboarding failed:", { error: err });
      setSubmissionError("We couldn't skip onboarding right now. Please try again.");
    }
  };

  const handlePhase1 = async (data: OnboardingPhase1Input, jobId?: string, options?: { fastTrack: boolean }) => {
    setSubmissionError(null);
    setPhase1Data(data);
    if (jobId) setResearchJobId(jobId);
    const shouldFastTrack = options?.fastTrack && !!jobId && researchJob?.status === "completed";
    try {
      if (contextId) {
        // Context already created during research — update it
        if (supabase) {
          await supabase
            .from("company_contexts")
            .update({
              company_name: data.company_name,
              website_url: data.website_url,
              industry: data.industry,
              company_size: data.company_size,
              sales_motion: data.sales_motion,
            })
            .eq("id", contextId);

          // Insert products
          if (data.products.length > 0) {
            await supabase.from("company_products").insert(
              data.products.map((p) => ({
                tenant_id: tenantId,
                context_id: contextId,
                name: p.name,
                description: p.description,
                product_type: p.product_type,
              }))
            );
          }
        }
        setPhase(shouldFastTrack ? 5 : 2);
      } else {
        const ctx = await createContext.mutateAsync(data);
        setContextId(ctx.id);
        setPhase(shouldFastTrack ? 5 : 2);
      }
    } catch {
      setSubmissionError("We couldn't save company details. Please retry before continuing.");
    }
  };

  const handlePhase2 = async (data: OnboardingPhase2Input) => {
    setSubmissionError(null);
    setPhase2Data(data);
    if (contextId && data.competitors.length > 0) {
      try {
        await addCompetitors.mutateAsync(data);
      } catch {
        setSubmissionError("We couldn't save competitors. Please retry before continuing.");
        return;
      }
    }
    setPhase(3);
  };

  const handlePhase3 = async (data: OnboardingPhase3Input) => {
    setSubmissionError(null);
    setPhase3Data(data);
    if (contextId && data.personas.length > 0) {
      try {
        await addPersonas.mutateAsync(data);
      } catch {
        setSubmissionError("We couldn't save personas. Please retry before continuing.");
        return;
      }
    }
    setPhase(4);
  };

  const handlePhase4 = async (data: OnboardingPhase4Input) => {
    setSubmissionError(null);
    setPhase4Data(data);
    if (contextId && data.claim_governance.length > 0) {
      try {
        await addClaimGovernance.mutateAsync(data);
      } catch {
        setSubmissionError("We couldn't save claim governance. Please retry before continuing.");
        return;
      }
    }
    setPhase(5);
  };

  const handleConfirm = async () => {
    setSubmissionError(null);
    setIsSubmitting(true);
    try {
      if (contextId) {
        await completeOnboarding.mutateAsync();
      }
      clearOnboardingBypass(tenantId);
      navigate("/dashboard");
    } catch {
      setSubmissionError("We couldn't complete onboarding. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-full bg-zinc-50 flex">
      {/* Left: progress rail */}
      <div className="w-64 bg-white border-r border-zinc-200 p-8 flex-shrink-0">
        <div className="mb-10">
          <h1 className="text-[18px] font-black text-zinc-950 tracking-[-0.05em]">ValueOS</h1>
          <p className="text-[11px] text-zinc-400 mt-1">Value Intelligence Setup</p>
        </div>

        <div className="space-y-1">
          {phases.map((p) => (
            <div
              key={p.key}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors",
                phase === p.step ? "bg-zinc-950 text-white" :
                  phase > p.step ? "text-zinc-600" : "text-zinc-300"
              )}
            >
              <div className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0",
                phase === p.step ? "bg-white text-zinc-950" :
                  phase > p.step ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-400"
              )}>
                {phase > p.step ? "✓" : p.step}
              </div>
              <span className="text-[13px] font-medium">{p.label}</span>
            </div>
          ))}
        </div>

        <div className="mt-10 p-4 rounded-xl bg-zinc-50 border border-zinc-100">
          <p className="text-[11px] text-zinc-500 leading-relaxed">
            This one-time setup teaches the system your business, products, and competitive landscape.
            Every value case you build after this will be faster and sharper.
          </p>
        </div>

        <button
          onClick={handleSkip}
          className="mt-4 w-full text-[12px] text-zinc-400 hover:text-zinc-600 transition-colors py-2"
        >
          Skip for now →
        </button>
      </div>

      {/* Right: phase content */}
      <div className="flex-1 flex justify-center py-10 px-8 overflow-y-auto">
        <div className="w-full max-w-2xl">
          {submissionError ? (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
              {submissionError}
            </div>
          ) : null}

          {phase === 1 && (
            <Phase1Company
              onNext={handlePhase1}
              researchJob={researchJob ?? null}
              researchSuggestions={researchSuggestions ?? []}
              onStartResearch={handleStartResearch}
              isResearching={createResearchJob.isPending}
            />
          )}
          {phase === 2 && (
            <Phase2Competitors
              onNext={handlePhase2}
              onBack={() => setPhase(1)}
              researchJobId={researchJobId}
            />
          )}
          {phase === 3 && (
            <Phase3Personas
              onNext={handlePhase3}
              onBack={() => setPhase(2)}
              researchJobId={researchJobId}
            />
          )}
          {phase === 4 && phase1Data && (
            <Phase4Claims
              companyName={phase1Data.company_name}
              onNext={handlePhase4}
              onBack={() => setPhase(3)}
              researchJobId={researchJobId}
            />
          )}
          {phase === 5 && phase1Data && (
            <Phase5Review
              phase1={phase1Data}
              phase2={phase2Data ?? { competitors: [] }}
              phase3={phase3Data ?? { personas: [] }}
              phase4={phase4Data ?? { claim_governance: [] }}
              onConfirm={handleConfirm}
              onBack={() => setPhase(4)}
              isSubmitting={isSubmitting}
              researchJobId={researchJobId}
              researchSuggestions={researchSuggestions ?? []}
            />
          )}
        </div>
      </div>
    </div>
  );
}
