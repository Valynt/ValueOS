import React, { useEffect, useRef, useState } from "react";

import { SourceBadge, SourceType } from "./SourceBadge";
import { ConfidenceBadge } from "./ConfidenceBadge";

// ============================================================================
// Types
// ============================================================================

export type ProvenanceNodeType = "source" | "formula" | "agent" | "confidence" | "evidence";

export interface ProvenanceNode {
  id: string;
  type: ProvenanceNodeType;
  label: string;
  value: string | number;
  sourceBadge?: SourceType;
  confidenceScore?: number;
  timestamp?: string;
  children?: ProvenanceNode[];
}

export interface ProvenanceChain {
  claimId: string;
  claimValue: string | number;
  claimLabel?: string;
  nodes: ProvenanceNode[];
}

export interface ProvenancePanelProps {
  /** Provenance chain data */
  chain: ProvenanceChain | null;
  /** Whether panel is open */
  isOpen: boolean;
  /** Callback when panel should close */
  onClose: () => void;
  /** Loading state */
  loading?: boolean;
  /** Additional CSS class */
  className?: string;
}

// ============================================================================
// Helper Components
// ============================================================================

const NodeIcon: Record<ProvenanceNodeType, string> = {
  source: "📄",
  formula: "🔧",
  agent: "🤖",
  confidence: "📊",
  evidence: "✓",
};

const NodeLabel: Record<ProvenanceNodeType, string> = {
  source: "Data Source",
  formula: "Formula",
  agent: "Agent",
  confidence: "Confidence",
  evidence: "Evidence",
};

interface ChainNodeProps {
  node: ProvenanceNode;
  depth?: number;
  isLast?: boolean;
}

const ChainNode: React.FC<ChainNodeProps> = ({ node, depth = 0, isLast = false }) => {
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div style={{ marginLeft: depth > 0 ? "24px" : "0" }}>
      {/* Connector Line */}
      {depth > 0 && (
        <div
          style={{
            position: "absolute",
            left: "-16px",
            top: "-24px",
            width: "2px",
            height: "40px",
            background: "var(--vds-color-border, #e5e7eb)",
          }}
        />
      )}

      {/* Node Card */}
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "flex-start",
          gap: "12px",
          padding: "12px",
          border: "1px solid var(--vds-color-border, #e5e7eb)",
          borderRadius: "8px",
          background: "var(--vds-color-surface, white)",
          marginBottom: hasChildren ? "16px" : "8px",
        }}
      >
        {/* Icon */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "32px",
            height: "32px",
            borderRadius: "6px",
            background: "var(--vds-color-primary-light, #dbeafe)",
            fontSize: "16px",
            flexShrink: 0,
          }}
        >
          {NodeIcon[node.type]}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Type Label */}
          <span
            style={{
              fontSize: "10px",
              fontWeight: 600,
              color: "var(--vds-color-text-secondary, #6b7280)",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            {NodeLabel[node.type]}
          </span>

          {/* Main Label */}
          <div
            style={{
              fontSize: "14px",
              fontWeight: 500,
              color: "var(--vds-color-text-primary, #111827)",
              marginTop: "2px",
              wordBreak: "break-word",
            }}
          >
            {node.label}
          </div>

          {/* Value */}
          <div
            style={{
              fontSize: "16px",
              fontWeight: 600,
              color: "var(--vds-color-primary, #2563eb)",
              marginTop: "4px",
            }}
          >
            {typeof node.value === "number" ? node.value.toLocaleString() : node.value}
          </div>

          {/* Badges */}
          <div style={{ display: "flex", gap: "8px", marginTop: "8px", flexWrap: "wrap" }}>
            {node.sourceBadge && <SourceBadge sourceType={node.sourceBadge} size="sm" />}
            {node.confidenceScore !== undefined && (
              <ConfidenceBadge score={node.confidenceScore} size="sm" />
            )}
          </div>

          {/* Timestamp */}
          {node.timestamp && (
            <div
              style={{
                fontSize: "11px",
                color: "var(--vds-color-text-tertiary, #9ca3af)",
                marginTop: "4px",
              }}
            >
              {new Date(node.timestamp).toLocaleString()}
            </div>
          )}
        </div>
      </div>

      {/* Child Nodes */}
      {hasChildren && (
        <div style={{ position: "relative" }}>
          {node.children!.map((child, index) => (
            <ChainNode
              key={child.id}
              node={child}
              depth={depth + 1}
              isLast={index === node.children!.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

/**
 * Slide-over panel displaying provenance lineage for a financial claim.
 *
 * Shows the full chain: raw data source → formula → agent → confidence → evidence tier.
 * Each node displays label, value, source badge, and timestamp.
 *
 * Features:
 * - Slide-in animation from right
 * - Click-outside to close
 * - Escape key to close
 * - Focus trap when open
 * - Loading state
 * - Empty state
 *
 * @example
 * <ProvenancePanel
 *   chain={provenanceData}
 *   isOpen={isPanelOpen}
 *   onClose={() => setIsPanelOpen(false)}
 *   loading={isLoading}
 * />
 */
export const ProvenancePanel: React.FC<ProvenancePanelProps> = ({
  chain,
  isOpen,
  onClose,
  loading = false,
  className = "",
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const [isClosing, setIsClosing] = useState(false);

  // Handle exit animation
  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 200); // Match animation duration
  };

  // Handle escape key
  useEffect(() => {
    if (!isOpen || isClosing) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, isClosing, onClose]);

  // Focus trap and initial focus
  useEffect(() => {
    if (!isOpen || isClosing) return;

    // Store previously focused element
    previouslyFocusedRef.current = document.activeElement as HTMLElement;

    // Focus close button when opening
    closeButtonRef.current?.focus();

    // Focus trap - recalculate focusable elements on each Tab key to avoid stale closures
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !panelRef.current) return;

      // Query focusable elements fresh each time to handle dynamic content
      const focusableElements = panelRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    };

    document.addEventListener("keydown", handleTab);

    return () => {
      document.removeEventListener("keydown", handleTab);
      // Restore focus
      previouslyFocusedRef.current?.focus();
    };
  }, [isOpen, isClosing]);

  // Handle click outside
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  if (!isOpen && !isClosing) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="provenance-title"
      onClick={handleBackdropClick}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        background: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        justifyContent: "flex-end",
      }}
    >
      {/* Panel */}
      <div
        ref={panelRef}
        className={className}
        data-testid="provenance-panel"
        style={{
          width: "100%",
          maxWidth: "480px",
          height: "100%",
          background: "var(--vds-color-surface, white)",
          boxShadow: "-4px 0 24px rgba(0, 0, 0, 0.1)",
          display: "flex",
          flexDirection: "column",
          animation: isClosing ? "slideOut 0.2s ease-out forwards" : "slideIn 0.2s ease-out",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: "1px solid var(--vds-color-border, #e5e7eb)",
          }}
        >
          <div>
            <h2
              id="provenance-title"
              style={{
                margin: 0,
                fontSize: "18px",
                fontWeight: 600,
                color: "var(--vds-color-text-primary, #111827)",
              }}
            >
              Lineage
            </h2>
            {chain?.claimLabel && (
              <p
                style={{
                  margin: "4px 0 0 0",
                  fontSize: "14px",
                  color: "var(--vds-color-text-secondary, #6b7280)",
                }}
              >
                {chain.claimLabel}
              </p>
            )}
          </div>
          <button
            ref={closeButtonRef}
            onClick={handleClose}
            aria-label="Close panel"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "36px",
              height: "36px",
              borderRadius: "6px",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontSize: "20px",
              color: "var(--vds-color-text-secondary, #6b7280)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--vds-color-surface-hover, #f3f4f6)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            overflow: "auto",
            padding: "20px",
          }}
        >
          {/* Loading State */}
          {loading && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "200px",
                gap: "16px",
              }}
            >
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  border: "3px solid var(--vds-color-border, #e5e7eb)",
                  borderTopColor: "var(--vds-color-primary, #2563eb)",
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite",
                }}
              />
              <span
                style={{
                  fontSize: "14px",
                  color: "var(--vds-color-text-secondary, #6b7280)",
                }}
              >
                Loading lineage...
              </span>
            </div>
          )}

          {/* Empty State */}
          {!loading && !chain && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "200px",
                gap: "12px",
              }}
            >
              <span style={{ fontSize: "48px" }}>🔍</span>
              <span
                style={{
                  fontSize: "14px",
                  color: "var(--vds-color-text-secondary, #6b7280)",
                  textAlign: "center",
                }}
              >
                No lineage data available
                <br />
                for this claim.
              </span>
            </div>
          )}

          {/* Chain Display */}
          {!loading && chain && (
            <div>
              {/* Claim Header */}
              <div
                style={{
                  padding: "16px",
                  background: "var(--vds-color-primary-light, #dbeafe)",
                  borderRadius: "8px",
                  marginBottom: "20px",
                }}
              >
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "var(--vds-color-primary, #2563eb)",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  Claim Value
                </span>
                <div
                  style={{
                    fontSize: "24px",
                    fontWeight: 700,
                    color: "var(--vds-color-text-primary, #111827)",
                    marginTop: "4px",
                  }}
                >
                  {typeof chain.claimValue === "number"
                    ? chain.claimValue.toLocaleString()
                    : chain.claimValue}
                </div>
              </div>

              {/* Chain Nodes */}
              <div style={{ position: "relative" }}>
                {chain.nodes.map((node, index) => (
                  <ChainNode
                    key={node.id}
                    node={node}
                    isLast={index === chain.nodes.length - 1}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "16px 20px",
            borderTop: "1px solid var(--vds-color-border, #e5e7eb)",
            fontSize: "12px",
            color: "var(--vds-color-text-tertiary, #9ca3af)",
            textAlign: "center",
          }}
        >
          Press Escape to close
        </div>

        {/* Animation Styles */}
        <style>{`
          @keyframes slideIn {
            from {
              transform: translateX(100%);
            }
            to {
              transform: translateX(0);
            }
          }
          @keyframes slideOut {
            from {
              transform: translateX(0);
            }
            to {
              transform: translateX(100%);
            }
          }
          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </div>
    </div>
  );
};

ProvenancePanel.displayName = "ProvenancePanel";
