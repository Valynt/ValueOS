/**
 * Command Pattern Implementation
 *
 * Provides a centralized command processor for canvas operations.
 * Enables undo/redo, command history, and consistent error handling.
 */

import { v4 as uuidv4 } from 'uuid';

// Base command interface
export interface Command {
  id: string;
  type: string;
  timestamp: number;
  description: string;
  execute(): Promise<CommandResult>;
  undo?(): Promise<void>;
  canUndo?(): boolean;
  metadata?: Record<string, any>;
}

// Command result interface
export interface CommandResult {
  success: boolean;
  data?: any;
  error?: Error;
  warnings?: string[];
  executionTime?: number;
}

// Command history entry
export interface CommandHistoryEntry {
  command: Command;
  result: CommandResult;
  executedAt: number;
  undoneAt?: number;
}

// Command processor options
export interface CommandProcessorOptions {
  maxHistorySize?: number;
  enableUndo?: boolean;
  onCommandExecuted?: (entry: CommandHistoryEntry) => void;
  onCommandUndone?: (entry: CommandHistoryEntry) => void;
  onError?: (error: Error, command: Command) => void;
}

/**
 * Centralized command processor for canvas operations
 */
export class CommandProcessor {
  private history: CommandHistoryEntry[] = [];
  private historyIndex = -1;
  private options: Required<CommandProcessorOptions>;
  private isProcessing = false;
  private commandQueue: Command[] = [];

  constructor(options: CommandProcessorOptions = {}) {
    this.options = {
      maxHistorySize: options.maxHistorySize ?? 100,
      enableUndo: options.enableUndo ?? true,
      onCommandExecuted: options.onCommandExecuted ?? (() => {}),
      onCommandUndone: options.onCommandUndone ?? (() => {}),
      onError: options.onError ?? (() => {}),
    };
  }

  /**
   * Execute a command
   */
  async execute(command: Command): Promise<CommandResult> {
    if (this.isProcessing) {
      // Queue command if processor is busy
      return new Promise((resolve, reject) => {
        const queuedCommand = {
          ...command,
          execute: async () => {
            try {
              const result = await command.execute();
              resolve(result);
            } catch (error) {
              reject(error);
            }
          },
        };
        this.commandQueue.push(queuedCommand);
      });
    }

    this.isProcessing = true;
    const startTime = Date.now();

    try {
      const result = await command.execute();
      const executionTime = Date.now() - startTime;

      // Add to history
      const historyEntry: CommandHistoryEntry = {
        command,
        result: { ...result, executionTime },
        executedAt: Date.now(),
      };

      this.addToHistory(historyEntry);

      // Notify listeners
      this.options.onCommandExecuted(historyEntry);

      return result;
    } catch (error) {
      const commandError = error instanceof Error ? error : new Error(String(error));
      this.options.onError(commandError, command);

      return {
        success: false,
        error: commandError,
        executionTime: Date.now() - startTime,
      };
    } finally {
      this.isProcessing = false;

      // Process queued commands
      if (this.commandQueue.length > 0) {
        const nextCommand = this.commandQueue.shift();
        if (nextCommand) {
          // Execute asynchronously to avoid blocking
          setTimeout(() => this.execute(nextCommand), 0);
        }
      }
    }
  }

  /**
   * Undo the last command
   */
  async undo(): Promise<boolean> {
    if (!this.options.enableUndo) {
      return false;
    }

    const lastEntry = this.getLastUndoableEntry();
    if (!lastEntry) {
      return false;
    }

    try {
      if (lastEntry.command.undo) {
        await lastEntry.command.undo();
      }

      lastEntry.undoneAt = Date.now();
      this.historyIndex--;

      this.options.onCommandUndone(lastEntry);
      return true;
    } catch (error) {
      this.options.onError(error instanceof Error ? error : new Error(String(error)), lastEntry.command);
      return false;
    }
  }

  /**
   * Redo the last undone command
   */
  async redo(): Promise<boolean> {
    if (!this.options.enableUndo) {
      return false;
    }

    const nextEntry = this.getNextRedoableEntry();
    if (!nextEntry) {
      return false;
    }

    try {
      const result = await nextEntry.command.execute();

      // Update history entry
      nextEntry.result = result;
      nextEntry.undoneAt = undefined;
      this.historyIndex++;

      this.options.onCommandExecuted(nextEntry);
      return true;
    } catch (error) {
      this.options.onError(error instanceof Error ? error : new Error(String(error)), nextEntry.command);
      return false;
    }
  }

  /**
   * Check if undo is possible
   */
  canUndo(): boolean {
    return this.options.enableUndo && this.getLastUndoableEntry() !== null;
  }

  /**
   * Check if redo is possible
   */
  canRedo(): boolean {
    return this.options.enableUndo && this.getNextRedoableEntry() !== null;
  }

  /**
   * Get command history
   */
  getHistory(): CommandHistoryEntry[] {
    return [...this.history];
  }

  /**
   * Get current history index
   */
  getHistoryIndex(): number {
    return this.historyIndex;
  }

  /**
   * Clear command history
   */
  clearHistory(): void {
    this.history = [];
    this.historyIndex = -1;
  }

  /**
   * Get processing status
   */
  isCommandProcessing(): boolean {
    return this.isProcessing;
  }

  /**
   * Get queued commands count
   */
  getQueuedCommandsCount(): number {
    return this.commandQueue.length;
  }

  private addToHistory(entry: CommandHistoryEntry): void {
    // Remove any entries after current index (for redo scenarios)
    this.history = this.history.slice(0, this.historyIndex + 1);

    // Add new entry
    this.history.push(entry);
    this.historyIndex++;

    // Trim history if it exceeds max size
    if (this.history.length > this.options.maxHistorySize) {
      const excess = this.history.length - this.options.maxHistorySize;
      this.history = this.history.slice(excess);
      this.historyIndex -= excess;
    }
  }

  private getLastUndoableEntry(): CommandHistoryEntry | null {
    for (let i = this.historyIndex; i >= 0; i--) {
      const entry = this.history[i];
      if (!entry.undoneAt && entry.command.canUndo?.() !== false) {
        return entry;
      }
    }
    return null;
  }

  private getNextRedoableEntry(): CommandHistoryEntry | null {
    for (let i = this.historyIndex + 1; i < this.history.length; i++) {
      const entry = this.history[i];
      if (entry.undoneAt) {
        return entry;
      }
    }
    return null;
  }
}

// Concrete command implementations

/**
 * Process user command through AI agent
 */
export class ProcessUserCommand implements Command {
  id: string;
  type = 'process-user-command';
  timestamp: number;
  description: string;
  metadata: Record<string, any>;

  constructor(
    private query: string,
    private context: {
      caseId: string;
      userId: string;
      sessionId: string;
      workflowState: any;
      tenantId?: string;
    },
    private commandProcessor: (query: string, context: any) => Promise<any>
  ) {
    this.id = uuidv4();
    this.timestamp = Date.now();
    this.description = `Process command: "${query.substring(0, 50)}${query.length > 50 ? '...' : ''}"`;
    this.metadata = { query, context };
  }

  async execute(): Promise<CommandResult> {
    try {
      const result = await this.commandProcessor(this.query, this.context);
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  canUndo(): boolean {
    return false; // AI commands cannot be undone
  }
}

/**
 * Create new value case
 */
export class CreateValueCase implements Command {
  id: string;
  type = 'create-value-case';
  timestamp: number;
  description: string;
  metadata: Record<string, any>;

  constructor(
    private caseData: {
      name: string;
      company: string;
      website?: string;
      stage?: string;
    },
    private createCaseFunction: (data: any) => Promise<any>,
    private onSuccess?: (newCase: any) => void
  ) {
    this.id = uuidv4();
    this.timestamp = Date.now();
    this.description = `Create value case: ${caseData.name}`;
    this.metadata = { caseData };
  }

  async execute(): Promise<CommandResult> {
    try {
      const newCase = await this.createCaseFunction(this.caseData);
      this.onSuccess?.(newCase);

      return {
        success: true,
        data: newCase,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  canUndo(): boolean {
    return true; // Could implement case deletion for undo
  }

  async undo(): Promise<void> {
    // Implementation would delete the created case
    // This is a placeholder for the actual undo logic
    console.log('Undo create case:', this.metadata.caseData);
  }
}

/**
 * Update workflow state
 */
export class UpdateWorkflowState implements Command {
  id: string;
  type = 'update-workflow-state';
  timestamp: number;
  description: string;
  metadata: Record<string, any>;

  private previousState?: any;

  constructor(
    private newState: any,
    private updateStateFunction: (state: any) => Promise<void>,
    private currentState: any
  ) {
    this.id = uuidv4();
    this.timestamp = Date.now();
    this.description = `Update workflow state to: ${newState.currentStage}`;
    this.metadata = { newState };
  }

  async execute(): Promise<CommandResult> {
    try {
      // Store previous state for undo
      this.previousState = { ...this.currentState };

      await this.updateStateFunction(this.newState);

      return {
        success: true,
        data: this.newState,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  canUndo(): boolean {
    return !!this.previousState;
  }

  async undo(): Promise<void> {
    if (this.previousState) {
      await this.updateStateFunction(this.previousState);
    }
  }
}

/**
 * Render SDUI page
 */
export class RenderSDUIPage implements Command {
  id: string;
  type = 'render-sdui-page';
  timestamp: number;
  description: string;
  metadata: Record<string, any>;

  constructor(
    private sduiPage: any,
    private renderFunction: (page: any) => Promise<any>,
    private onSuccess?: (result: any) => void
  ) {
    this.id = uuidv4();
    this.timestamp = Date.now();
    this.description = `Render SDUI page with ${sduiPage.sections?.length || 0} sections`;
    this.metadata = { sduiPage };
  }

  async execute(): Promise<CommandResult> {
    try {
      const result = await this.renderFunction(this.sduiPage);
      this.onSuccess?.(result);

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  canUndo(): boolean {
    return false; // Rendering operations cannot be undone
  }
}

// Singleton instance for global use
export const globalCommandProcessor = new CommandProcessor({
  maxHistorySize: 50,
  enableUndo: true,
  onCommandExecuted: (entry) => {
    console.log('Command executed:', entry.command.description);
  },
  onCommandUndone: (entry) => {
    console.log('Command undone:', entry.command.description);
  },
  onError: (error, command) => {
    console.error('Command error:', error, command.description);
  },
});
