/**
 * ArtifactPreview Widget
 *
 * Formatted rendering of artifact content with data-claim-id attributes on financial figures for click-to-trace.
 * Reference: openspec/changes/frontend-v1-surfaces/tasks.md §3.4
 */

import { Clock, FileText, User } from "lucide-react";
import React from "react";

import { WidgetProps } from "../CanvasHost";

export interface Artifact {
  id: string;
  type: "executive-memo" | "cfo-recommendation" | "customer-narrative" | "internal-case";
  status: "draft" | "ready" | "archived";
  title: string;
  content: string;
  claimIds: string[];
  generatedAt: string;
  modifiedAt?: string;
  modifiedBy?: string;
  readinessAtGeneration: number;
}

export interface ArtifactPreviewData {
  artifact: Artifact;
  onClaimClick?: (claimId: string) => void;
}

export function ArtifactPreview({ data, onAction }: WidgetProps) {
  const widgetData = data as unknown as ArtifactPreviewData;
  const artifact = widgetData.artifact;

  if (!artifact) {
    return (
      <div className="rounded-xl border bg-card p-6 text-center text-muted-foreground">
        <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>No artifact selected</p>
      </div>
    );
  }

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "executive-memo":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "cfo-recommendation":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "customer-narrative":
        return "bg-green-100 text-green-800 border-green-200";
      case "internal-case":
        return "bg-gray-100 text-gray-800 border-gray-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ready":
        return "bg-green-100 text-green-800";
      case "draft":
        return "bg-amber-100 text-amber-800";
      case "archived":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  // Parse content to identify financial figures (simple regex-based approach)
  const renderContent = (content: string) => {
    // Split by lines and render with claim IDs on potential financial figures
    return content.split("\n").map((line, index) => {
      // Simple heuristic: lines containing $ or % or numbers might have financial figures
      const hasFinancialFigure = /\$[\d,]+|[\d]+%?/.test(line);
      const claimId = hasFinancialFigure && artifact.claimIds[index % artifact.claimIds.length];

      return (
        <p key={index} className="mb-2">
          {claimId ? (
            <span
              data-claim-id={claimId}
              className="cursor-pointer hover:bg-primary/10 rounded px-1 transition-colors"
              onClick={() => onAction?.("claimClick", { claimId })}
              title="Click to trace provenance"
            >
              {line}
            </span>
          ) : (
            line
          )}
        </p>
      );
    });
  };

  return (
    <div className="rounded-xl border bg-card p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <FileText className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">{artifact.title}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={`text-xs px-2 py-0.5 rounded-full border ${getTypeBadge(
                  artifact.type
                )}`}
              >
                {artifact.type.replace("-", " ")}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusBadge(artifact.status)}`}>
                {artifact.status}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Metadata */}
      <div className="flex items-center gap-4 mb-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-1">
          <Clock className="w-4 h-4" />
          <span>Generated {new Date(artifact.generatedAt).toLocaleDateString()}</span>
        </div>
        {artifact.modifiedAt && (
          <div className="flex items-center gap-1">
            <User className="w-4 h-4" />
            <span>
              Modified {new Date(artifact.modifiedAt).toLocaleDateString()}
              {artifact.modifiedBy && ` by ${artifact.modifiedBy}`}
            </span>
          </div>
        )}
      </div>

      {/* Readiness watermark */}
      {artifact.status === "draft" && artifact.readinessAtGeneration < 0.8 && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm text-amber-800">
            <strong>DRAFT</strong> — Generated at {Math.round(artifact.readinessAtGeneration * 100)}%
            readiness. Review recommended before finalization.
          </p>
        </div>
      )}

      {/* Content */}
      <div className="prose prose-sm max-w-none text-foreground">
        {renderContent(artifact.content)}
      </div>

      {/* Claim IDs legend */}
      {artifact.claimIds.length > 0 && (
        <div className="mt-6 pt-4 border-t">
          <p className="text-xs text-muted-foreground mb-2">
            Click highlighted text to trace provenance
          </p>
          <div className="flex flex-wrap gap-2">
            {artifact.claimIds.slice(0, 5).map((claimId) => (
              <span key={claimId} className="text-xs px-2 py-1 bg-muted rounded">
                {claimId.slice(0, 8)}...
              </span>
            ))}
            {artifact.claimIds.length > 5 && (
              <span className="text-xs px-2 py-1 bg-muted rounded">
                +{artifact.claimIds.length - 5} more
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ArtifactPreview;
