/**
 * ValueTreeCanvas Component - Main graph visualization using React Flow
 */

import { useCallback } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { useWorkflowStore } from '../../store/workflow-store';
import { useWorkspaceStore } from '../../store/workspace-store';
import { Graph, ValueNode, ValueEdge } from '../../types/graph.types';

interface ValueTreeCanvasProps {
  graph?: Graph;
}

export function ValueTreeCanvas({ graph }: ValueTreeCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { setSelectedNodeId } = useWorkspaceStore();
  const { phase } = useWorkflowStore();

  // Transform graph data to React Flow format
  const transformGraph = useCallback((graphData: Graph) => {
    const flowNodes: Node[] = Object.values(graphData.nodes).map((node, index) => ({
      id: node.id,
      type: 'valueNode',
      position: { x: index * 250, y: (index % 3) * 150 }, // Simple layout
      data: { node, phase },
    }));

    const flowEdges: Edge[] = Object.values(graphData.edges).map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: 'smoothstep',
      animated: true,
    }));

    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [setNodes, setEdges, phase]);

  // Handle node selection
  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
  }, [setSelectedNodeId]);

  return (
    <div className="w-full h-full">
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
        <Controls />
        <MiniMap />
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
    <div className={`relative p-3 rounded-lg border shadow-sm min-w-[180px] ${nodeColor}`}>
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
