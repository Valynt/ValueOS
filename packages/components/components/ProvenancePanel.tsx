/**
 * ProvenancePanel
 *
 * Slide-over panel displaying lineage chain for any financial figure.
 * Reference: openspec/changes/frontend-v1-surfaces/tasks.md §1.1
 */

import React, { useEffect, useRef } from "react";
import { X, Database, Calculator, Bot, Shield, FileCheck, ChevronRight } from "lucide-react";
import { SourceBadge, SourceType } from "./SourceBadge";
import { ConfidenceBadge } from "./ConfidenceBadge";

export interface ProvenanceNode {
  id: string;
  type: "source" | "formula" | "agent" | "confidence" | "evidence";
  label: string;
  value: string | number;
  sourceBadge?: SourceType;
  timestamp?: string;
  confidence?: number;
}

export interface ProvenanceChain {
  claimId: string;
  claimValue: string | number;
  nodes: ProvenanceNode[];
}

export interface ProvenancePanelProps {
  isOpen: boolean;
  onClose: () => void;
  claimId?: string;
  claimValue?: string | number;
  nodes?: ProvenanceNode[];
  loading?: boolean;
  error?: string | null;
}

const nodeTypeConfig: Record<
  ProvenanceNode["type"],
  { icon: React.ComponentType<{ className?: string }>; label: string; colorClass: string }
> = {
  source: { icon: Database, label: "Data Source", colorClass: "bg-blue-50 text-blue-600 border-blue-200" },
  formula: { icon: Calculator, label: "Formula", colorClass: "bg-purple-50 text-purple-600 border-purple-200" },
  agent: { icon: Bot, label: "Agent", colorClass: "bg-indigo-50 text-indigo-600 border-indigo-200" },
  confidence: { icon: Shield, label: "Confidence", colorClass: "bg-green-50 text-green-600 border-green-200" },
  evidence: { icon: FileCheck, label: "Evidence", colorClass: "bg-amber-50 text-amber-600 border-amber-200" },
};

export function ProvenancePanel({
  isOpen,
  onClose,
  claimValue,
  nodes = [],
  loading = false,
  error = null,
}: ProvenancePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node) && isOpen) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose]);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity" aria-hidden="true" />

      {/* Panel */}
      <div
        ref={panelRef}
        className="relative w-full max-w-md bg-background border-l shadow-xl animate-in slide-in-from-right duration-300"
        role="dialog"
        aria-modal="true"
        aria-labelledby="provenance-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 id="provenance-title" className="text-lg font-semibold">
              Data Lineage
            </h2>
            <p className="text-sm text-muted-foreground">Source and provenance chain</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
            aria-label="Close panel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6 overflow-y-auto max-h-[calc(100vh-100px)]">
          {/* Claim value display */}
          {claimValue !== undefined && (
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Claim Value</p>
              <p className="text-2xl font-bold">{typeof claimValue === "number" ? claimValue.toLocaleString() : claimValue}</p>
            </div>
          )}

          {/* Loading state */}
          {loading && (
            <div className="space-y-4" data-testid="loading-state">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse flex gap-3">
                  <div className="w-10 h-10 rounded-full bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-1/3 bg-muted rounded" />
                    <div className="h-3 w-full bg-muted rounded" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="p-4 bg-red-50 text-red-700 rounded-lg" role="alert" data-testid="error-state">
              <p className="font-medium">Failed to load provenance</p>
              <p className="text-sm mt-1">{error}</p>
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && nodes.length === 0 && (
            <div className="text-center py-8 text-muted-foreground" data-testid="empty-state">
              <Database className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No provenance data available</p>
            </div>
          )}

          {/* Lineage chain */}
          {!loading && !error && nodes.length > 0 && (
            <div className="space-y-4" data-testid="lineage-chain">
              {nodes.map((node, index) => {
                const config = nodeTypeConfig[node.type];
                const Icon = config.icon;

                return (
                  <div key={node.id} className="relative">
                    {/* Connector line */}
                    {index < nodes.length - 1 && (
                      <div className="absolute left-5 top-12 w-0.5 h-6 bg-border" />
                    )}

                    <div className="flex gap-3">
                      {/* Node icon */}
                      <div
                        className={`w-10 h-10 rounded-full border flex items-center justify-center shrink-0 ${config.colorClass}`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>

                      {/* Node content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            {config.label}
                          </span>
                          {node.timestamp && (
                            <span className="text-xs text-muted-foreground">
                              {new Date(node.timestamp).toLocaleDateString()}
                            </span>
                          )}
                        </div>

                        <p className="font-medium mt-0.5">{node.label}</p>

                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-sm text-foreground">
                            {typeof node.value === "number" ? node.value.toLocaleString() : node.value}
                          </span>

                          {node.sourceBadge && <SourceBadge sourceType={node.sourceBadge} size="sm" showTier={false} />}

                          {node.confidence !== undefined && (
                            <ConfidenceBadge score={node.confidence} showTooltip={false} />
                          )}
                        </div>
                      </div>

                      {/* Arrow to next */}
                      {index < nodes.length - 1 && (
                        <ChevronRight className="w-4 h-4 text-muted-foreground self-center shrink-0" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
