/**
 * Live Workflow Graph
 * 
 * Real-time visualization of Temporal workflows and LangGraph reasoning loops
 * Shows agent-to-agent communication and execution flow
 */

import React, { useEffect, useRef, useState } from 'react';
import { 
  Activity, 
  CheckCircle, 
  Clock, 
  DollarSign,
  Loader2,
  XCircle,
  Zap
} from 'lucide-react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useTemporalWorkflow } from '../../hooks/useTemporalWorkflow';
import { useLangGraphState } from '../../hooks/useLangGraphState';

interface LiveWorkflowGraphProps {
  workflowId?: string;
  className?: string;
}

export function LiveWorkflowGraph({ workflowId, className }: LiveWorkflowGraphProps) {
  const { workflowState, activities } = useTemporalWorkflow(workflowId);
  const { reasoningLoop } = useLangGraphState(workflowId);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Convert workflow activities to React Flow nodes
  useEffect(() => {
    if (!activities) return;

    const flowNodes: Node[] = activities.map((activity, index) => ({
      id: activity.id,
      type: 'custom',
      position: { x: index * 200, y: 100 },
      data: {
        label: activity.name,
        status: activity.status,
        agent: activity.agent,
        duration: activity.duration,
        cost: activity.cost,
      },
    }));

    const flowEdges: Edge[] = activities.slice(0, -1).map((activity, index) => ({
      id: `${activity.id}-${activities[index + 1].id}`,
      source: activity.id,
      target: activities[index + 1].id,
      animated: activities[index + 1].status === 'running',
      style: { stroke: getEdgeColor(activities[index + 1].status) },
    }));

    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [activities, setNodes, setEdges]);

  const getEdgeColor = (status: string) => {
    switch (status) {
      case 'completed': return '#10b981';
      case 'running': return '#3b82f6';
      case 'failed': return '#ef4444';
      default: return '#64748b';
    }
  };

  return (
    <div className={`bg-slate-900 rounded-xl border border-slate-800 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-purple-400" />
          <h3 className="text-sm font-semibold">Live Orchestration Graph</h3>
        </div>

        {/* Workflow status */}
        {workflowState && (
          <div className="flex items-center gap-3 text-xs">
            <span className="text-slate-400">
              Workflow: <span className="text-slate-200">{workflowState.name}</span>
            </span>
            <StatusBadge status={workflowState.status} />
          </div>
        )}
      </div>

      {/* Graph Canvas */}
      <div className="h-[500px] relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={{ custom: CustomNode }}
          fitView
        >
          <Background color="#1e293b" gap={16} />
          <Controls className="bg-slate-800 border-slate-700" />
          <MiniMap 
            className="bg-slate-800 border-slate-700"
            nodeColor={(node) => {
              switch (node.data.status) {
                case 'completed': return '#10b981';
                case 'running': return '#3b82f6';
                case 'failed': return '#ef4444';
                default: return '#64748b';
              }
            }}
          />
        </ReactFlow>
      </div>

      {/* Metrics Footer */}
      {workflowState && (
        <div className="flex items-center gap-6 p-4 border-t border-slate-800 text-xs">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400">Latency:</span>
            <span className="font-medium">{workflowState.latency}s</span>
          </div>
          <div className="flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400">Cost:</span>
            <span className="font-medium">${workflowState.cost}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400">Loops:</span>
            <span className="font-medium">{reasoningLoop?.iterations || 0}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400">Activities:</span>
            <span className="font-medium">{activities?.length || 0}</span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Custom Node Component
 */
function CustomNode({ data }: { data: any }) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'running':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-slate-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'border-green-500 bg-green-500/10';
      case 'running': return 'border-blue-500 bg-blue-500/10';
      case 'failed': return 'border-red-500 bg-red-500/10';
      default: return 'border-slate-700 bg-slate-800';
    }
  };

  return (
    <div 
      className={`
        px-4 py-3 rounded-lg border-2 min-w-[180px]
        ${getStatusColor(data.status)}
        transition-all hover:shadow-lg
      `}
    >
      {/* Agent badge */}
      {data.agent && (
        <div className="text-xs text-slate-400 mb-1">
          {data.agent}
        </div>
      )}

      {/* Activity name */}
      <div className="flex items-center gap-2 mb-2">
        {getStatusIcon(data.status)}
        <span className="text-sm font-medium">{data.label}</span>
      </div>

      {/* Metrics */}
      {(data.duration || data.cost) && (
        <div className="flex items-center gap-3 text-xs text-slate-400">
          {data.duration && (
            <span>{data.duration}s</span>
          )}
          {data.cost && (
            <span>${data.cost}</span>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Status Badge Component
 */
function StatusBadge({ status }: { status: string }) {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'completed':
        return { color: 'bg-green-500', label: 'Completed', icon: CheckCircle };
      case 'running':
        return { color: 'bg-blue-500', label: 'Running', icon: Loader2 };
      case 'failed':
        return { color: 'bg-red-500', label: 'Failed', icon: XCircle };
      default:
        return { color: 'bg-slate-500', label: 'Pending', icon: Clock };
    }
  };

  const config = getStatusConfig(status);
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-slate-800">
      <div className={`w-1.5 h-1.5 rounded-full ${config.color}`} />
      <Icon className="w-3 h-3" />
      <span>{config.label}</span>
    </div>
  );
}
