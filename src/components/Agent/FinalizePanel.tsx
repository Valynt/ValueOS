/**
 * FinalizePanel Component
 *
 * Displays finalization progress and success state.
 * Shows saved artifacts, CRM sync status, and next steps.
 */

import { useState, useEffect } from "react";
import {
  CheckCircle,
  Loader2,
  FileText,
  Database,
  ExternalLink,
  Copy,
  Check,
  AlertTriangle,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import type { FinalizeResult, SavedArtifact, IntegrationResult } from "../../lib/agent/types";
import { cn } from "../../lib/utils";

interface FinalizePanelProps {
  result?: FinalizeResult;
  isLoading?: boolean;
  error?: { message: string; retryable: boolean };
  onRetry?: () => void;
  onClose?: () => void;
  onNavigate?: (path: string) => void;
  className?: string;
}

export function FinalizePanel({
  result,
  isLoading = false,
  error,
  onRetry,
  onClose,
  onNavigate,
  className,
}: FinalizePanelProps) {
  const [showConfetti, setShowConfetti] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Trigger success animation
  useEffect(() => {
    if (result && !isLoading && !error) {
      setShowConfetti(true);
      const timer = setTimeout(() => setShowConfetti(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [result, isLoading, error]);

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  if (isLoading) {
    return (
      <div className={cn("text-center py-12", className)}>
        <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-white mb-2">Finalizing...</h3>
        <p className="text-sm text-gray-400">Saving artifacts and syncing with integrations</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("text-center py-12", className)}>
        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-8 h-8 text-red-400" />
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">Finalization Failed</h3>
        <p className="text-sm text-gray-400 mb-6 max-w-md mx-auto">{error.message}</p>
        {error.retryable && onRetry && (
          <button
            onClick={onRetry}
            className={cn(
              "px-5 py-2 rounded-lg",
              "bg-primary hover:bg-primary/90 text-white",
              "text-sm font-medium transition-colors"
            )}
          >
            Try Again
          </button>
        )}
      </div>
    );
  }

  if (!result) {
    return null;
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Success header with animation */}
      <div className="text-center relative">
        {showConfetti && <ConfettiEffect />}
        <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4 animate-scale-in">
          <CheckCircle className="w-10 h-10 text-green-400" />
        </div>
        <h3 className="text-xl font-semibold text-white mb-2">Successfully Completed!</h3>
        <p className="text-sm text-gray-400 max-w-md mx-auto">{result.summary}</p>
      </div>

      {/* Saved artifacts */}
      {result.savedArtifacts.length > 0 && (
        <div className="bg-gray-800/50 rounded-lg border border-gray-700/50 p-4">
          <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4 text-gray-400" />
            Saved Artifacts
          </h4>
          <div className="space-y-2">
            {result.savedArtifacts.map((artifact) => (
              <SavedArtifactRow
                key={artifact.artifactId}
                artifact={artifact}
                isCopied={copiedId === artifact.artifactId}
                onCopy={() => copyToClipboard(artifact.location, artifact.artifactId)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Integration results */}
      {result.integrations && result.integrations.length > 0 && (
        <div className="bg-gray-800/50 rounded-lg border border-gray-700/50 p-4">
          <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
            <Database className="w-4 h-4 text-gray-400" />
            Integration Sync
          </h4>
          <div className="space-y-2">
            {result.integrations.map((integration, index) => (
              <IntegrationRow key={index} integration={integration} />
            ))}
          </div>
        </div>
      )}

      {/* Next steps */}
      {result.nextSteps && result.nextSteps.length > 0 && (
        <div className="bg-primary/5 rounded-lg border border-primary/20 p-4">
          <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            Suggested Next Steps
          </h4>
          <ul className="space-y-2">
            {result.nextSteps.map((step, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-gray-300">
                <ArrowRight className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                <span>{step}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-center gap-3 pt-4">
        {onClose && (
          <button
            onClick={onClose}
            className={cn(
              "px-5 py-2 rounded-lg",
              "bg-gray-800 hover:bg-gray-700 text-gray-300",
              "text-sm font-medium transition-colors"
            )}
          >
            Close
          </button>
        )}
        {onNavigate && (
          <button
            onClick={() => onNavigate("/deals")}
            className={cn(
              "flex items-center gap-2 px-5 py-2 rounded-lg",
              "bg-primary hover:bg-primary/90 text-white",
              "text-sm font-medium transition-colors"
            )}
          >
            View in Deals
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

interface SavedArtifactRowProps {
  artifact: SavedArtifact;
  isCopied: boolean;
  onCopy: () => void;
}

function SavedArtifactRow({ artifact, isCopied, onCopy }: SavedArtifactRowProps) {
  return (
    <div className="flex items-center gap-3 p-2 rounded-lg bg-gray-900/50">
      <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white truncate">{artifact.location}</p>
        <p className="text-xs text-gray-500">Version {artifact.version}</p>
      </div>
      <button
        onClick={onCopy}
        className="p-1.5 rounded hover:bg-gray-700 text-gray-500 hover:text-gray-300"
        title="Copy location"
      >
        {isCopied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
      </button>
    </div>
  );
}

interface IntegrationRowProps {
  integration: IntegrationResult;
}

function IntegrationRow({ integration }: IntegrationRowProps) {
  const statusColors = {
    success: "text-green-400",
    partial: "text-amber-400",
    failed: "text-red-400",
  };

  const statusIcons = {
    success: CheckCircle,
    partial: AlertTriangle,
    failed: AlertTriangle,
  };

  const Icon = statusIcons[integration.status];

  return (
    <div className="flex items-center gap-3 p-2 rounded-lg bg-gray-900/50">
      <Icon className={cn("w-4 h-4 flex-shrink-0", statusColors[integration.status])} />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white capitalize">{integration.system}</p>
        {integration.recordId && (
          <p className="text-xs text-gray-500">Record: {integration.recordId}</p>
        )}
        {integration.error && <p className="text-xs text-red-400">{integration.error}</p>}
      </div>
      {integration.status === "success" && integration.recordId && (
        <button
          className="p-1.5 rounded hover:bg-gray-700 text-gray-500 hover:text-gray-300"
          title="Open in CRM"
        >
          <ExternalLink className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

function ConfettiEffect() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {Array.from({ length: 20 }).map((_, i) => (
        <div
          key={i}
          className="absolute w-2 h-2 rounded-full animate-confetti"
          style={{
            left: `${Math.random() * 100}%`,
            backgroundColor: ["#18C3A5", "#10B981", "#3B82F6", "#8B5CF6", "#F59E0B"][
              Math.floor(Math.random() * 5)
            ],
            animationDelay: `${Math.random() * 0.5}s`,
            animationDuration: `${1 + Math.random() * 1}s`,
          }}
        />
      ))}
    </div>
  );
}

export default FinalizePanel;
