import { Building2, Globe, Loader2, Package, Plus, Sparkles, X } from "lucide-react";
import { useState } from "react";

import type { OnboardingPhase1Input } from "@/hooks/company-context/types";
import type { ResearchJob, ResearchSuggestion } from "@/hooks/company-context/types";
import { cn } from "@/lib/utils";

interface Props {
  onNext: (
    data: OnboardingPhase1Input,
    researchJobId?: string,
    options?: { fastTrack: boolean }
  ) => void;
  researchJob?: ResearchJob | null;
  researchSuggestions?: ResearchSuggestion[];
  onStartResearch?: (
    website: string,
    industry: string,
    companySize: string | null,
    salesMotion: string | null,
    ticker?: string
  ) => void;
  isResearching?: boolean;
}

export function Phase1Company({ onNext, researchJob, researchSuggestions, onStartResearch, isResearching }: Props) {
  const [companyName, setCompanyName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [industry, setIndustry] = useState("");
  const [ticker, setTicker] = useState("");
  const [companySize, setCompanySize] = useState<OnboardingPhase1Input["company_size"]>(null);
  const [salesMotion, setSalesMotion] = useState<OnboardingPhase1Input["sales_motion"]>(null);
  const [fastTrackMode, setFastTrackMode] = useState(true);
  const [products, setProducts] = useState<OnboardingPhase1Input["products"]>([
    { name: "", description: "", product_type: "platform" },
  ]);

  // Pre-populate products from suggestions when research completes
  const productSuggestions = researchSuggestions?.filter(
    (s) => s.entity_type === "product" && s.status === "suggested"
  ) ?? [];

  const hasResearchCompleted = researchJob?.status === "completed";
  const hasResearchFailed = researchJob?.status === "failed";
  const isResearchRunning = researchJob?.status === "running" || researchJob?.status === "queued";

  const [hasPrePopulated, setHasPrePopulated] = useState(false);
  if (hasResearchCompleted && productSuggestions.length > 0 && !hasPrePopulated) {
    const suggestedProducts = productSuggestions.map((s) => ({
      name: (s.payload as Record<string, string>).name ?? "",
      description: (s.payload as Record<string, string>).description ?? "",
      product_type: ((s.payload as Record<string, string>).product_type ?? "platform") as OnboardingPhase1Input["products"][0]["product_type"],
    }));
    const existingFilled = products.filter((p) => p.name.trim().length > 0);
    setProducts([...existingFilled, ...suggestedProducts]);
    setHasPrePopulated(true);
  }

  const addProduct = () => setProducts([...products, { name: "", description: "", product_type: "module" }]);
  const removeProduct = (i: number) => setProducts(products.filter((_, idx) => idx !== i));
  const updateProduct = (i: number, field: string, value: string) => {
    setProducts(products.map((p, idx) => (idx === i ? { ...p, [field]: value } : p)));
  };

  const canProceed = companyName.trim().length > 0 && products.some((p) => p.name.trim().length > 0);
  const canAutoFill = websiteUrl.trim().length > 0 && websiteUrl.includes(".") && !isResearching && !isResearchRunning;

  const handleSubmit = () => {
    onNext(
      {
        company_name: companyName.trim(),
        website_url: websiteUrl.trim(),
        industry: industry.trim(),
        ticker: ticker.trim() || undefined,
        company_size: companySize,
        sales_motion: salesMotion,
        products: products.filter((p) => p.name.trim().length > 0),
      },
      researchJob?.id,
      { fastTrack: fastTrackMode },
    );
  };

  const handleAutoFill = () => {
    if (onStartResearch && canAutoFill) {
      onStartResearch(websiteUrl.trim(), industry.trim(), companySize, salesMotion, ticker.trim());
    }
  };

  const sizeOptions: Array<{ value: OnboardingPhase1Input["company_size"]; label: string }> = [
    { value: "smb", label: "SMB" },
    { value: "mid_market", label: "Mid-Market" },
    { value: "enterprise", label: "Enterprise" },
  ];

  const motionOptions: Array<{ value: OnboardingPhase1Input["sales_motion"]; label: string }> = [
    { value: "new_logo", label: "New Logo" },
    { value: "expansion", label: "Expansion" },
    { value: "land_and_expand", label: "Land & Expand" },
    { value: "renewal", label: "Renewal" },
  ];

  const entityStatus = researchJob?.entity_status ?? {};
  const entityTypes = ["product", "competitor", "persona", "claim", "capability", "value_pattern", "sec_filing"];

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
            <Building2 className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-[16px] font-black text-zinc-950 tracking-tight">Your Company</h2>
            <p className="text-[12px] text-muted-foreground">Tell us about your business so every value case starts smarter</p>
          </div>
        </div>
      </div>

      {/* Company basics */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground mb-1.5 block">
            Company Name *
          </label>
          <input
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="e.g. Acme Corp"
            className="w-full px-4 py-3 rounded-xl border border-border text-[13px] bg-card placeholder:text-muted-foreground outline-none focus:border-zinc-400 transition-colors"
          />
        </div>
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground mb-1.5 block">
            Website
          </label>
          <div className="relative">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="https://acme.com"
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-border text-[13px] bg-card placeholder:text-muted-foreground outline-none focus:border-zinc-400 transition-colors"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground mb-1.5 block">
            Industry
          </label>
          <input
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            placeholder="e.g. SaaS, FinTech"
            className="w-full px-4 py-3 rounded-xl border border-border text-[13px] bg-card placeholder:text-muted-foreground outline-none focus:border-zinc-400 transition-colors"
          />
        </div>
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground mb-1.5 block">
            Ticker / CIK (optional)
          </label>
          <input
            value={ticker}
            onChange={(e) => setTicker(e.target.value)}
            placeholder="e.g. MSFT or 0000789019"
            className="w-full px-4 py-3 rounded-xl border border-border text-[13px] bg-card placeholder:text-muted-foreground outline-none focus:border-zinc-400 transition-colors"
          />
        </div>
      </div>

      {/* Company size */}
      <div>
        <label className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground mb-2 block">
          Company Size
        </label>
        <div className="flex gap-2">
          {sizeOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setCompanySize(opt.value)}
              className={cn(
                "flex-1 py-2.5 rounded-xl border text-[12px] font-medium transition-colors",
                companySize === opt.value
                  ? "border-zinc-950 bg-background text-white"
                  : "border-border text-muted-foreground hover:border-border"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sales motion */}
      <div>
        <label className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground mb-2 block">
          Primary Sales Motion
        </label>
        <div className="flex gap-2">
          {motionOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSalesMotion(opt.value)}
              className={cn(
                "flex-1 py-2.5 rounded-xl border text-[12px] font-medium transition-colors",
                salesMotion === opt.value
                  ? "border-zinc-950 bg-background text-white"
                  : "border-border text-muted-foreground hover:border-border"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Auto-fill from website */}
      {onStartResearch && (
        <div className="space-y-3">
          <div className="p-4 rounded-xl border border-border bg-card">
            <button
              type="button"
              onClick={() => setFastTrackMode((prev) => !prev)}
              className="w-full flex items-start justify-between gap-3 text-left"
            >
              <div>
                <p className="text-[13px] font-semibold text-foreground">Fast-track onboarding</p>
                <p className="text-[12px] text-muted-foreground mt-1">
                  Use an AI research agent to scan your website and public signals, then preload competitors,
                  personas, and claims so you can review and launch faster.
                </p>
              </div>
              <span
                className={cn(
                  "mt-0.5 inline-flex h-6 min-w-11 items-center rounded-full p-1 transition-colors",
                  fastTrackMode ? "bg-background" : "bg-zinc-300"
                )}
                aria-label="Toggle fast-track onboarding"
              >
                <span
                  className={cn(
                    "h-4 w-4 rounded-full bg-card transition-transform",
                    fastTrackMode ? "translate-x-5" : "translate-x-0"
                  )}
                />
              </span>
            </button>
          </div>

          {!researchJob && (
            <button
              onClick={handleAutoFill}
              disabled={!canAutoFill}
              className={cn(
                "w-full flex items-center justify-center gap-2 py-3 rounded-xl border text-[12px] font-medium transition-colors",
                canAutoFill
                  ? "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                  : "border-border bg-surface text-muted-foreground cursor-not-allowed"
              )}
            >
              <Sparkles className="w-4 h-4" />
              {fastTrackMode ? "Run AI fast-track research" : "Auto-fill from website"}
            </button>
          )}

          {(isResearchRunning || isResearching) && (
            <div className="p-4 rounded-xl border border-blue-100 bg-blue-50/50 space-y-3">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                <span className="text-[12px] font-medium text-blue-700">Analyzing website...</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {entityTypes.map((et) => {
                  const status = entityStatus[et] ?? "pending";
                  const statusColors: Record<string, string> = {
                    pending: "bg-muted text-muted-foreground",
                    running: "bg-blue-100 text-blue-600",
                    completed: "bg-emerald-100 text-emerald-700",
                    done: "bg-emerald-100 text-emerald-700",
                    failed: "bg-red-100 text-red-600",
                  };
                  return (
                    <div
                      key={et}
                      className={cn(
                        "px-2 py-1.5 rounded-lg text-[10px] font-medium text-center capitalize",
                        statusColors[status] ?? "bg-muted text-muted-foreground"
                      )}
                    >
                      {et.replace("_", " ")}
                      {status === "running" && (
                        <Loader2 className="w-3 h-3 inline ml-1 animate-spin" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {hasResearchCompleted && (
            <div className="p-3 rounded-xl border border-emerald-100 bg-emerald-50/50 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span className="text-[12px] text-emerald-700 font-medium">
                Research complete — products pre-populated below. Suggestions for competitors, personas, and claims will appear in the next steps.
              </span>
            </div>
          )}

          {hasResearchFailed && (
            <div className="p-3 rounded-xl border border-red-100 bg-red-50/50">
              <span className="text-[12px] text-red-700">
                Research failed: {researchJob?.error_message ?? "Unknown error"}. You can continue manually.
              </span>
            </div>
          )}
        </div>
      )}

      {/* Products */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Products / Solutions *
          </label>
          <button
            onClick={addProduct}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-muted-foreground transition-colors"
          >
            <Plus className="w-3 h-3" /> Add
          </button>
        </div>
        <div className="space-y-3">
          {products.map((p, i) => (
            <div key={i} className="flex items-start gap-3 p-4 rounded-xl border border-border bg-surface/50">
              <Package className="w-4 h-4 text-muted-foreground mt-2.5 flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <input
                  value={p.name}
                  onChange={(e) => updateProduct(i, "name", e.target.value)}
                  placeholder="Product name"
                  className="w-full px-3 py-2 rounded-lg border border-border text-[13px] bg-card placeholder:text-muted-foreground outline-none focus:border-zinc-400"
                />
                <input
                  value={p.description}
                  onChange={(e) => updateProduct(i, "description", e.target.value)}
                  placeholder="Brief description — what does it do for customers?"
                  className="w-full px-3 py-2 rounded-lg border border-border text-[13px] bg-card placeholder:text-muted-foreground outline-none focus:border-zinc-400"
                />
                <select
                  value={p.product_type ?? "platform"}
                  onChange={(e) => updateProduct(i, "product_type", e.target.value)}
                  className="px-3 py-2 rounded-lg border border-border text-[12px] bg-card text-muted-foreground outline-none"
                >
                  <option value="platform">Platform</option>
                  <option value="module">Module</option>
                  <option value="service">Service</option>
                  <option value="add_on">Add-on</option>
                </select>
              </div>
              {products.length > 1 && (
                <button onClick={() => removeProduct(i)} className="p-1 rounded hover:bg-muted/70 mt-2">
                  <X className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Next */}
      <div className="flex justify-end pt-2">
        <button
          onClick={handleSubmit}
          disabled={!canProceed}
          className={cn(
            "px-6 py-3 rounded-xl text-[13px] font-medium transition-colors",
            canProceed
              ? "bg-background text-white hover:bg-surface-elevated"
              : "bg-muted text-muted-foreground cursor-not-allowed"
          )}
        >
          Continue
        </button>
      </div>
    </div>
  );
}
