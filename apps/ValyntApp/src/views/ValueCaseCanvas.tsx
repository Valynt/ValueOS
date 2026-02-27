import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Clock,
  Layers,
  Play,
  RotateCcw,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useMergedContext } from "@/hooks/useDomainPacks";

import { HypothesisStage } from "./canvas/HypothesisStage";
import { ModelStage } from "./canvas/ModelStage";
import { IntegrityStage } from "./canvas/IntegrityStage";
import { NarrativeStage } from "./canvas/NarrativeStage";
import { RealizationStage } from "./canvas/RealizationStage";
import { AgentThread } from "./canvas/AgentThread";
import { EvidenceDrawer } from "./canvas/EvidenceDrawer";

// Workflow stages — the core loop
const stages = [
  { key: "hypothesis", label: "Hypothesis", color: "bg-blue-500", description: "Discovery & claims" },
  { key: "model", label: "Model", color: "bg-violet-500", description: "Value architecture" },
  { key: "integrity", label: "Integrity", color: "bg-amber-500", description: "Verify & challenge" },
  { key: "narrative", label: "Narrative", color: "bg-pink-500", description: "Assemble & export" },
  { key: "realization", label: "Realization", color: "bg-emerald-500", description: "Track & prove" },
];

export default function ValueCaseCanvas() {
  const { oppId, caseId } = useParams();
  const [activeStage, setActiveStage] = useState("hypothesis");
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const { data: merged } = useMergedContext(caseId);

  const stageContent: Record<string, React.ReactNode> = {
    hypothesis: <HypothesisStage />,
    model: <ModelStage />,
    integrity: <IntegrityStage />,
    narrative: <NarrativeStage />,
    realization: <RealizationStage />,
  };

  const currentStage = stages.find((s) => s.key === activeStage);

  return (
    <div className="h-full flex flex-col">
      {/* Top bar */}
      <div className="px-6 py-4 border-b border-zinc-200 bg-white flex items-center gap-4 flex-shrink-0">
        <Link to={`/opportunities/${oppId}`} className="p-1.5 rounded-lg hover:bg-zinc-100">
          <ArrowLeft className="w-4 h-4 text-zinc-400" />
        </Link>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-[15px] font-black text-zinc-950 tracking-tight truncate">
              Acme Corp — Enterprise Platform Migration
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 flex-shrink-0">
              Running
            </span>
            {merged?.pack && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-violet-50 text-violet-700 flex-shrink-0">
                <Layers className="w-2.5 h-2.5" />
                {merged.pack.name}
              </span>
            )}
          </div>
          <p className="text-[11px] text-zinc-400">{caseId || "VC-1024"}</p>
        </div>

        {/* Confidence */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[11px] text-zinc-400">Confidence</span>
          <div className="w-20 h-2 bg-zinc-100 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full" style={{ width: "87%" }} />
          </div>
          <span className="text-[12px] font-semibold text-zinc-700">87%</span>
        </div>

        {/* Version history */}
        <button className="flex items-center gap-1.5 px-3 py-2 border border-zinc-200 rounded-xl text-[12px] font-medium text-zinc-700 hover:bg-zinc-50">
          <Clock className="w-3.5 h-3.5" />
          v12
        </button>

        {/* Evidence */}
        <button
          onClick={() => setEvidenceOpen(!evidenceOpen)}
          className="flex items-center gap-1.5 px-3 py-2 border border-zinc-200 rounded-xl text-[12px] font-medium text-zinc-700 hover:bg-zinc-50"
        >
          <Shield className="w-3.5 h-3.5" />
          Evidence
        </button>

        {/* Run stage */}
        <button className="flex items-center gap-1.5 px-3 py-2 bg-zinc-950 text-white rounded-xl text-[12px] font-medium hover:bg-zinc-800">
          <Play className="w-3.5 h-3.5" />
          Run Stage
        </button>
      </div>

      {/* Stage selector — the workflow loop */}
      <div className="px-6 py-3 border-b border-zinc-100 bg-white flex items-center gap-1 flex-shrink-0">
        {stages.map((s) => (
          <button
            key={s.key}
            onClick={() => setActiveStage(s.key)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-medium transition-colors",
              activeStage === s.key
                ? "bg-zinc-950 text-white"
                : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
            )}
          >
            <div className={cn("w-2 h-2 rounded-full", s.color)} />
            {s.label}
          </button>
        ))}

        {/* Loop indicator */}
        <div className="ml-auto flex items-center gap-1.5 text-[11px] text-zinc-400">
          <RotateCcw className="w-3 h-3" />
          <span>Iterate anytime</span>
        </div>
      </div>

      {/* 2-panel body: canvas + agent thread */}
      <div className="flex-1 flex overflow-hidden">
        {/* Canvas (main content area) */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Stage header */}
          <div className="flex items-center gap-3 mb-5">
            <div className={cn("w-3 h-3 rounded-full", currentStage?.color)} />
            <h3 className="text-[15px] font-black text-zinc-950 tracking-tight">
              {currentStage?.label}
            </h3>
            <span className="text-[11px] text-zinc-400">{currentStage?.description}</span>
            <span className="text-[11px] text-zinc-300 ml-auto">Last updated 25m ago</span>
          </div>
          {stageContent[activeStage]}
        </div>

        {/* Agent thread panel */}
        <div className="w-[340px] border-l border-zinc-200 bg-white p-5 overflow-y-auto flex-shrink-0 hidden xl:block">
          <AgentThread />
        </div>
      </div>

      {/* Evidence drawer */}
      <EvidenceDrawer open={evidenceOpen} onClose={() => setEvidenceOpen(false)} />
    </div>
  );
}
