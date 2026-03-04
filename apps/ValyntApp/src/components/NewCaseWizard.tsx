/*
 * VALYNT New Case Wizard — Multi-step dialog for creating a new value case
 * Design: Atelier — clean, warm, progressive disclosure
 * Steps: 1. Company  2. Case Details  3. Value Model  4. Agent Config & Launch
 */
import { useState, useMemo } from "react";
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
  type ValueModel,
  type Agent,
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
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────
interface WizardData {
  // Step 1: Company
  companyId: string | null;
  newCompanyName: string;
  newCompanyIndustry: string;
  newCompanyRevenue: string;
  newCompanyEmployees: string;
  isNewCompany: boolean;
  // Step 2: Case Details
  caseTitle: string;
  caseDescription: string;
  caseType: string;
  priority: string;
  // Step 3: Value Model
  selectedModelIds: string[];
  // Step 4: Agent Config
  selectedAgentIds: string[];
  autoRunAgents: boolean;
}

const INITIAL_DATA: WizardData = {
  companyId: null,
  newCompanyName: "",
  newCompanyIndustry: "",
  newCompanyRevenue: "",
  newCompanyEmployees: "",
  isNewCompany: false,
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

const INDUSTRIES = [
  "Technology", "Manufacturing", "Financial Services", "Healthcare",
  "Retail", "Energy", "Telecommunications", "Media & Entertainment",
  "Government", "Education", "Other",
];

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

  // Reset on close
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setStep(1);
      setData({ ...INITIAL_DATA });
      setCompanySearch("");
      setIsLaunching(false);
    }
    onOpenChange(open);
  };

  // Filtered companies
  const filteredCompanies = useMemo(() => {
    if (!companySearch) return companyIntel;
    const q = companySearch.toLowerCase();
    return companyIntel.filter(
      (c) =>
        c.company.toLowerCase().includes(q) ||
        c.industry.toLowerCase().includes(q)
    );
  }, [companySearch]);

  // Selected company object
  const selectedCompany = useMemo(
    () => companyIntel.find((c) => c.id === data.companyId) || null,
    [data.companyId]
  );

  // Validation per step
  const canAdvance = useMemo(() => {
    switch (step) {
      case 1:
        return data.isNewCompany
          ? data.newCompanyName.trim().length > 0
          : data.companyId !== null;
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
    // Simulate API call
    await new Promise((r) => setTimeout(r, 1800));
    const companyName = data.isNewCompany
      ? data.newCompanyName
      : selectedCompany?.company || "Unknown";
    toast.success(`Case "${data.caseTitle}" created for ${companyName}`, {
      description: "Agents are now running the Hypothesis stage.",
    });
    handleOpenChange(false);
    // Navigate to the new case (mock — would use real ID from API)
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
              const Icon = s.icon;
              return (
                <div key={s.id} className="flex items-center">
                  <button
                    onClick={() => {
                      if (s.id < step) setStep(s.id);
                    }}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all text-[12px]",
                      isActive && "bg-foreground text-background font-semibold",
                      isComplete && "text-foreground cursor-pointer hover:bg-accent",
                      !isActive && !isComplete && "text-muted-foreground cursor-default"
                    )}
                  >
                    <div
                      className={cn(
                        "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold",
                        isActive && "bg-background text-foreground",
                        isComplete && "bg-emerald-500 text-white",
                        !isActive && !isComplete && "bg-muted text-muted-foreground"
                      )}
                    >
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
            <StepLaunch
              data={data}
              update={update}
              selectedCompany={selectedCompany}
            />
          )}
        </div>

        {/* ─── Footer ─── */}
        <div className="border-t border-border px-6 py-3.5 flex items-center justify-between bg-muted/20">
          <div className="text-[11px] text-muted-foreground">
            Step {step} of {STEPS.length}
          </div>
          <div className="flex items-center gap-2">
            {step > 1 && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-[12px]"
                onClick={() => setStep((s) => s - 1)}
              >
                <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                Back
              </Button>
            )}
            {step < 4 ? (
              <Button
                size="sm"
                className="h-8 text-[12px] bg-foreground text-background hover:bg-foreground/90"
                disabled={!canAdvance}
                onClick={() => setStep((s) => s + 1)}
              >
                Continue
                <ChevronRight className="w-3.5 h-3.5 ml-1" />
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
                    <Rocket className="w-3.5 h-3.5 mr-1.5" />
                    Launch Case
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
// Step 1: Company Selection
// ═══════════════════════════════════════════════════════════════════
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
            Choose an existing company from your intel database or add a new one.
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
            update({ isNewCompany: !data.isNewCompany, companyId: null })
          }
        >
          <Plus className="w-3 h-3 mr-1" />
          New Company
        </Button>
      </div>

      {data.isNewCompany ? (
        /* ─── New Company Form ─── */
        <div className="space-y-3 bg-muted/30 rounded-xl p-4 border border-border">
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
              Company Name *
            </label>
            <input
              type="text"
              value={data.newCompanyName}
              onChange={(e) => update({ newCompanyName: e.target.value })}
              placeholder="e.g. Acme Corporation"
              className="w-full h-9 px-3 rounded-lg border border-input bg-background text-[13px] placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                Industry
              </label>
              <select
                value={data.newCompanyIndustry}
                onChange={(e) => update({ newCompanyIndustry: e.target.value })}
                className="w-full h-9 px-3 rounded-lg border border-input bg-background text-[13px] focus:outline-none focus:ring-2 focus:ring-ring/20"
              >
                <option value="">Select...</option>
                {INDUSTRIES.map((ind) => (
                  <option key={ind} value={ind}>
                    {ind}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                Revenue
              </label>
              <input
                type="text"
                value={data.newCompanyRevenue}
                onChange={(e) => update({ newCompanyRevenue: e.target.value })}
                placeholder="e.g. $2.4B"
                className="w-full h-9 px-3 rounded-lg border border-input bg-background text-[13px] placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                Employees
              </label>
              <input
                type="text"
                value={data.newCompanyEmployees}
                onChange={(e) => update({ newCompanyEmployees: e.target.value })}
                placeholder="e.g. 12,400"
                className="w-full h-9 px-3 rounded-lg border border-input bg-background text-[13px] placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-[11px] text-muted-foreground">
              Agents will automatically enrich company data from EDGAR, Bloomberg, and public sources after launch.
            </span>
          </div>
        </div>
      ) : (
        /* ─── Existing Company List ─── */
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
                  <div
                    className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center text-[11px] font-bold flex-shrink-0",
                      selected
                        ? "bg-foreground text-background"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {company.company.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold truncate">
                        {company.company}
                      </span>
                      <Badge
                        variant="outline"
                        className="text-[9px] px-1.5 py-0 h-4 font-medium"
                      >
                        {company.industry}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        {company.revenue}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {company.employees}
                      </span>
                      <span className="flex items-center gap-1">
                        <Globe className="w-3 h-3" />
                        {company.source}
                      </span>
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

      {/* Title */}
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

      {/* Description */}
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

      {/* Case Type */}
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
                <Icon
                  className={cn(
                    "w-4 h-4",
                    selected ? "text-foreground" : "text-muted-foreground"
                  )}
                />
                <span className="text-[12px] font-semibold">{ct.label}</span>
                <span className="text-[10px] text-muted-foreground leading-tight">
                  {ct.desc}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Priority */}
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
              <div
                className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5",
                  selected
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {selected ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Target className="w-4 h-4" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold">{model.name}</span>
                  <Badge
                    variant="outline"
                    className="text-[9px] px-1.5 py-0 h-4 font-medium"
                  >
                    {model.category}
                  </Badge>
                  <Badge
                    className={cn(
                      "text-[9px] px-1.5 py-0 h-4 font-medium",
                      model.status === "active"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-700"
                    )}
                  >
                    {model.status}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                  {model.description}
                </p>
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
        <span>
          Selected models will be used to build the Value Tree in the Model stage.
          You can add or remove models later from the case canvas.
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
    ? data.newCompanyName
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
      {/* Summary Card */}
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
            <span className="text-muted-foreground">Models</span>
            <span className="font-medium">
              {data.selectedModelIds.length} selected
            </span>
          </div>
        </div>
      </div>

      {/* Agent Selection */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="text-[14px] font-semibold">Agent Configuration</h3>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              Select which agents to activate for this case.
            </p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-[11px] text-muted-foreground">Auto-run</span>
            <button
              onClick={() => update({ autoRunAgents: !data.autoRunAgents })}
              className={cn(
                "w-8 h-4.5 rounded-full transition-colors relative",
                data.autoRunAgents ? "bg-emerald-500" : "bg-muted"
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
                <div
                  className={cn(
                    "w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0",
                    selected
                      ? "bg-foreground text-background"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[12px] font-semibold block truncate">
                    {agent.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    v{agent.version} · {agent.successRate}% success
                  </span>
                </div>
                {selected && (
                  <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Launch info */}
      {data.autoRunAgents && (
        <div className="flex items-start gap-2 text-[11px] text-amber-700 bg-amber-50 rounded-lg px-3 py-2.5 border border-amber-200">
          <Zap className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>
            <strong>Auto-run enabled:</strong> Selected agents will immediately begin
            the Hypothesis stage — fetching company data, extracting financials, and
            generating initial claims. You'll receive a notification when human review
            is needed.
          </span>
        </div>
      )}
    </div>
  );
}
