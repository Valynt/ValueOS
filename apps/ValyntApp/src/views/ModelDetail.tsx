import { ArrowLeft, Boxes, Edit3, Loader2, Plus, Save, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { cn } from "@/lib/utils";
import { createModelScenario, fetchModelScenarios, type ModelScenario } from "@/services/modelScenariosService";

const model = {
  id: "MOD-01",
  name: "Cloud Migration ROI",
  version: "v2.1",
  category: "Infrastructure",
  description: "Quantifies the return on investment for enterprise cloud migration projects, including infrastructure savings and operational efficiency.",
  updatedAt: "Feb 5, 2026",
};

const kpis = [
  { id: "KPI-01", name: "Infrastructure Cost Savings", category: "Cost", formula: "current_infra_cost - projected_cloud_cost", baseline: "$2.4M/yr", target: "$600K/yr" },
  { id: "KPI-02", name: "Migration Timeline", category: "Timeline", formula: "planned_months", baseline: "18 months", target: "12 months" },
];

const tabs = ["Overview", "KPIs", "Scenarios", "History"];

export function ModelDetail() {
  const { id } = useParams();
  const modelId = id ?? model.id;
  const [activeTab, setActiveTab] = useState("KPIs");
  const [selectedKpi, setSelectedKpi] = useState(kpis[0]!);
  const [scenarios, setScenarios] = useState<ModelScenario[]>([]);
  const [scenarioLoading, setScenarioLoading] = useState(false);
  const [scenarioError, setScenarioError] = useState<string | null>(null);
  const [selectedScenarioIds, setSelectedScenarioIds] = useState<string[]>([]);

  const loadScenarios = async () => {
    setScenarioLoading(true);
    setScenarioError(null);
    try {
      const response = await fetchModelScenarios(modelId);
      setScenarios(response);
      setSelectedScenarioIds(response.slice(0, 2).map((s) => s.id));
    } catch (error) {
      setScenarioError(error instanceof Error ? error.message : "Unable to load scenarios");
    } finally {
      setScenarioLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "Scenarios") {
      void loadScenarios();
    }
  }, [activeTab]);

  const selectedScenarios = useMemo(
    () => scenarios.filter((scenario) => selectedScenarioIds.includes(scenario.id)).slice(0, 3),
    [scenarios, selectedScenarioIds],
  );

  const addScenario = async () => {
    try {
      await createModelScenario(modelId, {
        name: `Scenario ${scenarios.length + 1}`,
        description: "New variant",
        assumptions: [{ key: "migrationMonths", value: 12, unit: "months" }],
      });
      await loadScenarios();
    } catch (error) {
      setScenarioError(error instanceof Error ? error.message : "Unable to create scenario");
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 lg:px-10 pt-6 lg:pt-10 pb-4">
        <div className="flex items-center gap-2 mb-4">
          <Link to="/models" className="flex items-center gap-1.5 text-[13px] text-zinc-400 hover:text-zinc-700"><ArrowLeft className="w-4 h-4" />Value Models</Link>
          <span className="text-zinc-300">/</span><span className="text-[13px] text-zinc-700 font-medium">{model.id}</span>
        </div>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1"><div className="w-10 h-10 bg-violet-50 rounded-xl flex items-center justify-center"><Boxes className="w-5 h-5 text-violet-600" /></div><div><h1 className="text-xl font-black text-zinc-950 tracking-[-0.05em]">{model.name}</h1><p className="text-[12px] text-zinc-400">{model.version} · {model.category} · Updated {model.updatedAt}</p></div></div>
            <p className="text-[13px] text-zinc-500 mt-2 max-w-2xl">{model.description}</p>
          </div>
          <button className="flex items-center gap-2 px-3 py-2 border border-zinc-200 rounded-xl text-[12px] font-medium text-zinc-700 hover:bg-zinc-50"><Edit3 className="w-3.5 h-3.5" />Edit Model</button>
        </div>
      </div>

      <div className="px-6 lg:px-10 border-b border-zinc-200"><div className="flex gap-1">{tabs.map((tab) => <button key={tab} onClick={() => setActiveTab(tab)} className={cn("px-4 py-3 text-[13px] font-medium border-b-2 transition-colors", activeTab === tab ? "border-zinc-950 text-zinc-950" : "border-transparent text-zinc-400 hover:text-zinc-700")}>{tab}</button>)}</div></div>

      <div className="flex-1 overflow-hidden">
        {activeTab === "Overview" && <div className="p-6 lg:p-10">Overview</div>}

        {activeTab === "KPIs" && (
          <div className="flex h-full">
            <div className="w-[340px] border-r border-zinc-200 overflow-y-auto p-4 space-y-2 flex-shrink-0">
              <div className="flex items-center justify-between mb-3"><span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-400">{kpis.length} KPIs</span><button className="text-[12px] text-zinc-400 hover:text-zinc-700 flex items-center gap-1"><Plus className="w-3 h-3" /> Add</button></div>
              {kpis.map((kpi) => <button key={kpi.id} onClick={() => setSelectedKpi(kpi)} className={cn("w-full text-left p-3 rounded-xl", selectedKpi.id === kpi.id ? "bg-zinc-950 text-white" : "hover:bg-zinc-100")}><p className="text-[13px] font-medium">{kpi.name}</p></button>)}
            </div>
            <div className="flex-1 overflow-y-auto p-6 lg:p-8"><div className="max-w-lg space-y-6"><div className="flex items-center justify-between"><h3 className="text-lg font-black text-zinc-950 tracking-tight">{selectedKpi.name}</h3><button className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-950 text-white rounded-lg text-[12px]"><Save className="w-3.5 h-3.5" />Save</button></div><div className="p-5 bg-zinc-50 rounded-2xl border border-zinc-200"><div className="flex items-center gap-2 mb-3"><TrendingUp className="w-4 h-4 text-zinc-500" /><span className="text-[12px] font-medium text-zinc-600">Baseline → Target Preview</span></div></div></div></div>
          </div>
        )}

        {activeTab === "Scenarios" && (
          <div className="p-6 lg:p-10 space-y-4 overflow-y-auto h-full">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-zinc-900">Scenario Modeling</h3>
              <button onClick={() => void addScenario()} className="flex items-center gap-1.5 px-3 py-2 bg-zinc-900 text-white rounded-lg text-[12px]"><Plus className="w-3.5 h-3.5" />New Variant</button>
            </div>

            {scenarioLoading && <div className="flex items-center text-sm text-zinc-500"><Loader2 className="w-4 h-4 animate-spin mr-2" />Loading scenarios...</div>}
            {scenarioError && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{scenarioError}</div>}
            {!scenarioLoading && scenarios.length === 0 && <div className="text-sm text-zinc-500">No scenarios created yet.</div>}

            {scenarios.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="border border-zinc-200 rounded-xl p-4">
                  <p className="text-xs uppercase text-zinc-400 mb-3">Persisted Variants</p>
                  <div className="space-y-2">
                    {scenarios.map((scenario) => (
                      <label key={scenario.id} className="flex items-center justify-between rounded-lg border border-zinc-200 px-3 py-2">
                        <span className="text-sm text-zinc-700">{scenario.name}</span>
                        <input type="checkbox" checked={selectedScenarioIds.includes(scenario.id)} onChange={() => setSelectedScenarioIds((prev) => prev.includes(scenario.id) ? prev.filter((idValue) => idValue !== scenario.id) : [...prev, scenario.id])} />
                      </label>
                    ))}
                  </div>
                </div>

                <div className="border border-zinc-200 rounded-xl p-4">
                  <p className="text-xs uppercase text-zinc-400 mb-3">Comparison</p>
                  {selectedScenarios.length === 0 ? (
                    <p className="text-sm text-zinc-500">Select up to 3 scenarios to compare.</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedScenarios.map((scenario) => (
                        <div key={scenario.id} className="rounded-lg bg-zinc-50 border border-zinc-200 p-3">
                          <p className="text-sm font-medium text-zinc-900">{scenario.name}</p>
                          <p className="text-xs text-zinc-500 mt-1">ROI: {scenario.roiPercent}% · Payback: {scenario.paybackMonths} months · Savings: ${scenario.annualSavings.toLocaleString()}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "History" && <div className="p-6 lg:p-10">History</div>}
      </div>
    </div>
  );
}
