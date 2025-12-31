import { useState } from "react";
import {
  DollarSign,
  Loader2,
  RefreshCw,
  Settings2,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useDrawer } from "../contexts/DrawerContext";
import AgentBadge from "../components/Agents/AgentBadge";
import ConfidenceIndicator from "../components/Agents/ConfidenceIndicator";
import Tooltip from "../components/UI/Tooltip";

export default function ROICalculator() {
  const { openDrawer } = useDrawer();
  const [engHeadcount, setEngHeadcount] = useState(20);
  const [engSalary, setEngSalary] = useState(130);
  const [buildCost, setBuildCost] = useState(250);
  const [efficiencyTarget, setEfficiencyTarget] = useState(20);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizationGoal, setOptimizationGoal] = useState<
    "roi" | "npv" | "payback"
  >("roi");
  const [budgetConstraint, setBudgetConstraint] = useState(500);

  const devProductivity = Math.round(
    engHeadcount * engSalary * (efficiencyTarget / 100)
  );
  const maintenanceAvoidance = 250;
  const totalBenefits = devProductivity + maintenanceAvoidance;
  const netBenefit = totalBenefits - buildCost;
  const roi = Math.round((netBenefit / buildCost) * 100);
  const payback = (buildCost / (totalBenefits / 12)).toFixed(1);
  const npv = ((netBenefit * 2.8) / 1000).toFixed(2);

  const handleSmartSolve = () => {
    setIsOptimizing(true);
    setTimeout(() => {
      if (optimizationGoal === "roi") {
        setEfficiencyTarget(35);
        setBuildCost(180);
      } else if (optimizationGoal === "npv") {
        setEngHeadcount(35);
        setEfficiencyTarget(25);
      } else {
        setBuildCost(150);
        setEfficiencyTarget(30);
      }
      setIsOptimizing(false);
    }, 1500);
  };

  const confidenceScore = Math.min(94, 70 + Math.round(efficiencyTarget * 0.8));

  const openCostInputsDrawer = () => {
    openDrawer(
      "Cost Inputs",
      <div className="space-y-6">
        <p className="text-sm text-neutral-400">
          Enter the baseline costs for your project. These values are used to
          calculate ROI and payback period.
        </p>
        <div className="space-y-5">
          <div>
            <label className="text-xs font-medium text-neutral-500 uppercase tracking-wider flex items-center justify-between mb-3">
              <span>Engineering Headcount</span>
              <span className="text-white font-semibold text-sm">
                {engHeadcount}
              </span>
            </label>
            <input
              type="range"
              className="w-full"
              min="1"
              max="50"
              value={engHeadcount}
              onChange={(e) => setEngHeadcount(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-neutral-500 uppercase tracking-wider flex items-center justify-between mb-3">
              <span>Avg Salary</span>
              <span className="text-white font-semibold text-sm">
                ${engSalary}k
              </span>
            </label>
            <input
              type="range"
              className="w-full"
              min="80"
              max="200"
              value={engSalary}
              onChange={(e) => setEngSalary(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-neutral-500 uppercase tracking-wider flex items-center justify-between mb-3">
              <span>Build Cost</span>
              <span className="text-white font-semibold text-sm">
                ${buildCost}k
              </span>
            </label>
            <input
              type="range"
              className="w-full"
              min="50"
              max="500"
              value={buildCost}
              onChange={(e) => setBuildCost(Number(e.target.value))}
            />
          </div>
        </div>
      </div>
    );
  };

  const openAssumptionsDrawer = () => {
    openDrawer(
      "Assumptions",
      <div className="space-y-6">
        <p className="text-sm text-neutral-400">
          These assumptions affect the projected benefits. The Adversarial Agent
          may challenge aggressive assumptions.
        </p>
        <div className="space-y-5">
          <div>
            <label className="text-xs font-medium text-neutral-500 uppercase tracking-wider flex items-center justify-between mb-3">
              <span>Efficiency Gain</span>
              <span className="text-white font-semibold text-sm">
                {efficiencyTarget}%
              </span>
            </label>
            <input
              type="range"
              className="w-full"
              min="5"
              max="50"
              value={efficiencyTarget}
              onChange={(e) => setEfficiencyTarget(Number(e.target.value))}
            />
            <div className="mt-4 p-3 bg-neutral-800/50 border border-neutral-700 rounded-xl">
              <p className="text-xs text-neutral-400">
                Industry benchmarks suggest 12-15% is realistic for brownfield
                deployments.
              </p>
            </div>
          </div>
        </div>
        <button className="w-full btn btn-ghost h-10 text-xs text-neutral-500 justify-center hover:text-neutral-300">
          <RefreshCw className="w-3.5 h-3.5 mr-2" />
          Reset to defaults
        </button>
      </div>
    );
  };

  const openOptimizerDrawer = () => {
    openDrawer(
      "Smart Solver",
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <AgentBadge agentId="financial-modeling" size="sm" />
          <span className="text-xs text-neutral-500">
            Financial Modeling Agent
          </span>
        </div>
        <p className="text-sm text-neutral-400">
          Let the agent automatically adjust parameters to optimize for your
          selected goal while respecting your budget constraint.
        </p>
        <div className="space-y-5">
          <fieldset>
            <legend className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-3">
              Optimize For
            </legend>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "roi", label: "Max ROI" },
                { id: "npv", label: "Max NPV" },
                { id: "payback", label: "Fast Payback" },
              ].map((goal) => (
                <button
                  key={goal.id}
                  onClick={() =>
                    setOptimizationGoal(goal.id as "roi" | "npv" | "payback")
                  }
                  className={`px-3 py-3 text-xs font-medium rounded-xl border transition-all ${
                    optimizationGoal === goal.id
                      ? "bg-primary/20 border-primary/50 text-primary shadow-glow-teal"
                      : "bg-white/5 border-white/10 text-neutral-400 hover:text-white hover:border-white/20"
                  }`}
                >
                  {goal.label}
                </button>
              ))}
            </div>
          </fieldset>
          <div>
            <label className="text-xs font-medium text-neutral-500 uppercase tracking-wider flex items-center justify-between mb-3">
              <span>Budget Constraint</span>
              <span className="text-white font-semibold text-sm">
                ${budgetConstraint}k
              </span>
            </label>
            <input
              type="range"
              className="w-full"
              min="100"
              max="1000"
              step="50"
              value={budgetConstraint}
              onChange={(e) => setBudgetConstraint(Number(e.target.value))}
            />
          </div>
        </div>
        <button
          onClick={handleSmartSolve}
          disabled={isOptimizing}
          className="w-full btn btn-primary h-12 justify-center text-sm font-semibold"
        >
          {isOptimizing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Optimizing...
            </>
          ) : (
            <>
              <Target className="w-4 h-4 mr-2" />
              Run Optimization
            </>
          )}
        </button>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="h-14 border-b border-white/10 px-6 flex items-center justify-between bg-black/20 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold text-white">Business Case</h1>
          <span className="text-sm text-neutral-500">Acme Corp</span>
        </div>
        <div className="flex items-center gap-2">
          <AgentBadge
            agentId="financial-modeling"
            size="sm"
            pulse={isOptimizing}
          />
          <AgentBadge agentId="integrity" size="sm" />
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <button
            onClick={openCostInputsDrawer}
            className="bento-card text-left hover:border-white/20 hover:bg-neutral-900/60 group"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                  <DollarSign className="w-4 h-4 text-primary" />
                </div>
                <span className="text-[10px] font-semibold text-neutral-500 uppercase tracking-widest">
                  Cost Inputs
                </span>
              </div>
              <Settings2 className="w-4 h-4 text-neutral-600 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="text-3xl font-bold text-white tracking-tight">
              ${buildCost}k
            </div>
            <div className="text-xs text-neutral-500 mt-1">
              {engHeadcount} engineers at ${engSalary}k avg
            </div>
          </button>

          <button
            onClick={openAssumptionsDrawer}
            className="bento-card text-left hover:border-white/20 hover:bg-neutral-900/60 group"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-neutral-700/50 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-neutral-400" />
                </div>
                <span className="text-[10px] font-semibold text-neutral-500 uppercase tracking-widest">
                  Assumptions
                </span>
              </div>
              <Settings2 className="w-4 h-4 text-neutral-600 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="text-3xl font-bold text-white tracking-tight">
              {efficiencyTarget}%
            </div>
            <div className="text-xs text-neutral-500 mt-1">
              Efficiency gain target
            </div>
          </button>

          <button
            onClick={openOptimizerDrawer}
            className="bento-card text-left bg-primary/5 border-primary/20 hover:border-primary/40 hover:shadow-glow-teal group"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-primary" />
                </div>
                <span className="text-[10px] font-semibold text-primary/80 uppercase tracking-widest">
                  Smart Solver
                </span>
              </div>
              <Settings2 className="w-4 h-4 text-primary/50 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="text-xl font-semibold text-white">
              Auto-Optimize
            </div>
            <div className="text-xs text-neutral-500 mt-1">
              Let AI find the best parameters
            </div>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bento-card bg-primary/5">
            <div className="flex items-center justify-between mb-4">
              <div className="text-[10px] text-neutral-500 uppercase tracking-widest font-semibold flex items-center gap-1">
                3-Year ROI
                <Tooltip
                  content="Return on Investment calculated over a 3-year period."
                  showIcon={false}
                >
                  <span className="sr-only">More info</span>
                </Tooltip>
              </div>
              <AgentBadge agentId="integrity" size="sm" showName={false} />
            </div>
            <ConfidenceIndicator
              value={roi * 3}
              confidence={confidenceScore}
              label="%"
              size="lg"
            />
          </div>
          <div className="bento-card">
            <div className="text-[10px] text-neutral-500 uppercase tracking-widest mb-4 font-semibold flex items-center gap-1">
              Net Present Value
              <Tooltip
                content="The present value of all future cash flows, discounted at the cost of capital."
                showIcon={false}
              >
                <span className="sr-only">More info</span>
              </Tooltip>
            </div>
            <ConfidenceIndicator
              value={parseFloat(npv)}
              confidence={confidenceScore - 2}
              label="M"
              size="lg"
            />
          </div>
          <div className="bento-card">
            <div className="text-[10px] text-neutral-500 uppercase tracking-widest mb-4 font-semibold flex items-center gap-1">
              Payback Period
              <Tooltip
                content="Time required to recover the initial investment."
                showIcon={false}
              >
                <span className="sr-only">More info</span>
              </Tooltip>
            </div>
            <ConfidenceIndicator
              value={parseFloat(payback)}
              confidence={confidenceScore + 3}
              label="months"
              size="lg"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bento-card">
            <h3 className="text-sm font-semibold text-white mb-6">
              3-Year Trajectory
            </h3>
            <div className="h-48 flex items-end justify-around gap-6">
              {[
                { h: 70, y: "Y1", val: `$${netBenefit}K` },
                { h: 110, y: "Y2", val: `$${Math.round(netBenefit * 1.5)}K` },
                { h: 130, y: "Y3", val: `$${Math.round(netBenefit * 2)}K` },
              ].map((bar, i) => (
                <div
                  key={i}
                  className="flex-1 flex flex-col items-center group"
                >
                  <div className="text-xs text-neutral-500 mb-2 group-hover:text-white transition-colors font-mono">
                    {bar.val}
                  </div>
                  <div
                    className="w-full bg-primary rounded-t-lg transition-all group-hover:shadow-glow-teal"
                    style={{ height: `${bar.h}px` }}
                  />
                  <div className="text-xs text-neutral-500 mt-3 font-semibold">
                    {bar.y}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bento-card">
            <h3 className="text-sm font-semibold text-white mb-6">
              Value Breakdown
            </h3>
            <div className="space-y-5">
              {[
                {
                  label: "Dev Productivity",
                  value: `$${devProductivity}K`,
                  pct: (devProductivity / totalBenefits) * 100,
                  conf: 91,
                },
                {
                  label: "Maintenance Avoidance",
                  value: `$${maintenanceAvoidance}K`,
                  pct: (maintenanceAvoidance / totalBenefits) * 100,
                  conf: 96,
                },
              ].map((item, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-neutral-400">{item.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-semibold font-mono">
                        {item.value}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium bg-primary/20 text-primary">
                        {item.conf}%
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-white/5 rounded-full h-1.5">
                    <div
                      className="bg-primary h-1.5 rounded-full transition-all"
                      style={{ width: `${item.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bento-card bg-white/[0.02]">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            Strategic Insights
            <AgentBadge
              agentId="financial-modeling"
              size="sm"
              showName={false}
            />
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div className="p-4 bg-white/5 rounded-xl border border-white/5 text-neutral-400">
              Ship products{" "}
              <span className="text-white font-semibold">2x faster</span>
            </div>
            <div className="p-4 bg-white/5 rounded-xl border border-white/5 text-neutral-400">
              Scale with{" "}
              <span className="text-white font-semibold">
                {efficiencyTarget}%
              </span>{" "}
              capacity boost
            </div>
            <div className="p-4 bg-white/5 rounded-xl border border-white/5 text-neutral-400">
              Reduce onboarding by{" "}
              <span className="text-white font-semibold">50%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
