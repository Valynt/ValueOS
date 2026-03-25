/**
 * CaseWorkspace
 *
 * Handles two routes:
 *   /app/cases/new       — 2-step new-case wizard (company context → review)
 *   /app/cases/:caseId   — existing case view; shows 404 when the ID is unknown
 *
 * On creation, triggers DealAssemblyAgent (if CRM opportunity linked) or
 * OpportunityAgent (scratch) via POST /api/cases/:caseId/run-hypothesis-loop.
 */

import { IntegrityScoreCard } from "@sdui/components/SDUI/IntegrityScoreCard";
import { AlertCircle, ArrowLeft, ArrowRight, Check, FileText, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { apiClient } from "@/api/client/unified-api-client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useCase, useCreateCase } from "@/hooks/useCases";
import { useIntegrityScore } from "@/hooks/useIntegrityScore";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Wizard state
// ---------------------------------------------------------------------------

interface WizardData {
  companyName: string;
  companyDomain: string;
  description: string;
  crmOpportunityId: string;
}

const INITIAL_DATA: WizardData = {
  companyName: "",
  companyDomain: "",
  description: "",
  crmOpportunityId: "",
};

// ---------------------------------------------------------------------------
// Step components
// ---------------------------------------------------------------------------

function StepCompany({
  data,
  onChange,
}: {
  data: WizardData;
  onChange: (patch: Partial<WizardData>) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Company name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          autoFocus
          value={data.companyName}
          onChange={(e) => onChange({ companyName: e.target.value })}
          placeholder="e.g. Acme Corp"
          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-slate-400 focus:bg-white bg-slate-50 transition-colors"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Company domain{" "}
          <span className="text-slate-400 font-normal">(optional — used for web research)</span>
        </label>
        <input
          type="text"
          value={data.companyDomain}
          onChange={(e) => onChange({ companyDomain: e.target.value })}
          placeholder="e.g. acmecorp.com"
          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-slate-400 focus:bg-white bg-slate-50 transition-colors"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          CRM opportunity ID{" "}
          <span className="text-slate-400 font-normal">(optional — links to Salesforce / HubSpot)</span>
        </label>
        <input
          type="text"
          value={data.crmOpportunityId}
          onChange={(e) => onChange({ crmOpportunityId: e.target.value })}
          placeholder="e.g. 0065g00000AbCdEf"
          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-slate-400 focus:bg-white bg-slate-50 transition-colors"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Brief description{" "}
          <span className="text-slate-400 font-normal">(optional)</span>
        </label>
        <textarea
          rows={3}
          value={data.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="What problem are you solving for this customer?"
          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-slate-400 focus:bg-white bg-slate-50 transition-colors resize-none"
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// New-case wizard
// ---------------------------------------------------------------------------

const STEPS = [{ label: "Context" }, { label: "Review" }];

function NewCaseWizard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const createCase = useCreateCase();

  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>(INITIAL_DATA);
  const [launchError, setLaunchError] = useState<string | null>(null);

  const patch = (update: Partial<WizardData>) =>
    setData((prev) => ({ ...prev, ...update }));

  const canAdvance = step === 0 ? data.companyName.trim().length > 0 : true;

  const handleNext = () => {
    if (step < STEPS.length - 1) setStep((s) => s + 1);
  };

  const handleBack = () => setStep((s) => s - 1);

  const handleCreate = async () => {
    const ownerName =
      (user?.user_metadata?.full_name as string | undefined) ??
      user?.email?.split("@")[0] ??
      undefined;

    setLaunchError(null);

    try {
      // Step 1: Create the case record
      const newCase = await createCase.mutateAsync({
        name: `${data.companyName.trim()} — Value Case`,
        status: "draft",
        metadata: {
          company_name: data.companyName.trim(),
          company_domain: data.companyDomain.trim() || undefined,
          crm_opportunity_id: data.crmOpportunityId.trim() || undefined,
          description: data.description.trim() || undefined,
          owner_name: ownerName,
        },
      });

      // Step 2: Fire the agent lifecycle and navigate immediately.
      // The loop runs in the background; its status is surfaced in the case view.
      // No state updates after navigate() — the component will be unmounted.
      void apiClient
        .post(`/api/cases/${newCase.id}/run-hypothesis-loop`, {
          session_id: `wizard-${Date.now()}`,
        })
        .catch((loopErr: unknown) => {
          console.warn("Hypothesis loop failed to start:", loopErr);
        });

      navigate(`/app/cases/${newCase.id}`);
    } catch {
      setLaunchError("Failed to create case. Please try again.");
    }
  };

  const isPending = createCase.isPending;

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <Link
        to="/app/cases"
        className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-700 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Cases
      </Link>

      <h1 className="text-2xl font-bold text-slate-900 mb-1">New Value Case</h1>
      <p className="text-slate-500 text-sm mb-8">
        Step {step + 1} of {STEPS.length} — {STEPS[step]!.label}
      </p>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div key={s.label} className="flex items-center gap-2">
            <div
              className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold",
                i < step
                  ? "bg-primary text-white"
                  : i === step
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-400",
              )}
            >
              {i < step ? <Check className="w-3.5 h-3.5" /> : i + 1}
            </div>
            <span
              className={cn(
                "text-sm",
                i === step ? "font-medium text-slate-900" : "text-slate-400",
              )}
            >
              {s.label}
            </span>
            {i < STEPS.length - 1 && <div className="w-8 h-px bg-slate-200 mx-1" />}
          </div>
        ))}
      </div>

      {/* Step content */}
      <Card className="p-6 mb-6">
        {step === 0 && <StepCompany data={data} onChange={patch} />}
        {step === 1 && (
          <div className="space-y-4">
            <h3 className="font-semibold text-slate-900">Review</h3>
            <div className="space-y-2 text-sm">
              <div className="flex gap-2">
                <span className="text-slate-500 w-36 flex-shrink-0">Company</span>
                <span className="font-medium text-slate-900">{data.companyName}</span>
              </div>
              {data.companyDomain && (
                <div className="flex gap-2">
                  <span className="text-slate-500 w-36 flex-shrink-0">Domain</span>
                  <span className="text-slate-700">{data.companyDomain}</span>
                </div>
              )}
              {data.crmOpportunityId && (
                <div className="flex gap-2">
                  <span className="text-slate-500 w-36 flex-shrink-0">CRM Opportunity</span>
                  <span className="font-mono text-xs text-slate-700">{data.crmOpportunityId}</span>
                </div>
              )}
              {data.description && (
                <div className="flex gap-2">
                  <span className="text-slate-500 w-36 flex-shrink-0">Description</span>
                  <span className="text-slate-700">{data.description}</span>
                </div>
              )}
            </div>

            {/* Agent launch notice */}
            <div className="mt-4 p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <p className="text-xs text-slate-600 leading-relaxed">
                {data.crmOpportunityId
                  ? "DealAssemblyAgent will fetch CRM data, run web research, and generate value hypotheses automatically."
                  : "OpportunityAgent will generate value hypotheses from the context you provided."}
              </p>
            </div>
          </div>
        )}
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={step === 0 ? () => navigate("/app/cases") : handleBack}
          disabled={isPending}
        >
          {step === 0 ? "Cancel" : "Back"}
        </Button>

        {step < STEPS.length - 1 ? (
          <Button onClick={handleNext} disabled={!canAdvance}>
            Continue
            <ArrowRight className="w-4 h-4 ml-1.5" />
          </Button>
        ) : (
          <Button onClick={handleCreate} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                {createCase.isPending ? "Creating…" : "Launching agents…"}
              </>
            ) : (
              "Create & Launch Agents"
            )}
          </Button>
        )}
      </div>

      {launchError && (
        <p className="mt-3 text-sm text-red-500 text-center">{launchError}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Case summary sidebar
// ---------------------------------------------------------------------------

/**
 * CaseSummarySidebar
 *
 * Right-hand sidebar for the business case workspace.
 * Hierarchy (spec):
 *   1. Status Badge        — rendered in the parent header
 *   2. DefenseReadinessCard — shown via IntegrityScoreCard sub-component
 *   3. IntegrityScoreCard  — composite integrity score + violations
 *   4. Financial Summary   — future sprint
 *   5. Agent Activity      — future sprint
 */
function CaseSummarySidebar({ caseId }: { caseId: string }) {
  const { data, isLoading, resolveViolation } = useIntegrityScore(caseId);

  if (isLoading) {
    return (
      <div className="w-72 flex-shrink-0">
        <div className="bg-card border rounded-lg p-4 animate-pulse">
          <div className="h-4 bg-slate-200 rounded w-1/2 mb-3" />
          <div className="h-24 bg-slate-100 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-72 flex-shrink-0 space-y-3">
      <IntegrityScoreCard
        integrityScore={data?.integrity_score ?? null}
        defenseReadinessScore={data?.defense_readiness_score ?? null}
        violations={data?.violations ?? []}
        hardBlocked={data?.hard_blocked ?? false}
        onResolveLatestWarning={(id) =>
          resolveViolation({
            violationId: id,
            resolution_type: "RE_EVALUATE",
          })
        }
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Existing case view
// ---------------------------------------------------------------------------

function ExistingCaseView({ caseId }: { caseId: string }) {
  const { data: valueCase, isLoading, error, refetch } = useCase(caseId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        <span className="text-sm">Loading case…</span>
      </div>
    );
  }

  // Fetch error (network failure, 5xx, etc.) — distinct from a missing case
  if (error) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center mt-16">
        <AlertCircle className="w-10 h-10 text-red-300 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-slate-900 mb-2">Failed to load case</h2>
        <p className="text-sm text-slate-500 mb-6">
          {error instanceof Error ? error.message : "An unexpected error occurred. Please try again."}
        </p>
        <div className="flex items-center justify-center gap-3">
          <Button onClick={() => refetch()} variant="outline">
            Retry
          </Button>
          <Link to="/app/cases">
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              Back to Cases
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // 404: fetch succeeded but no case with this ID exists
  if (!valueCase) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center mt-16">
        <FileText className="w-10 h-10 text-slate-300 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-slate-900 mb-2">Case not found</h2>
        <p className="text-sm text-slate-500 mb-6">
          No case exists with ID <code className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">{caseId}</code>.
          It may have been deleted or the link is incorrect.
        </p>
        <Link to="/app/cases">
          <Button variant="outline">
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Back to Cases
          </Button>
        </Link>
      </div>
    );
  }

  // Minimal case view — full canvas is in ValueCaseCanvas (/opportunities/:oppId/cases/:caseId)
  return (
    <div className="p-8 max-w-5xl mx-auto">
      <Link
        to="/app/cases"
        className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-700 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Cases
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{valueCase.name}</h1>
          {valueCase.company_profiles?.company_name && (
            <p className="text-slate-500 mt-1">{valueCase.company_profiles.company_name}</p>
          )}
        </div>
        <span className="px-3 py-1 rounded-full text-xs font-semibold uppercase bg-slate-100 text-slate-600">
          {valueCase.status}
        </span>
      </div>

      {/* Two-column layout: main content + summary sidebar */}
      <div className="flex gap-6 items-start">
        {/* Main content */}
        <div className="flex-1 min-w-0">
          <Card className="p-6">
            <p className="text-sm text-slate-500">
              {valueCase.description ?? "No description provided."}
            </p>
          </Card>
        </div>

        {/* Summary sidebar */}
        <CaseSummarySidebar caseId={caseId} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Route entry point
// ---------------------------------------------------------------------------

export function CaseWorkspace() {
  const { caseId } = useParams<{ caseId?: string }>();

  if (!caseId || caseId === "new") {
    return <NewCaseWizard />;
  }

  return <ExistingCaseView caseId={caseId} />;
}

export default CaseWorkspace;
