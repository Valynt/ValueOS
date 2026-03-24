/**
 * ValueTreeCard
 *
 * Hierarchical tree view for value drivers with keyboard navigation,
 * aria-tree roles, and expand-all/collapse-all controls.
 *
 * UX Principles:
 * - Minimize Cognitive Load: progressive disclosure via expand/collapse
 * - Accessibility: aria-tree/treeitem roles, arrow key navigation
 * - Visual Hierarchy: indentation + status badges for quick scanning
 */

import { ChevronDown, ChevronRight, ChevronsUpDown, Circle } from "lucide-react";
import React, { useCallback, useRef, useState } from "react";

import { cn } from "@/lib/utils";

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
  showExpandAll?: boolean;
  className?: string;
}

const statusStyles: Record<string, { dot: string; badge: string }> = {
  active: { dot: "text-[var(--vds-color-primary)]", badge: "bg-[var(--vds-color-primary)]/10 text-[var(--vds-color-primary)]" },
  at_risk: { dot: "text-amber-500", badge: "bg-amber-500/10 text-amber-500" },
  achieved: { dot: "text-green-500", badge: "bg-green-500/10 text-green-500" },
};

function collectAllIds(nodes: ValueNode[]): string[] {
  const ids: string[] = [];
  function walk(n: ValueNode[]) {
    for (const node of n) {
      if (node.children && node.children.length > 0) {
        ids.push(node.id);
        walk(node.children);
      }
    }
  }
  walk(nodes);
  return ids;
}

function flattenVisible(nodes: ValueNode[], expanded: Set<string>): ValueNode[] {
  const result: ValueNode[] = [];
  function walk(n: ValueNode[]) {
    for (const node of n) {
      result.push(node);
      if (node.children && node.children.length > 0 && expanded.has(node.id)) {
        walk(node.children);
      }
    }
  }
  walk(nodes);
  return result;
}

interface TreeNodeProps {
  node: ValueNode;
  depth: number;
  expanded: Set<string>;
  toggle: (id: string) => void;
  onNodeClick?: (nodeId: string) => void;
  focusedId: string | null;
  onFocus: (id: string) => void;
}

const TreeNode: React.FC<TreeNodeProps> = ({
  node,
  depth,
  expanded,
  toggle,
  onNodeClick,
  focusedId,
  onFocus,
}) => {
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expanded.has(node.id);
  const isFocused = focusedId === node.id;
  const style = node.status ? statusStyles[node.status] : undefined;

  return (
    // eslint-disable-next-line jsx-a11y/role-has-required-aria-props -- managed by parent component
    <li role="treeitem" aria-expanded={hasChildren ? isExpanded : undefined}>
      <div
        className={cn(
          "flex items-center gap-2 py-1.5 px-2 rounded transition-colors cursor-pointer",
          "hover:bg-[var(--vds-color-surface)]/50",
          isFocused && "ring-2 ring-[var(--vds-color-primary)]/30 ring-inset bg-[var(--vds-color-surface)]/30"
        )}
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
        onClick={() => {
          if (hasChildren) toggle(node.id);
          onNodeClick?.(node.id);
        }}
        onFocus={() => onFocus(node.id)}
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- focusable for keyboard navigation
        tabIndex={isFocused ? 0 : -1}
        data-node-id={node.id}
      >
        {hasChildren ? (
          isExpanded ? (
            <ChevronDown className="w-4 h-4 text-[var(--vds-color-text-muted)] shrink-0" aria-hidden="true" />
          ) : (
            <ChevronRight className="w-4 h-4 text-[var(--vds-color-text-muted)] shrink-0" aria-hidden="true" />
          )
        ) : (
          <Circle
            className={cn("w-2.5 h-2.5 shrink-0 ml-0.5 mr-0.5", style?.dot ?? "text-[var(--vds-color-text-muted)]")}
            fill="currentColor"
            aria-hidden="true"
          />
        )}
        <span className="text-sm text-[var(--vds-color-text-primary)] truncate flex-1">{node.label}</span>
        {node.value !== undefined && (
          <span className="text-xs text-[var(--vds-color-text-muted)] font-mono shrink-0 tabular-nums">
            {node.value}
          </span>
        )}
        {node.status && (
          <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded", style?.badge)}>
            {node.status.replace("_", " ")}
          </span>
        )}
      </div>
      {hasChildren && isExpanded && (
        <ul role="group">
          {node.children!.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              toggle={toggle}
              onNodeClick={onNodeClick}
              focusedId={focusedId}
              onFocus={onFocus}
            />
          ))}
        </ul>
      )}
    </li>
  );
};

export const ValueTreeCard: React.FC<ValueTreeCardProps> = ({
  nodes,
  title,
  expandedIds,
  onNodeClick,
  onToggle,
  showExpandAll = true,
  className = "",
}) => {
  const [localExpanded, setLocalExpanded] = useState<Set<string>>(
    () => new Set(expandedIds ?? [])
  );
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const treeRef = useRef<HTMLUListElement>(null);

  const allBranchIds = collectAllIds(nodes);
  const allExpanded = allBranchIds.every((id) => localExpanded.has(id));

  const toggle = useCallback(
    (id: string) => {
      setLocalExpanded((prev) => {
        const next = new Set(prev);
        const willExpand = !next.has(id);
        if (willExpand) next.add(id);
        else next.delete(id);
        onToggle?.(id, willExpand);
        return next;
      });
    },
    [onToggle]
  );

  const toggleAll = useCallback(() => {
    if (allExpanded) {
      setLocalExpanded(new Set());
    } else {
      setLocalExpanded(new Set(allBranchIds));
    }
  }, [allExpanded, allBranchIds]);

  // Keyboard navigation: arrow keys to move, Enter/Space to toggle
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const visible = flattenVisible(nodes, localExpanded);
      const currentIndex = visible.findIndex((n) => n.id === focusedId);
      if (currentIndex === -1 && visible.length > 0) {
        setFocusedId(visible[0]!.id);
        return;
      }

      const current = visible[currentIndex];
      if (!current) return;

      switch (e.key) {
        case "ArrowDown": {
          e.preventDefault();
          const next = visible[currentIndex + 1];
          if (next) {
            setFocusedId(next.id);
            const el = treeRef.current?.querySelector(`[data-node-id="${next.id}"]`) as HTMLElement;
            el?.focus();
          }
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          const prev = visible[currentIndex - 1];
          if (prev) {
            setFocusedId(prev.id);
            const el = treeRef.current?.querySelector(`[data-node-id="${prev.id}"]`) as HTMLElement;
            el?.focus();
          }
          break;
        }
        case "ArrowRight": {
          e.preventDefault();
          const hasChildren = current.children && current.children.length > 0;
          if (hasChildren && !localExpanded.has(current.id)) {
            toggle(current.id);
          }
          break;
        }
        case "ArrowLeft": {
          e.preventDefault();
          if (localExpanded.has(current.id)) {
            toggle(current.id);
          }
          break;
        }
        case "Enter":
        case " ": {
          e.preventDefault();
          const hasChildren = current.children && current.children.length > 0;
          if (hasChildren) toggle(current.id);
          onNodeClick?.(current.id);
          break;
        }
      }
    },
    [nodes, localExpanded, focusedId, toggle, onNodeClick]
  );

  return (
    <div className={cn("bg-[var(--vds-color-surface)] border border-[var(--vds-color-border)] rounded-lg p-4", className)}>
      {/* Header */}
      {(title || showExpandAll) && (
        <div className="flex items-center justify-between mb-3">
          {title && (
            <h3 className="text-sm font-semibold text-[var(--vds-color-text-primary)]">{title}</h3>
          )}
          {showExpandAll && allBranchIds.length > 0 && (
            <button
              onClick={toggleAll}
              className={cn(
                "inline-flex items-center gap-1 text-xs text-[var(--vds-color-text-muted)] hover:text-[var(--vds-color-text-primary)] transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vds-color-primary)]/30 rounded px-1.5 py-0.5"
              )}
              aria-label={allExpanded ? "Collapse all" : "Expand all"}
            >
              <ChevronsUpDown className="h-3 w-3" aria-hidden="true" />
              {allExpanded ? "Collapse all" : "Expand all"}
            </button>
          )}
        </div>
      )}

      {/* Tree */}
      <ul
        ref={treeRef}
        role="tree"
        aria-label={title ?? "Value tree"}
        aria-multiselectable="false"
        className="space-y-0.5"
        onKeyDown={handleKeyDown}
      >
        {nodes.map((node) => (
          <TreeNode
            key={node.id}
            node={node}
            depth={0}
            expanded={localExpanded}
            toggle={toggle}
            onNodeClick={onNodeClick}
            focusedId={focusedId}
            onFocus={setFocusedId}
          />
        ))}
      </ul>
    </div>
  );
};
ValueTreeCard.displayName = "ValueTreeCard";

export default ValueTreeCard;
