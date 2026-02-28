import { useState } from "react";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ChevronRight,
  FileText,
  Layers,
  LayoutGrid,
  List,
  Pause,
  Play,
  Search,
  Shield,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useDomainPacks } from "@/hooks/useDomainPacks";

// -- Types --
type CaseStatus = "running" | "needs-input" | "paused" | "review" | "complete";
type Stage = "Discovery" | "Target" | "Realization" | "Expansion" | "Narrative";

interface ValueCase {
  id: string;
  company: string;
  dealName: string;
  stage: Stage;
  status: CaseStatus;
  confidence: number;
  projectedValue: string;
  nextAction: string;
  lastActivity: string;
  caseCount: number;
  owner: string;
  createdAt: string;
  tags: string[];
}

// -- Stage + status config --
const stageDot: Record<Stage, string> = {
  Discovery: "bg-blue-500",
  Target: "bg-violet-500",
  Realization: "bg-amber-500",
  Expansion: "bg-emerald-500",
  Narrative: "bg-pink-500",
};

const statusConfig: Record<CaseStatus, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  running: { icon: Play, color: "text-emerald-700", bg: "bg-emerald-50", label: "Running" },
  "needs-input": { icon: AlertTriangle, color: "text-amber-700", bg: "bg-amber-50", label: "Needs Input" },
  paused: { icon: Pause, color: "text-zinc-500", bg: "bg-zinc-100", label: "Paused" },
  review: { icon: Shield, color: "text-blue-700", bg: "bg-blue-50", label: "In Review" },
  complete: { icon: CheckCircle2, color: "text-emerald-700", bg: "bg-emerald-50", label: "Complete" },
};

// -- Quick-start inline --
function InlineQuickStart() {
  const [company, setCompany] = useState("");
  const [selectedPackId, setSelectedPackId] = useState<string>("");
  const navigate = useNavigate();
  const { data: packs, isLoading: packsLoading } = useDomainPacks();

  const handleStart = () => {
    if (!company.trim()) return;
    // In production this would create the case via API with the selected pack, then navigate
    const params = new URLSearchParams();
    if (selectedPackId) params.set("packId", selectedPackId);
    const qs = params.toString();
    navigate(`/opportunities/new/cases/new${qs ? `?${qs}` : ""}`);
  };

  return (
    <div className="bg-white border border-dashed border-zinc-300 rounded-2xl p-5 hover:border-zinc-400 transition-colors">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-8 h-8 bg-zinc-950 rounded-lg flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div>
          <h3 className="text-[13px] font-semibold text-zinc-900">Start a new Value Case</h3>
          <p className="text-[11px] text-zinc-400">Enter a company — the agent handles discovery, modeling, and narrative</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleStart()}
          placeholder="e.g. Acme Corp, Snowflake, Stripe..."
          className="flex-1 px-4 py-2.5 rounded-xl border border-zinc-200 text-[13px] bg-zinc-50 placeholder:text-zinc-400 placeholder:italic outline-none focus:border-zinc-400 focus:bg-white transition-colors"
        />
        <div className="relative">
          <Layers className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" />
          <select
            value={selectedPackId}
            onChange={(e) => setSelectedPackId(e.target.value)}
            className="appearance-none pl-8 pr-6 py-2.5 rounded-xl border border-zinc-200 text-[13px] bg-zinc-50 text-zinc-700 outline-none focus:border-zinc-400 focus:bg-white transition-colors cursor-pointer"
          >
            <option value="">No Domain Pack</option>
            {packsLoading && <option disabled>Loading...</option>}
            {packs?.map((pack) => (
              <option key={pack.id} value={pack.id}>
                {pack.name}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={handleStart}
          className="px-4 py-2.5 bg-zinc-950 text-white rounded-xl text-[13px] font-medium hover:bg-zinc-800 transition-colors flex items-center gap-2"
        >
          <Play className="w-3.5 h-3.5" />
          Start
        </button>
      </div>
    </div>
  );
}

// -- Deal workspace card --
function DealCard({ deal }: { deal: ValueCase }) {
  const st = statusConfig[deal.status];
  const StIcon = st.icon;

  return (
    <Link
      to={`/opportunities/${deal.id}`}
      className="bg-white border border-zinc-200 rounded-2xl p-5 hover:border-zinc-300 hover:shadow-md transition-all group"
    >
      {/* Header: company + status */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-zinc-100 rounded-lg flex items-center justify-center">
            <Building2 className="w-4 h-4 text-zinc-500" />
          </div>
          <div>
            <h3 className="text-[14px] font-black text-zinc-950 tracking-tight group-hover:text-zinc-700 transition-colors">
              {deal.company}
            </h3>
            <p className="text-[12px] text-zinc-400">{deal.dealName}</p>
          </div>
        </div>
        <div className={cn("flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold", st.color, st.bg)}>
          <StIcon className="w-3 h-3" />
          <span>{st.label}</span>
        </div>
      </div>

      {/* Stage + confidence + value row */}
      <div className="flex items-center gap-3 mb-3">
        <div className="flex items-center gap-1.5">
          <div className={cn("w-2 h-2 rounded-full", stageDot[deal.stage])} />
          <span className="text-[11px] font-semibold text-zinc-600">{deal.stage}</span>
        </div>
        <span className="text-zinc-200">|</span>
        <div className="flex items-center gap-1.5">
          <div className="w-12 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full",
                deal.confidence >= 80 ? "bg-emerald-500" : deal.confidence >= 60 ? "bg-amber-500" : "bg-red-400"
              )}
              style={{ width: `${deal.confidence}%` }}
            />
          </div>
          <span className="text-[11px] font-medium text-zinc-500">{deal.confidence}%</span>
        </div>
        <span className="text-zinc-200">|</span>
        <span className="text-[12px] font-bold text-zinc-800">{deal.projectedValue}</span>
      </div>

      {/* Tags */}
      {deal.tags.length > 0 && (
        <div className="flex items-center gap-1.5 mb-3">
          {deal.tags.map((tag) => (
            <span key={tag} className="px-2 py-0.5 bg-zinc-50 border border-zinc-100 rounded-md text-[10px] text-zinc-500 font-medium">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Next action — the most important line */}
      <div className="flex items-center gap-2 p-2.5 rounded-xl bg-zinc-50 border border-zinc-100">
        <Zap className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
        <span className="text-[12px] text-zinc-700 flex-1 truncate">{deal.nextAction}</span>
        <ChevronRight className="w-3.5 h-3.5 text-zinc-300 group-hover:text-zinc-500 transition-colors" />
      </div>

      {/* Footer: meta */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-100">
        <span className="text-[11px] text-zinc-400">{deal.lastActivity}</span>
        <span className="text-[11px] text-zinc-400">{deal.owner}</span>
      </div>
    </Link>
  );
}

// -- Summary stats bar --
function StatBar({ deals }: { deals: ValueCase[] }) {
  const needsInput = deals.filter((d) => d.status === "needs-input").length;
  const running = deals.filter((d) => d.status === "running").length;
  const totalValue = deals.reduce((sum, d) => {
    const num = parseFloat(d.projectedValue.replace(/[$M,]/g, ""));
    return sum + (isNaN(num) ? 0 : num);
  }, 0);
  const avgConfidence = Math.round(deals.reduce((sum, d) => sum + d.confidence, 0) / deals.length);

  const stats = [
    { label: "Active", value: deals.length, icon: Target },
    { label: "Running", value: running, icon: Play },
    { label: "Needs Input", value: needsInput, icon: AlertTriangle, highlight: needsInput > 0 },
    { label: "Pipeline", value: `$${totalValue.toFixed(1)}M`, icon: TrendingUp },
    { label: "Avg Confidence", value: `${avgConfidence}%`, icon: Shield },
  ];

  return (
    <div className="flex items-center gap-1 p-1 bg-white border border-zinc-200 rounded-2xl">
      {stats.map((s) => {
        const Icon = s.icon;
        return (
          <div
            key={s.label}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-xl flex-1 justify-center",
              s.highlight ? "bg-amber-50" : "hover:bg-zinc-50"
            )}
          >
            <Icon className={cn("w-3.5 h-3.5", s.highlight ? "text-amber-500" : "text-zinc-400")} />
            <div className="text-center">
              <p className={cn("text-[14px] font-black tracking-tight", s.highlight ? "text-amber-700" : "text-zinc-900")}>
                {s.value}
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-400">{s.label}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// -- Filter tabs --
type FilterTab = "all" | "needs-input" | "running" | "review" | "paused" | "complete";

const filterTabs: { key: FilterTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "needs-input", label: "Needs Input" },
  { key: "running", label: "Running" },
  { key: "review", label: "In Review" },
  { key: "paused", label: "Paused" },
  { key: "complete", label: "Complete" },
];

// -- Main page --
export default function Opportunities() {
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Mock data — workflow-oriented, not CRM-oriented
  const deals: ValueCase[] = [
    {
      id: "opp-1",
      company: "Acme Corp",
      dealName: "Platform Migration — Enterprise",
      stage: "Target",
      status: "needs-input",
      confidence: 87,
      projectedValue: "$4.2M",
      nextAction: "Review 3 assumptions flagged by Integrity Agent",
      lastActivity: "Model updated 25m ago",
      caseCount: 2,
      owner: "You",
      createdAt: "2024-01-15",
      tags: ["Enterprise", "Migration"],
    },
    {
      id: "opp-2",
      company: "TechStart Inc",
      dealName: "Cloud Modernization",
      stage: "Discovery",
      status: "running",
      confidence: 62,
      projectedValue: "$1.5M",
      nextAction: "Agent researching competitive landscape — ETA 2m",
      lastActivity: "Discovery started 8m ago",
      caseCount: 1,
      owner: "You",
      createdAt: "2024-01-18",
      tags: ["Mid-Market", "Cloud"],
    },
    {
      id: "opp-3",
      company: "Global Logistics Co",
      dealName: "Supply Chain Optimization",
      stage: "Narrative",
      status: "review",
      confidence: 91,
      projectedValue: "$2.8M",
      nextAction: "Executive summary ready for your review",
      lastActivity: "Narrative generated 2h ago",
      caseCount: 3,
      owner: "Sarah K.",
      createdAt: "2024-01-10",
      tags: ["Enterprise", "Supply Chain"],
    },
    {
      id: "opp-4",
      company: "FinServ Partners",
      dealName: "Risk Analytics Platform",
      stage: "Target",
      status: "paused",
      confidence: 45,
      projectedValue: "$3.1M",
      nextAction: "Resume: customer provided new baseline data",
      lastActivity: "Paused 1d ago — waiting on customer",
      caseCount: 1,
      owner: "You",
      createdAt: "2024-01-12",
      tags: ["Financial Services"],
    },
    {
      id: "opp-5",
      company: "MedTech Solutions",
      dealName: "Compliance Automation",
      stage: "Realization",
      status: "running",
      confidence: 78,
      projectedValue: "$2.1M",
      nextAction: "Tracking 4 KPIs — next checkpoint in 2 weeks",
      lastActivity: "KPI data refreshed 4h ago",
      caseCount: 2,
      owner: "You",
      createdAt: "2024-01-08",
      tags: ["Healthcare", "Compliance"],
    },
    {
      id: "opp-6",
      company: "RetailMax",
      dealName: "Inventory Intelligence",
      stage: "Expansion",
      status: "running",
      confidence: 83,
      projectedValue: "$1.9M",
      nextAction: "Expansion model ready — 3 new use cases identified",
      lastActivity: "Expansion analysis 6h ago",
      caseCount: 4,
      owner: "Mike R.",
      createdAt: "2024-01-05",
      tags: ["Retail", "AI/ML"],
    },
  ];

  // Filter logic
  const filtered = deals.filter((d) => {
    const matchesFilter = activeFilter === "all" || d.status === activeFilter;
    const matchesSearch =
      !search ||
      d.company.toLowerCase().includes(search.toLowerCase()) ||
      d.dealName.toLowerCase().includes(search.toLowerCase()) ||
      d.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="p-6 lg:p-10 max-w-[1200px] mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-zinc-950 tracking-[-0.05em]">Value Cases</h1>
          <p className="text-[13px] text-zinc-400 mt-0.5">
            {deals.length} deals · {deals.filter((d) => d.status === "needs-input").length} need your input
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/models"
            className="flex items-center gap-2 px-3 py-2 border border-zinc-200 rounded-xl text-[12px] font-medium text-zinc-600 hover:bg-zinc-50 transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
            Models
          </Link>
          <Link
            to="/agents"
            className="flex items-center gap-2 px-3 py-2 border border-zinc-200 rounded-xl text-[12px] font-medium text-zinc-600 hover:bg-zinc-50 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Agents
          </Link>
        </div>
      </div>

      {/* Quick start — always visible, never buried */}
      <InlineQuickStart />

      {/* Stats bar */}
      <StatBar deals={deals} />

      {/* Toolbar: search + filters + view toggle */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search deals, companies, tags..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 text-[13px] bg-white placeholder:text-zinc-400 outline-none focus:border-zinc-400 transition-colors"
          />
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-0.5 p-0.5 bg-zinc-100 rounded-xl">
          {filterTabs.map((tab) => {
            const count = tab.key === "all" ? deals.length : deals.filter((d) => d.status === tab.key).length;
            if (count === 0 && tab.key !== "all") return null;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveFilter(tab.key)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors flex items-center gap-1.5",
                  activeFilter === tab.key
                    ? "bg-white text-zinc-900 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-700"
                )}
              >
                {tab.label}
                <span
                  className={cn(
                    "text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full",
                    activeFilter === tab.key ? "bg-zinc-900 text-white" : "bg-zinc-200 text-zinc-500"
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-0.5 p-0.5 bg-zinc-100 rounded-lg ml-auto">
          <button
            onClick={() => setViewMode("grid")}
            className={cn(
              "p-1.5 rounded-md transition-colors",
              viewMode === "grid" ? "bg-white shadow-sm text-zinc-900" : "text-zinc-400 hover:text-zinc-600"
            )}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={cn(
              "p-1.5 rounded-md transition-colors",
              viewMode === "list" ? "bg-white shadow-sm text-zinc-900" : "text-zinc-400 hover:text-zinc-600"
            )}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Deal cards */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-12 h-12 bg-zinc-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Search className="w-5 h-5 text-zinc-400" />
          </div>
          <p className="text-[14px] font-medium text-zinc-600">No cases match your filters</p>
          <p className="text-[12px] text-zinc-400 mt-1">Try adjusting your search or filter criteria</p>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((deal) => (
            <DealCard key={deal.id} deal={deal} />
          ))}
        </div>
      ) : (
        /* List view — compact rows */
        <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
          <div className="grid grid-cols-[1fr_100px_100px_80px_1fr_100px] gap-4 px-5 py-2.5 border-b border-zinc-100 bg-zinc-50">
            <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-400">Deal</span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-400">Stage</span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-400">Status</span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-400">Conf.</span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-400">Next Action</span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-400 text-right">Value</span>
          </div>
          {filtered.map((deal) => {
            const st = statusConfig[deal.status];
            const StIcon = st.icon;
            return (
              <Link
                key={deal.id}
                to={`/opportunities/${deal.id}`}
                className="grid grid-cols-[1fr_100px_100px_80px_1fr_100px] gap-4 px-5 py-3.5 border-b border-zinc-50 hover:bg-zinc-50 transition-colors items-center"
              >
                <div>
                  <p className="text-[13px] font-bold text-zinc-900 truncate">{deal.company}</p>
                  <p className="text-[11px] text-zinc-400 truncate">{deal.dealName}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className={cn("w-2 h-2 rounded-full", stageDot[deal.stage])} />
                  <span className="text-[12px] text-zinc-600">{deal.stage}</span>
                </div>
                <div className={cn("flex items-center gap-1 text-[11px] font-medium", st.color)}>
                  <StIcon className="w-3 h-3" />
                  <span>{st.label}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-10 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        deal.confidence >= 80 ? "bg-emerald-500" : deal.confidence >= 60 ? "bg-amber-500" : "bg-red-400"
                      )}
                      style={{ width: `${deal.confidence}%` }}
                    />
                  </div>
                  <span className="text-[11px] text-zinc-500">{deal.confidence}%</span>
                </div>
                <p className="text-[12px] text-zinc-600 truncate">{deal.nextAction}</p>
                <p className="text-[13px] font-bold text-zinc-900 text-right">{deal.projectedValue}</p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
