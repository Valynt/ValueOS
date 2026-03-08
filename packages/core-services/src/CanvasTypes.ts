// Shared canvas types used by LayoutEngine, SuggestionEngine, and UndoRedoManager.
// Inlined from packages/backend/src/types/index.ts (CanvasComponent)
// and packages/backend/src/components/Agent/SuggestionCard.ts (Suggestion).

export interface CanvasComponent {
  id: string;
  type: string;
  position: { x: number; y: number; z?: number };
  size: { width: number; height: number };
  props: Record<string, unknown>;
}

export interface Suggestion {
  id: string;
  title: string;
  content: string;
  agentName: string;
  position: { x: number; y: number };
  priority: 'normal' | 'critical';
  actions: Array<{ label: string; action: string }>;
}
