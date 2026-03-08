// Migrated from apps/ValyntApp/src/services/UndoRedoManager.ts
// and packages/backend/src/services/UndoRedoManager.ts (identical logic, import path differed).
// Canonical location: packages/core-services/src/UndoRedoManager.ts

import type { CanvasComponent } from './CanvasTypes.js';

export type { CanvasComponent };

export interface HistoryState {
  components: CanvasComponent[];
  timestamp: Date;
  action: string;
  actor: string;
}

class UndoRedoManager {
  private history: HistoryState[] = [];
  private currentIndex = -1;
  private readonly MAX_HISTORY = 50;
  private listeners: Array<() => void> = [];

  saveState(components: CanvasComponent[], action: string, actor = 'user'): void {
    const newState: HistoryState = {
      components: JSON.parse(JSON.stringify(components)) as CanvasComponent[],
      timestamp: new Date(),
      action,
      actor,
    };

    if (this.currentIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.currentIndex + 1);
    }

    this.history.push(newState);

    if (this.history.length > this.MAX_HISTORY) {
      this.history.shift();
    } else {
      this.currentIndex++;
    }

    this.notifyListeners();
  }

  undo(): CanvasComponent[] | null {
    if (!this.canUndo()) return null;
    this.currentIndex--;
    this.notifyListeners();
    return JSON.parse(JSON.stringify(this.history[this.currentIndex].components)) as CanvasComponent[];
  }

  redo(): CanvasComponent[] | null {
    if (!this.canRedo()) return null;
    this.currentIndex++;
    this.notifyListeners();
    return JSON.parse(JSON.stringify(this.history[this.currentIndex].components)) as CanvasComponent[];
  }

  canUndo(): boolean { return this.currentIndex > 0; }
  canRedo(): boolean { return this.currentIndex < this.history.length - 1; }

  getCurrentState(): HistoryState | null {
    return this.currentIndex >= 0 ? this.history[this.currentIndex] : null;
  }

  getUndoAction(): string | null {
    return this.canUndo() ? this.history[this.currentIndex - 1].action : null;
  }

  getRedoAction(): string | null {
    return this.canRedo() ? this.history[this.currentIndex + 1].action : null;
  }

  getHistory(): HistoryState[] {
    return this.history.slice(0, this.currentIndex + 1);
  }

  clear(): void {
    this.history = [];
    this.currentIndex = -1;
    this.notifyListeners();
  }

  onChange(callback: () => void): void {
    this.listeners.push(callback);
  }

  private notifyListeners(): void {
    this.listeners.forEach(cb => cb());
  }

  getStats() {
    return {
      totalStates: this.history.length,
      currentIndex: this.currentIndex,
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      undoAction: this.getUndoAction(),
      redoAction: this.getRedoAction(),
    };
  }
}

export const undoRedoManager = new UndoRedoManager();
