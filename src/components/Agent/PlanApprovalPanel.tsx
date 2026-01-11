/**
 * PlanApprovalPanel Component
 *
 * Displays the agent's proposed plan with approval controls.
 * Features staggered card animation and token cost estimates.
 */

import { useState, useEffect } from "react";
import { CheckCircle, Edit3, Clock, Zap, ChevronDown, ChevronUp, Play, X } from "lucide-react";
import type { PlanStep } from "../../lib/agent/types";
import { cn } from "../../lib/utils";

interface PlanApprovalPanelProps {
  plan: PlanStep[];
  onApprove: (approvedSteps?: string[]) => void;
  onModify: (stepId: string, changes: { title?: string; description?: string }) => void;
  onReject: () => void;
  className?: string;
}

export function PlanApprovalPanel({
  plan,
  onApprove,
  onModify,
  onReject,
  className,
}: PlanApprovalPanelProps) {
  const [selectedSteps, setSelectedSteps] = useState<Set<string>>(new Set(plan.map((s) => s.id)));
  const [expandedStep, setExpandedStep] = useState<string | null>(null);
  const [editingStep, setEditingStep] = useState<string | null>(null);
  const [visibleSteps, setVisibleSteps] = useState<Set<string>>(new Set());

  // Staggered animation
  useEffect(() => {
    plan.forEach((step, index) => {
      setTimeout(() => {
        setVisibleSteps((prev) => new Set([...prev, step.id]));
      }, index * 100);
    });
  }, [plan]);

  const totalTokens = plan
    .filter((s) => selectedSteps.has(s.id))
    .reduce((sum, s) => sum + (s.estimatedTokens || 0), 0);

  const totalDuration = plan
    .filter((s) => selectedSteps.has(s.id))
    .reduce((sum, s) => sum + (s.estimatedDuration || 0), 0);

  const toggleStep = (stepId: string) => {
    setSelectedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) {
        next.delete(stepId);
      } else {
        next.add(stepId);
      }
      return next;
    });
  };

  const handleApprove = () => {
    if (selectedSteps.size === plan.length) {
      onApprove();
    } else {
      onApprove(Array.from(selectedSteps));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.shiftKey && e.key === "Enter") {
      e.preventDefault();
      handleApprove();
    }
  };

  return (
    <div className={cn("space-y-4", className)} onKeyDown={handleKeyDown} tabIndex={0}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Proposed Plan</h3>
          <p className="text-sm text-gray-400">Review and approve the steps below</p>
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-400">
          <div className="flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-amber-400" />
            <span>{totalTokens.toLocaleString()} tokens</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-blue-400" />
            <span>~{Math.ceil(totalDuration / 60)} min</span>
          </div>
        </div>
      </div>

      {/* Plan steps */}
      <div className="space-y-2">
        {plan.map((step, index) => (
          <TaskCard
            key={step.id}
            step={step}
            index={index}
            isSelected={selectedSteps.has(step.id)}
            isExpanded={expandedStep === step.id}
            isEditing={editingStep === step.id}
            isVisible={visibleSteps.has(step.id)}
            onToggle={() => toggleStep(step.id)}
            onExpand={() => setExpandedStep(expandedStep === step.id ? null : step.id)}
            onEdit={() => setEditingStep(editingStep === step.id ? null : step.id)}
            onSaveEdit={(changes) => {
              onModify(step.id, changes);
              setEditingStep(null);
            }}
          />
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-800">
        <div className="text-sm text-gray-500">
          {selectedSteps.size} of {plan.length} steps selected
          <span className="ml-2 text-gray-600">(Shift+Enter to approve)</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onReject}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg",
              "text-sm font-medium",
              "bg-gray-800 hover:bg-gray-700 text-gray-300",
              "transition-colors duration-150"
            )}
          >
            <X className="w-4 h-4" />
            Cancel
          </button>
          <button
            onClick={handleApprove}
            disabled={selectedSteps.size === 0}
            className={cn(
              "flex items-center gap-2 px-5 py-2 rounded-lg",
              "text-sm font-medium",
              "transition-all duration-150",
              selectedSteps.size > 0
                ? "bg-primary hover:bg-primary/90 text-white shadow-glow-teal"
                : "bg-gray-700 text-gray-500 cursor-not-allowed"
            )}
          >
            <Play className="w-4 h-4" />
            Approve & Execute
          </button>
        </div>
      </div>
    </div>
  );
}

interface TaskCardProps {
  step: PlanStep;
  index: number;
  isSelected: boolean;
  isExpanded: boolean;
  isEditing: boolean;
  isVisible: boolean;
  onToggle: () => void;
  onExpand: () => void;
  onEdit: () => void;
  onSaveEdit: (changes: { title?: string; description?: string }) => void;
}

function TaskCard({
  step,
  index,
  isSelected,
  isExpanded,
  isEditing,
  isVisible,
  onToggle,
  onExpand,
  onEdit,
  onSaveEdit,
}: TaskCardProps) {
  const [editTitle, setEditTitle] = useState(step.title);
  const [editDescription, setEditDescription] = useState(step.description);

  const typeColors = {
    research: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    analyze: "bg-purple-500/10 text-purple-400 border-purple-500/30",
    generate: "bg-green-500/10 text-green-400 border-green-500/30",
    validate: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    integrate: "bg-pink-500/10 text-pink-400 border-pink-500/30",
  };

  return (
    <div
      className={cn(
        "rounded-lg border transition-all duration-300",
        isSelected ? "bg-gray-800/50 border-gray-700" : "bg-gray-900/30 border-gray-800 opacity-60",
        !isVisible && "opacity-0 translate-y-4"
      )}
      style={{
        transitionDelay: isVisible ? "0ms" : `${index * 100}ms`,
      }}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Checkbox */}
          <button
            onClick={onToggle}
            className={cn(
              "flex-shrink-0 w-5 h-5 mt-0.5 rounded border-2 flex items-center justify-center",
              "transition-colors duration-150",
              isSelected ? "border-primary bg-primary" : "border-gray-600 hover:border-gray-500"
            )}
          >
            {isSelected && <CheckCircle className="w-3 h-3 text-white" />}
          </button>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-gray-500">Step {index + 1}</span>
              <span
                className={cn("text-[10px] px-1.5 py-0.5 rounded border", typeColors[step.type])}
              >
                {step.type}
              </span>
            </div>

            {isEditing ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className={cn(
                    "w-full px-3 py-1.5 rounded",
                    "bg-gray-700 border border-gray-600",
                    "text-white text-sm",
                    "focus:outline-none focus:ring-2 focus:ring-primary/50"
                  )}
                />
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className={cn(
                    "w-full px-3 py-1.5 rounded",
                    "bg-gray-700 border border-gray-600",
                    "text-gray-300 text-sm",
                    "focus:outline-none focus:ring-2 focus:ring-primary/50",
                    "resize-none"
                  )}
                  rows={2}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => onSaveEdit({ title: editTitle, description: editDescription })}
                    className="px-3 py-1 text-xs bg-primary text-white rounded hover:bg-primary/90"
                  >
                    Save
                  </button>
                  <button
                    onClick={onEdit}
                    className="px-3 py-1 text-xs bg-gray-700 text-gray-300 rounded hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h4 className="text-sm font-medium text-white">{step.title}</h4>
                <p className="text-sm text-gray-400 mt-0.5 line-clamp-2">{step.description}</p>
              </>
            )}

            {/* Expanded content */}
            {isExpanded && !isEditing && step.reasoning && (
              <div className="mt-3 pt-3 border-t border-gray-700">
                <p className="text-xs text-gray-500 mb-1">Reasoning:</p>
                <p className="text-sm text-gray-400">{step.reasoning}</p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            {step.estimatedTokens && (
              <span className="text-xs text-gray-500 mr-2">
                {step.estimatedTokens.toLocaleString()} tokens
              </span>
            )}
            <button
              onClick={onEdit}
              className="p-1.5 rounded hover:bg-gray-700 text-gray-500 hover:text-gray-300"
              title="Edit step"
            >
              <Edit3 className="w-4 h-4" />
            </button>
            <button
              onClick={onExpand}
              className="p-1.5 rounded hover:bg-gray-700 text-gray-500 hover:text-gray-300"
              title={isExpanded ? "Collapse" : "Expand"}
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PlanApprovalPanel;
