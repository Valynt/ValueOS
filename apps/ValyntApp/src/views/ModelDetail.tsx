import { ArrowLeft, Boxes, Edit3, Plus, Save, TrendingUp } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import { cn } from "@/lib/utils";

const model = {
  id: "MOD-01",
  name: "Cloud Migration ROI",
  version: "v2.1",
  status: "active",
  category: "Infrastructure",
  description: "Quantifies the return on investment for enterprise cloud migration projects, including infrastructure savings, operational efficiency, and revenue acceleration.",
  updatedAt: "Feb 5, 2026",
  createdBy: "Sarah Chen",
};

const kpis = [
  { id: "KPI-01", name: "Infrastructure Cost Savings", category: "Cost", formula: "current_infra_cost - projected_cloud_cost", baseline: "$2.4M/yr", target: "$600K/yr" },
  { id: "KPI-02", name: "Migration Timeline", category: "Timeline", formula: "planned_months", baseline: "18 months", target: "12 months" },
  { id: "KPI-03", name: "Server Consolidation Ratio", category: "Efficiency", formula: "current_servers / target_instances", baseline: "340:340", target: "340:85" },
  { id: "KPI-04", name: "Uptime SLA", category: "Quality", formula: "monthly_uptime_pct", baseline: "99.2%", target: "99.95%" },
  { id: "KPI-05", name: "Ops Team Reduction", category: "Cost", formula: "current_ops_fte - target_ops_fte", baseline: "24 FTE", target: "12 FTE" },
  { id: "KPI-06", name: "Time to Deploy", category: "Efficiency", formula: "avg_deploy_hours", baseline: "48 hours", target: "2 hours" },
  { id: "KPI-07", name: "Compliance Score", category: "Risk", formula: "compliance_checks_passed / total", baseline: "78%", target: "98%" },
  { id: "KPI-08", name: "Annual ROI", category: "Financial", formula: "(savings - investment) / investment * 100", baseline: "0%", target: "406%" },
];

const tabs = ["Overview", "KPIs", "Scenarios", "History"];

export default function ModelDetail() {
  const { id } = useParams();
  const [activeTab, setActiveTab] = useState("KPIs");
  const [selectedKpi, setSelectedKpi] = useState(kpis[0]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 lg:px-10 pt-6 lg:pt-10 pb-4">
        <div className="flex items-center gap-2 mb-4">
          <Link to="/models" className="flex items-center gap-1.5 text-[13px] text-zinc-400 hover:text-zinc-700">
            <ArrowLeft className="w-4 h-4" />
            Value Models
          </Link>
          <span className="text-zinc-300">/</span>
          <span className="text-[13px] text-zinc-700 font-medium">{model.id}</span>
        </div>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 bg-violet-50 rounded-xl flex items-center justify-center">
                <Boxes className="w-5 h-5 text-violet-600" />
              </div>
              <div>
                <h1 className="text-xl font-black text-zinc-950 tracking-[-0.05em]">{model.name}</h1>
                <p className="text-[12px] text-zinc-400">{model.version} &middot; {model.category} &middot; Updated {model.updatedAt}</p>
              </div>
            </div>
            <p className="text-[13px] text-zinc-500 mt-2 max-w-2xl">{model.description}</p>
          </div>
          <button className="flex items-center gap-2 px-3 py-2 border border-zinc-200 rounded-xl text-[12px] font-medium text-zinc-700 hover:bg-zinc-50">
            <Edit3 className="w-3.5 h-3.5" />
            Edit Model
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 lg:px-10 border-b border-zinc-200">
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-4 py-3 text-[13px] font-medium border-b-2 transition-colors",
                activeTab === tab
                  ? "border-zinc-950 text-zinc-950"
                  : "border-transparent text-zinc-400 hover:text-zinc-700"
              )}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "Overview" && (
          <div className="p-6 lg:p-10 max-w-[1000px] space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white border border-zinc-200 rounded-2xl p-5 text-center">
                <p className="text-2xl font-black text-zinc-950">{kpis.length}</p>
                <p className="text-[12px] text-zinc-500 mt-1">KPIs Defined</p>
              </div>
              <div className="bg-white border border-zinc-200 rounded-2xl p-5 text-center">
                <p className="text-2xl font-black text-zinc-950">3</p>
                <p className="text-[12px] text-zinc-500 mt-1">Active Cases</p>
              </div>
              <div className="bg-white border border-zinc-200 rounded-2xl p-5 text-center">
                <p className="text-2xl font-black text-zinc-950">v2.1</p>
                <p className="text-[12px] text-zinc-500 mt-1">Current Version</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === "KPIs" && (
          <div className="flex h-full">
            {/* KPI list */}
            <div className="w-[340px] border-r border-zinc-200 overflow-y-auto p-4 space-y-2 flex-shrink-0">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-400">{kpis.length} KPIs</span>
                <button className="text-[12px] text-zinc-400 hover:text-zinc-700 flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Add
                </button>
              </div>
              {kpis.map((kpi) => (
                <button
                  key={kpi.id}
                  onClick={() => setSelectedKpi(kpi)}
                  className={cn(
                    "w-full text-left p-3 rounded-xl transition-all",
                    selectedKpi.id === kpi.id
                      ? "bg-zinc-950 text-white"
                      : "hover:bg-zinc-100 text-zinc-700"
                  )}
                >
                  <p className={cn("text-[13px] font-medium", selectedKpi.id === kpi.id ? "text-white" : "text-zinc-900")}>{kpi.name}</p>
                  <p className={cn("text-[11px] mt-0.5", selectedKpi.id === kpi.id ? "text-zinc-300" : "text-zinc-400")}>{kpi.category}</p>
                </button>
              ))}
            </div>

            {/* KPI editor */}
            <div className="flex-1 overflow-y-auto p-6 lg:p-8">
              <div className="max-w-lg space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-black text-zinc-950 tracking-tight">{selectedKpi.name}</h3>
                  <button className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-950 text-white rounded-lg text-[12px] font-medium hover:bg-zinc-800">
                    <Save className="w-3.5 h-3.5" />
                    Save
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-400 block mb-2">Category</label>
                    <input type="text" defaultValue={selectedKpi.category} className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 text-[13px] bg-white focus:border-zinc-400 focus:ring-0 outline-none" />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-400 block mb-2">Formula</label>
                    <input type="text" defaultValue={selectedKpi.formula} className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 text-[13px] bg-white font-mono focus:border-zinc-400 focus:ring-0 outline-none" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-400 block mb-2">Baseline</label>
                      <input type="text" defaultValue={selectedKpi.baseline} className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 text-[13px] bg-white focus:border-zinc-400 focus:ring-0 outline-none" />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-400 block mb-2">Target</label>
                      <input type="text" defaultValue={selectedKpi.target} className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 text-[13px] bg-white focus:border-zinc-400 focus:ring-0 outline-none" />
                    </div>
                  </div>
                </div>

                {/* Preview chart placeholder */}
                <div className="p-5 bg-zinc-50 rounded-2xl border border-zinc-200">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="w-4 h-4 text-zinc-500" />
                    <span className="text-[12px] font-medium text-zinc-600">Baseline → Target Preview</span>
                  </div>
                  <div className="flex items-end gap-6 h-24">
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-16 bg-zinc-300 rounded-t-lg" style={{ height: "100%" }} />
                      <span className="text-[10px] text-zinc-400">Baseline</span>
                      <span className="text-[11px] font-semibold text-zinc-600">{selectedKpi.baseline}</span>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-16 bg-violet-500 rounded-t-lg" style={{ height: "40%" }} />
                      <span className="text-[10px] text-zinc-400">Target</span>
                      <span className="text-[11px] font-semibold text-violet-700">{selectedKpi.target}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "Scenarios" && (
          <div className="p-6 lg:p-10 flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-[13px] text-zinc-400">Scenario modeling coming soon</p>
            </div>
          </div>
        )}

        {activeTab === "History" && (
          <div className="p-6 lg:p-10 max-w-[800px] space-y-3">
            {[
              { version: "v2.1", date: "Feb 5, 2026", author: "Sarah Chen", changes: "Updated ROI formula, added compliance KPI" },
              { version: "v2.0", date: "Jan 20, 2026", author: "Sarah Chen", changes: "Major revision: added 3 new KPIs, restructured categories" },
              { version: "v1.3", date: "Dec 15, 2025", author: "James Park", changes: "Adjusted baseline values for server consolidation" },
              { version: "v1.0", date: "Nov 1, 2025", author: "Sarah Chen", changes: "Initial model creation" },
            ].map((v) => (
              <div key={v.version} className="flex items-start gap-4 p-4 bg-white border border-zinc-200 rounded-2xl">
                <span className="px-2.5 py-1 bg-zinc-100 rounded-lg text-[12px] font-mono font-semibold text-zinc-700 flex-shrink-0">{v.version}</span>
                <div className="flex-1">
                  <p className="text-[13px] text-zinc-700">{v.changes}</p>
                  <p className="text-[11px] text-zinc-400 mt-1">{v.author} &middot; {v.date}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
