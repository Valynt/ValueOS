import React, { useCallback, useState } from "react";
import { ChevronDown, ChevronRight, Circle } from "lucide-react";

export interface ValueNode {
  id: string;
  label: string;
  value?: number | string;
  children?: ValueNode[];
  type?: "root" | "branch" | "leaf";
  status?: "active" | "at_risk" | "achieved";
}

export interface ValueTreeCardProps {
  nodes: ValueNode[];
  title?: string;
  expandedIds?: string[];
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
        className={`flex items-center gap-2 py-1.5 px-2 rounded hover:bg-secondary/50 transition-colors cursor-pointer`}
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
        <span className="text-sm text-foreground truncate flex-1">{node.label}</span>
        {node.value !== undefined && (
          <span className="text-xs text-muted-foreground font-mono shrink-0">
            {node.value}
          </span>
        )}
        {node.status && (
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded ${
              node.status === "active"
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
