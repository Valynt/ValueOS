/**
 * NarrativeBlock
 *
 * Displays narrative content (insights, recommendations, warnings, summaries)
 * with type-coded visual indicators, collapsible sources, and copy support.
 *
 * UX Principles:
 * - Progressive Disclosure: sources hidden behind toggle
 * - Immediate Feedback: copy-to-clipboard with visual confirmation
 * - Accessibility: focus management, keyboard-accessible toggle, aria roles
 * - Visual Hierarchy: left border color codes type at a glance
 */

import React, { useCallback, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  ExternalLink,
  FileText,
  Lightbulb,
  User,
} from "lucide-react";
import { ConfidenceDisplay } from "../Agent/ConfidenceDisplay";
import { cn } from "@/lib/utils";

export interface NarrativeBlockProps {
  content: string;
  author?: string;
  timestamp?: string;
  type?: "insight" | "recommendation" | "warning" | "summary";
  confidence?: number;
  sources?: string[];
  collapsible?: boolean;
  defaultExpanded?: boolean;
  className?: string;
}

const typeConfig: Record<
  NonNullable<NarrativeBlockProps["type"]>,
  { icon: React.FC<{ className?: string }>; borderColor: string; iconColor: string; label: string }
> = {
  insight: { icon: Lightbulb, borderColor: "border-l-primary", iconColor: "text-primary", label: "Insight" },
  recommendation: { icon: ArrowUpRight, borderColor: "border-l-success", iconColor: "text-success", label: "Recommendation" },
  warning: { icon: AlertTriangle, borderColor: "border-l-warning", iconColor: "text-warning", label: "Warning" },
  summary: { icon: FileText, borderColor: "border-l-[hsl(var(--color-primary-400))]", iconColor: "text-primary", label: "Summary" },
};

export const NarrativeBlock: React.FC<NarrativeBlockProps> = ({
  content,
  author,
  timestamp,
  type = "summary",
  confidence,
  sources,
  collapsible = false,
  defaultExpanded = true,
  className = "",
}) => {
  const [showSources, setShowSources] = useState(false);
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [copied, setCopied] = useState(false);
  const config = typeConfig[type];
  const Icon = config.icon;

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: no-op if clipboard API unavailable
    }
  }, [content]);

  return (
    <article
      className={cn(
        "bg-card border border-border border-l-4 rounded-lg p-4 transition-all duration-200",
        config.borderColor,
        className
      )}
      aria-label={`${config.label}: ${content.slice(0, 60)}...`}
    >
      <div className="flex items-start gap-3">
        <Icon className={cn("w-5 h-5 shrink-0 mt-0.5", config.iconColor)} />
        <div className="flex-1 min-w-0">
          {/* Header row */}
          <div className="flex items-center gap-2 flex-wrap mb-2">
            {collapsible ? (
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-1 text-xs font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                aria-expanded={expanded}
              >
                {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                {config.label}
              </button>
            ) : (
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {config.label}
              </span>
            )}
            {confidence !== undefined && (
              <ConfidenceDisplay value={confidence} size="sm" showLabel={false} />
            )}

            {/* Copy button */}
            <button
              onClick={handleCopy}
              className={cn(
                "ml-auto p-1 rounded text-muted-foreground hover:text-foreground transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              )}
              aria-label={copied ? "Copied" : "Copy content"}
              title="Copy to clipboard"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-success" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          {/* Content (collapsible) */}
          {(!collapsible || expanded) && (
            <div className="animate-in fade-in-0 duration-200">
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
                    className={cn(
                      "flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                    )}
                    aria-expanded={showSources}
                  >
                    {showSources ? (
                      <ChevronDown className="w-3 h-3" />
                    ) : (
                      <ChevronRight className="w-3 h-3" />
                    )}
                    {sources.length} source{sources.length !== 1 ? "s" : ""}
                  </button>
                  {showSources && (
                    <ul className="mt-2 space-y-1 animate-in fade-in-0 slide-in-from-top-1 duration-150">
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
          )}
        </div>
      </div>
    </article>
  );
};
NarrativeBlock.displayName = "NarrativeBlock";

export default NarrativeBlock;
