import { ArrowRight, BarChart3, Boxes, Plus, Search, Tag } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { cn } from "@/lib/utils";

const models = [
  { id: "MOD-01", name: "Cloud Migration ROI", status: "active", kpis: 8, version: "v2.1", usedBy: 3, category: "Infrastructure", updatedAt: "Feb 5, 2026" },
  { id: "MOD-02", name: "TCO Reduction Framework", status: "active", kpis: 5, version: "v1.3", usedBy: 2, category: "Cost Optimization", updatedAt: "Jan 28, 2026" },
  { id: "MOD-03", name: "Revenue Acceleration Model", status: "active", kpis: 12, version: "v3.0", usedBy: 5, category: "Revenue", updatedAt: "Feb 7, 2026" },
  { id: "MOD-04", name: "Risk Quantification Matrix", status: "draft", kpis: 6, version: "v0.9", usedBy: 0, category: "Risk", updatedAt: "Feb 8, 2026" },
  { id: "MOD-05", name: "Customer Retention Value", status: "active", kpis: 7, version: "v1.1", usedBy: 1, category: "Revenue", updatedAt: "Jan 15, 2026" },
  { id: "MOD-06", name: "Operational Efficiency Baseline", status: "archived", kpis: 4, version: "v1.0", usedBy: 0, category: "Operations", updatedAt: "Dec 1, 2025" },
];

const statusConfig: Record<string, { color: string; bg: string }> = {
  active: { color: "text-emerald-700", bg: "bg-emerald-50" },
  draft: { color: "text-amber-700", bg: "bg-amber-50" },
  archived: { color: "text-zinc-500", bg: "bg-zinc-100" },
};

export default function Models() {
  const [filter, setFilter] = useState("all");

  const filtered = filter === "all" ? models : models.filter((m) => m.status === filter);

  return (
    <div className="p-6 lg:p-10 max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-zinc-950 tracking-[-0.05em]">Value Models</h1>
          <p className="text-[13px] text-zinc-400 mt-1">Reusable modeling frameworks for value cases</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 bg-zinc-950 text-white rounded-xl text-[13px] font-medium hover:bg-zinc-800 transition-colors">
          <Plus className="w-4 h-4" />
          New Model
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-zinc-200 bg-white flex-1 max-w-xs">
          <Search className="w-4 h-4 text-zinc-400" />
          <input type="text" placeholder="Search models..." className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-zinc-400" />
        </div>
        <div className="flex items-center gap-1 bg-white border border-zinc-200 rounded-xl p-1">
          {["all", "active", "draft", "archived"].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors capitalize",
                filter === s ? "bg-zinc-950 text-white" : "text-zinc-500 hover:text-zinc-700"
              )}
            >
              {s === "all" ? "All" : s}
            </button>
          ))}
        </div>
      </div>

      {/* Card grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((m) => {
          const st = statusConfig[m.status];
          return (
            <Link
              key={m.id}
              to={`/models/${m.id}`}
              className="bg-white border border-zinc-200 rounded-3xl p-6 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] hover:border-zinc-300 hover:shadow-md transition-all group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 bg-violet-50 rounded-xl flex items-center justify-center">
                  <Boxes className="w-5 h-5 text-violet-600" />
                </div>
                <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize", st.color, st.bg)}>
                  {m.status}
                </span>
              </div>
              <h3 className="text-[14px] font-semibold text-zinc-900 mb-1 group-hover:text-zinc-950">{m.name}</h3>
              <div className="flex items-center gap-2 mb-4">
                <Tag className="w-3 h-3 text-zinc-400" />
                <span className="text-[12px] text-zinc-500">{m.category}</span>
                <span className="text-zinc-300">&middot;</span>
                <span className="text-[12px] text-zinc-400">{m.version}</span>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-zinc-100">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <BarChart3 className="w-3 h-3 text-zinc-400" />
                    <span className="text-[12px] text-zinc-500">{m.kpis} KPIs</span>
                  </div>
                  <span className="text-[12px] text-zinc-400">Used by {m.usedBy}</span>
                </div>
                <ArrowRight className="w-4 h-4 text-zinc-300 group-hover:text-zinc-500 transition-colors" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
