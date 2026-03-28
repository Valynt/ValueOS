import { ChevronDown, ChevronRight, Circle } from "lucide-react";
import React, { useCallback, useState } from "react";

export interface ValueNode {
  id: string;
  label: string;
  value?: number | string;
  children?: ValueNode[];
  type?: "root" | "branch" | "leaf";
  status?: "active" | "at_risk" | "achieved";
  category?: string;
  confidencePct?: number;
  evidenceCount?: number;
  riskLevel?: "validated" | "warning" | "risk";
  collaborationHint?: string;
}

interface ValueTreeSummary {
  hypothesisCount: number;
  totalValueLow: number;
  totalValueHigh: number;
  currency: string;
  overallConfidence: number;
}

export interface ValueTreeCardProps {
  nodes: ValueNode[];
  title?: string;
  expandedIds?: string[];
  summary?: ValueTreeSummary;
  onNodeClick?: (nodeId: string) => void;
  onToggle?: (nodeId: string, expanded: boolean) => void;
  className?: string;
}

const statusColors: Record<string, string> = {
  active: "text-blue-400",
  at_risk: "text-yellow-400",
  achieved: "text-green-400",
};

interface TreeNodeProps {
  node: ValueNode;
  depth: number;
  expanded: Set<string>;
  toggle: (id: string) => void;
  onNodeClick?: (nodeId: string) => void;
}

const TreeNode: React.FC<TreeNodeProps> = ({ node, depth, expanded, toggle, onNodeClick }) => {
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expanded.has(node.id);
  const statusColor = node.status ? statusColors[node.status] ?? "text-muted-foreground" : "text-muted-foreground";

  return (
    <div>
      <div
        className={`flex items-start gap-2 py-2 px-2 rounded hover:bg-secondary/50 transition-colors cursor-pointer`}
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
        onClick={() => {
          if (hasChildren) toggle(node.id);
          onNodeClick?.(node.id);
        }}
      >
        {hasChildren ? (
          isExpanded ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          )
        ) : (
          <Circle className={`w-2.5 h-2.5 ${statusColor} shrink-0 ml-0.5 mr-0.5`} fill="currentColor" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm text-foreground truncate flex-1">{node.label}</span>
            {node.value !== undefined && (
              <span className="text-xs text-muted-foreground font-mono shrink-0">
                {node.value}
              </span>
            )}
            {node.status && (
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded ${node.status === "active"
                    ? "bg-blue-500/20 text-blue-400"
                    : node.status === "at_risk"
                      ? "bg-yellow-500/20 text-yellow-400"
                      : "bg-green-500/20 text-green-400"
                  }`}
              >
                {node.status.replace("_", " ")}
              </span>
            )}
          </div>
          {(node.category || node.confidencePct !== undefined || node.evidenceCount !== undefined || node.riskLevel !== undefined) && (
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              {node.category && <span>{node.category}</span>}
              {node.confidencePct !== undefined && <span>Confidence {node.confidencePct}%</span>}
              {node.evidenceCount !== undefined && <span>Evidence {node.evidenceCount}</span>}
              {node.riskLevel !== undefined && (
                <span
                  className={`${node.riskLevel === "validated"
                      ? "text-green-400"
                      : node.riskLevel === "warning"
                        ? "text-yellow-400"
                        : "text-red-400"
                    }`}
                >
                  {node.riskLevel.replace("_", " ")}
                </span>
              )}
            </div>
          )}
          {node.collaborationHint && (
            <div className="mt-1 text-[11px] text-blue-400/90">{node.collaborationHint}</div>
          )}
        </div>
      </div>
      {hasChildren && isExpanded && (
        <div>
          {node.children!.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              toggle={toggle}
              onNodeClick={onNodeClick}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const ValueTreeCard: React.FC<ValueTreeCardProps> = ({
  nodes,
  title,
  expandedIds,
  summary,
  onNodeClick,
  onToggle,
  className = "",
}) => {
  const [localExpanded, setLocalExpanded] = useState<Set<string>>(
    () => new Set(expandedIds ?? [])
  );

  const toggle = useCallback(
    (id: string) => {
      setLocalExpanded((prev) => {
        const next = new Set(prev);
        const willExpand = !next.has(id);
        if (willExpand) {
          next.add(id);
        } else {
          next.delete(id);
        }
        onToggle?.(id, willExpand);
        return next;
      });
    },
    [onToggle]
  );

  return (
    <div className={`bg-card border border-border rounded-lg p-4 ${className}`}>
      {title && (
        <h3 className="text-sm font-semibold text-foreground mb-3">{title}</h3>
      )}
      {summary && (
        <div className="mb-3 grid grid-cols-1 gap-2 rounded-lg border border-border/80 bg-muted/20 p-3 text-xs text-muted-foreground md:grid-cols-3">
          <div>
            <div className="text-[11px] uppercase tracking-wide">Hypotheses</div>
            <div className="mt-1 text-sm font-semibold text-foreground">{summary.hypothesisCount}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide">Value Range</div>
            <div className="mt-1 text-sm font-semibold text-foreground">
              {summary.currency} {Math.round(summary.totalValueLow / 1000)}k–{Math.round(summary.totalValueHigh / 1000)}k
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide">Overall Confidence</div>
            <div className="mt-1 text-sm font-semibold text-foreground">{Math.round(summary.overallConfidence * 100)}%</div>
          </div>
        </div>
      )}
      <div className="space-y-0.5">
        {nodes.map((node) => (
          <TreeNode
            key={node.id}
            node={node}
            depth={0}
            expanded={localExpanded}
            toggle={toggle}
            onNodeClick={onNodeClick}
          />
        ))}
      </div>
    </div>
  );
};
ValueTreeCard.displayName = "ValueTreeCard";

export default ValueTreeCard;
