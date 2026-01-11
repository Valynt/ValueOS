/**
 * CostEstimatorModal Component
 *
 * Pre-execution cost estimate modal showing token usage and pricing.
 * Helps users understand costs before approving agent actions.
 */

import { useState } from "react";
import { X, Zap, Clock, DollarSign, AlertTriangle, CheckCircle, Info } from "lucide-react";
import { cn } from "../../lib/utils";

interface CostEstimate {
  estimatedTokens: number;
  estimatedCost: number;
  estimatedDuration: number; // seconds
  breakdown: CostBreakdownItem[];
  warnings?: string[];
  withinBudget: boolean;
  remainingBudget?: number;
}

interface CostBreakdownItem {
  label: string;
  tokens: number;
  cost: number;
  type: "input" | "output" | "embedding" | "other";
}

interface CostEstimatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  estimate: CostEstimate;
  planTitle?: string;
  className?: string;
}

export function CostEstimatorModal({
  isOpen,
  onClose,
  onConfirm,
  estimate,
  planTitle = "Agent Execution",
  className,
}: CostEstimatorModalProps) {
  const [acknowledged, setAcknowledged] = useState(false);

  if (!isOpen) return null;

  const formatCost = (cost: number) => {
    if (cost < 0.01) return "<$0.01";
    return `$${cost.toFixed(2)}`;
  };

  const formatTokens = (tokens: number) => {
    if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
    if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
    return tokens.toString();
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  };

  const typeColors = {
    input: "text-blue-400",
    output: "text-green-400",
    embedding: "text-purple-400",
    other: "text-gray-400",
  };

  const hasWarnings = estimate.warnings && estimate.warnings.length > 0;
  const requiresAcknowledgment = !estimate.withinBudget || hasWarnings;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cost-modal-title"
    >
      <div
        className={cn(
          "bg-gray-900 border border-gray-700 rounded-xl",
          "w-full max-w-md mx-4 shadow-2xl",
          "animate-scale-in",
          className
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h2 id="cost-modal-title" className="text-lg font-semibold text-white">
            Cost Estimate
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Plan title */}
          <div className="text-sm text-gray-400">
            Estimated cost for: <span className="text-white font-medium">{planTitle}</span>
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-gray-800/50 rounded-lg p-3 text-center">
              <Zap className="w-5 h-5 text-amber-400 mx-auto mb-1" />
              <div className="text-lg font-bold text-white">
                {formatTokens(estimate.estimatedTokens)}
              </div>
              <div className="text-xs text-gray-500">tokens</div>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3 text-center">
              <DollarSign className="w-5 h-5 text-green-400 mx-auto mb-1" />
              <div className="text-lg font-bold text-white">
                {formatCost(estimate.estimatedCost)}
              </div>
              <div className="text-xs text-gray-500">estimated</div>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3 text-center">
              <Clock className="w-5 h-5 text-blue-400 mx-auto mb-1" />
              <div className="text-lg font-bold text-white">
                {formatDuration(estimate.estimatedDuration)}
              </div>
              <div className="text-xs text-gray-500">duration</div>
            </div>
          </div>

          {/* Breakdown */}
          <div className="bg-gray-800/30 rounded-lg p-3">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
              Cost Breakdown
            </h3>
            <div className="space-y-2">
              {estimate.breakdown.map((item, index) => (
                <div key={index} className="flex items-center justify-between text-sm">
                  <span className={cn("flex items-center gap-2", typeColors[item.type])}>
                    <span className="w-2 h-2 rounded-full bg-current" />
                    {item.label}
                  </span>
                  <span className="text-gray-400">
                    {formatTokens(item.tokens)} · {formatCost(item.cost)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Budget status */}
          {estimate.remainingBudget !== undefined && (
            <div
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg",
                estimate.withinBudget
                  ? "bg-green-500/10 border border-green-500/20"
                  : "bg-red-500/10 border border-red-500/20"
              )}
            >
              {estimate.withinBudget ? (
                <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
              )}
              <div className="flex-1">
                <div
                  className={cn(
                    "text-sm font-medium",
                    estimate.withinBudget ? "text-green-400" : "text-red-400"
                  )}
                >
                  {estimate.withinBudget ? "Within Budget" : "Exceeds Budget"}
                </div>
                <div className="text-xs text-gray-400">
                  Remaining: {formatCost(estimate.remainingBudget)}
                </div>
              </div>
            </div>
          )}

          {/* Warnings */}
          {hasWarnings && (
            <div className="space-y-2">
              {estimate.warnings!.map((warning, index) => (
                <div
                  key={index}
                  className="flex items-start gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20"
                >
                  <Info className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-amber-200">{warning}</span>
                </div>
              ))}
            </div>
          )}

          {/* Acknowledgment checkbox */}
          {requiresAcknowledgment && (
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                className="mt-1 w-4 h-4 rounded border-gray-600 bg-gray-800 text-primary focus:ring-primary/50"
              />
              <span className="text-sm text-gray-400">
                I understand the cost implications and want to proceed
              </span>
            </label>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-800">
          <button
            onClick={onClose}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium",
              "bg-gray-800 hover:bg-gray-700 text-gray-300",
              "transition-colors"
            )}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={requiresAcknowledgment && !acknowledged}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium",
              "transition-colors",
              requiresAcknowledgment && !acknowledged
                ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                : "bg-primary hover:bg-primary/90 text-white"
            )}
          >
            Confirm & Execute
          </button>
        </div>
      </div>
    </div>
  );
}

export default CostEstimatorModal;
