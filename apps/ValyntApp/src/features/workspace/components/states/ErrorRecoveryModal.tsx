/**
 * FE-028: Error Recovery Modal
 *
 * Overlay modal for the error state. Shows error details,
 * recovery suggestions, and retry/dismiss actions.
 * Recoverable errors allow retrying from the previous state.
 */

import {
  AlertTriangle,
  RefreshCw,
  ArrowLeft,
  Copy,
  ChevronDown,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AgentPhase } from "../../agent/types";

interface ErrorRecoveryModalProps {
  code: string;
  message: string;
  recoverable: boolean;
  suggestions?: string[];
  previousPhase: AgentPhase | null;
  onRetry: () => void;
  onDismiss: () => void;
}

const PHASE_LABELS: Record<AgentPhase, string> = {
  idle: "Ready",
  plan: "Planning",
  execute: "Execution",
  clarify: "Clarification",
  review: "Review",
  finalize: "Finalization",
  error: "Error",
  resume: "Resume",
};

export function ErrorRecoveryModal({
  code,
  message,
  recoverable,
  suggestions,
  previousPhase,
  onRetry,
  onDismiss,
}: ErrorRecoveryModalProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyError = () => {
    const text = `Error: ${code}\n${message}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onDismiss}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Red accent bar */}
        <div className="h-1 bg-red-500" />

        {/* Content */}
        <div className="p-6">
          {/* Icon + title */}
          <div className="flex items-start gap-4 mb-4">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
              <AlertTriangle size={20} className="text-red-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold text-slate-900">
                {recoverable ? "Something went wrong" : "Operation failed"}
              </h3>
              <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                {message}
              </p>
            </div>
          </div>

          {/* Context: where the error occurred */}
          {previousPhase && previousPhase !== "idle" && (
            <div className="mb-4 px-3 py-2 bg-slate-50 rounded-lg text-xs text-slate-500">
              Error occurred during{" "}
              <span className="font-medium text-slate-700">
                {PHASE_LABELS[previousPhase]}
              </span>{" "}
              phase
            </div>
          )}

          {/* Suggestions */}
          {suggestions && suggestions.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-medium text-slate-500 mb-2">
                Suggested actions:
              </p>
              <ul className="space-y-1.5">
                {suggestions.map((suggestion, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-slate-600"
                  >
                    <span className="text-slate-400 mt-0.5">•</span>
                    {suggestion}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Error details (collapsible) */}
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 mb-4"
          >
            <ChevronDown
              size={12}
              className={cn("transition-transform", showDetails && "rotate-180")}
            />
            Technical details
          </button>

          {showDetails && (
            <div className="mb-4 bg-slate-900 rounded-lg p-3 relative">
              <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap break-all">
                {`Code: ${code}\n${message}`}
              </pre>
              <button
                onClick={handleCopyError}
                className="absolute top-2 right-2 p-1 text-slate-500 hover:text-slate-300 rounded"
                aria-label="Copy error"
              >
                <Copy size={12} />
              </button>
              {copied && (
                <span className="absolute top-2 right-8 text-[10px] text-emerald-400">
                  Copied
                </span>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-slate-100 flex gap-3">
          <Button
            variant="outline"
            onClick={onDismiss}
            className="flex-1"
          >
            <ArrowLeft size={14} className="mr-1.5" />
            {recoverable ? "Go Back" : "Dismiss"}
          </Button>
          {recoverable && (
            <Button
              onClick={onRetry}
              className="flex-1"
            >
              <RefreshCw size={14} className="mr-1.5" />
              Retry
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
