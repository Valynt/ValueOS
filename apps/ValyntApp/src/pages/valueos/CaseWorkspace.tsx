/**
 * CaseWorkspace
 *
 * Handles two routes:
 *   /app/cases/new       — 3-step new-case wizard
 *   /app/cases/:caseId   — existing case view; shows 404 when the ID is unknown
 */

import { AlertCircle, ArrowLeft, ArrowRight, Check, FileText, Loader2 } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useCase, useCreateCase } from "@/hooks/useCases";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Value model catalogue (static — matches ModelDetail fixture data)
// ---------------------------------------------------------------------------

interface ValueModel {
  id: string;
  name: string;
  description: string;
  category: string;
}

const VALUE_MODELS: ValueModel[] = [
  {
    id: "vm_1",
    name: "SaaS ROI Calculator",
    description: "Quantifies software ROI: licence savings, productivity gains, and payback period.",
    category: "Financial",
  },
  {
    id: "vm_2",
    name: "Cloud Migration ROI",
    description: "Infrastructure cost savings, server consolidation, and ops efficiency.",
    category: "Infrastructure",
  },
  {
    id: "vm_3",
    name: "Revenue Acceleration",
    description: "Pipeline velocity, win-rate uplift, and incremental ARR impact.",
    category: "Revenue",
  },
  {
    id: "vm_4",
    name: "Risk Reduction",
    description: "Quantifies avoided cost from compliance, security, and operational risk.",
    category: "Risk",
  },
];

// ---------------------------------------------------------------------------
// Wizard state
// ---------------------------------------------------------------------------

interface WizardData {
  companyName: string;
  description: string;
  selectedModelIds: string[];
}

const INITIAL_DATA: WizardData = {
  companyName: "",
  description: "",
  // vm_1 pre-selected so Step 3 "Continue" is enabled by default
  selectedModelIds: ["vm_1"],
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
          Brief description <span className="text-slate-400 font-normal">(optional)</span>
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

function StepModels({
  data,
  onChange,
}: {
  data: WizardData;
  onChange: (patch: Partial<WizardData>) => void;
}) {
  const toggle = (id: string) => {
    const next = data.selectedModelIds.includes(id)
      ? data.selectedModelIds.filter((m) => m !== id)
      : [...data.selectedModelIds, id];
    onChange({ selectedModelIds: next });
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">
        Select one or more value models to anchor this case. You can add more later.
      </p>
      <div className="grid grid-cols-2 gap-3">
        {VALUE_MODELS.map((model) => {
          const selected = data.selectedModelIds.includes(model.id);
          return (
            <button
              key={model.id}
              type="button"
              onClick={() => toggle(model.id)}
              className={cn(
                "p-4 rounded-xl border text-left transition-all",
                selected
                  ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                  : "border-slate-200 hover:border-slate-300 bg-white"
              )}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <span className="text-sm font-semibold text-slate-900">{model.name}</span>
                {selected && (
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">{model.description}</p>
              <span className="mt-2 inline-block text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                {model.category}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// New-case wizard
// ---------------------------------------------------------------------------

const STEPS = [
  { label: "Company" },
  { label: "Models" },
  { label: "Review" },
];

function NewCaseWizard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const createCase = useCreateCase();

  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>(INITIAL_DATA);

  const patch = (update: Partial<WizardData>) =>
    setData((prev) => ({ ...prev, ...update }));

  const canAdvance =
    step === 0
      ? data.companyName.trim().length > 0
      : step === 1
        ? data.selectedModelIds.length > 0
        : true;

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
    }
  };

  const handleBack = () => setStep((s) => s - 1);

  const handleCreate = async () => {
    const ownerName =
      (user?.user_metadata?.full_name as string | undefined) ??
      user?.email?.split("@")[0] ??
      undefined;

    try {
      const newCase = await createCase.mutateAsync({
        name: `${data.companyName.trim()} — Value Case`,
        status: "draft",
        metadata: {
          company_name: data.companyName.trim(),
          description: data.description.trim() || undefined,
          model_ids: data.selectedModelIds,
          owner_name: ownerName,
        },
      });
      navigate(`/app/cases/${newCase.id}`);
    } catch {
      // createCase.isError handles the UI error state
    }
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      {/* Back to cases */}
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
                    : "bg-slate-100 text-slate-400"
              )}
            >
              {i < step ? <Check className="w-3.5 h-3.5" /> : i + 1}
            </div>
            <span
              className={cn(
                "text-sm",
                i === step ? "font-medium text-slate-900" : "text-slate-400"
              )}
            >
              {s.label}
            </span>
            {i < STEPS.length - 1 && (
              <div className="w-8 h-px bg-slate-200 mx-1" />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <Card className="p-6 mb-6">
        {step === 0 && <StepCompany data={data} onChange={patch} />}
        {step === 1 && <StepModels data={data} onChange={patch} />}
        {step === 2 && (
          <div className="space-y-4">
            <h3 className="font-semibold text-slate-900">Review</h3>
            <div className="space-y-2 text-sm">
              <div className="flex gap-2">
                <span className="text-slate-500 w-28 flex-shrink-0">Company</span>
                <span className="font-medium text-slate-900">{data.companyName}</span>
              </div>
              {data.description && (
                <div className="flex gap-2">
                  <span className="text-slate-500 w-28 flex-shrink-0">Description</span>
                  <span className="text-slate-700">{data.description}</span>
                </div>
              )}
              <div className="flex gap-2">
                <span className="text-slate-500 w-28 flex-shrink-0">Models</span>
                <span className="text-slate-700">
                  {data.selectedModelIds
                    .map((id) => VALUE_MODELS.find((m) => m.id === id)?.name ?? id)
                    .join(", ")}
                </span>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={step === 0 ? () => navigate("/app/cases") : handleBack}
        >
          {step === 0 ? "Cancel" : "Back"}
        </Button>

        {step < STEPS.length - 1 ? (
          <Button onClick={handleNext} disabled={!canAdvance}>
            Continue
            <ArrowRight className="w-4 h-4 ml-1.5" />
          </Button>
        ) : (
          <Button
            onClick={handleCreate}
            disabled={createCase.isPending}
          >
            {createCase.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                Creating…
              </>
            ) : (
              "Create Case"
            )}
          </Button>
        )}
      </div>

      {createCase.isError && (
        <p className="mt-3 text-sm text-red-500 text-center">
          Failed to create case. Please try again.
        </p>
      )}
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
    <div className="p-8 max-w-4xl mx-auto">
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

      <Card className="p-6">
        <p className="text-sm text-slate-500">
          {valueCase.description ?? "No description provided."}
        </p>
      </Card>
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
