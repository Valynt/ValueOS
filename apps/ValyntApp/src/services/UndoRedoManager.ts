import { CanvasComponent } from '../types';

export interface HistoryState {
  components: CanvasComponent[];
  timestamp: Date;
  action: string;
  actor: string;
}

class UndoRedoManager {
  private history: HistoryState[] = [];
  private currentIndex: number = -1;
  private readonly MAX_HISTORY = 50;
  private listeners: Array<() => void> = [];

  saveState(components: CanvasComponent[], action: string, actor: string = 'user') {
    const newState: HistoryState = {
      components: JSON.parse(JSON.stringify(components)),
      timestamp: new Date(),
      action,
      actor
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
    return JSON.parse(JSON.stringify(this.history[this.currentIndex].components));
  }

  redo(): CanvasComponent[] | null {
    if (!this.canRedo()) return null;

    this.currentIndex++;
    this.notifyListeners();
    return JSON.parse(JSON.stringify(this.history[this.currentIndex].components));
  }

  canUndo(): boolean {
    return this.currentIndex > 0;
  }

  canRedo(): boolean {
    return this.currentIndex < this.history.length - 1;
  }

  getCurrentState(): HistoryState | null {
    if (this.currentIndex >= 0 && this.currentIndex < this.history.length) {
      return this.history[this.currentIndex];
    }
    return null;
  }

  getUndoAction(): string | null {
    if (this.canUndo()) {
      return this.history[this.currentIndex - 1].action;
    }
    return null;
  }

  getRedoAction(): string | null {
    if (this.canRedo()) {
      return this.history[this.currentIndex + 1].action;
    }
    return null;
  }

  getHistory(): HistoryState[] {
    return this.history.slice(0, this.currentIndex + 1);
  }

  clear() {
    this.history = [];
    this.currentIndex = -1;
    this.notifyListeners();
  }

  onChange(callback: () => void) {
    this.listeners.push(callback);
  }

  private notifyListeners() {
    this.listeners.forEach(callback => callback());
  }

  getStats() {
    return {
      totalStates: this.history.length,
      currentIndex: this.currentIndex,
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      undoAction: this.getUndoAction(),
      redoAction: this.getRedoAction()
    };
  }
}

export const undoRedoManager = new UndoRedoManager();
