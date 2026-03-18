/**
 * LifecycleNav
 *
 * Horizontal tab bar showing lifecycle stages: Assembly → Modeling → Integrity → Outputs → Realization.
 * Reference: openspec/changes/frontend-v1-surfaces/tasks.md §7
 */

import { Check, ChevronRight, Lock } from "lucide-react";
import React from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

type LifecycleStage = "assembly" | "model" | "integrity" | "outputs" | "realization";

interface Stage {
  id: LifecycleStage;
  label: string;
  path: string;
}

const stages: Stage[] = [
  { id: "assembly", label: "Assembly", path: "assembly" },
  { id: "model", label: "Modeling", path: "model" },
  { id: "integrity", label: "Integrity", path: "integrity" },
  { id: "outputs", label: "Outputs", path: "outputs" },
  { id: "realization", label: "Realization", path: "realization" },
];

export interface LifecycleNavProps {
  completedStages?: LifecycleStage[];
  lockedStages?: LifecycleStage[];
  caseStatus?: string;
}

export function LifecycleNav({ completedStages = [], lockedStages = [], caseStatus }: LifecycleNavProps) {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  // Determine current stage from URL
  const currentPath = location.pathname;
  const currentStage = stages.find((s) => currentPath.includes(s.path))?.id;

  const handleStageClick = (stage: Stage) => {
    if (!caseId) return;

    // Don't navigate if stage is locked
    if (lockedStages.includes(stage.id)) return;

    navigate(`/workspace/${caseId}/${stage.path}`);
  };

  const getStageState = (stage: Stage) => {
    const isCompleted = completedStages.includes(stage.id);
    const isLocked = lockedStages.includes(stage.id);
    const isActive = currentStage === stage.id;

    return { isCompleted, isLocked, isActive };
  };

  return (
    <nav className="px-6 py-3 border-b bg-card" aria-label="Case lifecycle">
      <div className="flex items-center gap-2">
        {stages.map((stage, index) => {
          const { isCompleted, isLocked, isActive } = getStageState(stage);
          const isLast = index === stages.length - 1;

          return (
            <React.Fragment key={stage.id}>
              <button
                onClick={() => handleStageClick(stage)}
                disabled={isLocked}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
                  ${isActive ? "bg-primary text-primary-foreground" : ""}
                  ${isCompleted && !isActive ? "bg-green-100 text-green-800" : ""}
                  ${isLocked ? "opacity-50 cursor-not-allowed" : "hover:bg-muted cursor-pointer"}
                  ${!isActive && !isCompleted && !isLocked ? "text-muted-foreground" : ""}
                `}
                aria-current={isActive ? "step" : undefined}
                aria-disabled={isLocked}
              >
                {isCompleted && !isActive ? (
                  <Check className="w-4 h-4" aria-hidden="true" />
                ) : isLocked ? (
                  <Lock className="w-4 h-4" aria-hidden="true" />
                ) : null}
                <span>{stage.label}</span>
              </button>

              {!isLast && (
                <ChevronRight className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Status indicator */}
      {caseStatus && (
        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Case status:</span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              caseStatus === "presentation-ready"
                ? "bg-green-100 text-green-800"
                : caseStatus === "blocked"
                  ? "bg-red-100 text-red-800"
                  : "bg-amber-100 text-amber-800"
            }`}
          >
            {caseStatus.replace("-", " ")}
          </span>
        </div>
      )}
    </nav>
  );
}

export default LifecycleNav;
