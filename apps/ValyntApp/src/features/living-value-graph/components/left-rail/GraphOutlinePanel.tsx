/**
 * GraphOutlinePanel Component - Tree view of all graph nodes
 */

import { useState } from 'react';

import { ValueNode } from '../../types/graph.types';

interface GraphOutlinePanelProps {
  nodes?: ValueNode[];
  onNodeSelect?: (nodeId: string) => void;
  selectedNodeId?: string | null;
}

export function GraphOutlinePanel({ nodes = [], onNodeSelect, selectedNodeId }: GraphOutlinePanelProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  const toggleExpand = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  // Build tree structure
  const rootNodes = nodes.filter(n => !n.inputs || n.inputs.length === 0);

  return (
    <div className="p-4">
      <h3 className="text-sm font-semibold text-neutral-900 mb-3">Graph Outline</h3>
      <div className="space-y-1">
        {rootNodes.map(node => (
          <TreeNode
            key={node.id}
            node={node}
            allNodes={nodes}
            level={0}
            expanded={expandedNodes}
            onToggle={toggleExpand}
            selected={selectedNodeId === node.id}
            onSelect={onNodeSelect}
          />
        ))}
      </div>
    </div>
  );
}

interface TreeNodeProps {
  node: ValueNode;
  allNodes: ValueNode[];
  level: number;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  selected: boolean;
  onSelect?: (id: string) => void;
}

function TreeNode({ node, allNodes, level, expanded, onToggle, selected, onSelect }: TreeNodeProps) {
  const isExpanded = expanded.has(node.id);
  const hasChildren = node.outputs && node.outputs.length > 0;

  return (
    <div>
      <div
        className={`flex items-center gap-2 p-1.5 rounded cursor-pointer ${
          selected ? 'bg-blue-50 border border-blue-200' : 'hover:bg-neutral-50'
        }`}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={() => onSelect?.(node.id)}
      >
        {hasChildren && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle(node.id);
            }}
            className="w-4 h-4 flex items-center justify-center text-neutral-400 hover:text-neutral-600"
          >
            {isExpanded ? '▼' : '▶'}
          </button>
        )}
        {!hasChildren && <span className="w-4" />}

        <span className="text-xs text-neutral-500 uppercase">{node.type}</span>
        <span className="text-sm text-neutral-900 truncate">{node.label}</span>
        {node.value !== undefined && (
          <span className="text-sm text-neutral-500 ml-auto">
            {typeof node.value === 'number' ? node.value.toLocaleString() : node.value}
          </span>
        )}
      </div>

      {isExpanded && hasChildren && node.outputs?.map(childId => {
        const childNode = allNodes.find(n => n.id === childId);
        if (!childNode) return null;
        return (
          <TreeNode
            key={childId}
            node={childNode}
            allNodes={allNodes}
            level={level + 1}
            expanded={expanded}
            onToggle={onToggle}
            selected={selected}
            onSelect={onSelect}
          />
        );
      })}
    </div>
  );
}
