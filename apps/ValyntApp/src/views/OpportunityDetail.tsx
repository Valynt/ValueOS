import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Bot,
  Boxes,
  Building2,
  Calendar,
  CheckCircle2,
  FileText,
  Pause,
  Play,
  Plus,
  User,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { cn } from "@/lib/utils";

const opp = {
  id: "OPP-001",
  name: "Enterprise Platform Migration",
  company: "Acme Corp",
  industry: "Manufacturing",
  status: "active",
  owner: "Sarah Chen",
  valuePotential: "$4.2M",
  createdAt: "Jan 15, 2026",
  description: "Full platform migration from legacy on-prem to cloud-native architecture. Includes data migration, re-platforming of core services, and training.",
};

const cases = [
  { id: "VC-1024", stage: "Target", status: "running", confidence: 87, startedAt: "Feb 1, 2026", lastRun: "2h ago" },
  { id: "VC-1018", stage: "Discovery", status: "completed", confidence: 95, startedAt: "Jan 20, 2026", lastRun: "3d ago" },
  { id: "VC-1010", stage: "Discovery", status: "paused", confidence: 72, startedAt: "Jan 16, 2026", lastRun: "1w ago" },
];

const models = [
  { id: "MOD-01", name: "Cloud Migration ROI", kpis: 8, version: "v2.1" },
  { id: "MOD-02", name: "TCO Reduction Framework", kpis: 5, version: "v1.3" },
];

const artifacts = [
  { name: "10-K Analysis Report", type: "report", date: "Feb 5, 2026", agent: "Opportunity Agent" },
  { name: "Competitive Landscape", type: "analysis", date: "Feb 3, 2026", agent: "Research Agent" },
  { name: "Value Tree v2", type: "model", date: "Feb 1, 2026", agent: "Target Agent" },
];

const activity = [
  { action: "Value case VC-1024 moved to Target stage", time: "2h ago", actor: "system" },
  { action: "Sarah Chen attached Cloud Migration ROI model", time: "1d ago", actor: "user" },
  { action: "Opportunity Agent completed 10-K analysis", time: "2d ago", actor: "agent" },
  { action: "Opportunity created by Sarah Chen", time: "Jan 15, 2026", actor: "user" },
];

const stageStatusConfig: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  running: { icon: Play, color: "text-emerald-700", bg: "bg-emerald-50" },
  paused: { icon: Pause, color: "text-amber-700", bg: "bg-amber-50" },
  completed: { icon: CheckCircle2, color: "text-blue-700", bg: "bg-blue-50" },
};

export default function OpportunityDetail() {
  const { id } = useParams();

  return (
    <div className="p-6 lg:p-10 max-w-[1400px] mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6">
        <Link to="/opportunities" className="flex items-center gap-1.5 text-[13px] text-zinc-400 hover:text-zinc-700 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Opportunities
        </Link>
        <span className="text-zinc-300">/</span>
        <span className="text-[13px] text-zinc-700 font-medium">{opp.id}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-black text-zinc-950 tracking-[-0.05em]">{opp.name}</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700">
              Active
            </span>
          </div>
          <p className="text-[13px] text-zinc-500 max-w-2xl">{opp.description}</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 bg-zinc-950 text-white rounded-xl text-[13px] font-medium hover:bg-zinc-800 transition-colors">
          <Plus className="w-4 h-4" />
          Start Value Case
        </button>
      </div>

      {/* 3-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: meta + activity */}
        <div className="lg:col-span-3 space-y-6">
          {/* Meta card */}
          <div className="bg-white border border-zinc-200 rounded-3xl p-5 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)]">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400 mb-4">Details</h3>
            <div className="space-y-4">
              {[
                { label: "Company", value: opp.company, icon: Building2 },
                { label: "Industry", value: opp.industry, icon: BarChart3 },
                { label: "Owner", value: opp.owner, icon: User },
                { label: "Created", value: opp.createdAt, icon: Calendar },
              ].map((item) => (
                <div key={item.label}>
                  <p className="text-[11px] text-zinc-400 mb-0.5">{item.label}</p>
                  <div className="flex items-center gap-2">
                    <item.icon className="w-3.5 h-3.5 text-zinc-400" />
                    <span className="text-[13px] text-zinc-700">{item.value}</span>
                  </div>
                </div>
              ))}
              <div>
                <p className="text-[11px] text-zinc-400 mb-0.5">Value Potential</p>
                <p className="text-xl font-black text-zinc-950 tracking-tight">{opp.valuePotential}</p>
              </div>
            </div>
          </div>

          {/* Activity stream */}
          <div className="bg-white border border-zinc-200 rounded-3xl p-5 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)]">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400 mb-4">Activity</h3>
            <div className="space-y-4">
              {activity.map((a, i) => (
                <div key={i} className="flex gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-zinc-300 mt-2 flex-shrink-0" />
                  <div>
                    <p className="text-[12px] text-zinc-700 leading-relaxed">{a.action}</p>
                    <p className="text-[11px] text-zinc-400 mt-0.5">{a.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Center: value case timeline */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white border border-zinc-200 rounded-3xl p-6 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)]">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-[13px] font-semibold text-zinc-900">Value Cases</h3>
              <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-400">
                {cases.length} cases
              </span>
            </div>
            <div className="space-y-3">
              {cases.map((c) => {
                const st = stageStatusConfig[c.status];
                const StIcon = st.icon;
                return (
                  <Link
                    key={c.id}
                    to={`/opportunities/${id}/cases/${c.id}`}
                    className="flex items-center gap-4 p-4 rounded-2xl border border-zinc-200 hover:border-zinc-300 hover:shadow-sm transition-all group"
                  >
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", st.bg)}>
                      <StIcon className={cn("w-5 h-5", st.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[14px] font-semibold text-zinc-900">{c.id}</p>
                        <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize", st.color, st.bg)}>
                          {c.status}
                        </span>
                      </div>
                      <p className="text-[12px] text-zinc-500 mt-0.5">
                        {c.stage} stage &middot; Started {c.startedAt}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-14 h-2 bg-zinc-100 rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full",
                              c.confidence >= 80 ? "bg-emerald-500" : c.confidence >= 60 ? "bg-amber-500" : "bg-red-500"
                            )}
                            style={{ width: `${c.confidence}%` }}
                          />
                        </div>
                        <span className="text-[12px] font-medium text-zinc-600">{c.confidence}%</span>
                      </div>
                      <p className="text-[11px] text-zinc-400">Last run {c.lastRun}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-zinc-300 group-hover:text-zinc-500 transition-colors" />
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: attached assets */}
        <div className="lg:col-span-4 space-y-6">
          {/* Models */}
          <div className="bg-white border border-zinc-200 rounded-3xl p-5 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[13px] font-semibold text-zinc-900">Linked Models</h3>
              <button className="text-[12px] text-zinc-400 hover:text-zinc-700 flex items-center gap-1">
                <Plus className="w-3 h-3" /> Attach
              </button>
            </div>
            <div className="space-y-2">
              {models.map((m) => (
                <Link
                  key={m.id}
                  to={`/models/${m.id}`}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-zinc-50 transition-colors"
                >
                  <div className="w-8 h-8 bg-violet-50 rounded-lg flex items-center justify-center">
                    <Boxes className="w-4 h-4 text-violet-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-zinc-900 truncate">{m.name}</p>
                    <p className="text-[11px] text-zinc-400">{m.kpis} KPIs &middot; {m.version}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Artifacts */}
          <div className="bg-white border border-zinc-200 rounded-3xl p-5 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[13px] font-semibold text-zinc-900">Artifacts</h3>
              <span className="text-[11px] text-zinc-400">{artifacts.length} items</span>
            </div>
            <div className="space-y-2">
              {artifacts.map((a, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl hover:bg-zinc-50 transition-colors cursor-pointer">
                  <div className="w-8 h-8 bg-zinc-100 rounded-lg flex items-center justify-center">
                    <FileText className="w-4 h-4 text-zinc-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-zinc-900 truncate">{a.name}</p>
                    <p className="text-[11px] text-zinc-400">
                      <Bot className="w-3 h-3 inline mr-1" />
                      {a.agent} &middot; {a.date}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
