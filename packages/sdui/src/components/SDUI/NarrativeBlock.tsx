import {
  AlertTriangle,
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  Clock,
  ExternalLink,
  FileText,
  Lightbulb,
  User,
} from "lucide-react";
import React, { useState } from "react";

import { ConfidenceDisplay } from "../Agent/ConfidenceDisplay";

export interface NarrativeBlockProps {
  content: string;
  author?: string;
  timestamp?: string;
  type?: "insight" | "recommendation" | "warning" | "summary";
  confidence?: number;
  sources?: string[];
  className?: string;
}

const typeConfig: Record<
  NonNullable<NarrativeBlockProps["type"]>,
  { icon: React.FC<{ className?: string }>; borderColor: string; iconColor: string }
> = {
  insight: { icon: Lightbulb, borderColor: "border-l-blue-500", iconColor: "text-blue-400" },
  recommendation: { icon: ArrowUpRight, borderColor: "border-l-green-500", iconColor: "text-green-400" },
  warning: { icon: AlertTriangle, borderColor: "border-l-yellow-500", iconColor: "text-yellow-400" },
  summary: { icon: FileText, borderColor: "border-l-purple-500", iconColor: "text-purple-400" },
};

export const NarrativeBlock: React.FC<NarrativeBlockProps> = ({
  content,
  author,
  timestamp,
  type = "summary",
  confidence,
  sources,
  className = "",
}) => {
  const [showSources, setShowSources] = useState(false);
  const config = typeConfig[type];
  const Icon = config.icon;

  return (
    <div
      className={`bg-card border border-border border-l-4 ${config.borderColor} rounded-lg p-4 ${className}`}
    >
      <div className="flex items-start gap-3">
        <Icon className={`w-5 h-5 ${config.iconColor} shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {type}
            </span>
            {confidence !== undefined && (
              <ConfidenceDisplay data={{ score: confidence }} size="sm" showLabel={false} />
            )}
          </div>

          <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
            {content}
          </div>

          {(author || timestamp) && (
            <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
              {author && (
                <span className="inline-flex items-center gap-1">
                  <User className="w-3 h-3" />
                  {author}
                </span>
              )}
              {timestamp && (
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {timestamp}
                </span>
              )}
            </div>
          )}

          {sources && sources.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border">
              <button
                onClick={() => setShowSources(!showSources)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {showSources ? (
                  <ChevronDown className="w-3 h-3" />
                ) : (
                  <ChevronRight className="w-3 h-3" />
                )}
                {sources.length} source{sources.length !== 1 ? "s" : ""}
              </button>
              {showSources && (
                <ul className="mt-2 space-y-1">
                  {sources.map((source, i) => (
                    <li
                      key={i}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground"
                    >
                      <ExternalLink className="w-3 h-3 shrink-0" />
                      <span className="truncate">{source}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
NarrativeBlock.displayName = "NarrativeBlock";

export default NarrativeBlock;
