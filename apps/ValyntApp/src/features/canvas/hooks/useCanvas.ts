import { useCallback, useState } from "react";

import { apiClient } from "../../../api/client/unified-api-client";
import { logger } from "@/lib/logger";
import type { Canvas, CanvasEdge, CanvasNode, CanvasViewport } from "../types";

export function useCanvas(_canvasId?: string) {
  const [canvas, setCanvas] = useState<Canvas | null>(null);
  const [selectedNodes, setSelectedNodes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadCanvas = useCallback(async (id: string) => {
    setIsLoading(true);
    try {
      const response = await apiClient.get<Canvas>(`/api/canvas/${id}`);
      if (response.success && response.data) {
        setCanvas(response.data);
      }
    } catch (error) {
      logger.error("Failed to load canvas", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const addNode = useCallback((node: Omit<CanvasNode, "id">) => {
    const newNode: CanvasNode = {
      ...node,
      id: `node_${Date.now()}`,
    };
    setCanvas((prev) =>
      prev ? { ...prev, nodes: [...prev.nodes, newNode], updatedAt: new Date().toISOString() } : null
    );
    return newNode;
  }, []);

  const updateNode = useCallback((nodeId: string, updates: Partial<CanvasNode>) => {
    setCanvas((prev) =>
      prev
        ? {
            ...prev,
            nodes: prev.nodes.map((n) => (n.id === nodeId ? { ...n, ...updates } : n)),
            updatedAt: new Date().toISOString(),
          }
        : null
    );
  }, []);

  const deleteNode = useCallback((nodeId: string) => {
    setCanvas((prev) =>
      prev
        ? {
            ...prev,
            nodes: prev.nodes.filter((n) => n.id !== nodeId),
            edges: prev.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
            updatedAt: new Date().toISOString(),
          }
        : null
    );
    setSelectedNodes((prev) => prev.filter((id) => id !== nodeId));
  }, []);

  const addEdge = useCallback((edge: Omit<CanvasEdge, "id">) => {
    const newEdge: CanvasEdge = {
      ...edge,
      id: `edge_${Date.now()}`,
    };
    setCanvas((prev) =>
      prev ? { ...prev, edges: [...prev.edges, newEdge], updatedAt: new Date().toISOString() } : null
    );
    return newEdge;
  }, []);

  const deleteEdge = useCallback((edgeId: string) => {
    setCanvas((prev) =>
      prev
        ? {
            ...prev,
            edges: prev.edges.filter((e) => e.id !== edgeId),
            updatedAt: new Date().toISOString(),
          }
        : null
    );
  }, []);

  const setViewport = useCallback((viewport: CanvasViewport) => {
    setCanvas((prev) => (prev ? { ...prev, viewport } : null));
  }, []);

  const selectNode = useCallback((nodeId: string, multi = false) => {
    setSelectedNodes((prev) => (multi ? [...prev, nodeId] : [nodeId]));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedNodes([]);
  }, []);

  return {
    canvas,
    selectedNodes,
    isLoading,
    loadCanvas,
    addNode,
    updateNode,
    deleteNode,
    addEdge,
    deleteEdge,
    setViewport,
    selectNode,
    clearSelection,
  };
}
