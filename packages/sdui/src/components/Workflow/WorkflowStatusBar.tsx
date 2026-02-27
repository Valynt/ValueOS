import React from "react";
import { Bot, CheckCircle, Circle, Loader2, SkipForward, XCircle } from "lucide-react";
import { ConfidenceDisplay } from "../Agent/ConfidenceDisplay";

export interface WorkflowStage {
  id: string;
  label: string;
  status: "pending" | "active" | "completed" | "failed" | "skipped";
}

export interface WorkflowStatusBarProps {
  stages: WorkflowStage[];
  currentStageId: string;
  agentName?: string;
  confidence?: number;
  startedAt?: string;
  className?: string;
}

const stageIcon: Record<WorkflowStage["status"], React.FC<{ className?: string }>> = {
  pending: Circle,
  active: Loader2,
  completed: CheckCircle,
  failed: XCircle,
  skipped: SkipForward,
};

const stageColor: Record<WorkflowStage["status"], string> = {
  pending: "text-muted-foreground",
  active: "text-primary",
  completed: "text-green-400",
  failed: "text-red-400",
  skipped: "text-muted-foreground/50",
};

const connectorColor: Record<WorkflowStage["status"], string> = {
  pending: "bg-border",
  active: "bg-primary/50",
  completed: "bg-green-400",
  failed: "bg-red-400",
  skipped: "bg-border/50",
};

export const WorkflowStatusBar: React.FC<WorkflowStatusBarProps> = ({
  stages,
  currentStageId,
  agentName,
  confidence,
  startedAt,
  className = "",
}) => {
  return (
    <div className={`bg-card border border-border rounded-lg p-4 ${className}`}>
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {agentName && (
            <span className="inline-flex items-center gap-1.5 text-sm text-foreground font-medium">
              <Bot className="w-4 h-4 text-primary" />
              {agentName}
            </span>
          )}
          {startedAt && (
            <span className="text-xs text-muted-foreground">
              Started {startedAt}
            </span>
          )}
        </div>
        {confidence !== undefined && (
          <ConfidenceDisplay data={{ score: confidence }} size="sm" showLabel={false} />
        )}
      </div>

      {/* Stage progress */}
      <div className="flex items-center">
        {stages.map((stage, i) => {
          const Icon = stageIcon[stage.status];
          const color = stageColor[stage.status];
          const isCurrent = stage.id === currentStageId;

          return (
            <React.Fragment key={stage.id}>
              <div
                className={`flex flex-col items-center gap-1 min-w-0 ${
                  isCurrent ? "scale-110" : ""
                } transition-transform`}
              >
                <Icon
                  className={`w-5 h-5 ${color} ${
                    stage.status === "active" ? "animate-spin" : ""
                  }`}
                />
                <span
                  className={`text-[10px] leading-tight text-center truncate max-w-[72px] ${
                    isCurrent ? "text-foreground font-semibold" : "text-muted-foreground"
                  }`}
                >
                  {stage.label}
                </span>
              </div>
              {i < stages.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-1.5 rounded-full ${connectorColor[stage.status]}`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
WorkflowStatusBar.displayName = "WorkflowStatusBar";

export default WorkflowStatusBar;
