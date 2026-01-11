/**
 * SourceBadge Component
 *
 * Visual badge linking model numbers to raw source data.
 * Clicking opens the Source Drawer with highlighted text.
 * Part of the Assumption Sourcing UI (P1).
 */

import { useState } from "react";
import { FileText, ExternalLink, Quote, ChevronRight } from "lucide-react";
import { cn } from "../../lib/utils";

export type SourceType = "pdf" | "10k" | "website" | "api" | "manual" | "calculation";

export interface SourceReference {
  id: string;
  type: SourceType;
  label: string;
  documentName?: string;
  pageNumber?: number;
  excerpt?: string;
  highlightedText?: string;
  url?: string;
  confidence: number; // 0-1
  timestamp?: Date;
}

interface SourceBadgeProps {
  source: SourceReference;
  value?: string | number;
  onClick?: (source: SourceReference) => void;
  size?: "sm" | "md";
  className?: string;
}

const SOURCE_COLORS: Record<SourceType, { bg: string; text: string; border: string }> = {
  pdf: { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/30" },
  "10k": { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/30" },
  website: { bg: "bg-green-500/10", text: "text-green-400", border: "border-green-500/30" },
  api: { bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/30" },
  manual: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/30" },
  calculation: { bg: "bg-cyan-500/10", text: "text-cyan-400", border: "border-cyan-500/30" },
};

const SOURCE_ICONS: Record<SourceType, React.ReactNode> = {
  pdf: <FileText className="w-3 h-3" />,
  "10k": <FileText className="w-3 h-3" />,
  website: <ExternalLink className="w-3 h-3" />,
  api: <ExternalLink className="w-3 h-3" />,
  manual: <Quote className="w-3 h-3" />,
  calculation: <span className="text-[10px] font-mono">fx</span>,
};

export function SourceBadge({ source, value, onClick, size = "sm", className }: SourceBadgeProps) {
  const colors = SOURCE_COLORS[source.type];
  const icon = SOURCE_ICONS[source.type];

  return (
    <button
      onClick={() => onClick?.(source)}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border transition-all",
        colors.bg,
        colors.border,
        "hover:brightness-125",
        size === "sm" ? "px-1.5 py-0.5 text-xs" : "px-2 py-1 text-sm",
        onClick && "cursor-pointer",
        !onClick && "cursor-default",
        className
      )}
      aria-label={`Source: ${source.label}`}
      type="button"
    >
      <span className={colors.text}>{icon}</span>
      {value && <span className="font-medium text-white">{value}</span>}
      <span className={cn("font-medium", colors.text)}>{source.label}</span>
      {source.pageNumber && <span className="text-gray-500">p.{source.pageNumber}</span>}
      {onClick && <ChevronRight className="w-3 h-3 text-gray-500" />}
    </button>
  );
}

/**
 * SourceDrawer Component
 *
 * Slide-out panel showing source details with highlighted text.
 */
interface SourceDrawerProps {
  source: SourceReference | null;
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

export function SourceDrawer({ source, isOpen, onClose, className }: SourceDrawerProps) {
  if (!source) return null;

  const colors = SOURCE_COLORS[source.type];

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} aria-hidden="true" />
      )}

      {/* Drawer */}
      <div
        className={cn(
          "fixed right-0 top-0 bottom-0 w-full max-w-md z-50",
          "bg-gray-900 border-l border-gray-800",
          "transform transition-transform duration-300 ease-out",
          isOpen ? "translate-x-0" : "translate-x-full",
          className
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Source details"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", colors.bg)}>
              <span className={colors.text}>{SOURCE_ICONS[source.type]}</span>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">{source.label}</h2>
              {source.documentName && (
                <p className="text-sm text-gray-500">{source.documentName}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(100vh-80px)]">
          {/* Metadata */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Type</p>
              <p className={cn("text-sm font-medium", colors.text)}>{source.type.toUpperCase()}</p>
            </div>
            {source.pageNumber && (
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Page</p>
                <p className="text-sm font-medium text-white">{source.pageNumber}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Confidence</p>
              <p
                className={cn(
                  "text-sm font-medium",
                  source.confidence >= 0.8
                    ? "text-green-400"
                    : source.confidence >= 0.5
                      ? "text-amber-400"
                      : "text-red-400"
                )}
              >
                {Math.round(source.confidence * 100)}%
              </p>
            </div>
            {source.timestamp && (
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Extracted</p>
                <p className="text-sm text-gray-400">{source.timestamp.toLocaleDateString()}</p>
              </div>
            )}
          </div>

          {/* Highlighted excerpt */}
          {source.highlightedText && (
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Source Text</p>
              <div className="p-4 rounded-lg bg-gray-800/50 border border-gray-700">
                <p className="text-sm text-gray-300 leading-relaxed">
                  {source.excerpt && (
                    <span className="text-gray-500">
                      {source.excerpt.split(source.highlightedText)[0]}
                    </span>
                  )}
                  <mark className="bg-primary/30 text-white px-1 rounded">
                    {source.highlightedText}
                  </mark>
                  {source.excerpt && (
                    <span className="text-gray-500">
                      {source.excerpt.split(source.highlightedText)[1]}
                    </span>
                  )}
                </p>
              </div>
            </div>
          )}

          {/* Full excerpt if no highlight */}
          {!source.highlightedText && source.excerpt && (
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Excerpt</p>
              <div className="p-4 rounded-lg bg-gray-800/50 border border-gray-700">
                <p className="text-sm text-gray-300 leading-relaxed italic">"{source.excerpt}"</p>
              </div>
            </div>
          )}

          {/* External link */}
          {source.url && (
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "flex items-center gap-2 px-4 py-3 rounded-lg",
                "bg-gray-800 border border-gray-700",
                "text-sm text-gray-300 hover:text-white hover:border-gray-600",
                "transition-colors"
              )}
            >
              <ExternalLink className="w-4 h-4" />
              <span>View Original Document</span>
            </a>
          )}
        </div>
      </div>
    </>
  );
}

/**
 * Hook to manage source drawer state
 */
export function useSourceDrawer() {
  const [selectedSource, setSelectedSource] = useState<SourceReference | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const openDrawer = (source: SourceReference) => {
    setSelectedSource(source);
    setIsOpen(true);
  };

  const closeDrawer = () => {
    setIsOpen(false);
    // Delay clearing source to allow animation
    setTimeout(() => setSelectedSource(null), 300);
  };

  return {
    selectedSource,
    isOpen,
    openDrawer,
    closeDrawer,
  };
}

export default SourceBadge;
