import React, { useCallback } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
} from 'reactflow';
import 'reactflow/dist/style.css';

/**
 * ValueFlowGraph renders a visual representation of the multi‑agent system.
 * Each agent is represented as a node. Edges indicate message or data flow.
 * Colors convey the type of interaction:
 *   - Blue: Value lifecycle events
 *   - Green: Data queries/reads
 *   - Orange: Validation and compliance flows
 */

const initialNodes = [
  {
    id: 'opportunity',
    type: 'input',
    position: { x: 0, y: 100 },
    data: { label: 'Opportunity\nAgent', state: 'idle' },
    style: { backgroundColor: '#e3f2fd', border: '1px solid #90caf9' },
  },
  {
    id: 'target',
    position: { x: 250, y: 100 },
    data: { label: 'Target\nAgent', state: 'idle' },
    style: { backgroundColor: '#fff3e0', border: '1px solid #ffb74d' },
  },
  {
    id: 'realization',
    position: { x: 500, y: 100 },
    data: { label: 'Realization\nAgent', state: 'idle' },
    style: { backgroundColor: '#e8f5e9', border: '1px solid #81c784' },
  },
  {
    id: 'expansion',
    position: { x: 750, y: 100 },
    data: { label: 'Expansion\nAgent', state: 'idle' },
    style: { backgroundColor: '#ede7f6', border: '1px solid #9575cd' },
  },
  {
    id: 'integrity',
    position: { x: 375, y: 300 },
    data: { label: 'Integrity\nAgent', state: 'idle' },
    style: { backgroundColor: '#ffebee', border: '1px solid #e57373' },
  },
  {
    id: 'orchestrator',
    position: { x: 375, y: -50 },
    data: { label: 'Orchestrator\nAgent', state: 'idle' },
    style: { backgroundColor: '#f3e5f5', border: '1px solid #ba68c8' },
  },
];

const initialEdges = [
  {
    id: 'e1',
    source: 'opportunity',
    target: 'target',
    label: 'value.opportunity.created',
    style: { stroke: '#2196f3' },
    animated: true,
  },
  {
    id: 'e2',
    source: 'target',
    target: 'realization',
    label: 'value.target.defined',
    style: { stroke: '#fb8c00' },
    animated: true,
  },
  {
    id: 'e3',
    source: 'realization',
    target: 'expansion',
    label: 'value.realization.updated',
    style: { stroke: '#4caf50' },
    animated: true,
  },
  {
    id: 'e4',
    source: 'expansion',
    target: 'target',
    label: 'value.expansion.triggered',
    style: { stroke: '#9575cd' },
    animated: true,
  },
  {
    id: 'e5',
    source: 'target',
    target: 'integrity',
    label: 'validate business case',
    style: { stroke: '#d81b60' },
    animated: false,
  },
  {
    id: 'e6',
    source: 'realization',
    target: 'integrity',
    label: 'validate report',
    style: { stroke: '#d81b60' },
  },
  {
    id: 'e7',
    source: 'expansion',
    target: 'integrity',
    label: 'validate upsell case',
    style: { stroke: '#d81b60' },
  },
  {
    id: 'e8',
    source: 'orchestrator',
    target: 'opportunity',
    label: 'start workflow',
    style: { stroke: '#6a1b9a' },
  },
  {
    id: 'e9',
    source: 'orchestrator',
    target: 'target',
    label: 'delegate business case',
    style: { stroke: '#6a1b9a' },
  },
];

function ValueFlowGraph() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge({ ...params, animated: true }, eds)),
    [setEdges]
  );

  return (
    <div style={{ height: 600, width: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
      >
        <MiniMap
          nodeStrokeColor={(n) => {
            if (n.id === 'integrity') return '#e57373';
            if (n.id === 'expansion') return '#9575cd';
            if (n.id === 'realization') return '#81c784';
            if (n.id === 'target') return '#ffb74d';
            if (n.id === 'opportunity') return '#90caf9';
            return '#ba68c8';
          }}
          nodeColor={(n) => {
            return n.style?.backgroundColor || '#fff';
          }}
        />
        <Controls position="bottom-right" />
        <Background color="#f0f0f0" gap={16} />
      </ReactFlow>
    </div>
  );
}

export default ValueFlowGraph;