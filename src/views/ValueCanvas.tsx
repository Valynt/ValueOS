import { useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  FolderOpen,
  Globe,
  Link2,
  Loader2,
  Mail,
  Mic,
  Plus,
  Sparkles,
} from "lucide-react";
import Header from "../components/Layout/Header";
import AgentBadge from "../components/Agents/AgentBadge";
import Tooltip from "../components/UI/Tooltip";
import EmptyState from "../components/UI/EmptyState";

const quickActions = [
  {
    icon: Mic,
    label: "Analyze Sales Call",
    description: "Upload recording or transcript",
  },
  {
    icon: Link2,
    label: "Import from CRM",
    description: "Salesforce, HubSpot, Dynamics",
  },
  {
    icon: FileText,
    label: "Upload Documents",
    description: "PDF, Word, or text files",
  },
  {
    icon: Mail,
    label: "Email Thread",
    description: "Paste conversation to analyze",
  },
];

const hypotheses = [
  {
    id: 1,
    title: "Manufacturing Automation Gap",
    description:
      "Legacy systems causing 23% efficiency loss in production lines",
    confidence: 87,
    source: "Derived from 10-K filing analysis",
  },
  {
    id: 2,
    title: "Supply Chain Visibility",
    description: "Lack of real-time inventory tracking leading to stockouts",
    confidence: 74,
    source: "Competitor analysis and industry benchmarks",
  },
  {
    id: 3,
    title: "Workforce Productivity",
    description: "Manual data entry consuming 15 hours/week per team member",
    confidence: 91,
    source: "Customer interview transcript",
  },
];

export default function ValueCanvas() {
  const [companyUrl, setCompanyUrl] = useState("");
  const [isResearching, setIsResearching] = useState(false);
  const [researchComplete, setResearchComplete] = useState(false);
  const [selectedHypothesis, setSelectedHypothesis] = useState<number | null>(
    null
  );
  const [showEmptyState, setShowEmptyState] = useState(false);

  const handleResearch = () => {
    if (!companyUrl.trim()) return;
    setIsResearching(true);
    setTimeout(() => {
      setIsResearching(false);
      setResearchComplete(true);
    }, 2000);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background">
      <Header
        title="Phase 1: Value Discovery"
        breadcrumbs={["Acme Corp", "Discovery"]}
      />

      <div className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <section className="mb-8" aria-labelledby="research-section">
            <div className="flex items-center gap-3 mb-3">
              <AgentBadge
                agentId="company-intelligence"
                size="md"
                pulse={isResearching}
              />
              <span className="text-sm text-foreground/70">
                {isResearching ? "Researching company..." : "Ready to analyze"}
              </span>
            </div>

            <div className="card p-4 sm:p-5">
              <label htmlFor="company-input" className="sr-only">
                Company URL or name
              </label>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-4">
                <div className="flex-1 flex items-center gap-3 bg-secondary/30 rounded-lg px-4 py-3">
                  <Globe
                    className="w-5 h-5 text-muted-foreground flex-shrink-0"
                    aria-hidden="true"
                  />
                  <input
                    id="company-input"
                    type="text"
                    value={companyUrl}
                    onChange={(e) => setCompanyUrl(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleResearch()}
                    placeholder="Enter company URL, ticker, or name..."
                    className="flex-1 bg-transparent text-foreground placeholder-muted-foreground/70 focus:outline-none"
                    aria-describedby="research-help"
                  />
                </div>
                <button
                  onClick={handleResearch}
                  disabled={isResearching || !companyUrl.trim()}
                  className="btn btn-primary h-11 px-6 justify-center"
                  aria-busy={isResearching}
                >
                  {isResearching ? (
                    <>
                      <Loader2
                        className="w-4 h-4 animate-spin mr-2"
                        aria-hidden="true"
                      />
                      Researching...
                    </>
                  ) : (
                    "Research"
                  )}
                </button>
              </div>
              <p
                id="research-help"
                className="text-xs text-muted-foreground/60"
              >
                Our AI will analyze SEC filings, news, and industry reports to
                identify opportunities.
              </p>

              {researchComplete && (
                <div
                  className="flex items-center gap-2 text-sm text-green-500 bg-green-500/10 px-4 py-3 rounded-lg mt-4 animate-fade-in"
                  role="status"
                  aria-live="polite"
                >
                  <CheckCircle2
                    className="w-4 h-4 flex-shrink-0"
                    aria-hidden="true"
                  />
                  <span>
                    Company Intelligence found 12 data points from SEC filings,
                    news, and industry reports
                  </span>
                </div>
              )}
            </div>
          </section>

          <section className="mb-8" aria-labelledby="hypotheses-section">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-5">
              <div className="flex items-center gap-3">
                <AgentBadge agentId="opportunity" size="md" />
                <h2
                  id="hypotheses-section"
                  className="text-sm font-semibold text-foreground flex items-center gap-1"
                >
                  Suggested Hypotheses
                  <Tooltip content="Hypotheses are potential value opportunities identified by analyzing company data. Click one to explore it further with the Value Mapping Agent." />
                </h2>
              </div>
              <span className="text-xs text-foreground/60 sm:ml-auto">
                Click to explore with Value Mapping Agent
              </span>
            </div>

            {showEmptyState ? (
              <div className="card">
                <EmptyState
                  icon={FolderOpen}
                  title="No hypotheses yet"
                  description="Research a company above to generate value hypotheses, or create one manually."
                  actionLabel="Create Hypothesis"
                  onAction={() => setShowEmptyState(false)}
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {hypotheses.map((hypothesis, index) => (
                  <button
                    key={hypothesis.id}
                    onClick={() => setSelectedHypothesis(hypothesis.id)}
                    className={`card-interactive p-5 text-left ${
                      selectedHypothesis === hypothesis.id
                        ? "ring-2 ring-emerald-500 bg-emerald-500/5 border-emerald-500/30"
                        : ""
                    }`}
                    style={{ animationDelay: `${index * 100}ms` }}
                    aria-pressed={selectedHypothesis === hypothesis.id}
                    aria-label={`${hypothesis.title}: ${hypothesis.description}. Confidence ${hypothesis.confidence}%`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <Sparkles
                            className="w-4 h-4 text-emerald-500 flex-shrink-0"
                            aria-hidden="true"
                          />
                          <span className="font-semibold text-foreground">
                            {hypothesis.title}
                          </span>
                        </div>
                        <p className="text-sm text-foreground/70 mb-3 leading-relaxed">
                          {hypothesis.description}
                        </p>
                        <p className="text-xs text-foreground/50">
                          {hypothesis.source}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-2xl font-bold text-foreground">
                          {hypothesis.confidence}%
                        </div>
                        <div className="text-[10px] text-foreground/50 uppercase tracking-wider">
                          confidence
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="mb-8" aria-labelledby="manual-input">
            <div className="card p-5 bg-secondary/20 border-dashed">
              <label htmlFor="manual-hypothesis" className="sr-only">
                Manual hypothesis input
              </label>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <Sparkles
                  className="w-5 h-5 text-muted-foreground flex-shrink-0 hidden sm:block"
                  aria-hidden="true"
                />
                <input
                  id="manual-hypothesis"
                  type="text"
                  placeholder="Or describe your customer's main pain point manually..."
                  className="flex-1 bg-transparent text-foreground placeholder-muted-foreground/70 focus:outline-none py-2"
                />
                <button
                  className="btn btn-outline h-10 px-4 justify-center"
                  aria-label="Submit manual hypothesis"
                >
                  <span className="sm:hidden mr-2">Submit</span>
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          </section>

          <section aria-labelledby="input-sources">
            <h2
              id="input-sources"
              className="text-xs font-semibold text-foreground/60 uppercase tracking-wider mb-4"
            >
              Additional Input Sources
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {quickActions.map((action, index) => (
                <button
                  key={index}
                  className="group card-interactive p-4 text-center"
                  aria-label={`${action.label}: ${action.description}`}
                >
                  <div className="flex flex-col items-center gap-3">
                    <div className="p-3 bg-secondary rounded-lg group-hover:bg-foreground/10 transition-colors">
                      <action.icon
                        className="w-5 h-5 text-foreground"
                        aria-hidden="true"
                      />
                    </div>
                    <div>
                      <div className="text-xs font-medium text-foreground mb-0.5">
                        {action.label}
                      </div>
                      <div className="text-[10px] text-muted-foreground hidden sm:block">
                        {action.description}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
              <button
                className="card p-4 border-dashed hover:bg-secondary/30 transition-colors"
                aria-label="Create blank case from scratch"
              >
                <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground h-full">
                  <div className="p-3 bg-secondary/50 rounded-lg">
                    <Plus className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <span className="text-xs font-medium">Blank Case</span>
                </div>
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
