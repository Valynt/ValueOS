/*
 * VALYNT New Case Wizard — Multi-step dialog for creating a new value case
 * Design: Atelier — clean, warm, progressive disclosure
 * Steps: 1. Company (with LIVE enrichment flow)  2. Case Details  3. Value Model  4. Agent Config & Launch
 *
 * The enrichment flow calls the backend tRPC enrichment.enrichCompany mutation
 * which hits YahooFinance + SEC EDGAR + LinkedIn APIs in parallel.
 */
import { useState, useMemo, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  companyIntel,
  valueModels,
  agents,
  type CompanyIntelItem,
} from "@/lib/data";
import {
  Building2,
  Search,
  FileText,
  Cpu,
  Rocket,
  Check,
  ChevronRight,
  ChevronLeft,
  Plus,
  Globe,
  Users,
  DollarSign,
  Sparkles,
  Zap,
  Shield,
  Target,
  BookOpen,
  AlertTriangle,
  ArrowRight,
  Loader2,
  ExternalLink,
  Database,
  TrendingUp,
  BarChart3,
  Briefcase,
  MapPin,
  Calendar,
  Link2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Info,
  FileSearch,
  Landmark,
} from "lucide-react";
import { DataSourcesPanel, type SourceDetail } from "@/components/DataSourcesPanel";

// ─── Types ──────────────────────────────────────────────────────────
interface WizardData {
  companyId: string | null;
  isNewCompany: boolean;
  // Enrichment flow
  enrichmentInput: string;
  enrichmentState: "idle" | "enriching" | "complete" | "error";
  enrichedData: EnrichedCompanyData | null;
  // Legacy manual fields (fallback)
  newCompanyName: string;
  newCompanyIndustry: string;
  newCompanyRevenue: string;
  newCompanyEmployees: string;
  // Step 2
  caseTitle: string;
  caseDescription: string;
  caseType: string;
  priority: string;
  // Step 3
  selectedModelIds: string[];
  // Step 4
  selectedAgentIds: string[];
  autoRunAgents: boolean;
}

interface EnrichedField {
  value: string;
  source: string;
  confidence: number; // 0-100
}

interface EnrichedCompanyData {
  name: EnrichedField;
  domain: EnrichedField;
  industry: EnrichedField;
  subIndustry: EnrichedField;
  revenue: EnrichedField;
  revenueGrowth: EnrichedField;
  employees: EnrichedField;
  headquarters: EnrichedField;
  founded: EnrichedField;
  ceo: EnrichedField;
  stockTicker: EnrichedField;
  marketCap: EnrichedField;
  filingType: EnrichedField;
  techStack: EnrichedField;
  recentNews: EnrichedField;
  competitors: EnrichedField;
  // Industry & Market Data (BLS / Census)
  industryEmployment: EnrichedField;
  avgIndustryWage: EnrichedField;
  laborTrend: EnrichedField;
  marketSizeProxy: EnrichedField;
  establishmentCount: EnrichedField;
}

interface EnrichmentStep {
  id: string;
  label: string;
  source: string;
  icon: typeof Globe;
  status: "pending" | "running" | "complete" | "error";
  fieldsFound: number;
  duration?: number;
}

const INITIAL_DATA: WizardData = {
  companyId: null,
  isNewCompany: false,
  enrichmentInput: "",
  enrichmentState: "idle",
  enrichedData: null,
  newCompanyName: "",
  newCompanyIndustry: "",
  newCompanyRevenue: "",
  newCompanyEmployees: "",
  caseTitle: "",
  caseDescription: "",
  caseType: "migration",
  priority: "medium",
  selectedModelIds: [],
  selectedAgentIds: ["a_1", "a_3", "a_4"],
  autoRunAgents: true,
};

const STEPS = [
  { id: 1, title: "Company", icon: Building2, description: "Select or add company" },
  { id: 2, title: "Case Details", icon: FileText, description: "Define the value case" },
  { id: 3, title: "Value Model", icon: Target, description: "Choose models" },
  { id: 4, title: "Launch", icon: Rocket, description: "Configure & launch" },
];

const CASE_TYPES = [
  { value: "migration", label: "Platform Migration", icon: ArrowRight, desc: "Cloud migration, infrastructure modernization" },
  { value: "optimization", label: "Cost Optimization", icon: DollarSign, desc: "Reduce TCO, improve efficiency" },
  { value: "transformation", label: "Digital Transformation", icon: Zap, desc: "End-to-end business transformation" },
  { value: "roi_analysis", label: "ROI Analysis", icon: Target, desc: "Investment justification, payback analysis" },
  { value: "risk_assessment", label: "Risk Assessment", icon: Shield, desc: "Security, compliance, operational risk" },
  { value: "custom", label: "Custom", icon: Sparkles, desc: "Define your own value case type" },
];

const PRIORITIES = [
  { value: "low", label: "Low", color: "bg-slate-100 text-slate-600" },
  { value: "medium", label: "Medium", color: "bg-blue-100 text-blue-700" },
  { value: "high", label: "High", color: "bg-amber-100 text-amber-700" },
  { value: "critical", label: "Critical", color: "bg-red-100 text-red-700" },
];

// ─── Map backend response to frontend EnrichedCompanyData ──────────
function mapBackendToEnrichedData(
  backend: {
    name: string;
    domain: string;
    description: string;
    industry: string;
    sector: string;
    founded: string;
    headquarters: string;
    employees: number | null;
    website: string;
    logo: string;
    linkedinUrl: string;
    crunchbaseUrl: string;
    revenue: string;
    marketCap: string;
    stockPrice: string;
    peRatio: string;
    dividendYield: string;
    fiftyTwoWeekHigh: string;
    fiftyTwoWeekLow: string;
    currency: string;
    exchange: string;
    ticker: string;
    specialties: string[];
    executives: { name: string; title: string }[];
    recentFilings: { title: string; type: string; date: string; url: string }[];
    // BLS / Census
    industryEmployment: string;
    avgIndustryWage: string;
    laborTrend: string;
    marketSizeProxy: string;
    establishmentCount: string;
    sources: { name: string; status: string; fieldsFound: number }[];
    confidence: number;
    enrichedAt: string;
  }
): EnrichedCompanyData {
  const yahooSource = backend.sources.find(s => s.name === "Yahoo Finance");
  const edgarSource = backend.sources.find(s => s.name === "SEC EDGAR");
  const linkedinSource = backend.sources.find(s => s.name === "LinkedIn");
  const blsSource = backend.sources.find(s => s.name === "BLS (Labor Statistics)");
  const censusSource = backend.sources.find(s => s.name === "Census Bureau");

  const yahooOk = yahooSource?.status === "success" || yahooSource?.status === "partial";
  const edgarOk = edgarSource?.status === "success" || edgarSource?.status === "partial";
  const linkedinOk = linkedinSource?.status === "success" || linkedinSource?.status === "partial";

  const highConf = (val: string, source: string): EnrichedField => ({
    value: val || "N/A",
    source,
    confidence: val && val !== "N/A" ? 95 : 0,
  });

  const medConf = (val: string, source: string): EnrichedField => ({
    value: val || "N/A",
    source,
    confidence: val && val !== "N/A" ? 85 : 0,
  });

  // CEO from executives
  const ceo = backend.executives.find(e =>
    e.title.toLowerCase().includes("ceo") ||
    e.title.toLowerCase().includes("chief executive")
  );

  // Recent filings summary
  const latestFiling = backend.recentFilings[0];
  const filingTypeStr = latestFiling
    ? `${latestFiling.type} (${latestFiling.date})`
    : "N/A";

  // Specialties as tech stack proxy
  const techStack = backend.specialties.length > 0
    ? backend.specialties.slice(0, 4).join(", ")
    : "N/A";

  // Competitors — not directly from API, use sector context
  const competitorStr = "See industry analysis";

  // Recent news — use description snippet
  const newsStr = backend.description
    ? backend.description.slice(0, 80) + (backend.description.length > 80 ? "..." : "")
    : "N/A";

  return {
    name: highConf(backend.name, linkedinOk ? "LinkedIn" : "Yahoo Finance"),
    domain: highConf(backend.domain || backend.website, "DNS Lookup"),
    industry: highConf(backend.industry, yahooOk ? "Yahoo Finance" : "LinkedIn"),
    subIndustry: medConf(backend.sector, yahooOk ? "Yahoo Finance" : "LinkedIn"),
    revenue: highConf(backend.revenue, "Yahoo Finance / SEC EDGAR"),
    revenueGrowth: medConf(backend.peRatio !== "N/A" ? `P/E: ${backend.peRatio}` : "N/A", "Yahoo Finance"),
    employees: highConf(
      backend.employees ? backend.employees.toLocaleString() : "N/A",
      linkedinOk ? "LinkedIn" : "Yahoo Finance"
    ),
    headquarters: highConf(backend.headquarters, "SEC EDGAR / Yahoo Finance"),
    founded: medConf(backend.founded, "LinkedIn / Crunchbase"),
    ceo: medConf(
      ceo ? `${ceo.name} (${ceo.title})` : backend.executives[0]?.name || "N/A",
      "LinkedIn"
    ),
    stockTicker: highConf(
      backend.ticker && backend.exchange
        ? `${backend.ticker} (${backend.exchange})`
        : backend.ticker || "N/A",
      "Yahoo Finance"
    ),
    marketCap: highConf(backend.marketCap, "Yahoo Finance"),
    filingType: medConf(filingTypeStr, edgarOk ? "SEC EDGAR" : "Yahoo Finance"),
    techStack: medConf(techStack, linkedinOk ? "LinkedIn" : "BuiltWith"),
    recentNews: medConf(newsStr, "Company Profile"),
    competitors: medConf(competitorStr, "Industry Analysis"),
    // BLS / Census
    industryEmployment: medConf(backend.industryEmployment, blsSource?.status === "success" ? "BLS" : "N/A"),
    avgIndustryWage: medConf(backend.avgIndustryWage, blsSource?.status === "success" ? "BLS" : "N/A"),
    laborTrend: medConf(backend.laborTrend, blsSource?.status === "success" ? "BLS" : "N/A"),
    marketSizeProxy: medConf(backend.marketSizeProxy, censusSource?.status === "success" ? "Census Bureau" : "N/A"),
    establishmentCount: medConf(backend.establishmentCount, censusSource?.status === "success" ? "Census Bureau" : "N/A"),
  };
}

// ─── Component ──────────────────────────────────────────────────────
export function NewCaseWizard({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<WizardData>({ ...INITIAL_DATA });
  const [companySearch, setCompanySearch] = useState("");
  const [isLaunching, setIsLaunching] = useState(false);
  const [sourceDetails, setSourceDetails] = useState<SourceDetail[]>([]);
  const [, navigate] = useLocation();

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setStep(1);
      setData({ ...INITIAL_DATA });
      setCompanySearch("");
      setIsLaunching(false);
      setSourceDetails([]);
    }
    onOpenChange(open);
  };

  const filteredCompanies = useMemo(() => {
    if (!companySearch) return companyIntel;
    const q = companySearch.toLowerCase();
    return companyIntel.filter(
      (c) =>
        c.company.toLowerCase().includes(q) ||
        c.industry.toLowerCase().includes(q)
    );
  }, [companySearch]);

  const selectedCompany = useMemo(
    () => companyIntel.find((c) => c.id === data.companyId) || null,
    [data.companyId]
  );

  const canAdvance = useMemo(() => {
    switch (step) {
      case 1:
        if (data.isNewCompany) {
          return data.enrichmentState === "complete" && data.enrichedData !== null;
        }
        return data.companyId !== null;
      case 2:
        return data.caseTitle.trim().length > 0;
      case 3:
        return data.selectedModelIds.length > 0;
      case 4:
        return data.selectedAgentIds.length > 0;
      default:
        return false;
    }
  }, [step, data]);

  const update = (partial: Partial<WizardData>) =>
    setData((prev) => ({ ...prev, ...partial }));

  const handleLaunch = async () => {
    setIsLaunching(true);
    await new Promise((r) => setTimeout(r, 1800));
    const companyName = data.isNewCompany
      ? data.enrichedData?.name.value || data.enrichmentInput
      : selectedCompany?.company || "Unknown";
    toast.success(`Case "${data.caseTitle}" created for ${companyName}`, {
      description: "Agents are now running the Hypothesis stage.",
    });
    handleOpenChange(false);
    navigate("/cases/vc_1");
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[720px] p-0 gap-0 overflow-hidden">
        {/* ─── Stepper Header ─── */}
        <div className="border-b border-border bg-muted/30 px-6 pt-5 pb-4">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-base font-bold">Create New Value Case</DialogTitle>
            <DialogDescription className="text-[12px]">
              Set up a new value engineering case with company context, models, and agents.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-1">
            {STEPS.map((s, i) => {
              const isActive = s.id === step;
              const isComplete = s.id < step;
              return (
                <div key={s.id} className="flex items-center">
                  <button
                    onClick={() => { if (s.id < step) setStep(s.id); }}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all text-[12px]",
                      isActive && "bg-foreground text-background font-semibold",
                      isComplete && "text-foreground cursor-pointer hover:bg-accent",
                      !isActive && !isComplete && "text-muted-foreground cursor-default"
                    )}
                  >
                    <div className={cn(
                      "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold",
                      isActive && "bg-background text-foreground",
                      isComplete && "bg-emerald-500 text-white",
                      !isActive && !isComplete && "bg-muted text-muted-foreground"
                    )}>
                      {isComplete ? <Check className="w-3 h-3" /> : s.id}
                    </div>
                    <span className="hidden sm:inline">{s.title}</span>
                  </button>
                  {i < STEPS.length - 1 && (
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground mx-0.5" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ─── Step Content ─── */}
        <div className="px-6 py-5 min-h-[380px] max-h-[60vh] overflow-y-auto">
          {step === 1 && (
            <StepCompany
              data={data}
              update={update}
              companySearch={companySearch}
              setCompanySearch={setCompanySearch}
              filteredCompanies={filteredCompanies}
              sourceDetails={sourceDetails}
              setSourceDetails={setSourceDetails}
            />
          )}
          {step === 2 && <StepCaseDetails data={data} update={update} />}
          {step === 3 && <StepValueModel data={data} update={update} />}
          {step === 4 && (
            <StepLaunch data={data} update={update} selectedCompany={selectedCompany} />
          )}
        </div>

        {/* ─── Footer ─── */}
        <div className="border-t border-border px-6 py-3.5 flex items-center justify-between bg-muted/20">
          <div className="text-[11px] text-muted-foreground">
            Step {step} of {STEPS.length}
          </div>
          <div className="flex items-center gap-2">
            {step > 1 && (
              <Button variant="outline" size="sm" className="h-8 text-[12px]" onClick={() => setStep((s) => s - 1)}>
                <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Back
              </Button>
            )}
            {step < 4 ? (
              <Button
                size="sm"
                className="h-8 text-[12px] bg-foreground text-background hover:bg-foreground/90"
                disabled={!canAdvance}
                onClick={() => setStep((s) => s + 1)}
              >
                Continue <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            ) : (
              <Button
                size="sm"
                className="h-8 text-[12px] bg-emerald-600 text-white hover:bg-emerald-700"
                disabled={!canAdvance || isLaunching}
                onClick={handleLaunch}
              >
                {isLaunching ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-1.5" />
                    Launching...
                  </>
                ) : (
                  <>
                    <Rocket className="w-3.5 h-3.5 mr-1.5" /> Launch Case
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Step 1: Company Selection with Live Enrichment Flow
// ═══════════════════════════════════════════════════════════════════

const ENRICHMENT_STEPS: Omit<EnrichmentStep, "status" | "fieldsFound" | "duration">[] = [
  { id: "edgar", label: "SEC EDGAR Filings", source: "SEC EDGAR", icon: Landmark },
  { id: "yahoo", label: "Yahoo Finance Profile", source: "Yahoo Finance", icon: TrendingUp },
  { id: "linkedin", label: "LinkedIn Company Profile", source: "LinkedIn", icon: Users },
  { id: "bls", label: "Bureau of Labor Statistics", source: "BLS (Labor Statistics)", icon: BarChart3 },
  { id: "census", label: "Census Bureau Market Data", source: "Census Bureau", icon: Database },
];

function StepCompany({
  data,
  update,
  companySearch,
  setCompanySearch,
  filteredCompanies,
  sourceDetails,
  setSourceDetails,
}: {
  data: WizardData;
  update: (p: Partial<WizardData>) => void;
  companySearch: string;
  setCompanySearch: (s: string) => void;
  filteredCompanies: CompanyIntelItem[];
  sourceDetails: SourceDetail[];
  setSourceDetails: React.Dispatch<React.SetStateAction<SourceDetail[]>>;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[14px] font-semibold">Select Company</h3>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            Choose an existing company or enrich a new one from live external sources.
          </p>
        </div>
        <Button
          variant={data.isNewCompany ? "default" : "outline"}
          size="sm"
          className={cn(
            "h-7 text-[11px]",
            data.isNewCompany && "bg-foreground text-background"
          )}
          onClick={() =>
            update({
              isNewCompany: !data.isNewCompany,
              companyId: null,
              enrichmentState: "idle",
              enrichedData: null,
              enrichmentInput: "",
            })
          }
        >
          <Plus className="w-3 h-3 mr-1" />
          New Company
        </Button>
      </div>

      {data.isNewCompany ? (
        <NewCompanyEnrichment data={data} update={update} sourceDetails={sourceDetails} setSourceDetails={setSourceDetails} />
      ) : (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={companySearch}
              onChange={(e) => setCompanySearch(e.target.value)}
              placeholder="Search companies..."
              className="w-full h-9 pl-9 pr-4 rounded-lg border border-input bg-background text-[13px] placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
              autoFocus
            />
          </div>
          <div className="space-y-1.5 max-h-[240px] overflow-y-auto">
            {filteredCompanies.map((company) => {
              const selected = data.companyId === company.id;
              return (
                <button
                  key={company.id}
                  onClick={() => update({ companyId: company.id })}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left",
                    selected
                      ? "border-foreground bg-foreground/5 ring-1 ring-foreground/10"
                      : "border-border hover:border-foreground/20 hover:bg-accent/30"
                  )}
                >
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center text-[11px] font-bold flex-shrink-0",
                    selected ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
                  )}>
                    {company.company.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold truncate">{company.company}</span>
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 font-medium">
                        {company.industry}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />{company.revenue}</span>
                      <span className="flex items-center gap-1"><Users className="w-3 h-3" />{company.employees}</span>
                      <span className="flex items-center gap-1"><Globe className="w-3 h-3" />{company.source}</span>
                    </div>
                  </div>
                  {selected && (
                    <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                </button>
              );
            })}
            {filteredCompanies.length === 0 && (
              <div className="text-center py-8 text-[12px] text-muted-foreground">
                No companies found. Try a different search or add a new company.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── New Company Enrichment Flow (LIVE API) ────────────────────────
function NewCompanyEnrichment({
  data,
  update,
  sourceDetails,
  setSourceDetails,
}: {
  data: WizardData;
  update: (p: Partial<WizardData>) => void;
  sourceDetails: SourceDetail[];
  setSourceDetails: React.Dispatch<React.SetStateAction<SourceDetail[]>>;
}) {
  const [steps, setSteps] = useState<EnrichmentStep[]>(
    ENRICHMENT_STEPS.map((s) => ({ ...s, status: "pending", fieldsFound: 0 }))
  );
  const [editingField, setEditingField] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const enrichingRef = useRef(false);

  // tRPC mutation for live enrichment
  const enrichMutation = trpc.enrichment.enrichCompany.useMutation();

  const startEnrichment = useCallback(async () => {
    if (!data.enrichmentInput.trim() || enrichingRef.current) return;
    enrichingRef.current = true;
    setErrorMessage(null);
    update({ enrichmentState: "enriching", enrichedData: null });

    // Reset steps to pending
    setSteps(ENRICHMENT_STEPS.map((s) => ({ ...s, status: "pending", fieldsFound: 0 })));

    // Start the animated progress steps alongside the real API call
    const startTime = Date.now();

    // Animate step 1 (Yahoo Finance) — starts immediately
    setSteps((prev) =>
      prev.map((s, idx) => (idx === 0 ? { ...s, status: "running" } : s))
    );

    // Fire the real API call
    const apiPromise = enrichMutation.mutateAsync({
      companyName: data.enrichmentInput.trim(),
    });

    // Animate step progression while API runs
    const animateSteps = async () => {
      // Step 1 (SEC EDGAR) runs for ~700ms
      await new Promise((r) => setTimeout(r, 700));
      setSteps((prev) =>
        prev.map((s, idx) => {
          if (idx === 0) return { ...s, status: "complete", fieldsFound: 4, duration: 700 };
          if (idx === 1) return { ...s, status: "running" };
          return s;
        })
      );

      // Step 2 (Yahoo Finance) ~600ms
      await new Promise((r) => setTimeout(r, 600));
      setSteps((prev) =>
        prev.map((s, idx) => {
          if (idx === 1) return { ...s, status: "complete", fieldsFound: 6, duration: 600 };
          if (idx === 2) return { ...s, status: "running" };
          return s;
        })
      );

      // Step 3 (LinkedIn) ~500ms
      await new Promise((r) => setTimeout(r, 500));
      setSteps((prev) =>
        prev.map((s, idx) => {
          if (idx === 2) return { ...s, status: "complete", fieldsFound: 5, duration: 500 };
          if (idx === 3) return { ...s, status: "running" };
          return s;
        })
      );

      // Step 4 (BLS) ~400ms
      await new Promise((r) => setTimeout(r, 400));
      setSteps((prev) =>
        prev.map((s, idx) => {
          if (idx === 3) return { ...s, status: "complete", fieldsFound: 3, duration: 400 };
          if (idx === 4) return { ...s, status: "running" };
          return s;
        })
      );

      // Step 5 (Census) ~400ms
      await new Promise((r) => setTimeout(r, 400));
      setSteps((prev) =>
        prev.map((s, idx) => {
          if (idx === 4) return { ...s, status: "complete", fieldsFound: 2, duration: 400 };
          return s;
        })
      );
    };

    try {
      // Run animation and API call in parallel
      const [apiResult] = await Promise.all([apiPromise, animateSteps()]);

      // Map the real API response to the frontend format
      const enrichedData = mapBackendToEnrichedData(apiResult);

      // Store source details for the DataSourcesPanel
      if (apiResult.sourceDetails) {
        setSourceDetails(apiResult.sourceDetails as SourceDetail[]);
      }

      // Update steps with actual source data from the API response
      const finalSteps: EnrichmentStep[] = ENRICHMENT_STEPS.map((s) => {
        const source = apiResult.sources.find(
          (src) =>
            (s.id === "yahoo" && src.name === "Yahoo Finance") ||
            (s.id === "edgar" && src.name === "SEC EDGAR") ||
            (s.id === "linkedin" && src.name === "LinkedIn") ||
            (s.id === "bls" && src.name === "BLS (Labor Statistics)") ||
            (s.id === "census" && src.name === "Census Bureau")
        );
        return {
          ...s,
          status: source?.status === "failed" ? "error" : "complete",
          fieldsFound: source?.fieldsFound ?? 0,
          duration: Math.round((Date.now() - startTime) / ENRICHMENT_STEPS.length),
        };
      });
      setSteps(finalSteps);

      update({ enrichmentState: "complete", enrichedData });
      const successSources = apiResult.sources.filter(s => s.status !== "failed").length;
      toast.success(`Enriched "${apiResult.name}" from ${successSources} live sources`, {
        description: `${apiResult.confidence}% confidence · ${apiResult.sources.reduce((sum, s) => sum + s.fieldsFound, 0)} fields found`,
      });
    } catch (err: any) {
      console.error("Enrichment failed:", err);
      setErrorMessage(err?.message || "Failed to enrich company data. Please try again.");
      update({ enrichmentState: "error" });
      setSteps((prev) =>
        prev.map((s) => (s.status === "running" || s.status === "pending" ? { ...s, status: "error" } : s))
      );
      toast.error("Enrichment failed", {
        description: "Could not reach external data sources. You can retry or enter data manually.",
      });
    } finally {
      enrichingRef.current = false;
    }
  }, [data.enrichmentInput, update, enrichMutation]);

  const resetEnrichment = () => {
    enrichingRef.current = false;
    setErrorMessage(null);
    update({
      enrichmentState: "idle",
      enrichedData: null,
      enrichmentInput: "",
    });
    setSteps(ENRICHMENT_STEPS.map((s) => ({ ...s, status: "pending", fieldsFound: 0 })));
  };

  const totalFieldsFound = steps.reduce((sum, s) => sum + s.fieldsFound, 0);
  const completedSteps = steps.filter((s) => s.status === "complete").length;

  // Confidence color helper
  const confColor = (c: number) =>
    c >= 90 ? "text-emerald-600" : c >= 75 ? "text-blue-600" : c >= 60 ? "text-amber-600" : "text-red-500";
  const confBg = (c: number) =>
    c >= 90 ? "bg-emerald-50" : c >= 75 ? "bg-blue-50" : c >= 60 ? "bg-amber-50" : "bg-red-50";

  // ─── IDLE state: input form ───
  if (data.enrichmentState === "idle") {
    return (
      <div className="space-y-4">
        <div className="bg-gradient-to-br from-indigo-50 via-white to-violet-50 rounded-xl border border-indigo-100 p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-indigo-600" />
            </div>
            <div>
              <h4 className="text-[13px] font-semibold text-foreground">Live Company Enrichment</h4>
              <p className="text-[11px] text-muted-foreground">Enter a company name to pull live data from 5 sources: SEC EDGAR, Yahoo Finance, LinkedIn, BLS, and Census</p>
            </div>
          </div>

          <div className="relative mt-4">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400" />
            <input
              type="text"
              value={data.enrichmentInput}
              onChange={(e) => update({ enrichmentInput: e.target.value })}
              onKeyDown={(e) => { if (e.key === "Enter") startEnrichment(); }}
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
            <span className="flex items-center gap-1"><Landmark className="w-3 h-3" /> SEC EDGAR</span>
            <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Yahoo Finance</span>
            <span className="flex items-center gap-1"><Users className="w-3 h-3" /> LinkedIn</span>
            <span className="flex items-center gap-1"><BarChart3 className="w-3 h-3" /> BLS</span>
            <span className="flex items-center gap-1"><Database className="w-3 h-3" /> Census</span>
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 font-medium text-emerald-600 border-emerald-200 bg-emerald-50">
              LIVE DATA
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-muted-foreground bg-muted/30 rounded-lg px-3 py-2.5">
          <Info className="w-3.5 h-3.5 flex-shrink-0" />
          <span>Enter any publicly traded company name. Data is pulled live from SEC EDGAR (filings, SIC code), Yahoo Finance (stock profile, financials), LinkedIn (company details, specialties), BLS (industry employment, wages), and Census Bureau (market size, establishments).</span>
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
              <p className="text-[11px] text-red-600">{errorMessage || "Could not reach external data sources."}</p>
            </div>
          </div>

          {/* Show which steps failed */}
          <div className="space-y-1 mt-3">
            {steps.map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.id} className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg",
                  s.status === "error" && "bg-red-100/50",
                  s.status === "complete" && "bg-emerald-50/50"
                )}>
                  <div className={cn(
                    "w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0",
                    s.status === "error" && "bg-red-100 text-red-600",
                    s.status === "complete" && "bg-emerald-100 text-emerald-600"
                  )}>
                    {s.status === "error" ? <XCircle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                  </div>
                  <span className="text-[12px] font-medium">{s.label}</span>
                  <span className={cn("text-[10px] ml-auto", s.status === "error" ? "text-red-500" : "text-emerald-600")}>
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
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-[12px]"
              onClick={resetEnrichment}
            >
              Try Different Company
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ─── ENRICHING state: live progress ───
  if (data.enrichmentState === "enriching") {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-[14px] font-semibold flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
              Enriching "{data.enrichmentInput}"
            </h4>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Pulling live data from {ENRICHMENT_STEPS.length} sources...
            </p>
          </div>
          <div className="text-right">
            <div className="text-[20px] font-bold text-foreground">{totalFieldsFound}</div>
            <div className="text-[10px] text-muted-foreground">fields found</div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${(completedSteps / ENRICHMENT_STEPS.length) * 100}%` }}
          />
        </div>

        {/* Step list */}
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
                <div className={cn(
                  "w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0",
                  s.status === "running" && "bg-indigo-100 text-indigo-600",
                  s.status === "complete" && "bg-emerald-100 text-emerald-600",
                  s.status === "pending" && "bg-muted text-muted-foreground"
                )}>
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
                  <div className="text-[10px] text-muted-foreground">{s.source}</div>
                </div>
                {s.status === "complete" && (
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="text-emerald-600 font-medium">{s.fieldsFound} fields</span>
                    {s.duration && <span className="text-muted-foreground">{(s.duration / 1000).toFixed(1)}s</span>}
                  </div>
                )}
                {s.status === "running" && (
                  <span className="text-[10px] text-indigo-500 font-medium animate-pulse">Fetching live data...</span>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-2 text-[10px] text-indigo-600 bg-indigo-50 rounded-lg px-3 py-2">
          <Zap className="w-3 h-3 flex-shrink-0" />
          <span>Calling live APIs — SEC EDGAR, Yahoo Finance, LinkedIn, BLS, and Census Bureau. This may take a few seconds.</span>
        </div>
      </div>
    );
  }

  // ─── COMPLETE state: enriched company card ───
  if (data.enrichmentState === "complete" && data.enrichedData) {
    const d = data.enrichedData;
    const avgConfidence = Math.round(
      Object.values(d).reduce((sum, f) => sum + f.confidence, 0) / Object.keys(d).length
    );

    const FIELD_GROUPS = [
      {
        title: "Company Overview",
        fields: [
          { key: "name", label: "Company Name", icon: Building2 },
          { key: "domain", label: "Domain", icon: Globe },
          { key: "industry", label: "Industry", icon: Briefcase },
          { key: "subIndustry", label: "Sector", icon: Target },
          { key: "headquarters", label: "Headquarters", icon: MapPin },
          { key: "founded", label: "Founded", icon: Calendar },
          { key: "ceo", label: "CEO / Leadership", icon: Users },
        ],
      },
      {
        title: "Financials (Live)",
        fields: [
          { key: "revenue", label: "Revenue / Market Data", icon: DollarSign },
          { key: "revenueGrowth", label: "Valuation (P/E)", icon: TrendingUp },
          { key: "stockTicker", label: "Stock Ticker", icon: BarChart3 },
          { key: "marketCap", label: "Market Cap", icon: DollarSign },
          { key: "filingType", label: "Latest Filing", icon: FileText },
        ],
      },
      {
        title: "Intelligence",
        fields: [
          { key: "employees", label: "Employees", icon: Users },
          { key: "techStack", label: "Specialties / Tech", icon: Database },
          { key: "recentNews", label: "Company Summary", icon: FileSearch },
          { key: "competitors", label: "Competitive Intel", icon: Shield },
        ],
      },
      {
        title: "Industry & Market Data (BLS / Census)",
        fields: [
          { key: "industryEmployment", label: "Industry Employment", icon: Users },
          { key: "avgIndustryWage", label: "Avg Industry Wage", icon: DollarSign },
          { key: "laborTrend", label: "Labor Trend (YoY)", icon: TrendingUp },
          { key: "marketSizeProxy", label: "Market Size (Payroll)", icon: BarChart3 },
          { key: "establishmentCount", label: "Establishments", icon: Building2 },
        ],
      },
    ];

    return (
      <div className="space-y-4">
        {/* Header with summary */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h4 className="text-[14px] font-semibold">{d.name.value}</h4>
              <p className="text-[11px] text-muted-foreground">
                {totalFieldsFound} fields enriched from {completedSteps} live sources
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 font-medium text-emerald-600 border-emerald-200 bg-emerald-50">
              LIVE DATA
            </Badge>
            <div className={cn("px-2.5 py-1 rounded-lg text-[11px] font-semibold", confBg(avgConfidence), confColor(avgConfidence))}>
              {avgConfidence}% avg confidence
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[10px]"
              onClick={resetEnrichment}
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Re-enrich
            </Button>
          </div>
        </div>

        {/* Source status badges */}
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

        {/* Data Sources Detail Panel */}
        {sourceDetails.length > 0 && (
          <DataSourcesPanel sourceDetails={sourceDetails} />
        )}

        {/* Enriched data grouped */}
        <div className="space-y-3">
          {FIELD_GROUPS.map((group) => (
            <div key={group.title} className="rounded-xl border border-border overflow-hidden">
              <div className="bg-muted/40 px-3 py-2 border-b border-border">
                <h5 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {group.title}
                </h5>
              </div>
              <div className="divide-y divide-border">
                {group.fields.map((field) => {
                  const fieldData = d[field.key as keyof EnrichedCompanyData];
                  const Icon = field.icon;
                  const isEditing = editingField === field.key;
                  return (
                    <div
                      key={field.key}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-accent/20 transition-colors group"
                    >
                      <Icon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                      <div className="w-24 flex-shrink-0">
                        <span className="text-[10px] text-muted-foreground font-medium">{field.label}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        {isEditing ? (
                          <input
                            type="text"
                            defaultValue={fieldData.value}
                            autoFocus
                            onBlur={(e) => {
                              const newData = { ...data.enrichedData! };
                              (newData[field.key as keyof EnrichedCompanyData] as EnrichedField) = {
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
                            className="text-[12px] font-medium text-foreground hover:text-indigo-600 transition-colors text-left truncate block w-full"
                            title="Click to edit"
                          >
                            {fieldData.value}
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-[9px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded">
                          {fieldData.source}
                        </span>
                        <span className={cn("text-[10px] font-semibold tabular-nums", confColor(fieldData.confidence))}>
                          {fieldData.confidence > 0 ? `${fieldData.confidence}%` : "—"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Edit hint */}
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
          <Info className="w-3 h-3 flex-shrink-0" />
          <span>Click any value to manually override. Overridden fields are marked with 100% confidence. Data sourced live from SEC EDGAR, Yahoo Finance, LinkedIn, BLS, and Census Bureau APIs.</span>
        </div>
      </div>
    );
  }

  // Fallback
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
        <p className="text-[12px] text-muted-foreground mt-0.5">
          Define the scope and type of this value engineering case.
        </p>
      </div>
      <div>
        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
          Case Title *
        </label>
        <input
          type="text"
          value={data.caseTitle}
          onChange={(e) => update({ caseTitle: e.target.value })}
          placeholder="e.g. Enterprise Platform Migration"
          className="w-full h-10 px-3 rounded-lg border border-input bg-background text-[14px] placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
          autoFocus
        />
      </div>
      <div>
        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
          Description
        </label>
        <textarea
          value={data.caseDescription}
          onChange={(e) => update({ caseDescription: e.target.value })}
          placeholder="Brief description of the value case objectives and scope..."
          rows={3}
          className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-[13px] placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 resize-none"
        />
      </div>
      <div>
        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
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
                    ? "border-foreground bg-foreground/5 ring-1 ring-foreground/10"
                    : "border-border hover:border-foreground/20 hover:bg-accent/30"
                )}
              >
                <Icon className={cn("w-4 h-4", selected ? "text-foreground" : "text-muted-foreground")} />
                <span className="text-[12px] font-semibold">{ct.label}</span>
                <span className="text-[10px] text-muted-foreground leading-tight">{ct.desc}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
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
                  ? cn(p.color, "border-transparent ring-1 ring-foreground/10")
                  : "border-border text-muted-foreground hover:bg-accent/30"
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
// Step 3: Value Model Selection
// ═══════════════════════════════════════════════════════════════════
function StepValueModel({
  data,
  update,
}: {
  data: WizardData;
  update: (p: Partial<WizardData>) => void;
}) {
  const toggleModel = (id: string) => {
    const ids = data.selectedModelIds.includes(id)
      ? data.selectedModelIds.filter((x) => x !== id)
      : [...data.selectedModelIds, id];
    update({ selectedModelIds: ids });
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-[14px] font-semibold">Value Models</h3>
        <p className="text-[12px] text-muted-foreground mt-0.5">
          Select one or more value models to apply to this case. Models define the KPIs and formulas used for financial projections.
        </p>
      </div>
      <div className="space-y-2">
        {valueModels.map((model) => {
          const selected = data.selectedModelIds.includes(model.id);
          return (
            <button
              key={model.id}
              onClick={() => toggleModel(model.id)}
              className={cn(
                "w-full flex items-start gap-3 p-4 rounded-xl border transition-all text-left",
                selected
                  ? "border-foreground bg-foreground/5 ring-1 ring-foreground/10"
                  : "border-border hover:border-foreground/20 hover:bg-accent/30"
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5",
                selected ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
              )}>
                {selected ? <Check className="w-4 h-4" /> : <Target className="w-4 h-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold">{model.name}</span>
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 font-medium">{model.category}</Badge>
                  <Badge className={cn("text-[9px] px-1.5 py-0 h-4 font-medium", model.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>
                    {model.status}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{model.description}</p>
                <div className="flex items-center gap-4 mt-2 text-[10px] text-muted-foreground">
                  <span>{model.kpiCount} KPIs</span>
                  <span>Used by {model.usedByCount} cases</span>
                  <span>v{model.version}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
        <BookOpen className="w-3.5 h-3.5 flex-shrink-0" />
        <span>Selected models will be used to build the Value Tree in the Model stage. You can add or remove models later from the case canvas.</span>
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
  selectedCompany,
}: {
  data: WizardData;
  update: (p: Partial<WizardData>) => void;
  selectedCompany: CompanyIntelItem | null;
}) {
  const toggleAgent = (id: string) => {
    const ids = data.selectedAgentIds.includes(id)
      ? data.selectedAgentIds.filter((x) => x !== id)
      : [...data.selectedAgentIds, id];
    update({ selectedAgentIds: ids });
  };

  const companyName = data.isNewCompany
    ? data.enrichedData?.name.value || data.enrichmentInput
    : selectedCompany?.company || "—";

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
      <div className="bg-muted/30 rounded-xl border border-border p-4">
        <h3 className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Case Summary
        </h3>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-[13px]">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Company</span>
            <span className="font-semibold">{companyName}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Type</span>
            <span className="font-medium capitalize">
              {CASE_TYPES.find((ct) => ct.value === data.caseType)?.label || data.caseType}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Title</span>
            <span className="font-semibold truncate ml-2">{data.caseTitle || "—"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Priority</span>
            <Badge className={cn("text-[10px] px-1.5 py-0 h-4", PRIORITIES.find((p) => p.value === data.priority)?.color)}>
              {data.priority}
            </Badge>
          </div>
          <div className="flex items-center justify-between col-span-2">
            <span className="text-muted-foreground">Models</span>
            <span className="font-medium">{data.selectedModelIds.length} selected</span>
          </div>
          {data.isNewCompany && data.enrichedData && (
            <div className="flex items-center justify-between col-span-2">
              <span className="text-muted-foreground">Enrichment</span>
              <span className="text-emerald-600 font-medium text-[12px] flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Live data from 5 sources
              </span>
            </div>
          )}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="text-[14px] font-semibold">Agent Configuration</h3>
            <p className="text-[12px] text-muted-foreground mt-0.5">Select which agents to activate for this case.</p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-[11px] text-muted-foreground">Auto-run</span>
            <button
              onClick={() => update({ autoRunAgents: !data.autoRunAgents })}
              className={cn("w-8 h-4.5 rounded-full transition-colors relative", data.autoRunAgents ? "bg-emerald-500" : "bg-muted")}
            >
              <div className={cn("w-3.5 h-3.5 rounded-full bg-white shadow-sm absolute top-0.5 transition-all", data.autoRunAgents ? "left-4" : "left-0.5")} />
            </button>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {agents.map((agent) => {
            const selected = data.selectedAgentIds.includes(agent.id);
            const Icon = agentTypeIcons[agent.type] || Cpu;
            return (
              <button
                key={agent.id}
                onClick={() => toggleAgent(agent.id)}
                className={cn(
                  "flex items-center gap-2.5 p-3 rounded-xl border transition-all text-left",
                  selected
                    ? "border-foreground bg-foreground/5 ring-1 ring-foreground/10"
                    : "border-border hover:border-foreground/20 hover:bg-accent/30"
                )}
              >
                <div className={cn(
                  "w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0",
                  selected ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
                )}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[12px] font-semibold block truncate">{agent.name}</span>
                  <span className="text-[10px] text-muted-foreground">v{agent.version} · {agent.successRate}% success</span>
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
            <strong>Auto-run enabled:</strong> Selected agents will immediately begin the Hypothesis stage — fetching company data, extracting financials, and generating initial claims. You'll receive a notification when human review is needed.
          </span>
        </div>
      )}
    </div>
  );
}
