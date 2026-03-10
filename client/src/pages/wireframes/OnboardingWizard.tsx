/**
 * ValueOS Wireframes — Tenant Onboarding Wizard
 * Sprint 16: Enterprise tenant onboarding — submit website, product, ICP, competitors
 * First-run experience for enterprise pilots
 */
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Globe, Building2, Users, Swords, CheckCircle2,
  ArrowRight, ArrowLeft, Loader2, Sparkles, Upload,
  FileText, Target, Search, Plus, X, ChevronRight
} from "lucide-react";
import { useState } from "react";

/* ------------------------------------------------------------------ */
/*  Step definitions                                                   */
/* ------------------------------------------------------------------ */
const steps = [
  { id: 1, label: "Company", icon: Building2, description: "Tell us about your company" },
  { id: 2, label: "Product", icon: FileText, description: "Describe your product or service" },
  { id: 3, label: "ICP", icon: Target, description: "Define your ideal customer profile" },
  { id: 4, label: "Competitors", icon: Swords, description: "Identify your competitive landscape" },
  { id: 5, label: "Review", icon: CheckCircle2, description: "Review and launch ingestion" },
];

/* ------------------------------------------------------------------ */
/*  Mock ingestion status                                              */
/* ------------------------------------------------------------------ */
const ingestionSteps = [
  { label: "Crawling website", status: "complete" as const, detail: "142 pages indexed" },
  { label: "Extracting product capabilities", status: "complete" as const, detail: "23 capabilities identified" },
  { label: "Building industry benchmarks", status: "running" as const, detail: "Matching SIC codes..." },
  { label: "Generating domain pack", status: "pending" as const, detail: "" },
  { label: "Seeding hypothesis templates", status: "pending" as const, detail: "" },
];

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */
export default function OnboardingWizard() {
  const [currentStep, setCurrentStep] = useState(1);
  const [ingesting, setIngesting] = useState(false);
  const [websiteUrl, setWebsiteUrl] = useState("https://initech.com");
  const [companyName, setCompanyName] = useState("Initech");
  const [industry, setIndustry] = useState("Enterprise Software");
  const [competitors, setCompetitors] = useState(["Globex Corp", "Umbrella Inc"]);
  const [newCompetitor, setNewCompetitor] = useState("");

  const canAdvance = currentStep < 5;
  const canGoBack = currentStep > 1;

  return (
    <div className="h-screen flex flex-col md:flex-row bg-background overflow-hidden">
      {/* Left panel — Steps (hidden on mobile, shown as top bar) */}
      <div className="hidden md:flex w-72 border-r border-border flex-col shrink-0 bg-card/50">
        {/* Logo */}
        <div className="h-14 border-b border-border flex items-center px-5 gap-2">
          <div className="w-7 h-7 rounded bg-primary/20 flex items-center justify-center">
            <span className="text-primary text-[10px] font-bold font-mono">V</span>
          </div>
          <span className="text-sm font-semibold">ValueOS Setup</span>
        </div>

        {/* Step list */}
        <div className="flex-1 p-4">
          <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mb-4">Onboarding Steps</p>
          <div className="space-y-1">
            {steps.map((step, i) => {
              const isActive = step.id === currentStep;
              const isComplete = step.id < currentStep || ingesting;
              return (
                <button
                  key={step.id}
                  onClick={() => !ingesting && setCurrentStep(step.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                    isActive ? "bg-primary/10 border border-primary/20" :
                    isComplete ? "text-health/80 hover:bg-muted" :
                    "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-mono shrink-0 ${
                    isComplete ? "bg-health/15 text-health" :
                    isActive ? "bg-primary/15 text-primary" :
                    "bg-muted text-muted-foreground"
                  }`}>
                    {isComplete ? <CheckCircle2 className="w-3.5 h-3.5" /> : step.id}
                  </div>
                  <div>
                    <p className={`text-[11px] font-medium ${isActive ? "text-foreground" : ""}`}>{step.label}</p>
                    <p className="text-[9px] text-muted-foreground/60">{step.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Help */}
        <div className="p-4 border-t border-border">
          <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
            <div className="flex items-center gap-1.5 mb-1">
              <Sparkles className="w-3 h-3 text-primary" />
              <span className="text-[10px] font-medium text-primary">AI-Assisted Setup</span>
            </div>
            <p className="text-[9px] text-muted-foreground leading-relaxed">
              ValueOS will crawl your website and public data to pre-populate benchmarks, KPI templates, and hypothesis seeds for your industry.
            </p>
          </div>
        </div>
      </div>

      {/* Mobile step indicator */}
      <div className="md:hidden flex items-center gap-1.5 px-4 py-3 border-b border-border bg-card/50">
        <div className="w-6 h-6 rounded bg-primary/20 flex items-center justify-center">
          <span className="text-primary text-[9px] font-bold font-mono">V</span>
        </div>
        <span className="text-[11px] font-semibold">Step {currentStep}/{steps.length}</span>
        <div className="flex-1 flex gap-1 ml-2">
          {steps.map((s) => (
            <div key={s.id} className={`h-1 flex-1 rounded-full transition-colors ${s.id <= currentStep ? 'bg-primary' : 'bg-muted'}`} />
          ))}
        </div>
      </div>

      {/* Right panel — Step content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-14 border-b border-border flex items-center px-4 md:px-6 shrink-0">
          <div>
            <h1 className="text-sm font-semibold">{steps[currentStep - 1].description}</h1>
            <p className="text-[10px] text-muted-foreground">Step {currentStep} of {steps.length}</p>
          </div>
          <div className="ml-auto">
            <Link href="/wireframes">
              <span className="text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer">Skip for now</span>
            </Link>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-xl mx-auto">
            <AnimatePresence mode="wait">
              {/* Step 1: Company */}
              {currentStep === 1 && (
                <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                  <div>
                    <label className="text-[11px] font-medium text-foreground mb-1.5 block">Company Website</label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 flex items-center h-9 rounded-md border border-border bg-input px-3 gap-2">
                        <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                        <input
                          type="text"
                          value={websiteUrl}
                          onChange={(e) => setWebsiteUrl(e.target.value)}
                          className="flex-1 bg-transparent text-sm outline-none"
                          placeholder="https://yourcompany.com"
                        />
                      </div>
                      <button className="h-9 px-3 rounded-md bg-primary/15 text-[11px] text-primary hover:bg-primary/25 transition-colors flex items-center gap-1.5">
                        <Search className="w-3 h-3" />
                        Crawl
                      </button>
                    </div>
                    <p className="text-[9px] text-muted-foreground mt-1">We'll crawl your website to extract product info, pricing, and positioning.</p>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-foreground mb-1.5 block">Company Name</label>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="w-full h-9 rounded-md border border-border bg-input px-3 text-sm outline-none"
                      placeholder="Acme Corp"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-foreground mb-1.5 block">Industry</label>
                    <input
                      type="text"
                      value={industry}
                      onChange={(e) => setIndustry(e.target.value)}
                      className="w-full h-9 rounded-md border border-border bg-input px-3 text-sm outline-none"
                      placeholder="e.g., Enterprise Software, Financial Services"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-foreground mb-1.5 block">Company Size</label>
                    <div className="grid grid-cols-4 gap-2">
                      {["1-50", "51-200", "201-1000", "1000+"].map((size) => (
                        <button key={size} className="h-9 rounded-md border border-border text-[11px] text-muted-foreground hover:border-primary/30 hover:text-foreground transition-colors">
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Step 2: Product */}
              {currentStep === 2 && (
                <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                  <div>
                    <label className="text-[11px] font-medium text-foreground mb-1.5 block">Product / Service Description</label>
                    <textarea
                      className="w-full h-32 rounded-md border border-border bg-input px-3 py-2 text-sm outline-none resize-none"
                      placeholder="Describe what your product or service does, the problems it solves, and the value it delivers to customers..."
                      defaultValue="Initech provides enterprise process automation software that reduces manual workflows by 40-60%, enabling organizations to reallocate FTEs to higher-value activities."
                    />
                    <p className="text-[9px] text-muted-foreground mt-1">This helps the AI generate relevant value hypotheses and KPI templates.</p>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-foreground mb-1.5 block">Key Value Drivers</label>
                    <div className="space-y-2">
                      {["Cost reduction", "Revenue growth", "Risk mitigation", "Operational efficiency"].map((driver) => (
                        <div key={driver} className="flex items-center gap-2 p-2.5 rounded-md border border-border hover:border-primary/20 transition-colors">
                          <div className="w-4 h-4 rounded border border-primary/30 bg-primary/10 flex items-center justify-center">
                            <CheckCircle2 className="w-3 h-3 text-primary" />
                          </div>
                          <span className="text-[11px]">{driver}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-foreground mb-1.5 block">Upload Materials (Optional)</label>
                    <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/20 transition-colors">
                      <Upload className="w-5 h-5 text-muted-foreground mx-auto mb-2" />
                      <p className="text-[11px] text-muted-foreground">Drop pitch decks, case studies, or ROI calculators</p>
                      <p className="text-[9px] text-muted-foreground/60 mt-1">PDF, PPTX, XLSX — max 25MB each</p>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Step 3: ICP */}
              {currentStep === 3 && (
                <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                  <div>
                    <label className="text-[11px] font-medium text-foreground mb-1.5 block">Ideal Customer Profile</label>
                    <textarea
                      className="w-full h-24 rounded-md border border-border bg-input px-3 py-2 text-sm outline-none resize-none"
                      placeholder="Describe your ideal customer..."
                      defaultValue="Mid-market to enterprise companies (500-10,000 employees) in manufacturing, financial services, or healthcare with high-volume manual processes and regulatory compliance requirements."
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-foreground mb-1.5 block">Target Personas</label>
                    <div className="space-y-2">
                      {[
                        { title: "VP Operations", role: "Economic Buyer", priority: "Primary" },
                        { title: "CFO", role: "Financial Approver", priority: "Primary" },
                        { title: "IT Director", role: "Technical Evaluator", priority: "Secondary" },
                        { title: "Process Owner", role: "End User Champion", priority: "Secondary" },
                      ].map((persona) => (
                        <div key={persona.title} className="flex items-center gap-3 p-3 rounded-md border border-border">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <Users className="w-4 h-4 text-primary" />
                          </div>
                          <div className="flex-1">
                            <p className="text-[11px] font-medium">{persona.title}</p>
                            <p className="text-[9px] text-muted-foreground">{persona.role}</p>
                          </div>
                          <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                            persona.priority === "Primary" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                          }`}>{persona.priority}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-foreground mb-1.5 block">Typical Deal Size</label>
                    <div className="grid grid-cols-4 gap-2">
                      {["<$50K", "$50K-$200K", "$200K-$1M", "$1M+"].map((size) => (
                        <button key={size} className="h-9 rounded-md border border-border text-[11px] text-muted-foreground hover:border-primary/30 hover:text-foreground transition-colors">
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Step 4: Competitors */}
              {currentStep === 4 && (
                <motion.div key="step4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                  <div>
                    <label className="text-[11px] font-medium text-foreground mb-1.5 block">Key Competitors</label>
                    <div className="space-y-2 mb-3">
                      {competitors.map((comp) => (
                        <div key={comp} className="flex items-center gap-2 p-2.5 rounded-md border border-border">
                          <Swords className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-[11px] flex-1">{comp}</span>
                          <button onClick={() => setCompetitors(competitors.filter(c => c !== comp))} className="text-muted-foreground hover:text-risk transition-colors">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={newCompetitor}
                        onChange={(e) => setNewCompetitor(e.target.value)}
                        className="flex-1 h-9 rounded-md border border-border bg-input px-3 text-sm outline-none"
                        placeholder="Add competitor..."
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && newCompetitor.trim()) {
                            setCompetitors([...competitors, newCompetitor.trim()]);
                            setNewCompetitor("");
                          }
                        }}
                      />
                      <button
                        onClick={() => {
                          if (newCompetitor.trim()) {
                            setCompetitors([...competitors, newCompetitor.trim()]);
                            setNewCompetitor("");
                          }
                        }}
                        className="h-9 px-3 rounded-md bg-muted text-[11px] text-muted-foreground hover:bg-accent transition-colors flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        Add
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-foreground mb-1.5 block">Competitive Positioning</label>
                    <textarea
                      className="w-full h-24 rounded-md border border-border bg-input px-3 py-2 text-sm outline-none resize-none"
                      placeholder="How do you differentiate from competitors?"
                      defaultValue="Unlike Globex (manual ROI calculators) and Umbrella (generic automation), Initech provides AI-driven process discovery that identifies automation opportunities 3x faster with quantified business impact."
                    />
                  </div>
                </motion.div>
              )}

              {/* Step 5: Review & Launch */}
              {currentStep === 5 && (
                <motion.div key="step5" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                  {!ingesting ? (
                    <>
                      <div className="p-4 rounded-lg border border-border bg-card">
                        <h3 className="text-[11px] font-medium mb-3">Review Your Setup</h3>
                        <div className="space-y-3">
                          {[
                            { label: "Company", value: `${companyName} · ${industry}` },
                            { label: "Website", value: websiteUrl },
                            { label: "Competitors", value: competitors.join(", ") },
                          ].map((item) => (
                            <div key={item.label} className="flex items-start gap-3">
                              <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider w-20 shrink-0 pt-0.5">{item.label}</span>
                              <span className="text-[11px] text-foreground">{item.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="p-4 rounded-lg bg-primary/5 border border-primary/15">
                        <div className="flex items-center gap-2 mb-2">
                          <Sparkles className="w-4 h-4 text-primary" />
                          <h3 className="text-[11px] font-medium text-primary">What happens next</h3>
                        </div>
                        <ul className="space-y-1.5 text-[11px] text-muted-foreground">
                          <li className="flex items-start gap-2">
                            <ChevronRight className="w-3 h-3 text-primary mt-0.5 shrink-0" />
                            ValueOS crawls your website and extracts product capabilities
                          </li>
                          <li className="flex items-start gap-2">
                            <ChevronRight className="w-3 h-3 text-primary mt-0.5 shrink-0" />
                            Industry benchmarks and KPI templates are matched to your sector
                          </li>
                          <li className="flex items-start gap-2">
                            <ChevronRight className="w-3 h-3 text-primary mt-0.5 shrink-0" />
                            A custom Domain Pack is generated with hypothesis seeds and assumption templates
                          </li>
                          <li className="flex items-start gap-2">
                            <ChevronRight className="w-3 h-3 text-primary mt-0.5 shrink-0" />
                            Competitor intelligence is indexed for Red Team agent use
                          </li>
                        </ul>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 mb-4">
                        <Loader2 className="w-4 h-4 text-primary animate-spin" />
                        <h3 className="text-sm font-medium">Ingesting your company context...</h3>
                      </div>
                      {ingestionSteps.map((step, i) => (
                        <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                            step.status === "complete" ? "bg-health/15 text-health" :
                            step.status === "running" ? "bg-primary/15 text-primary" :
                            "bg-muted text-muted-foreground/40"
                          }`}>
                            {step.status === "complete" ? <CheckCircle2 className="w-3 h-3" /> :
                             step.status === "running" ? <Loader2 className="w-3 h-3 animate-spin" /> :
                             <span className="text-[8px] font-mono">{i + 1}</span>}
                          </div>
                          <div className="flex-1">
                            <p className={`text-[11px] font-medium ${step.status === "pending" ? "text-muted-foreground/40" : ""}`}>{step.label}</p>
                            {step.detail && (
                              <p className={`text-[9px] ${step.status === "running" ? "text-primary" : "text-muted-foreground"}`}>{step.detail}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Footer — navigation buttons */}
        <div className="h-16 border-t border-border flex items-center justify-between px-8 shrink-0">
          <button
            onClick={() => canGoBack && setCurrentStep(currentStep - 1)}
            className={`h-9 px-4 rounded-md text-[11px] flex items-center gap-1.5 transition-colors ${
              canGoBack ? "bg-muted text-foreground hover:bg-accent" : "text-muted-foreground/30 cursor-not-allowed"
            }`}
            disabled={!canGoBack}
          >
            <ArrowLeft className="w-3 h-3" />
            Back
          </button>

          {currentStep === 5 && !ingesting ? (
            <button
              onClick={() => setIngesting(true)}
              className="h-9 px-5 rounded-md bg-primary text-primary-foreground text-[11px] font-medium flex items-center gap-1.5 hover:bg-primary/90 transition-colors"
            >
              <Sparkles className="w-3 h-3" />
              Launch Ingestion
            </button>
          ) : canAdvance ? (
            <button
              onClick={() => setCurrentStep(currentStep + 1)}
              className="h-9 px-5 rounded-md bg-primary text-primary-foreground text-[11px] font-medium flex items-center gap-1.5 hover:bg-primary/90 transition-colors"
            >
              Continue
              <ArrowRight className="w-3 h-3" />
            </button>
          ) : ingesting ? (
            <Link href="/wireframes/command-center">
              <span className="h-9 px-5 rounded-md bg-health text-background text-[11px] font-medium flex items-center gap-1.5 cursor-pointer">
                Go to Command Center
                <ArrowRight className="w-3 h-3" />
              </span>
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
