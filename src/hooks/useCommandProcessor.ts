/**
 * useCommandProcessor Hook
 *
 * React hook for interacting with the Command Processor.
 * Provides command execution, undo/redo, and history management.
 */

import { useCallback, useEffect, useState, useRef } from 'react';
import {
  Command,
  CommandProcessor,
  CommandResult,
  CommandHistoryEntry,
  CommandProcessorOptions,
  globalCommandProcessor,
  ProcessUserCommand,
  CreateValueCase,
  UpdateWorkflowState,
  RenderSDUIPage,
} from '../lib/commands/CommandProcessor';

export interface UseCommandProcessorOptions extends CommandProcessorOptions {
  useGlobalProcessor?: boolean;
}

export interface CommandProcessorState {
  isProcessing: boolean;
  canUndo: boolean;
  canRedo: boolean;
  history: CommandHistoryEntry[];
  historyIndex: number;
  queuedCommands: number;
}

/**
 * Hook for using the command processor in React components
 */
export function useCommandProcessor(options: UseCommandProcessorOptions = {}) {
  const { useGlobalProcessor = true, ...processorOptions } = options;

  // Create or use global processor
  const processorRef = useRef<CommandProcessor>(
    useGlobalProcessor ? globalCommandProcessor : new CommandProcessor(processorOptions)
  );
  const processor = processorRef.current;

  // State management
  const [state, setState] = useState<CommandProcessorState>({
    isProcessing: false,
    canUndo: false,
    canRedo: false,
    history: [],
    historyIndex: -1,
    queuedCommands: 0,
  });

  // Update state when processor changes
  const updateState = useCallback(() => {
    setState({
      isProcessing: processor.isCommandProcessing(),
      canUndo: processor.canUndo(),
      canRedo: processor.canRedo(),
      history: processor.getHistory(),
      historyIndex: processor.getHistoryIndex(),
      queuedCommands: processor.getQueuedCommandsCount(),
    });
  }, [processor]);

  // Listen to processor events
  useEffect(() => {
    // Set up event listeners
    const onCommandExecuted = () => updateState();
    const onCommandUndone = () => updateState();
    const onError = () => updateState();

    // Override processor options to include our listeners
    if (!useGlobalProcessor) {
      processor.options.onCommandExecuted = onCommandExecuted;
      processor.options.onCommandUndone = onCommandUndone;
      processor.options.onError = onError;
    }

    // Initial state update
    updateState();

    // Set up interval to check processing status
    const interval = setInterval(updateState, 100);

    return () => {
      clearInterval(interval);
    };
  }, [processor, updateState, useGlobalProcessor]);

  // Command execution
  const executeCommand = useCallback(async (command: Command): Promise<CommandResult> => {
    const result = await processor.execute(command);
    updateState();
    return result;
  }, [processor, updateState]);

  // Undo/Redo
  const undo = useCallback(async (): Promise<boolean> => {
    const success = await processor.undo();
    updateState();
    return success;
  }, [processor, updateState]);

  const redo = useCallback(async (): Promise<boolean> => {
    const success = await processor.redo();
    updateState();
    return success;
  }, [processor, updateState]);

  // Clear history
  const clearHistory = useCallback(() => {
    processor.clearHistory();
    updateState();
  }, [processor, updateState]);

  // Convenience command creators
  const processUserCommand = useCallback((
    query: string,
    context: any,
    commandProcessor: (query: string, context: any) => Promise<any>
  ) => {
    return new ProcessUserCommand(query, context, commandProcessor);
  }, []);

  const createValueCase = useCallback((
    caseData: any,
    createCaseFunction: (data: any) => Promise<any>,
    onSuccess?: (newCase: any) => void
  ) => {
    return new CreateValueCase(caseData, createCaseFunction, onSuccess);
  }, []);

  const updateWorkflowState = useCallback((
    newState: any,
    updateStateFunction: (state: any) => Promise<void>,
    currentState: any
  ) => {
    return new UpdateWorkflowState(newState, updateStateFunction, currentState);
  }, []);

  const renderSDUIPage = useCallback((
    sduiPage: any,
    renderFunction: (page: any) => Promise<any>,
    onSuccess?: (result: any) => void
  ) => {
    return new RenderSDUIPage(sduiPage, renderFunction, onSuccess);
  }, []);

  // High-level command execution helpers
  const executeUserCommand = useCallback(async (
    query: string,
    context: any,
    commandProcessor: (query: string, context: any) => Promise<any>
  ): Promise<CommandResult> => {
    const command = processUserCommand(query, context, commandProcessor);
    return executeCommand(command);
  }, [processUserCommand, executeCommand]);

  const executeCreateCase = useCallback(async (
    caseData: any,
    createCaseFunction: (data: any) => Promise<any>,
    onSuccess?: (newCase: any) => void
  ): Promise<CommandResult> => {
    const command = createValueCase(caseData, createCaseFunction, onSuccess);
    return executeCommand(command);
  }, [createValueCase, executeCommand]);

  const executeUpdateState = useCallback(async (
    newState: any,
    updateStateFunction: (state: any) => Promise<void>,
    currentState: any
  ): Promise<CommandResult> => {
    const command = updateWorkflowState(newState, updateStateFunction, currentState);
    return executeCommand(command);
  }, [updateWorkflowState, executeCommand]);

  const executeRenderPage = useCallback(async (
    sduiPage: any,
    renderFunction: (page: any) => Promise<any>,
    onSuccess?: (result: any) => void
  ): Promise<CommandResult> => {
    const command = renderSDUIPage(sduiPage, renderFunction, onSuccess);
    return executeCommand(command);
  }, [renderSDUIPage, executeCommand]);

  // Keyboard shortcuts
  const handleKeyboardShortcut = useCallback((event: KeyboardEvent) => {
    if (event.metaKey || event.ctrlKey) {
      if (event.key === 'z' && !event.shiftKey) {
        event.preventDefault();
        undo();
      } else if ((event.key === 'z' && event.shiftKey) || event.key === 'y') {
        event.preventDefault();
        redo();
      }
    }
  }, [undo, redo]);

  // Set up keyboard shortcuts
  useEffect(() => {
    window.addEventListener('keydown', handleKeyboardShortcut);
    return () => window.removeEventListener('keydown', handleKeyboardShortcut);
  }, [handleKeyboardShortcut]);

  return {
    // State
    ...state,

    // Core actions
    executeCommand,
    undo,
    redo,
    clearHistory,

    // Command creators
    processUserCommand,
    createValueCase,
    updateWorkflowState,
    renderSDUIPage,

    // High-level helpers
    executeUserCommand,
    executeCreateCase,
    executeUpdateState,
    executeRenderPage,

    // Processor access
    processor,
  };
}

/**
 * Hook for command history visualization
 */
export function useCommandHistory(processor: CommandProcessor) {
  const [history, setHistory] = useState<CommandHistoryEntry[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  useEffect(() => {
    const updateHistory = () => {
      setHistory(processor.getHistory());
      setSelectedIndex(processor.getHistoryIndex());
    };

    updateHistory();

    // Listen for changes
    const interval = setInterval(updateHistory, 100);
    return () => clearInterval(interval);
  }, [processor]);

  const selectEntry = useCallback((index: number) => {
    setSelectedIndex(index);
  }, []);

  const clearHistory = useCallback(() => {
    processor.clearHistory();
    setSelectedIndex(-1);
  }, [processor]);

  return {
    history,
    selectedIndex,
    selectEntry,
    clearHistory,
  };
}

/**
 * Hook for command debugging and monitoring
 */
export function useCommandMonitor(processor: CommandProcessor) {
  const [metrics, setMetrics] = useState({
    totalCommands: 0,
    successfulCommands: 0,
    failedCommands: 0,
    averageExecutionTime: 0,
    lastCommandTime: 0,
  });

  useEffect(() => {
    const updateMetrics = () => {
      const history = processor.getHistory();
      const successful = history.filter(entry => entry.result.success);
      const failed = history.filter(entry => !entry.result.success);
      const executionTimes = history
        .filter(entry => entry.result.executionTime)
        .map(entry => entry.result.executionTime!);

      setMetrics({
        totalCommands: history.length,
        successfulCommands: successful.length,
        failedCommands: failed.length,
        averageExecutionTime: executionTimes.length > 0
          ? executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length
          : 0,
        lastCommandTime: history.length > 0 ? history[history.length - 1].executedAt : 0,
      });
    };

    updateMetrics();
    const interval = setInterval(updateMetrics, 1000);
    return () => clearInterval(interval);
  }, [processor]);

  return metrics;
}
