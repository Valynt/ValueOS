export interface CanvasNode {
  id: string;
  type: CanvasNodeType;
  position: { x: number; y: number };
  data: Record<string, unknown>;
  selected?: boolean;
}

export type CanvasNodeType = "text" | "card" | "metric" | "chart" | "image" | "connector";

export interface CanvasEdge {
  id: string;
  source: string;
  target: string;
  type?: "default" | "animated";
  label?: string;
}

export interface Canvas {
  id: string;
  name: string;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  viewport: CanvasViewport;
  createdAt: string;
  updatedAt: string;
}

export interface CanvasViewport {
  x: number;
  y: number;
  zoom: number;
}

export interface CanvasState {
  canvas: Canvas | null;
  selectedNodes: string[];
  isDragging: boolean;
  isConnecting: boolean;
}
