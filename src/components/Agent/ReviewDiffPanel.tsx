/**
 * ReviewDiffPanel Component
 *
 * Displays execution results for review with diff comparison.
 * Supports approve, reject, and revision request actions.
 */

import { useState } from "react";
import {
  CheckCircle,
  XCircle,
  Edit3,
  FileText,
  Table,
  BarChart3,
  Code,
  Image,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
} from "lucide-react";
import type { Artifact, ExecutionResult, SourceReference } from "../../lib/agent/types";
import { cn } from "../../lib/utils";

interface ReviewDiffPanelProps {
  results: ExecutionResult[];
  artifacts: Artifact[];
  onApprove: (approvedItems?: string[]) => void;
  onReject: (reason: string) => void;
  onRevise: (artifactId: string, change: string) => void;
  className?: string;
}

export function ReviewDiffPanel({
  results,
  artifacts,
  onApprove,
  onReject,
  onRevise,
  className,
}: ReviewDiffPanelProps) {
  const [selectedArtifacts, setSelectedArtifacts] = useState<Set<string>>(
    new Set(artifacts.map((a) => a.id))
  );
  const [expandedArtifact, setExpandedArtifact] = useState<string | null>(artifacts[0]?.id || null);
  const [revisionMode, setRevisionMode] = useState<string | null>(null);
  const [revisionText, setRevisionText] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectDialog, setShowRejectDialog] = useState(false);

  const toggleArtifact = (id: string) => {
    setSelectedArtifacts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleApprove = () => {
    if (selectedArtifacts.size === artifacts.length) {
      onApprove();
    } else {
      onApprove(Array.from(selectedArtifacts));
    }
  };

  const handleReject = () => {
    onReject(rejectReason);
    setShowRejectDialog(false);
    setRejectReason("");
  };

  const handleRevision = (artifactId: string) => {
    if (revisionText.trim()) {
      onRevise(artifactId, revisionText);
      setRevisionMode(null);
      setRevisionText("");
    }
  };

  const successCount = results.filter((r) => r.status === "success").length;
  const partialCount = results.filter((r) => r.status === "partial").length;
  const failedCount = results.filter((r) => r.status === "failed").length;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Review Results</h3>
          <p className="text-sm text-gray-400">
            {artifacts.length} artifact{artifacts.length !== 1 ? "s" : ""} generated
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          {successCount > 0 && (
            <span className="flex items-center gap-1.5 text-green-400">
              <CheckCircle className="w-4 h-4" />
              {successCount} success
            </span>
          )}
          {partialCount > 0 && (
            <span className="flex items-center gap-1.5 text-amber-400">
              <Edit3 className="w-4 h-4" />
              {partialCount} partial
            </span>
          )}
          {failedCount > 0 && (
            <span className="flex items-center gap-1.5 text-red-400">
              <XCircle className="w-4 h-4" />
              {failedCount} failed
            </span>
          )}
        </div>
      </div>

      {/* Artifacts list */}
      <div className="space-y-2">
        {artifacts.map((artifact) => (
          <ArtifactCard
            key={artifact.id}
            artifact={artifact}
            isSelected={selectedArtifacts.has(artifact.id)}
            isExpanded={expandedArtifact === artifact.id}
            isRevising={revisionMode === artifact.id}
            revisionText={revisionMode === artifact.id ? revisionText : ""}
            onToggle={() => toggleArtifact(artifact.id)}
            onExpand={() =>
              setExpandedArtifact(expandedArtifact === artifact.id ? null : artifact.id)
            }
            onStartRevision={() => setRevisionMode(artifact.id)}
            onCancelRevision={() => {
              setRevisionMode(null);
              setRevisionText("");
            }}
            onRevisionTextChange={setRevisionText}
            onSubmitRevision={() => handleRevision(artifact.id)}
          />
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-800">
        <div className="text-sm text-gray-500">
          {selectedArtifacts.size} of {artifacts.length} selected
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowRejectDialog(true)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg",
              "text-sm font-medium",
              "bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30",
              "transition-colors duration-150"
            )}
          >
            <ThumbsDown className="w-4 h-4" />
            Reject
          </button>
          <button
            onClick={handleApprove}
            disabled={selectedArtifacts.size === 0}
            className={cn(
              "flex items-center gap-2 px-5 py-2 rounded-lg",
              "text-sm font-medium",
              "transition-all duration-150",
              selectedArtifacts.size > 0
                ? "bg-green-500 hover:bg-green-400 text-black"
                : "bg-gray-700 text-gray-500 cursor-not-allowed"
            )}
          >
            <ThumbsUp className="w-4 h-4" />
            Approve & Finalize
          </button>
        </div>
      </div>

      {/* Reject dialog */}
      {showRejectDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 max-w-md mx-4 shadow-2xl">
            <h4 className="text-lg font-semibold text-white mb-2">Reject Results</h4>
            <p className="text-sm text-gray-400 mb-4">
              Please provide a reason for rejection. This will help the agent improve.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="What needs to be different?"
              className={cn(
                "w-full px-3 py-2 rounded-lg",
                "bg-gray-800 border border-gray-700",
                "text-white placeholder-gray-500",
                "focus:outline-none focus:ring-2 focus:ring-red-500/50",
                "resize-none"
              )}
              rows={3}
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => {
                  setShowRejectDialog(false);
                  setRejectReason("");
                }}
                className="px-4 py-2 text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={!rejectReason.trim()}
                className={cn(
                  "px-4 py-2 text-sm rounded-lg",
                  rejectReason.trim()
                    ? "bg-red-500 hover:bg-red-400 text-white"
                    : "bg-gray-700 text-gray-500 cursor-not-allowed"
                )}
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface ArtifactCardProps {
  artifact: Artifact;
  isSelected: boolean;
  isExpanded: boolean;
  isRevising: boolean;
  revisionText: string;
  onToggle: () => void;
  onExpand: () => void;
  onStartRevision: () => void;
  onCancelRevision: () => void;
  onRevisionTextChange: (text: string) => void;
  onSubmitRevision: () => void;
}

function ArtifactCard({
  artifact,
  isSelected,
  isExpanded,
  isRevising,
  revisionText,
  onToggle,
  onExpand,
  onStartRevision,
  onCancelRevision,
  onRevisionTextChange,
  onSubmitRevision,
}: ArtifactCardProps) {
  const typeIcons = {
    document: FileText,
    data: Table,
    chart: BarChart3,
    table: Table,
    code: Code,
    image: Image,
  };

  const Icon = typeIcons[artifact.type] || FileText;

  return (
    <div
      className={cn(
        "rounded-lg border transition-all duration-200",
        isSelected ? "bg-gray-800/50 border-gray-700" : "bg-gray-900/30 border-gray-800 opacity-60"
      )}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Checkbox */}
          <button
            onClick={onToggle}
            className={cn(
              "flex-shrink-0 w-5 h-5 mt-0.5 rounded border-2 flex items-center justify-center",
              "transition-colors duration-150",
              isSelected ? "border-green-500 bg-green-500" : "border-gray-600 hover:border-gray-500"
            )}
          >
            {isSelected && <CheckCircle className="w-3 h-3 text-white" />}
          </button>

          {/* Icon */}
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gray-700/50 flex items-center justify-center">
            <Icon className="w-5 h-5 text-gray-400" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium text-white">{artifact.title}</h4>
            <p className="text-xs text-gray-500 mt-0.5">
              {artifact.type} • {artifact.format || "unknown format"}
              {artifact.size && ` • ${formatBytes(artifact.size)}`}
            </p>

            {/* Sources */}
            {artifact.sourceReferences && artifact.sourceReferences.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {artifact.sourceReferences.slice(0, 3).map((source) => (
                  <SourceBadge key={source.id} source={source} />
                ))}
                {artifact.sourceReferences.length > 3 && (
                  <span className="text-xs text-gray-500">
                    +{artifact.sourceReferences.length - 3} more
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            <button
              onClick={onStartRevision}
              className="p-1.5 rounded hover:bg-gray-700 text-gray-500 hover:text-gray-300"
              title="Request revision"
            >
              <RotateCcw className="w-4 h-4" />
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

        {/* Expanded content */}
        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-gray-700">
            <div className="bg-gray-900/50 rounded-lg p-4 max-h-60 overflow-auto">
              <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono">
                {typeof artifact.content === "string"
                  ? artifact.content
                  : JSON.stringify(artifact.content, null, 2)}
              </pre>
            </div>
          </div>
        )}

        {/* Revision input */}
        {isRevising && (
          <div className="mt-4 pt-4 border-t border-gray-700">
            <p className="text-sm text-gray-400 mb-2">What changes would you like?</p>
            <textarea
              value={revisionText}
              onChange={(e) => onRevisionTextChange(e.target.value)}
              placeholder="Describe the changes needed..."
              className={cn(
                "w-full px-3 py-2 rounded-lg",
                "bg-gray-800 border border-gray-700",
                "text-white placeholder-gray-500 text-sm",
                "focus:outline-none focus:ring-2 focus:ring-primary/50",
                "resize-none"
              )}
              rows={2}
            />
            <div className="flex justify-end gap-2 mt-2">
              <button
                onClick={onCancelRevision}
                className="px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded"
              >
                Cancel
              </button>
              <button
                onClick={onSubmitRevision}
                disabled={!revisionText.trim()}
                className={cn(
                  "px-3 py-1.5 text-xs rounded",
                  revisionText.trim()
                    ? "bg-primary hover:bg-primary/90 text-white"
                    : "bg-gray-700 text-gray-500 cursor-not-allowed"
                )}
              >
                Request Revision
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface SourceBadgeProps {
  source: SourceReference;
}

function SourceBadge({ source }: SourceBadgeProps) {
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs",
        "bg-blue-500/10 text-blue-400 border border-blue-500/20",
        "hover:bg-blue-500/20 transition-colors"
      )}
      title={source.excerpt}
    >
      <span className="truncate max-w-[100px]">{source.title}</span>
      <span className="text-blue-300/60">{Math.round(source.confidence * 100)}%</span>
      {source.url && <ExternalLink className="w-3 h-3" />}
    </a>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default ReviewDiffPanel;
