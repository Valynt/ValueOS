/**
 * New Case Wizard
 *
 * Multi-step dialog for creating new value cases with live company enrichment.
 * Integrates with:
 *   - useTenant() for tenant isolation
 *   - useCreateCase() for Supabase case creation
 *   - useDomainPacks() for value model selection
 *   - enrichmentService for live SEC EDGAR + Yahoo Finance data
 *
 * Steps:
 *   1. Company Selection (existing or new with enrichment)
 *   2. Case Details (title, description, type, priority)
 *   3. Domain Pack / Value Model selection
 *   4. Agent Configuration & Launch
 */
import { useCallback, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useTenant } from "@/contexts/TenantContext";
import { useCreateCase } from "@/hooks/useCases";
import { useDomainPacks, type DomainPack } from "@/hooks/useDomainPacks";
import {
  enrichCompany,
  type EnrichedCompany,
  type EnrichedField,
  type EnrichmentResult,
} from "@/services/enrichmentService";

// UI Components
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Icons
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookOpen,
  Briefcase,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  Cpu,
  Database,
  DollarSign,
  FileSearch,
  FileText,
  Globe,
  Info,
  Landmark,
  Loader2,
  MapPin,
  Plus,
  RefreshCw,
  Rocket,
  Search,
  Shield,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  XCircle,
  Zap,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════

interface WizardData {
  // Step 1
  isNewCompany: boolean;
  selectedCompanyId: string;
  enrichmentInput: string;
  enrichmentState: "idle" | "enriching" | "complete" | "error";
  enrichedData: EnrichedCompany | null;
  // Step 2
  caseTitle: string;
  caseDescription: string;
  caseType: string;
  priority: string;
  // Step 3
  selectedPackIds: string[];
  // Step 4
  selectedAgentIds: string[];
  autoRunAgents: boolean;
}

const INITIAL_DATA: WizardData = {
  isNewCompany: false,
  selectedCompanyId: "",
  enrichmentInput: "",
  enrichmentState: "idle",
  enrichedData: null,
  caseTitle: "",
  caseDescription: "",
  caseType: "cost_optimization",
  priority: "medium",
  selectedPackIds: [],
  selectedAgentIds: ["opp-agent", "fin-agent", "integrity-agent"],
  autoRunAgents: true,
};

interface EnrichmentStep {
  id: string;
  label: string;
  source: string;
  icon: typeof Search;
  status: "pending" | "running" | "complete" | "error";
  fieldsFound: number;
  duration?: number;
}

const ENRICHMENT_STEPS: EnrichmentStep[] = [
  { id: "sec", label: "SEC EDGAR", source: "sec.gov", icon: Landmark, status: "pending", fieldsFound: 0 },
  { id: "yahoo", label: "Yahoo Finance", source: "finance.yahoo.com", icon: TrendingUp, status: "pending", fieldsFound: 0 },
  { id: "cross", label: "Cross-Reference", source: "derived", icon: Database, status: "pending", fieldsFound: 0 },
];

const CASE_TYPES = [
  { value: "cost_optimization", label: "Cost Optimization", desc: "Reduce operational costs", icon: DollarSign },
  { value: "revenue_growth", label: "Revenue Growth", desc: "Increase revenue streams", icon: TrendingUp },
  { value: "risk_mitigation", label: "Risk Mitigation", desc: "Reduce business risk", icon: Shield },
  { value: "digital_transform", label: "Digital Transform", desc: "Modernize technology", icon: Cpu },
  { value: "market_expansion", label: "Market Expansion", desc: "Enter new markets", icon: Globe },
  { value: "operational_efficiency", label: "Ops Efficiency", desc: "Streamline operations", icon: Target },
];

const PRIORITIES = [
  { value: "critical", label: "Critical", color: "bg-red-100 text-red-700" },
  { value: "high", label: "High", color: "bg-orange-100 text-orange-700" },
  { value: "medium", label: "Medium", color: "bg-blue-100 text-blue-700" },
  { value: "low", label: "Low", color: "bg-zinc-100 text-zinc-600" },
];

const AGENTS = [
  { id: "opp-agent", name: "Opportunity Agent", type: "extraction", version: "2.1", successRate: 94 },
  { id: "fin-agent", name: "Financial Modeling", type: "modeling", version: "1.8", successRate: 91 },
  { id: "integrity-agent", name: "Integrity Engine", type: "integrity", version: "3.0", successRate: 97 },
  { id: "narrative-agent", name: "Narrative Builder", type: "narrative", version: "1.5", successRate: 89 },
  { id: "red-team-agent", name: "Red Team Auditor", type: "red_team", version: "2.0", successRate: 96 },
  { id: "expansion-agent", name: "Expansion Scout", type: "research", version: "1.3", successRate: 87 },
];

// ═══════════════════════════════════════════════════════════════════
// Wizard Steps
// ═══════════════════════════════════════════════════════════════════

const STEPS = [
  { id: 1, title: "Company", description: "Select or enrich" },
  { id: 2, title: "Details", description: "Case scope" },
  { id: 3, title: "Models", description: "Domain packs" },
  { id: 4, title: "Launch", description: "Agents & go" },
];

// ═══════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════

interface NewCaseWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewCaseWizard({ open, onOpenChange }: NewCaseWizardProps) {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<WizardData>(INITIAL_DATA);
  const [isLaunching, setIsLaunching] = useState(false);

  const navigate = useNavigate();
  const { currentTenant } = useTenant();
  const createCase = useCreateCase();
  const { data: packs } = useDomainPacks();

  const update = useCallback(
    (partial: Partial<WizardData>) => setData((prev) => ({ ...prev, ...partial })),
    []
  );

  const canProceed = useMemo(() => {
    switch (step) {
      case 1:
        return data.isNewCompany
          ? data.enrichmentState === "complete"
          : !!data.selectedCompanyId;
      case 2:
        return !!data.caseTitle.trim();
      case 3:
        return true; // packs are optional
      case 4:
        return data.selectedAgentIds.length > 0;
      default:
        return false;
    }
  }, [step, data]);

  const handleLaunch = async () => {
    if (!currentTenant?.id) {
      toast.error("No tenant selected");
      return;
    }

    setIsLaunching(true);
    try {
      const result = await createCase.mutateAsync({
        name: data.caseTitle,
        description: data.caseDescription || undefined,
        domain_pack_id: data.selectedPackIds[0] || undefined,
        status: "draft",
        stage: "hypothesis",
        metadata: {
          caseType: data.caseType,
          priority: data.priority,
          enrichedCompany: data.enrichedData
            ? {
                name: data.enrichedData.name.value,
                industry: data.enrichedData.industry.value,
                ticker: data.enrichedData.stockTicker.value,
              }
            : undefined,
          selectedAgents: data.selectedAgentIds,
          autoRunAgents: data.autoRunAgents,
        },
      });

      toast.success(`Case "${data.caseTitle}" created`, {
        description: data.autoRunAgents
          ? "Agents are starting the Hypothesis stage..."
          : "Navigate to the case to begin.",
      });

      onOpenChange(false);
      setStep(1);
      setData(INITIAL_DATA);

      // Navigate to the new case
      if (result?.id) {
        navigate(`/opportunities/${result.id}/cases/${result.id}`);
      }
    } catch (err: any) {
      toast.error("Failed to create case", {
        description: err?.message || "Please try again.",
      });
    } finally {
      setIsLaunching(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    // Reset after animation
    setTimeout(() => {
      setStep(1);
      setData(INITIAL_DATA);
    }, 200);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col p-0">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-zinc-100">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-[16px] font-semibold">New Value Case</DialogTitle>
              <p className="text-[12px] text-zinc-400 mt-0.5">
                Step {step} of {STEPS.length} — {STEPS[step - 1].title}
              </p>
            </div>
            {/* Stepper */}
            <div className="flex items-center gap-1">
              {STEPS.map((s, idx) => (
                <div key={s.id} className="flex items-center">
                  <div
                    className={cn(
                      "w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold transition-all",
                      idx + 1 < step && "bg-emerald-100 text-emerald-700",
                      idx + 1 === step && "bg-zinc-900 text-white",
                      idx + 1 > step && "bg-zinc-100 text-zinc-400"
                    )}
                  >
                    {idx + 1 < step ? <Check className="w-3.5 h-3.5" /> : s.id}
                  </div>
                  {idx < STEPS.length - 1 && (
                    <ChevronRight className="w-3 h-3 text-zinc-300 mx-0.5" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </DialogHeader>

        {/* Body (scrollable) */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {step === 1 && <StepCompany data={data} update={update} />}
          {step === 2 && <StepCaseDetails data={data} update={update} />}
          {step === 3 && <StepDomainPack data={data} update={update} packs={packs || []} />}
          {step === 4 && <StepLaunch data={data} update={update} />}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-100 flex items-center justify-between bg-zinc-50/50">
          <Button
            variant="outline"
            size="sm"
            className="h-9 text-[12px]"
            onClick={() => (step > 1 ? setStep(step - 1) : handleClose())}
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
            {step > 1 ? "Back" : "Cancel"}
          </Button>

          {step < 4 ? (
            <Button
              size="sm"
              className="h-9 text-[12px] bg-zinc-900 text-white hover:bg-zinc-800"
              disabled={!canProceed}
              onClick={() => setStep(step + 1)}
            >
              Continue
              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          ) : (
            <Button
              size="sm"
              className="h-9 text-[12px] bg-emerald-600 text-white hover:bg-emerald-700"
              disabled={!canProceed || isLaunching}
              onClick={handleLaunch}
            >
              {isLaunching ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Rocket className="w-3.5 h-3.5 mr-1.5" />
                  Launch Case
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Step 1: Company Selection + Live Enrichment
// ═══════════════════════════════════════════════════════════════════

function StepCompany({
  data,
  update,
}: {
  data: WizardData;
  update: (p: Partial<WizardData>) => void;
}) {
  if (data.isNewCompany) {
    return <NewCompanyEnrichment data={data} update={update} />;
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-[14px] font-semibold">Select Company</h3>
        <p className="text-[12px] text-zinc-400 mt-0.5">
          Choose an existing company or enrich a new one with live data.
        </p>
      </div>

      {/* Existing companies placeholder */}
      <div className="bg-zinc-50 rounded-xl border border-zinc-200 p-4 text-center">
        <p className="text-[12px] text-zinc-500">
          Company profiles from your tenant will appear here.
        </p>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-zinc-200" />
        <span className="text-[11px] text-zinc-400 font-medium">OR</span>
        <div className="flex-1 h-px bg-zinc-200" />
      </div>

      {/* New Company button */}
      <button
        onClick={() => update({ isNewCompany: true })}
        className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-dashed border-zinc-300 hover:border-zinc-400 hover:bg-zinc-50 transition-all text-left"
      >
        <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center">
          <Plus className="w-5 h-5 text-zinc-500" />
        </div>
        <div>
          <span className="text-[13px] font-semibold text-zinc-900 block">
            New Company
          </span>
          <span className="text-[11px] text-zinc-400">
            Enter a company name to pull live data from SEC EDGAR & Yahoo Finance
          </span>
        </div>
        <Badge
          variant="outline"
          className="ml-auto text-[9px] px-1.5 py-0 h-4 font-medium text-emerald-600 border-emerald-200 bg-emerald-50"
        >
          LIVE DATA
        </Badge>
      </button>
    </div>
  );
}

// ─── New Company Enrichment Flow ─────────────────────────────────

function NewCompanyEnrichment({
  data,
  update,
}: {
  data: WizardData;
  update: (p: Partial<WizardData>) => void;
}) {
  const [steps, setSteps] = useState<EnrichmentStep[]>(
    ENRICHMENT_STEPS.map((s) => ({ ...s }))
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const enrichingRef = useRef(false);

  const startEnrichment = useCallback(async () => {
    if (!data.enrichmentInput.trim() || enrichingRef.current) return;
    enrichingRef.current = true;
    setErrorMessage(null);
    update({ enrichmentState: "enriching", enrichedData: null });

    // Reset steps
    setSteps(ENRICHMENT_STEPS.map((s) => ({ ...s, status: "pending", fieldsFound: 0 })));

    const startTime = Date.now();

    // Animate step 1 immediately
    setSteps((prev) =>
      prev.map((s, idx) => (idx === 0 ? { ...s, status: "running" } : s))
    );

    // Fire the real API call
    const apiPromise = enrichCompany(data.enrichmentInput.trim());

    // Animate step progression while API runs
    const animateSteps = async () => {
      await new Promise((r) => setTimeout(r, 800));
      setSteps((prev) =>
        prev.map((s, idx) => {
          if (idx === 0) return { ...s, status: "complete", fieldsFound: 4, duration: 800 };
          if (idx === 1) return { ...s, status: "running" };
          return s;
        })
      );
      await new Promise((r) => setTimeout(r, 700));
      setSteps((prev) =>
        prev.map((s, idx) => {
          if (idx === 1) return { ...s, status: "complete", fieldsFound: 5, duration: 700 };
          if (idx === 2) return { ...s, status: "running" };
          return s;
        })
      );
      await new Promise((r) => setTimeout(r, 400));
      setSteps((prev) =>
        prev.map((s, idx) => {
          if (idx === 2) return { ...s, status: "complete", fieldsFound: 3, duration: 400 };
          return s;
        })
      );
    };

    try {
      const [result] = await Promise.all([apiPromise, animateSteps()]);

      // Update steps with actual source data
      const finalSteps: EnrichmentStep[] = ENRICHMENT_STEPS.map((s) => {
        const source = result.sources.find(
          (src) =>
            (s.id === "sec" && src.name === "SEC EDGAR") ||
            (s.id === "yahoo" && src.name === "Yahoo Finance") ||
            (s.id === "cross" && src.name === "Cross-Reference")
        );
        return {
          ...s,
          status: source?.status === "failed" ? "error" : "complete",
          fieldsFound: source?.fieldsFound ?? 0,
          duration: source?.latencyMs ?? Math.round((Date.now() - startTime) / 3),
        };
      });
      setSteps(finalSteps);

      update({ enrichmentState: "complete", enrichedData: result.company });

      const successSources = result.sources.filter((s) => s.status !== "failed").length;
      toast.success(`Enriched "${result.company.name.value}" from ${successSources} live sources`, {
        description: `${result.overallConfidence}% confidence · ${result.totalFieldsFound} fields found`,
      });
    } catch (err: any) {
      console.error("Enrichment failed:", err);
      setErrorMessage(err?.message || "Failed to enrich company data.");
      update({ enrichmentState: "error" });
      setSteps((prev) =>
        prev.map((s) =>
          s.status === "running" || s.status === "pending"
            ? { ...s, status: "error" }
            : s
        )
      );
      toast.error("Enrichment failed", {
        description: "Could not reach external data sources. You can retry or enter data manually.",
      });
    } finally {
      enrichingRef.current = false;
    }
  }, [data.enrichmentInput, update]);

  const resetEnrichment = () => {
    enrichingRef.current = false;
    setErrorMessage(null);
    update({ enrichmentState: "idle", enrichedData: null, enrichmentInput: "" });
    setSteps(ENRICHMENT_STEPS.map((s) => ({ ...s, status: "pending", fieldsFound: 0 })));
  };

  const totalFieldsFound = steps.reduce((sum, s) => sum + s.fieldsFound, 0);
  const completedSteps = steps.filter((s) => s.status === "complete").length;

  const confColor = (c: number) =>
    c >= 90 ? "text-emerald-600" : c >= 75 ? "text-blue-600" : c >= 60 ? "text-amber-600" : "text-red-500";
  const confBg = (c: number) =>
    c >= 90 ? "bg-emerald-50" : c >= 75 ? "bg-blue-50" : c >= 60 ? "bg-amber-50" : "bg-red-50";

  // ─── IDLE state ───
  if (data.enrichmentState === "idle") {
    return (
      <div className="space-y-4">
        <button
          onClick={() => update({ isNewCompany: false })}
          className="flex items-center gap-1.5 text-[11px] text-zinc-500 hover:text-zinc-700 transition-colors"
        >
          <ArrowLeft className="w-3 h-3" />
          Back to company selection
        </button>

        <div className="bg-gradient-to-br from-indigo-50 via-white to-violet-50 rounded-xl border border-indigo-100 p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-indigo-600" />
            </div>
            <div>
              <h4 className="text-[13px] font-semibold text-zinc-900">Live Company Enrichment</h4>
              <p className="text-[11px] text-zinc-400">
                Enter a company name to pull live data from SEC EDGAR & Yahoo Finance
              </p>
            </div>
          </div>

          <div className="relative mt-4">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400" />
            <input
              type="text"
              value={data.enrichmentInput}
              onChange={(e) => update({ enrichmentInput: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter") startEnrichment();
              }}
              placeholder="e.g. Salesforce, Snowflake, Microsoft, Tesla..."
              className="w-full h-11 pl-10 pr-28 rounded-lg border border-indigo-200 bg-white text-[13px] placeholder:text-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-300/50 focus:border-indigo-300"
              autoFocus
            />
            <Button
              size="sm"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 h-8 text-[12px] bg-indigo-600 text-white hover:bg-indigo-700"
              disabled={!data.enrichmentInput.trim()}
              onClick={startEnrichment}
            >
              <Search className="w-3.5 h-3.5 mr-1.5" />
              Enrich
            </Button>
          </div>

          <div className="flex items-center gap-4 mt-3 text-[10px] text-indigo-400">
            <span className="flex items-center gap-1">
              <Landmark className="w-3 h-3" /> SEC EDGAR
            </span>
            <span className="flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> Yahoo Finance
            </span>
            <Badge
              variant="outline"
              className="text-[9px] px-1.5 py-0 h-4 font-medium text-emerald-600 border-emerald-200 bg-emerald-50"
            >
              LIVE DATA
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-zinc-500 bg-zinc-50 rounded-lg px-3 py-2.5">
          <Info className="w-3.5 h-3.5 flex-shrink-0" />
          <span>
            Enter any publicly traded company name. Data is pulled live from SEC EDGAR
            (filings, CIK, SIC codes) and Yahoo Finance (stock profile, financials, industry).
          </span>
        </div>
      </div>
    );
  }

  // ─── ERROR state ───
  if (data.enrichmentState === "error") {
    return (
      <div className="space-y-4">
        <div className="bg-red-50 rounded-xl border border-red-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
              <XCircle className="w-4 h-4 text-red-600" />
            </div>
            <div>
              <h4 className="text-[13px] font-semibold text-red-800">Enrichment Failed</h4>
              <p className="text-[11px] text-red-600">
                {errorMessage || "Could not reach external data sources."}
              </p>
            </div>
          </div>

          <div className="space-y-1 mt-3">
            {steps.map((s) => {
              const Icon = s.icon;
              return (
                <div
                  key={s.id}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg",
                    s.status === "error" && "bg-red-100/50",
                    s.status === "complete" && "bg-emerald-50/50"
                  )}
                >
                  <div
                    className={cn(
                      "w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0",
                      s.status === "error" && "bg-red-100 text-red-600",
                      s.status === "complete" && "bg-emerald-100 text-emerald-600"
                    )}
                  >
                    {s.status === "error" ? (
                      <XCircle className="w-3 h-3" />
                    ) : (
                      <CheckCircle2 className="w-3 h-3" />
                    )}
                  </div>
                  <span className="text-[12px] font-medium">{s.label}</span>
                  <span
                    className={cn(
                      "text-[10px] ml-auto",
                      s.status === "error" ? "text-red-500" : "text-emerald-600"
                    )}
                  >
                    {s.status === "error" ? "Failed" : `${s.fieldsFound} fields`}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-2 mt-4">
            <Button
              size="sm"
              className="h-8 text-[12px] bg-red-600 text-white hover:bg-red-700"
              onClick={() => {
                update({ enrichmentState: "idle" });
                setSteps(ENRICHMENT_STEPS.map((s) => ({ ...s, status: "pending", fieldsFound: 0 })));
              }}
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Try Again
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-[12px]" onClick={resetEnrichment}>
              Try Different Company
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ─── ENRICHING state ───
  if (data.enrichmentState === "enriching") {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-[14px] font-semibold flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
              Enriching "{data.enrichmentInput}"
            </h4>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Pulling live data from {ENRICHMENT_STEPS.length} sources...
            </p>
          </div>
          <div className="text-right">
            <div className="text-[20px] font-bold text-zinc-900">{totalFieldsFound}</div>
            <div className="text-[10px] text-zinc-400">fields found</div>
          </div>
        </div>

        <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${(completedSteps / ENRICHMENT_STEPS.length) * 100}%` }}
          />
        </div>

        <div className="space-y-1">
          {steps.map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.id}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all",
                  s.status === "running" && "bg-indigo-50 border border-indigo-100",
                  s.status === "complete" && "bg-emerald-50/50",
                  s.status === "pending" && "opacity-40"
                )}
              >
                <div
                  className={cn(
                    "w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0",
                    s.status === "running" && "bg-indigo-100 text-indigo-600",
                    s.status === "complete" && "bg-emerald-100 text-emerald-600",
                    s.status === "pending" && "bg-zinc-100 text-zinc-400"
                  )}
                >
                  {s.status === "running" ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : s.status === "complete" ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <Icon className="w-3.5 h-3.5" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-medium">{s.label}</div>
                  <div className="text-[10px] text-zinc-400">{s.source}</div>
                </div>
                {s.status === "complete" && (
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="text-emerald-600 font-medium">{s.fieldsFound} fields</span>
                    {s.duration && (
                      <span className="text-zinc-400">{(s.duration / 1000).toFixed(1)}s</span>
                    )}
                  </div>
                )}
                {s.status === "running" && (
                  <span className="text-[10px] text-indigo-500 font-medium animate-pulse">
                    Fetching live data...
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-2 text-[10px] text-indigo-600 bg-indigo-50 rounded-lg px-3 py-2">
          <Zap className="w-3 h-3 flex-shrink-0" />
          <span>
            Calling live APIs — SEC EDGAR and Yahoo Finance. This may take a few seconds.
          </span>
        </div>
      </div>
    );
  }

  // ─── COMPLETE state ───
  if (data.enrichmentState === "complete" && data.enrichedData) {
    const d = data.enrichedData;
    const allFields = Object.values(d);
    const fieldsWithData = allFields.filter((f) => f.confidence > 0);
    const avgConfidence =
      fieldsWithData.length > 0
        ? Math.round(fieldsWithData.reduce((sum, f) => sum + f.confidence, 0) / fieldsWithData.length)
        : 0;

    const FIELD_GROUPS = [
      {
        title: "Company Overview",
        fields: [
          { key: "name", label: "Company Name", icon: Building2 },
          { key: "domain", label: "Domain", icon: Globe },
          { key: "industry", label: "Industry", icon: Briefcase },
          { key: "subIndustry", label: "Sector", icon: Target },
          { key: "headquarters", label: "Headquarters", icon: MapPin },
          { key: "stockTicker", label: "Stock Ticker", icon: BarChart3 },
        ],
      },
      {
        title: "Financials (Live)",
        fields: [
          { key: "revenue", label: "Stock Price", icon: DollarSign },
          { key: "revenueGrowth", label: "Valuation (P/E)", icon: TrendingUp },
          { key: "marketCap", label: "Market Cap", icon: DollarSign },
          { key: "filingType", label: "Latest Filing", icon: FileText },
        ],
      },
      {
        title: "Intelligence",
        fields: [
          { key: "employees", label: "Employees", icon: Users },
          { key: "recentNews", label: "Company Summary", icon: FileSearch },
        ],
      },
    ];

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h4 className="text-[14px] font-semibold">{d.name.value}</h4>
              <p className="text-[11px] text-zinc-400">
                {totalFieldsFound} fields enriched from {completedSteps} live sources
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="text-[9px] px-1.5 py-0 h-4 font-medium text-emerald-600 border-emerald-200 bg-emerald-50"
            >
              LIVE DATA
            </Badge>
            <div
              className={cn(
                "px-2.5 py-1 rounded-lg text-[11px] font-semibold",
                confBg(avgConfidence),
                confColor(avgConfidence)
              )}
            >
              {avgConfidence}% avg confidence
            </div>
            <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={resetEnrichment}>
              <RefreshCw className="w-3 h-3 mr-1" />
              Re-enrich
            </Button>
          </div>
        </div>

        {/* Source badges */}
        <div className="flex items-center gap-2">
          {steps.map((s) => (
            <div
              key={s.id}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-medium",
                s.status === "complete" && "bg-emerald-50 text-emerald-700 border border-emerald-200",
                s.status === "error" && "bg-red-50 text-red-700 border border-red-200"
              )}
            >
              {s.status === "complete" ? (
                <CheckCircle2 className="w-3 h-3" />
              ) : (
                <XCircle className="w-3 h-3" />
              )}
              {s.source}: {s.fieldsFound} fields
            </div>
          ))}
        </div>

        {/* Enriched data grouped */}
        <div className="space-y-3">
          {FIELD_GROUPS.map((group) => (
            <div key={group.title} className="rounded-xl border border-zinc-200 overflow-hidden">
              <div className="bg-zinc-50 px-3 py-2 border-b border-zinc-200">
                <h5 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                  {group.title}
                </h5>
              </div>
              <div className="divide-y divide-zinc-100">
                {group.fields.map((field) => {
                  const fieldData = d[field.key as keyof EnrichedCompany];
                  if (!fieldData || fieldData.confidence === 0) return null;
                  const Icon = field.icon;
                  const isEditing = editingField === field.key;
                  return (
                    <div
                      key={field.key}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-zinc-50 transition-colors group"
                    >
                      <Icon className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
                      <div className="w-24 flex-shrink-0">
                        <span className="text-[10px] text-zinc-400 font-medium">{field.label}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        {isEditing ? (
                          <input
                            type="text"
                            defaultValue={fieldData.value}
                            autoFocus
                            onBlur={(e) => {
                              const newData = { ...data.enrichedData! };
                              (newData[field.key as keyof EnrichedCompany] as EnrichedField) = {
                                ...fieldData,
                                value: e.target.value,
                                source: "Manual Override",
                                confidence: 100,
                              };
                              update({ enrichedData: newData });
                              setEditingField(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                              if (e.key === "Escape") setEditingField(null);
                            }}
                            className="w-full h-6 px-1.5 rounded border border-indigo-300 bg-white text-[12px] focus:outline-none focus:ring-1 focus:ring-indigo-300"
                          />
                        ) : (
                          <button
                            onClick={() => setEditingField(field.key)}
                            className="text-[12px] font-medium text-zinc-900 hover:text-indigo-600 transition-colors text-left truncate block w-full"
                            title="Click to edit"
                          >
                            {fieldData.value}
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-[9px] text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded">
                          {fieldData.source}
                        </span>
                        <span className={cn("text-[10px] font-semibold tabular-nums", confColor(fieldData.confidence))}>
                          {fieldData.confidence}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 text-[10px] text-zinc-500 bg-zinc-50 rounded-lg px-3 py-2">
          <Info className="w-3 h-3 flex-shrink-0" />
          <span>
            Click any value to manually override. Data sourced live from SEC EDGAR and Yahoo Finance.
          </span>
        </div>
      </div>
    );
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════════
// Step 2: Case Details
// ═══════════════════════════════════════════════════════════════════

function StepCaseDetails({
  data,
  update,
}: {
  data: WizardData;
  update: (p: Partial<WizardData>) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-[14px] font-semibold">Case Details</h3>
        <p className="text-[12px] text-zinc-400 mt-0.5">
          Define the scope and type of this value engineering case.
        </p>
      </div>
      <div>
        <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider block mb-1.5">
          Case Title *
        </label>
        <input
          type="text"
          value={data.caseTitle}
          onChange={(e) => update({ caseTitle: e.target.value })}
          placeholder="e.g. Enterprise Platform Migration"
          className="w-full h-10 px-3 rounded-lg border border-zinc-200 bg-white text-[14px] placeholder:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-200"
          autoFocus
        />
      </div>
      <div>
        <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider block mb-1.5">
          Description
        </label>
        <textarea
          value={data.caseDescription}
          onChange={(e) => update({ caseDescription: e.target.value })}
          placeholder="Brief description of the value case objectives and scope..."
          rows={3}
          className="w-full px-3 py-2.5 rounded-lg border border-zinc-200 bg-white text-[13px] placeholder:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-200 resize-none"
        />
      </div>
      <div>
        <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider block mb-2">
          Case Type
        </label>
        <div className="grid grid-cols-3 gap-2">
          {CASE_TYPES.map((ct) => {
            const Icon = ct.icon;
            const selected = data.caseType === ct.value;
            return (
              <button
                key={ct.value}
                onClick={() => update({ caseType: ct.value })}
                className={cn(
                  "flex flex-col items-start gap-1.5 p-3 rounded-xl border transition-all text-left",
                  selected
                    ? "border-zinc-900 bg-zinc-50 ring-1 ring-zinc-200"
                    : "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50"
                )}
              >
                <Icon className={cn("w-4 h-4", selected ? "text-zinc-900" : "text-zinc-400")} />
                <span className="text-[12px] font-semibold">{ct.label}</span>
                <span className="text-[10px] text-zinc-400 leading-tight">{ct.desc}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider block mb-2">
          Priority
        </label>
        <div className="flex items-center gap-2">
          {PRIORITIES.map((p) => (
            <button
              key={p.value}
              onClick={() => update({ priority: p.value })}
              className={cn(
                "px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all border",
                data.priority === p.value
                  ? cn(p.color, "border-transparent ring-1 ring-zinc-200")
                  : "border-zinc-200 text-zinc-500 hover:bg-zinc-50"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Step 3: Domain Pack Selection
// ═══════════════════════════════════════════════════════════════════

function StepDomainPack({
  data,
  update,
  packs,
}: {
  data: WizardData;
  update: (p: Partial<WizardData>) => void;
  packs: DomainPack[];
}) {
  const togglePack = (id: string) => {
    const ids = data.selectedPackIds.includes(id)
      ? data.selectedPackIds.filter((x) => x !== id)
      : [...data.selectedPackIds, id];
    update({ selectedPackIds: ids });
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-[14px] font-semibold">Domain Packs</h3>
        <p className="text-[12px] text-zinc-400 mt-0.5">
          Select a domain pack to pre-load KPIs, assumptions, and industry benchmarks.
        </p>
      </div>
      <div className="space-y-2">
        {packs.map((pack) => {
          const selected = data.selectedPackIds.includes(pack.id);
          return (
            <button
              key={pack.id}
              onClick={() => togglePack(pack.id)}
              className={cn(
                "w-full flex items-start gap-3 p-4 rounded-xl border transition-all text-left",
                selected
                  ? "border-zinc-900 bg-zinc-50 ring-1 ring-zinc-200"
                  : "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50"
              )}
            >
              <div
                className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5",
                  selected ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-400"
                )}
              >
                {selected ? <Check className="w-4 h-4" /> : <Target className="w-4 h-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold">{pack.name}</span>
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 font-medium">
                    {pack.industry}
                  </Badge>
                </div>
                <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                  {pack.description || `Domain pack for ${pack.industry} industry`}
                </p>
                <div className="flex items-center gap-4 mt-2 text-[10px] text-zinc-400">
                  <span>{pack.kpis?.length || 0} KPIs</span>
                  <span>{pack.assumptions?.length || 0} assumptions</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-2 text-[11px] text-zinc-500 bg-zinc-50 rounded-lg px-3 py-2">
        <BookOpen className="w-3.5 h-3.5 flex-shrink-0" />
        <span>
          Domain packs provide pre-configured KPIs and assumptions for the Hypothesis stage.
          You can customize them later from the case canvas.
        </span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Step 4: Agent Config & Launch
// ═══════════════════════════════════════════════════════════════════

function StepLaunch({
  data,
  update,
}: {
  data: WizardData;
  update: (p: Partial<WizardData>) => void;
}) {
  const toggleAgent = (id: string) => {
    const ids = data.selectedAgentIds.includes(id)
      ? data.selectedAgentIds.filter((x) => x !== id)
      : [...data.selectedAgentIds, id];
    update({ selectedAgentIds: ids });
  };

  const companyName = data.isNewCompany
    ? data.enrichedData?.name.value || data.enrichmentInput
    : "Selected Company";

  const agentTypeIcons: Record<string, typeof Cpu> = {
    extraction: Search,
    research: Globe,
    integrity: Shield,
    modeling: Target,
    narrative: BookOpen,
    red_team: AlertTriangle,
  };

  return (
    <div className="space-y-5">
      <div className="bg-zinc-50 rounded-xl border border-zinc-200 p-4">
        <h3 className="text-[12px] font-semibold text-zinc-500 uppercase tracking-wider mb-3">
          Case Summary
        </h3>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-[13px]">
          <div className="flex items-center justify-between">
            <span className="text-zinc-400">Company</span>
            <span className="font-semibold">{companyName}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-zinc-400">Type</span>
            <span className="font-medium capitalize">
              {CASE_TYPES.find((ct) => ct.value === data.caseType)?.label || data.caseType}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-zinc-400">Title</span>
            <span className="font-semibold truncate ml-2">{data.caseTitle || "—"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-zinc-400">Priority</span>
            <Badge
              className={cn(
                "text-[10px] px-1.5 py-0 h-4",
                PRIORITIES.find((p) => p.value === data.priority)?.color
              )}
            >
              {data.priority}
            </Badge>
          </div>
          <div className="flex items-center justify-between col-span-2">
            <span className="text-zinc-400">Domain Packs</span>
            <span className="font-medium">{data.selectedPackIds.length} selected</span>
          </div>
          {data.isNewCompany && data.enrichedData && (
            <div className="flex items-center justify-between col-span-2">
              <span className="text-zinc-400">Enrichment</span>
              <span className="text-emerald-600 font-medium text-[12px] flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Live data from SEC EDGAR & Yahoo Finance
              </span>
            </div>
          )}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="text-[14px] font-semibold">Agent Configuration</h3>
            <p className="text-[12px] text-zinc-400 mt-0.5">
              Select which agents to activate for this case.
            </p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-[11px] text-zinc-400">Auto-run</span>
            <button
              onClick={() => update({ autoRunAgents: !data.autoRunAgents })}
              className={cn(
                "w-8 h-4.5 rounded-full transition-colors relative",
                data.autoRunAgents ? "bg-emerald-500" : "bg-zinc-200"
              )}
            >
              <div
                className={cn(
                  "w-3.5 h-3.5 rounded-full bg-white shadow-sm absolute top-0.5 transition-all",
                  data.autoRunAgents ? "left-4" : "left-0.5"
                )}
              />
            </button>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {AGENTS.map((agent) => {
            const selected = data.selectedAgentIds.includes(agent.id);
            const Icon = agentTypeIcons[agent.type] || Cpu;
            return (
              <button
                key={agent.id}
                onClick={() => toggleAgent(agent.id)}
                className={cn(
                  "flex items-center gap-2.5 p-3 rounded-xl border transition-all text-left",
                  selected
                    ? "border-zinc-900 bg-zinc-50 ring-1 ring-zinc-200"
                    : "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50"
                )}
              >
                <div
                  className={cn(
                    "w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0",
                    selected ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-400"
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[12px] font-semibold block truncate">{agent.name}</span>
                  <span className="text-[10px] text-zinc-400">
                    v{agent.version} · {agent.successRate}% success
                  </span>
                </div>
                {selected && <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>

      {data.autoRunAgents && (
        <div className="flex items-start gap-2 text-[11px] text-amber-700 bg-amber-50 rounded-lg px-3 py-2.5 border border-amber-200">
          <Zap className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>
            <strong>Auto-run enabled:</strong> Selected agents will immediately begin the
            Hypothesis stage — fetching company data, extracting financials, and generating
            initial claims. You'll receive a notification when human review is needed.
          </span>
        </div>
      )}
    </div>
  );
}
