import React, { useState } from "react";

export interface Artifact {
  id: string;
  type: "executive-memo" | "cfo-recommendation" | "customer-narrative" | "internal-case";
  title: string;
  content: string;
  claimIds: string[];
  readinessAtGeneration: number;
}

export interface ArtifactPreviewProps {
  artifact: Artifact;
  onClaimClick?: (claimId: string) => void;
  className?: string;
}

/**
 * ArtifactPreview - Formatted rendering of artifact content.
 *
 * Shows artifact with data-claim-id attributes on financial figures for click-to-trace.
 *
 * Reference: openspec/changes/frontend-v1-surfaces/tasks.md §3.4.1
 */
export function ArtifactPreview({ artifact, onClaimClick, className = "" }: ArtifactPreviewProps) {
  const [showDraft, setShowDraft] = useState(artifact.readinessAtGeneration < 0.8);

  // Parse content and add claim IDs to financial figures
  const renderContent = (content: string) => {
    // Simple regex to find currency amounts and percentages
    const parts = content.split(/(\$[\d,]+(?:\.\d{2})?|\d+%|\$\d+\.?\d*\s*(?:million|billion|M|B)?)/gi);

    return parts.map((part, index) => {
      // Check if this part looks like a financial figure
      const isFinancial = /^\$[\d,]+/.test(part) || /^\d+%$/.test(part);
      // Only assign claimId if we have a corresponding claimIds entry
      const claimId = index < artifact.claimIds.length ? artifact.claimIds[index] : null;

      if (isFinancial && claimId) {
        return (
          <button
            key={index}
            onClick={() => onClaimClick?.(claimId)}
            data-claim-id={claimId}
            className="text-primary underline decoration-dotted hover:decoration-solid font-medium"
          >
            {part}
          </button>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  const typeLabels = {
    "executive-memo": "Executive Memo",
    "cfo-recommendation": "CFO Recommendation",
    "customer-narrative": "Customer Narrative",
    "internal-case": "Internal Case",
  };

  return (
    <div className={`bg-card border border-border rounded-lg overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div>
          <span className="text-xs text-muted-foreground uppercase tracking-wide">
            {typeLabels[artifact.type]}
          </span>
          <h3 className="font-semibold">{artifact.title}</h3>
        </div>
        <div className="flex items-center gap-2">
          {showDraft && (
            <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded">
              DRAFT
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            Readiness: {(artifact.readinessAtGeneration * 100).toFixed(0)}%
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 prose prose-sm max-w-none">
        <div className="whitespace-pre-wrap leading-relaxed">
          {renderContent(artifact.content)}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-border bg-accent/30 text-xs text-muted-foreground">
        <p>Click on highlighted financial figures to view provenance and lineage.</p>
      </div>
    </div>
  );
}
