/**
 * ValueCanvas - Interactive canvas for value driver configuration
 *
 * React Flow-based implementation with real-time calculations and visual DAG editing.
 */

import React, { useCallback, useEffect, useMemo } from 'react';
import {
  Background,
  Connection,
  Controls,
  MiniMap,
  Node,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { Library, Redo, Settings, Undo } from 'lucide-react';

import { nodeTypes } from './ValueCanvasNodes';
import { ValueDriverEditor } from './ValueDriverEditor';
import { ValueDriverLibrary } from './ValueDriverLibrary';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useOrganization } from '@/hooks/useOrganization';
import { logger } from '@/lib/logger';
import { calculationEngine } from '@/services/CalculationEngine';
import { PlaygroundSessionService } from '@/services/PlaygroundSessionService';
import useValueCanvasStore, { useTemporalStore } from '@/stores/valueCanvasStore';

interface ValueCanvasProps {
  sessionId: string;
  onSave?: () => void;
}

const ValueCanvasContent: React.FC<ValueCanvasProps> = ({ sessionId, onSave }) => {
  const { organizationId } = useOrganization();

  // Zustand store
  const {
    nodes,
    edges,
    driverValues,
    driverDefinitions,
    selectedNodeId,
    isEditorOpen,
    isLibraryOpen,
    isSaving,
    lastSaved,
    error,
    setSelectedNodeId,
    setIsEditorOpen,
    setIsLibraryOpen,
    setIsSaving,
    setLastSaved,
    setError,
    addDriverNode,
    updateDriverFormula,
    loadCanvas,
    onConnect: storeOnConnect,
  } = useValueCanvasStore();

  // Undo/Redo
  const { undo, redo, pastStates, futureStates } = useTemporalStore();

  // React Flow state
  const [rfNodes, setRfNodes, onNodesChange] = useNodesState([]);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState([]);

  // Session service
  const [sessionService] = React.useState(() => new PlaygroundSessionService());

  // Sync Zustand store with React Flow
  useEffect(() => {
    setRfNodes(nodes);
  }, [nodes, setRfNodes]);

  useEffect(() => {
    setRfEdges(edges);
  }, [edges, setRfEdges]);

  // Load session data
  useEffect(() => {
    if (!organizationId) return;
    const loadSession = async () => {
      try {
        const session = await sessionService.loadSession(sessionId, organizationId);
        if (session?.data) {
          const canvasData = session.data;
          loadCanvas({
            nodes: canvasData.nodes || [],
            edges: canvasData.edges || [],
            driverDefinitions: canvasData.driverDefinitions || {},
            driverValues: canvasData.driverValues || {},
          });

          // Re-register nodes with calculation engine
          Object.entries(canvasData.driverDefinitions || {}).forEach(([nodeId, def]) => {
            calculationEngine.registerNode(nodeId, def.formula || '', canvasData.driverValues?.[nodeId] || 0);
          });
        }
      } catch (error) {
        logger.error('Failed to load session', { sessionId, organizationId, error });
        setError('Failed to load canvas data');
      }
    };

    loadSession();
  }, [sessionId, organizationId, sessionService, loadCanvas, setError]);

  // Auto-save with debouncing
  useEffect(() => {
    if (!organizationId) return;
    const autoSave = async () => {
      if (!nodes.length && !edges.length) return; // Don't save empty canvas

      try {
        setIsSaving(true);
        await sessionService.updateSession(sessionId, {
          data: {
            nodes,
            edges,
            driverDefinitions,
            driverValues,
            engineState: calculationEngine.serialize(),
          },
          organizationId,
        });
        setLastSaved(new Date());
        setError(null);
        onSave?.();
      } catch (error) {
        logger.error('Auto-save failed', { sessionId, error });
        setError('Failed to save changes');
      } finally {
        setIsSaving(false);
      }
    };

    const timeout = setTimeout(autoSave, 2000); // 2 second debounce
    return () => clearTimeout(timeout);
  }, [nodes, edges, driverDefinitions, driverValues, sessionId, organizationId, sessionService, setIsSaving, setLastSaved, setError, onSave]);

  // Handle connections
  const onConnect = useCallback((connection: Connection) => {
    storeOnConnect(connection);
  }, [storeOnConnect]);

  // Handle node selection
  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
  }, [setSelectedNodeId]);

  // Handle node drag end (for updating positions)
  const onNodeDragStop = useCallback((_event: React.MouseEvent, _node: Node) => {
    // Update node position in store if needed
    // This would be handled by the store's updateNode action
  }, []);

  // Add new driver from library
  const handleAddDriver = useCallback((driverType: 'input' | 'calculated', template?: any) => {
    const nodeId = `node_${Date.now()}`;
    const position = { x: Math.random() * 400 + 100, y: Math.random() * 300 + 100 };

    const driverNode = {
      id: nodeId,
      type: driverType,
      label: template?.name || `${driverType} Driver`,
      formula: template?.formula || '',
      value: template?.defaultValue || 0,
      format: template?.format || 'number',
      position,
    };

    addDriverNode(driverNode);

    // Register with calculation engine
    calculationEngine.registerNode(nodeId, driverNode.formula, driverNode.value);

    setIsLibraryOpen(false);
  }, [addDriverNode, setIsLibraryOpen]);

  // Open editor for selected node
  const handleEditNode = useCallback(() => {
    if (selectedNodeId) {
      setIsEditorOpen(true);
    }
  }, [selectedNodeId, setIsEditorOpen]);

  // Save formula from editor
  const handleSaveFormula = useCallback((formula: string) => {
    if (selectedNodeId) {
      updateDriverFormula(selectedNodeId, formula);

      // Update calculation engine
      const results = calculationEngine.updateFormula(selectedNodeId, formula);

      // Update driver values in store
      results.forEach(result => {
        if (!result.error) {
          useValueCanvasStore.getState().updateDriverValue(result.nodeId, result.value);
        }
      });
    }
    setIsEditorOpen(false);
  }, [selectedNodeId, updateDriverFormula, setIsEditorOpen]);

  // Status display
  const statusDisplay = useMemo(() => {
    if (error) {
      return <Badge variant="destructive">{error}</Badge>;
    }
    if (isSaving) {
      return <Badge variant="secondary">Saving...</Badge>;
    }
    if (lastSaved) {
      return <Badge variant="outline">Saved {lastSaved.toLocaleTimeString()}</Badge>;
    }
    return <Badge variant="outline">Unsaved changes</Badge>;
  }, [error, isSaving, lastSaved]);

  return (
    <div className="h-full w-full relative">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={nodeTypes}
        fitView
        className="bg-gray-50"
      >
        <Background />
        <Controls />
        <MiniMap />

        {/* Top Panel */}
        <Panel position="top-left">
          <Card className="shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                Value Driver Canvas
                {statusDisplay}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsLibraryOpen(true)}
                >
                  <Library className="w-4 h-4 mr-1" />
                  Add Driver
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleEditNode}
                  disabled={!selectedNodeId}
                >
                  <Settings className="w-4 h-4 mr-1" />
                  Edit Formula
                </Button>

                <div className="w-[1px] h-6 bg-border" />

                <Button
                  size="sm"
                  variant="outline"
                  onClick={undo}
                  disabled={pastStates.length === 0}
                >
                  <Undo className="w-4 h-4" />
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={redo}
                  disabled={futureStates.length === 0}
                >
                  <Redo className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </Panel>

        {/* Bottom Panel */}
        <Panel position="bottom-left">
          <div className="text-sm text-muted-foreground">
            {nodes.length} nodes • {edges.length} connections • {Object.keys(driverValues).length} calculated values
          </div>
        </Panel>
      </ReactFlow>

      {/* Library Sidebar */}
      {isLibraryOpen && (
        <ValueDriverLibrary
          onAddDriver={handleAddDriver}
          onClose={() => setIsLibraryOpen(false)}
        />
      )}

      {/* Formula Editor */}
      {isEditorOpen && selectedNodeId && (
        <ValueDriverEditor
          nodeId={selectedNodeId}
          initialFormula={driverDefinitions[selectedNodeId]?.formula || ''}
          onSave={handleSaveFormula}
          onClose={() => setIsEditorOpen(false)}
        />
      )}
    </div>
  );
};

export const ValueCanvas: React.FC<ValueCanvasProps> = (props) => {
  return (
    <ReactFlowProvider>
      <ValueCanvasContent {...props} />
    </ReactFlowProvider>
  );
};
