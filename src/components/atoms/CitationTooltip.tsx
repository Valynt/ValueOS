/**
 * CitationTooltip Component
 * Shows source information in a tooltip on hover
 */

import React, { useState } from "react";
import { Cloud, Database, FileCode, FileText } from "lucide-react";

export type CitationSourceType = "crm" | "database" | "api" | "document";

export interface CitationTooltipProps {
  citationId: string;
  sourceType: CitationSourceType;
  timestamp?: Date;
  verifiedBy?: string;
  metadata?: Record<string, any>;
  className?: string;
}

export const CitationTooltip: React.FC<CitationTooltipProps> = ({
  citationId,
  sourceType,
  timestamp,
  verifiedBy,
  metadata,
  className = "",
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  const sourceIcons: Record<CitationSourceType, React.ReactNode> = {
    crm: <Cloud className="w-3 h-3" />,
    database: <Database className="w-3 h-3" />,
    api: <FileCode className="w-3 h-3" />,
    document: <FileText className="w-3 h-3" />,
  };

  const sourceLabels: Record<CitationSourceType, string> = {
    crm: "CRM",
    database: "Database",
    api: "API",
    document: "Document",
  };

  const sourceColors: Record<CitationSourceType, string> = {
    crm: "bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800",
    database:
      "bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800",
    api: "bg-green-100 dark:bg-green-950 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800",
    document:
      "bg-orange-100 dark:bg-orange-950 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800",
  };

  return (
    <div className={`relative inline-block ${className}`}>
      {/* Trigger badge */}
      <button
        type="button"
        className={`
          inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium border
          transition-all hover:shadow-sm
          ${sourceColors[sourceType]}
        `}
        aria-label={`Citation ${citationId} from ${sourceLabels[sourceType]}`}
        aria-expanded={showTooltip}
        aria-haspopup="dialog"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={() => setShowTooltip(!showTooltip)}
      >
        <span aria-hidden="true" className="flex items-center gap-1">
          {sourceIcons[sourceType]}
          <span className="hidden sm:inline">{citationId}</span>
          <span className="sm:hidden">{sourceLabels[sourceType]}</span>
        </span>
      </button>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50">
          <div className="bg-card border border-border rounded-lg shadow-lg p-3 min-w-[200px] max-w-[300px]">
            {/* Header */}
            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-border">
              {sourceIcons[sourceType]}
              <div>
                <div className="text-sm font-semibold text-foreground">
                  {citationId}
                </div>
                <div className="text-xs text-muted-foreground">
                  {sourceLabels[sourceType]}
                </div>
              </div>
            </div>

            {/* Details */}
            <div className="space-y-1.5 text-xs">
              {timestamp && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Verified:</span>
                  <span className="text-foreground font-medium">
                    {timestamp.toLocaleDateString()}
                  </span>
                </div>
              )}

              {verifiedBy && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">By:</span>
                  <span className="text-foreground font-medium">
                    {verifiedBy}
                  </span>
                </div>
              )}

              {metadata && Object.keys(metadata).length > 0 && (
                <div className="mt-2 pt-2 border-t border-border">
                  <div className="text-muted-foreground mb-1">Metadata:</div>
                  {Object.entries(metadata)
                    .slice(0, 3)
                    .map(([key, value]) => (
                      <div key={key} className="flex justify-between">
                        <span className="text-muted-foreground">{key}:</span>
                        <span className="text-foreground font-mono text-[10px]">
                          {String(value).slice(0, 20)}
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* View full details link */}
            <button className="mt-2 text-xs text-primary hover:underline">
              View audit trail →
            </button>
          </div>

          {/* Tooltip arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-[1px]">
            <div className="w-2 h-2 bg-card border-r border-b border-border rotate-45" />
          </div>
        </div>
      )}
    </div>
  );
};

export default CitationTooltip;
