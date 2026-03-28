import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Download,
  Layers,
  Play,
  RotateCcw,
  Shield,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { AgentThread } from "./canvas/AgentThread";
import { EvidenceDrawer } from "./canvas/EvidenceDrawer";
import { ExpansionStage } from "./canvas/ExpansionStage";
import { HypothesisStage } from "./canvas/HypothesisStage";
import { IntegrityStage } from "./canvas/IntegrityStage";
import { ModelStage } from "./canvas/ModelStage";
import { NarrativeStage } from "./canvas/NarrativeStage";
import { RealizationStage } from "./canvas/RealizationStage";
import { ValueGraphStage } from "./canvas/ValueGraphStage";

import { useToast } from "@/components/ui/use-toast";
import type { AgentJobResult } from "@/hooks/useAgentJob";
import { usePptxExport } from "@/hooks/useCaseExport";
import { useCase } from "@/hooks/useCases";
import { useMergedContext } from "@/hooks/useDomainPacks";
import { cn } from "@/lib/utils";

interface StageDefinition {
  key: string;
  label: string;
  color: string;
  description: string;
}

interface StageExecutionMetadata {
  status?: "pending" | "in_progress" | "blocked" | "complete";
  is_complete?: boolean;
  blocked_reason?: string;
  prerequisites?: string[];
  completion_criteria?: string[];
  last_updated_at?: string;
}

interface WorkflowExecutionMetadata {
  active_stage?: string;
  in_progress_stage?: string;
  blocked_stage?: string;
  stages?: Record<string, StageExecutionMetadata>;
}

interface MilestoneDefinition {
  key: "discover" | "analyze" | "validate" | "decide";
  label: string;
  progressCopy: string;
  stageKeys: string[];
}

const stages: StageDefinition[] = [
  { key: "hypothesis", label: "Hypothesis", color: "bg-blue-500", description: "Discovery & claims" },
  { key: "model", label: "Model", color: "bg-violet-500", description: "Value architecture" },
  { key: "integrity", label: "Integrity", color: "bg-amber-500", description: "Verify & challenge" },
  { key: "narrative", label: "Narrative", color: "bg-pink-500", description: "Assemble & export" },
  { key: "realization", label: "Realization", color: "bg-emerald-500", description: "Track & prove" },
  { key: "expansion", label: "Expansion", color: "bg-violet-400", description: "Grow & expand" },
  { key: "value-graph", label: "Value Graph", color: "bg-orange-500", description: "Causal graph" },
];

const milestones: MilestoneDefinition[] = [
  {
    key: "discover",
    label: "Discover",
    progressCopy: "Capture and frame value hypotheses grounded in customer context.",
    stageKeys: ["hypothesis"],
  },
  {
    key: "analyze",
    label: "Analyze",
    progressCopy: "Quantify value architecture and map drivers to measurable outcomes.",
    stageKeys: ["model", "value-graph"],
  },
  {
    key: "validate",
    label: "Validate",
    progressCopy: "Pressure-test assumptions and compile evidence-backed narrative outputs.",
    stageKeys: ["integrity", "narrative"],
  },
  {
    key: "decide",
    label: "Decide",
    progressCopy: "Align realization execution and expansion plans for operational decisions.",
    stageKeys: ["realization", "expansion"],
  },
];

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function parseStageExecutionMetadata(input: unknown): StageExecutionMetadata {
  if (!isObjectRecord(input)) return {};
  const status = input.status;
  return {
    status: status === "pending" || status === "in_progress" || status === "blocked" || status === "complete"
      ? status
      : undefined,
    is_complete: typeof input.is_complete === "boolean" ? input.is_complete : undefined,
    blocked_reason: typeof input.blocked_reason === "string" ? input.blocked_reason : undefined,
    prerequisites: toStringList(input.prerequisites),
    completion_criteria: toStringList(input.completion_criteria),
    last_updated_at: typeof input.last_updated_at === "string" ? input.last_updated_at : undefined,
  };
}

function parseWorkflowExecutionMetadata(input: unknown): WorkflowExecutionMetadata {
  if (!isObjectRecord(input)) return {};
  const stagesValue = isObjectRecord(input.stages) ? input.stages : {};
  const stagesRecord: Record<string, StageExecutionMetadata> = {};

  Object.entries(stagesValue).forEach(([stageKey, stageValue]) => {
    stagesRecord[stageKey] = parseStageExecutionMetadata(stageValue);
  });

  return {
    active_stage: typeof input.active_stage === "string" ? input.active_stage : undefined,
    in_progress_stage: typeof input.in_progress_stage === "string" ? input.in_progress_stage : undefined,
    blocked_stage: typeof input.blocked_stage === "string" ? input.blocked_stage : undefined,
    stages: stagesRecord,
  };
}

function getStageState(
  stageKey: string,
  workflowExecution: WorkflowExecutionMetadata
): "pending" | "in_progress" | "blocked" | "complete" {
  const stage = workflowExecution.stages?.[stageKey];
  if (stage?.status) return stage.status;
  if (stage?.is_complete) return "complete";
  if (workflowExecution.blocked_stage === stageKey) return "blocked";
  if (workflowExecution.in_progress_stage === stageKey || workflowExecution.active_stage === stageKey) return "in_progress";
  return "pending";
}

function getMilestoneCompletionCriteria(
  milestone: MilestoneDefinition,
  workflowExecution: WorkflowExecutionMetadata
): string[] {
  return milestone.stageKeys.flatMap((stageKey) => workflowExecution.stages?.[stageKey]?.completion_criteria ?? []);
}

export default function ValueCaseCanvas() {
  const { oppId, caseId } = useParams();
  const [activeStage, setActiveStage] = useState("hypothesis");
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [activeDirectResult, setActiveDirectResult] = useState<AgentJobResult | null>(null);
  const [guardMessage, setGuardMessage] = useState<string | null>(null);

  const handleRunStarted = (jobId: string, direct?: AgentJobResult) => {
    setActiveRunId(jobId);
    setActiveDirectResult(direct ?? null);
  };
  const { data: merged } = useMergedContext(caseId);
  const { data: valueCase, isLoading: caseLoading } = useCase(caseId);
  const pptxExport = usePptxExport(caseId);
  const { toast } = useToast();

  const workflowExecution = useMemo(
    () => parseWorkflowExecutionMetadata(valueCase?.metadata?.workflow_execution),
    [valueCase?.metadata]
  );

  const stageStatuses = useMemo(
    () => Object.fromEntries(stages.map((stage) => [stage.key, getStageState(stage.key, workflowExecution)])),
    [workflowExecution]
  );

  const activeMilestone = useMemo(
    () => milestones.find((milestone) => milestone.stageKeys.includes(activeStage)) ?? milestones[0],
    [activeStage]
  );

  const milestoneCriteria = useMemo(
    () => getMilestoneCompletionCriteria(activeMilestone, workflowExecution),
    [activeMilestone, workflowExecution]
  );

  const recommendedNextAction = useMemo(() => {
    const orderedStages = stages.map((stage) => stage.key);

    for (const stageKey of orderedStages) {
      const state = stageStatuses[stageKey];
      const stageLabel = stages.find((item) => item.key === stageKey)?.label ?? stageKey;
      const stageMilestone = milestones.find((milestone) => milestone.stageKeys.includes(stageKey))?.label ?? "the journey";

      if (state === "blocked") {
        const blockedReason = workflowExecution.stages?.[stageKey]?.blocked_reason;
        return `Unblock ${stageLabel}${blockedReason ? `: ${blockedReason}` : " by satisfying prerequisites."}`;
      }
      if (state === "in_progress") {
        return `Continue ${stageLabel} to advance ${stageMilestone}.`;
      }
      if (state === "pending") {
        return `Run ${stageLabel} next to progress ${stageMilestone}.`;
      }
    }

    return "All milestones are complete. Review evidence and prepare stakeholder export.";
  }, [stageStatuses, workflowExecution.stages]);

  useEffect(() => {
    if (pptxExport.isError) {
      toast({
        title: "Export failed",
        description: pptxExport.error?.message ?? "Could not generate PPTX. Try again.",
        variant: "destructive",
      });
    }
  }, [pptxExport.isError, pptxExport.error, toast]);

  const caseTitle = caseLoading
    ? null
    : valueCase
      ? [valueCase.company_profiles?.company_name, valueCase.name].filter(Boolean).join(" — ")
      : caseId ?? "Value Case";

  const stageContent: Record<string, React.ReactNode> = {
    hypothesis: <HypothesisStage onRunStarted={handleRunStarted} />,
    model: <ModelStage />,
    integrity: <IntegrityStage caseId={caseId} />,
    narrative: <NarrativeStage caseId={caseId} opportunityId={oppId} />,
    realization: <RealizationStage caseId={caseId} />,
    expansion: <ExpansionStage caseId={caseId} />,
    "value-graph": <ValueGraphStage opportunityId={oppId} />,
  };

  const currentStage = stages.find((s) => s.key === activeStage);

  const tryEnterStage = (targetStage: StageDefinition) => {
    const stageStatus = stageStatuses[targetStage.key];
    if (stageStatus !== "blocked") {
      setGuardMessage(null);
      setActiveStage(targetStage.key);
      return;
    }

    const stageMetadata = workflowExecution.stages?.[targetStage.key];
    const prerequisites = stageMetadata?.prerequisites ?? [];
    const blockedReason = stageMetadata?.blocked_reason ?? "Required upstream work is incomplete.";
    const prerequisiteSummary = prerequisites.length > 0
      ? `Prerequisites: ${prerequisites.join(", ")}.`
      : "No explicit prerequisites were provided by execution metadata.";

    setGuardMessage(`${targetStage.label} is currently blocked. ${blockedReason} ${prerequisiteSummary}`);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 border-b border-zinc-200 bg-white flex items-center gap-4 flex-shrink-0">
        <Link to={`/opportunities/${oppId}`} className="p-1.5 rounded-lg hover:bg-zinc-100">
          <ArrowLeft className="w-4 h-4 text-zinc-400" />
        </Link>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-[15px] font-black text-zinc-950 tracking-tight truncate">
              {caseTitle ?? <span className="inline-block w-48 h-4 bg-zinc-100 rounded animate-pulse" />}
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

        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[11px] text-zinc-400">Confidence</span>
          <div className="w-20 h-2 bg-zinc-100 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full" style={{ width: "87%" }} />
          </div>
          <span className="text-[12px] font-semibold text-zinc-700">87%</span>
        </div>

        <button className="flex items-center gap-1.5 px-3 py-2 border border-zinc-200 rounded-xl text-[12px] font-medium text-zinc-700 hover:bg-zinc-50">
          <Clock className="w-3.5 h-3.5" />
          v12
        </button>

        <button
          onClick={() => setEvidenceOpen(!evidenceOpen)}
          className="flex items-center gap-1.5 px-3 py-2 border border-zinc-200 rounded-xl text-[12px] font-medium text-zinc-700 hover:bg-zinc-50"
        >
          <Shield className="w-3.5 h-3.5" />
          Evidence
        </button>

        <button
          onClick={() => pptxExport.mutate({ title: caseTitle ?? undefined })}
          disabled={pptxExport.isPending}
          className="flex items-center gap-1.5 px-3 py-2 border border-zinc-200 rounded-xl text-[12px] font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Export as PowerPoint"
        >
          <Download className="w-3.5 h-3.5" />
          {pptxExport.isPending ? "Exporting…" : "Export"}
        </button>

        <button className="flex items-center gap-1.5 px-3 py-2 bg-zinc-950 text-white rounded-xl text-[12px] font-medium hover:bg-zinc-800">
          <Play className="w-3.5 h-3.5" />
          Run Stage
        </button>
      </div>

      <div className="px-6 py-3 border-b border-zinc-100 bg-white flex items-center gap-1 flex-shrink-0">
        {stages.map((s) => {
          const status = stageStatuses[s.key];
          return (
            <button
              key={s.key}
              onClick={() => tryEnterStage(s)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-medium transition-colors",
                activeStage === s.key
                  ? "bg-zinc-950 text-white"
                  : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700",
                status === "blocked" ? "opacity-70" : ""
              )}
            >
              <div className={cn("w-2 h-2 rounded-full", s.color)} />
              {s.label}
            </button>
          );
        })}

        <div className="ml-auto flex items-center gap-1.5 text-[11px] text-zinc-400">
          <RotateCcw className="w-3 h-3" />
          <span>Iterate anytime</span>
        </div>
      </div>

      <div className="px-6 py-3 border-b border-zinc-100 bg-zinc-50 flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-zinc-500 font-semibold">Journey milestone</p>
          <p className="text-[14px] font-semibold text-zinc-900">
            {activeMilestone.label}
          </p>
          <p className="text-[12px] text-zinc-600">{activeMilestone.progressCopy}</p>
          <p className="text-[12px] text-zinc-700 mt-2" data-testid="guided-next-action">
            Recommended next action: {recommendedNextAction}
          </p>
          {guardMessage && (
            <p className="text-[12px] text-amber-700 mt-2" role="alert">
              {guardMessage}
            </p>
          )}
        </div>

        <div className="min-w-[280px]">
          <p className="text-[11px] uppercase tracking-wide text-zinc-500 font-semibold">Completion criteria</p>
          {milestoneCriteria.length > 0 ? (
            <ul className="mt-1 space-y-1">
              {milestoneCriteria.map((criteria, index) => (
                <li key={`${criteria}-${index}`} className="text-[12px] text-zinc-700 flex items-start gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mt-0.5" />
                  <span>{criteria}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[12px] text-zinc-500">No completion criteria reported by workflow execution metadata yet.</p>
          )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6">
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

        <div className="w-[340px] border-l border-zinc-200 bg-white p-5 overflow-y-auto flex-shrink-0 hidden xl:block">
          <AgentThread runId={activeRunId} directResult={activeDirectResult} />
        </div>
      </div>

      <EvidenceDrawer open={evidenceOpen} onClose={() => setEvidenceOpen(false)} />
    </div>
  );
}
