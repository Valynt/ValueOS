/*
 * VALYNT New Case Wizard — Multi-step dialog for creating a new value case
 * Design: Atelier — clean, warm, progressive disclosure
 * Steps: 1. Company (with enrichment flow)  2. Case Details  3. Value Model  4. Agent Config & Launch
 */
import { useState, useMemo, useEffect, useCallback, useRef } from "react";
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

// ─── Simulated enrichment data for different company inputs ────────
const ENRICHMENT_DB: Record<string, EnrichedCompanyData> = {
  default: {
    name: { value: "TechVista Solutions", source: "LinkedIn", confidence: 95 },
    domain: { value: "techvista.com", source: "DNS Lookup", confidence: 100 },
    industry: { value: "Enterprise Software", source: "Bloomberg", confidence: 92 },
    subIndustry: { value: "Cloud Infrastructure & DevOps", source: "Crunchbase", confidence: 85 },
    revenue: { value: "$1.2B", source: "EDGAR 10-K (FY2025)", confidence: 98 },
    revenueGrowth: { value: "+18% YoY", source: "EDGAR 10-K (FY2025)", confidence: 98 },
    employees: { value: "6,800", source: "LinkedIn", confidence: 88 },
    headquarters: { value: "Austin, TX", source: "EDGAR 10-K", confidence: 99 },
    founded: { value: "2012", source: "Crunchbase", confidence: 95 },
    ceo: { value: "Maria Chen", source: "LinkedIn", confidence: 92 },
    stockTicker: { value: "TVST (NASDAQ)", source: "Bloomberg", confidence: 100 },
    marketCap: { value: "$8.4B", source: "Bloomberg", confidence: 97 },
    filingType: { value: "10-K Annual Report", source: "SEC EDGAR", confidence: 100 },
    techStack: { value: "AWS, Kubernetes, React, PostgreSQL", source: "BuiltWith", confidence: 78 },
    recentNews: { value: "Acquired DataSync Labs for $340M (Jan 2026)", source: "Reuters", confidence: 96 },
    competitors: { value: "HashiCorp, Datadog, Confluent", source: "Bloomberg", confidence: 84 },
  },
  salesforce: {
    name: { value: "Salesforce, Inc.", source: "SEC EDGAR", confidence: 100 },
    domain: { value: "salesforce.com", source: "DNS Lookup", confidence: 100 },
    industry: { value: "Enterprise Software", source: "Bloomberg", confidence: 98 },
    subIndustry: { value: "CRM & Customer Experience", source: "Gartner", confidence: 95 },
    revenue: { value: "$37.9B", source: "EDGAR 10-K (FY2025)", confidence: 100 },
    revenueGrowth: { value: "+11% YoY", source: "EDGAR 10-K (FY2025)", confidence: 100 },
    employees: { value: "73,000", source: "LinkedIn", confidence: 90 },
    headquarters: { value: "San Francisco, CA", source: "EDGAR 10-K", confidence: 100 },
    founded: { value: "1999", source: "Crunchbase", confidence: 100 },
    ceo: { value: "Marc Benioff", source: "LinkedIn", confidence: 100 },
    stockTicker: { value: "CRM (NYSE)", source: "Bloomberg", confidence: 100 },
    marketCap: { value: "$285B", source: "Bloomberg", confidence: 97 },
    filingType: { value: "10-K Annual Report", source: "SEC EDGAR", confidence: 100 },
    techStack: { value: "Heroku, AWS, Oracle DB, Lightning", source: "BuiltWith", confidence: 82 },
    recentNews: { value: "Launched Agentforce 2.0 AI platform (Feb 2026)", source: "TechCrunch", confidence: 94 },
    competitors: { value: "Microsoft Dynamics, HubSpot, Oracle CX", source: "Gartner", confidence: 92 },
  },
  snowflake: {
    name: { value: "Snowflake Inc.", source: "SEC EDGAR", confidence: 100 },
    domain: { value: "snowflake.com", source: "DNS Lookup", confidence: 100 },
    industry: { value: "Data & Analytics", source: "Bloomberg", confidence: 97 },
    subIndustry: { value: "Cloud Data Warehousing", source: "Gartner", confidence: 96 },
    revenue: { value: "$3.4B", source: "EDGAR 10-K (FY2025)", confidence: 99 },
    revenueGrowth: { value: "+32% YoY", source: "EDGAR 10-K (FY2025)", confidence: 99 },
    employees: { value: "7,200", source: "LinkedIn", confidence: 87 },
    headquarters: { value: "Bozeman, MT", source: "EDGAR 10-K", confidence: 100 },
    founded: { value: "2012", source: "Crunchbase", confidence: 100 },
    ceo: { value: "Sridhar Ramaswamy", source: "LinkedIn", confidence: 95 },
    stockTicker: { value: "SNOW (NYSE)", source: "Bloomberg", confidence: 100 },
    marketCap: { value: "$56B", source: "Bloomberg", confidence: 96 },
    filingType: { value: "10-K Annual Report", source: "SEC EDGAR", confidence: 100 },
    techStack: { value: "AWS, Azure, GCP, Apache Arrow", source: "BuiltWith", confidence: 80 },
    recentNews: { value: "Expanded Cortex AI with LLM fine-tuning (Jan 2026)", source: "VentureBeat", confidence: 91 },
    competitors: { value: "Databricks, Google BigQuery, Amazon Redshift", source: "Gartner", confidence: 93 },
  },
};

function getEnrichedData(input: string): EnrichedCompanyData {
  const lower = input.toLowerCase();
  if (lower.includes("salesforce") || lower.includes("sfdc")) return ENRICHMENT_DB.salesforce;
  if (lower.includes("snowflake") || lower.includes("snow")) return ENRICHMENT_DB.snowflake;
  // For any other input, use default but customize the name
  const data = { ...ENRICHMENT_DB.default };
  data.name = { ...data.name, value: input.trim() || "TechVista Solutions" };
  if (input.includes(".")) {
    data.domain = { ...data.domain, value: input.trim() };
    // Extract company name from domain
    const parts = input.replace(/^(https?:\/\/)?(www\.)?/, "").split(".");
    data.name = { ...data.name, value: parts[0].charAt(0).toUpperCase() + parts[0].slice(1) + " Inc." };
  }
  return data;
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
  const [, navigate] = useLocation();

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setStep(1);
      setData({ ...INITIAL_DATA });
      setCompanySearch("");
      setIsLaunching(false);
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
// Step 1: Company Selection with Enrichment Flow
// ═══════════════════════════════════════════════════════════════════

const ENRICHMENT_STEPS: Omit<EnrichmentStep, "status" | "fieldsFound" | "duration">[] = [
  { id: "dns", label: "Domain & DNS Lookup", source: "DNS / WHOIS", icon: Globe },
  { id: "edgar", label: "SEC EDGAR Filings", source: "SEC EDGAR", icon: Landmark },
  { id: "bloomberg", label: "Bloomberg Terminal", source: "Bloomberg", icon: TrendingUp },
  { id: "linkedin", label: "LinkedIn Company Profile", source: "LinkedIn", icon: Users },
  { id: "crunchbase", label: "Crunchbase & Funding", source: "Crunchbase", icon: BarChart3 },
  { id: "builtwith", label: "Tech Stack Analysis", source: "BuiltWith", icon: Database },
  { id: "news", label: "Recent News & Press", source: "Reuters / TechCrunch", icon: FileSearch },
];

function StepCompany({
  data,
  update,
  companySearch,
  setCompanySearch,
  filteredCompanies,
}: {
  data: WizardData;
  update: (p: Partial<WizardData>) => void;
  companySearch: string;
  setCompanySearch: (s: string) => void;
  filteredCompanies: CompanyIntelItem[];
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[14px] font-semibold">Select Company</h3>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            Choose an existing company or enrich a new one from external sources.
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
        <NewCompanyEnrichment data={data} update={update} />
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

// ─── New Company Enrichment Flow ────────────────────────────────────
function NewCompanyEnrichment({
  data,
  update,
}: {
  data: WizardData;
  update: (p: Partial<WizardData>) => void;
}) {
  const [steps, setSteps] = useState<EnrichmentStep[]>(
    ENRICHMENT_STEPS.map((s) => ({ ...s, status: "pending", fieldsFound: 0 }))
  );
  const [editingField, setEditingField] = useState<string | null>(null);
  const enrichingRef = useRef(false);

  const startEnrichment = useCallback(async () => {
    if (!data.enrichmentInput.trim() || enrichingRef.current) return;
    enrichingRef.current = true;
    update({ enrichmentState: "enriching", enrichedData: null });

    // Reset steps
    setSteps(ENRICHMENT_STEPS.map((s) => ({ ...s, status: "pending", fieldsFound: 0 })));

    const fieldsPerStep = [1, 4, 3, 2, 2, 1, 2];
    const durationsMs = [400, 900, 800, 600, 700, 500, 650];

    for (let i = 0; i < ENRICHMENT_STEPS.length; i++) {
      // Set current step to running
      setSteps((prev) =>
        prev.map((s, idx) => (idx === i ? { ...s, status: "running" } : s))
      );

      await new Promise((r) => setTimeout(r, durationsMs[i]));

      // Complete current step
      setSteps((prev) =>
        prev.map((s, idx) =>
          idx === i
            ? { ...s, status: "complete", fieldsFound: fieldsPerStep[i], duration: durationsMs[i] }
            : s
        )
      );
    }

    // All done — set enriched data
    const enrichedData = getEnrichedData(data.enrichmentInput);
    update({ enrichmentState: "complete", enrichedData });
    enrichingRef.current = false;
  }, [data.enrichmentInput, update]);

  const resetEnrichment = () => {
    enrichingRef.current = false;
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
              <h4 className="text-[13px] font-semibold text-foreground">Intelligent Company Enrichment</h4>
              <p className="text-[11px] text-muted-foreground">Enter a company name or domain to auto-populate from 7 external sources</p>
            </div>
          </div>

          <div className="relative mt-4">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400" />
            <input
              type="text"
              value={data.enrichmentInput}
              onChange={(e) => update({ enrichmentInput: e.target.value })}
              onKeyDown={(e) => { if (e.key === "Enter") startEnrichment(); }}
              placeholder="e.g. Salesforce, snowflake.com, or any company name..."
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
            <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Bloomberg</span>
            <span className="flex items-center gap-1"><Users className="w-3 h-3" /> LinkedIn</span>
            <span className="flex items-center gap-1"><BarChart3 className="w-3 h-3" /> Crunchbase</span>
            <span className="flex items-center gap-1"><Database className="w-3 h-3" /> BuiltWith</span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-muted-foreground bg-muted/30 rounded-lg px-3 py-2.5">
          <Info className="w-3.5 h-3.5 flex-shrink-0" />
          <span>Try entering <strong>"Salesforce"</strong> or <strong>"Snowflake"</strong> for a rich demo, or any company name for simulated enrichment.</span>
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
              Pulling data from {ENRICHMENT_STEPS.length} sources...
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
                  <span className="text-[10px] text-indigo-500 font-medium animate-pulse">Fetching...</span>
                )}
              </div>
            );
          })}
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
          { key: "subIndustry", label: "Sub-Industry", icon: Target },
          { key: "headquarters", label: "Headquarters", icon: MapPin },
          { key: "founded", label: "Founded", icon: Calendar },
          { key: "ceo", label: "CEO", icon: Users },
        ],
      },
      {
        title: "Financials",
        fields: [
          { key: "revenue", label: "Revenue", icon: DollarSign },
          { key: "revenueGrowth", label: "Revenue Growth", icon: TrendingUp },
          { key: "stockTicker", label: "Stock Ticker", icon: BarChart3 },
          { key: "marketCap", label: "Market Cap", icon: DollarSign },
          { key: "filingType", label: "Filing Type", icon: FileText },
        ],
      },
      {
        title: "Intelligence",
        fields: [
          { key: "employees", label: "Employees", icon: Users },
          { key: "techStack", label: "Tech Stack", icon: Database },
          { key: "recentNews", label: "Recent News", icon: FileSearch },
          { key: "competitors", label: "Competitors", icon: Shield },
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
                {totalFieldsFound} fields enriched from {completedSteps} sources
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
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

        {/* Edit hint */}
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
          <Info className="w-3 h-3 flex-shrink-0" />
          <span>Click any value to manually override. Overridden fields are marked with 100% confidence.</span>
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
                <CheckCircle2 className="w-3 h-3" /> 16 fields from 7 sources
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
