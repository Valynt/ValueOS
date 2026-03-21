/**
 * ValueTreeCanvas Component - Main graph visualization using React Flow
 *
 * Uses the ELK hierarchical layout engine for proper node positioning,
 * replacing the naive `index * 250` approach that caused overlaps.
 */
import { useCallback, useEffect } from 'react';
import ReactFlow, {
  Background,
  Controls,
  Edge,
  Handle,
  MiniMap,
  Node,
  Position,
  useEdgesState,
  useNodesState,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { useWorkflowStore } from '../../store/workflow-store';
import { useWorkspaceStore } from '../../store/workspace-store';
import { Graph, ValueNode } from '../../types/graph.types';
import {
  computeElkLayout,
  computeFallbackLayout,
} from '../../utils/layoutEngine';

interface ValueTreeCanvasProps {
  graph?: Graph;
}

export function ValueTreeCanvas({ graph }: ValueTreeCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { setSelectedNodeId } = useWorkspaceStore();
  const { phase } = useWorkflowStore();

  /**
   * Transform graph data to React Flow format and apply ELK layout.
   * Falls back to the synchronous hierarchical layout if ELK fails.
   */
  const transformGraph = useCallback(
    async (graphData: Graph) => {
      const rawNodes: Node[] = Object.values(graphData.nodes).map((node) => ({
        id: node.id,
        type: 'valueNode',
        // Temporary position — will be overwritten by layout engine
        position: { x: 0, y: 0 },
        data: { node, phase },
      }));

      const rawEdges: Edge[] = Object.values(graphData.edges).map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: 'smoothstep',
        animated: true,
      }));

      // Apply ELK layout with fallback
      let layoutedNodes: Node[];
      try {
        layoutedNodes = await computeElkLayout(rawNodes, rawEdges, {
          direction: 'TB',
          nodeWidth: 200,
          nodeHeight: 80,
          nodeSeparation: 40,
          rankSeparation: 80,
        });
      } catch {
        // ELK failed (e.g., in test environment) — use synchronous fallback
        layoutedNodes = computeFallbackLayout(rawNodes, rawEdges, {
          direction: 'TB',
          nodeWidth: 200,
          nodeHeight: 80,
          nodeSeparation: 40,
          rankSeparation: 80,
        });
      }

      setNodes(layoutedNodes);
      setEdges(rawEdges);
    },
    [setNodes, setEdges, phase]
  );

  useEffect(() => {
    if (graph) {
      void transformGraph(graph);
    }
  }, [graph, transformGraph]);

  // Handle node selection
  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setSelectedNodeId(node.id);
    },
    [setSelectedNodeId]
  );

  return (
    <div className="w-full h-full" role="region" aria-label="Value tree canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={{ valueNode: ValueNodeComponent }}
        fitView
        attributionPosition="bottom-right"
      >
        <Background />
        <Controls aria-label="Canvas controls" />
        <MiniMap aria-label="Canvas minimap" />
      </ReactFlow>
    </div>
  );
}

// Custom Node Component
interface ValueNodeComponentProps {
  data: {
    node: ValueNode;
    phase: string;
  };
}

function ValueNodeComponent({ data }: ValueNodeComponentProps) {
  const { node, phase } = data;
  const isLocked = phase === 'FINALIZED' || node.metadata?.locked;
  const hasLowConfidence = (node.confidence || 0) < 0.7;
  const evidenceCount = node.evidence?.length || 0;

  const nodeColor = isLocked
    ? 'bg-slate-100 border-slate-300'
    : hasLowConfidence
    ? 'bg-amber-50 border-amber-300'
    : 'bg-white border-neutral-300';

  return (
    <div
      className={`relative p-3 rounded-lg border shadow-sm min-w-[180px] ${nodeColor}`}
      role="article"
      aria-label={`${node.type}: ${node.label}`}
    >
      {/* Handles for connections */}
      <Handle type="target" position={Position.Top} className="w-2 h-2" />
      <Handle type="source" position={Position.Bottom} className="w-2 h-2" />

      {/* Node Content */}
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs text-neutral-500 uppercase">{node.type}</span>
        {isLocked && <span className="text-xs">🔒</span>}
      </div>

      <div className="text-sm font-medium text-neutral-900 truncate">{node.label}</div>

      {node.value !== undefined && (
        <div className="text-lg font-bold text-neutral-900 mt-1">
          {typeof node.value === 'number'
            ? node.value >= 1000000
              ? `$${(node.value / 1000000).toFixed(1)}M`
              : node.value.toLocaleString()
            : node.value}
        </div>
      )}

      {/* Badges */}
      <div className="flex items-center gap-2 mt-2">
        {hasLowConfidence && (
          <span className="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded">
            Low confidence
          </span>
        )}
        {evidenceCount > 0 && (
          <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
            {evidenceCount} sources
          </span>
        )}
      </div>
    </div>
  );
}
