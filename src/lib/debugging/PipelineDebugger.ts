/**
 * Advanced Debugging Tools for Pipeline Inspection
 *
 * Provides comprehensive debugging, monitoring, and inspection
 * capabilities for the Canvas Workspace pipeline.
 */

import { logger } from '../lib/logger';

export interface DebugEvent {
  id: string;
  timestamp: number;
  type: 'command' | 'render' | 'network' | 'state' | 'error' | 'performance';
  category: string;
  title: string;
  description: string;
  data: any;
  duration?: number;
  stackTrace?: string;
  userId?: string;
  sessionId?: string;
  traceId?: string;
}

export interface PipelineMetrics {
  totalCommands: number;
  successfulCommands: number;
  failedCommands: number;
  averageCommandTime: number;
  totalRenders: number;
  averageRenderTime: number;
  networkRequests: number;
  failedNetworkRequests: number;
  stateTransitions: number;
  errorCount: number;
}

export interface DebugSession {
  id: string;
  startTime: number;
  endTime?: number;
  events: DebugEvent[];
  metrics: PipelineMetrics;
  isActive: boolean;
}

/**
 * Pipeline Debugger - Main debugging interface
 */
export class PipelineDebugger {
  private static instance: PipelineDebugger;
  private sessions = new Map<string, DebugSession>();
  private activeSessionId: string | null = null;
  private eventListeners = new Map<string, Set<(event: DebugEvent) => void>>();
  private maxEvents = 1000;
  private isEnabled = false;

  static getInstance(): PipelineDebugger {
    if (!PipelineDebugger.instance) {
      PipelineDebugger.instance = new PipelineDebugger();
    }
    return PipelineDebugger.instance;
  }

  /**
   * Enable/disable debugging
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    logger.info(`Pipeline debugging ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Start a new debugging session
   */
  startSession(id?: string): string {
    const sessionId = id || this.generateSessionId();

    const session: DebugSession = {
      id: sessionId,
      startTime: Date.now(),
      events: [],
      metrics: this.createEmptyMetrics(),
      isActive: true,
    };

    this.sessions.set(sessionId, session);
    this.activeSessionId = sessionId;

    this.logEvent({
      id: this.generateEventId(),
      timestamp: Date.now(),
      type: 'state',
      category: 'debugger',
      title: 'Debug Session Started',
      description: `Debug session ${sessionId} started`,
      data: { sessionId },
    });

    logger.info(`Debug session started: ${sessionId}`);
    return sessionId;
  }

  /**
   * End current debugging session
   */
  endSession(sessionId?: string): DebugSession | null {
    const id = sessionId || this.activeSessionId;
    if (!id) return null;

    const session = this.sessions.get(id);
    if (!session) return null;

    session.endTime = Date.now();
    session.isActive = false;

    this.logEvent({
      id: this.generateEventId(),
      timestamp: Date.now(),
      type: 'state',
      category: 'debugger',
      title: 'Debug Session Ended',
      description: `Debug session ${id} ended`,
      data: {
        sessionId: id,
        duration: session.endTime - session.startTime,
        eventCount: session.events.length,
      },
    });

    if (this.activeSessionId === id) {
      this.activeSessionId = null;
    }

    logger.info(`Debug session ended: ${id}`);
    return session;
  }

  /**
   * Log a debug event
   */
  logEvent(event: Omit<DebugEvent, 'id' | 'timestamp'>): void {
    if (!this.isEnabled) return;

    const debugEvent: DebugEvent = {
      id: this.generateEventId(),
      timestamp: Date.now(),
      ...event,
    };

    // Add to active session
    if (this.activeSessionId) {
      const session = this.sessions.get(this.activeSessionId);
      if (session) {
        session.events.push(debugEvent);
        this.updateMetrics(session, debugEvent);

        // Limit events in memory
        if (session.events.length > this.maxEvents) {
          session.events = session.events.slice(-this.maxEvents);
        }
      }
    }

    // Notify listeners
    this.notifyListeners(debugEvent);
  }

  /**
   * Subscribe to debug events
   */
  subscribe(type: string, callback: (event: DebugEvent) => void): () => void {
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, new Set());
    }

    this.eventListeners.get(type)!.add(callback);

    return () => {
      const listeners = this.eventListeners.get(type);
      if (listeners) {
        listeners.delete(callback);
        if (listeners.size === 0) {
          this.eventListeners.delete(type);
        }
      }
    };
  }

  /**
   * Get current session
   */
  getCurrentSession(): DebugSession | null {
    return this.activeSessionId ? this.sessions.get(this.activeSessionId) || null : null;
  }

  /**
   * Get session by ID
   */
  getSession(id: string): DebugSession | null {
    return this.sessions.get(id) || null;
  }

  /**
   * Get all sessions
   */
  getAllSessions(): DebugSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Export session data
   */
  exportSession(sessionId: string): string | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    return JSON.stringify({
      session: {
        id: session.id,
        startTime: session.startTime,
        endTime: session.endTime,
        metrics: session.metrics,
      },
      events: session.events,
    }, null, 2);
  }

  /**
   * Import session data
   */
  importSession(data: string): DebugSession | null {
    try {
      const parsed = JSON.parse(data);

      const session: DebugSession = {
        id: parsed.session.id,
        startTime: parsed.session.startTime,
        endTime: parsed.session.endTime,
        events: parsed.events,
        metrics: parsed.session.metrics,
        isActive: false,
      };

      this.sessions.set(session.id, session);
      return session;
    } catch (error) {
      logger.error('Failed to import debug session:', error);
      return null;
    }
  }

  /**
   * Clear all sessions
   */
  clearSessions(): void {
    this.sessions.clear();
    this.activeSessionId = null;
    logger.info('All debug sessions cleared');
  }

  /**
   * Get performance insights
   */
  getPerformanceInsights(sessionId?: string): {
    slowestCommands: Array<{ name: string; duration: number }>;
    errorPatterns: Array<{ type: string; count: number }>;
    networkIssues: Array<{ url: string; error: string }>;
    stateTransitions: Array<{ from: string; to: string; count: number }>;
  } {
    const session = sessionId ? this.sessions.get(sessionId) : this.getCurrentSession();
    if (!session) {
      return {
        slowestCommands: [],
        errorPatterns: [],
        networkIssues: [],
        stateTransitions: [],
      };
    }

    const insights = {
      slowestCommands: this.analyzeSlowCommands(session),
      errorPatterns: this.analyzeErrorPatterns(session),
      networkIssues: this.analyzeNetworkIssues(session),
      stateTransitions: this.analyzeStateTransitions(session),
    };

    return insights;
  }

  private updateMetrics(session: DebugSession, event: DebugEvent): void {
    switch (event.type) {
      case 'command':
        session.metrics.totalCommands++;
        if (event.data.success) {
          session.metrics.successfulCommands++;
        } else {
          session.metrics.failedCommands++;
        }
        if (event.duration) {
          session.metrics.averageCommandTime =
            (session.metrics.averageCommandTime + event.duration) / 2;
        }
        break;

      case 'render':
        session.metrics.totalRenders++;
        if (event.duration) {
          session.metrics.averageRenderTime =
            (session.metrics.averageRenderTime + event.duration) / 2;
        }
        break;

      case 'network':
        session.metrics.networkRequests++;
        if (!event.data.success) {
          session.metrics.failedNetworkRequests++;
        }
        break;

      case 'state':
        session.metrics.stateTransitions++;
        break;

      case 'error':
        session.metrics.errorCount++;
        break;
    }
  }

  private analyzeSlowCommands(session: DebugSession): Array<{ name: string; duration: number }> {
    const commands = session.events
      .filter(e => e.type === 'command' && e.duration)
      .sort((a, b) => (b.duration || 0) - (a.duration || 0))
      .slice(0, 10);

    return commands.map(cmd => ({
      name: cmd.title,
      duration: cmd.duration || 0,
    }));
  }

  private analyzeErrorPatterns(session: DebugSession): Array<{ type: string; count: number }> {
    const errors = session.events.filter(e => e.type === 'error');
    const patterns = new Map<string, number>();

    errors.forEach(error => {
      const key = error.category || 'unknown';
      patterns.set(key, (patterns.get(key) || 0) + 1);
    });

    return Array.from(patterns.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);
  }

  private analyzeNetworkIssues(session: DebugSession): Array<{ url: string; error: string }> {
    return session.events
      .filter(e => e.type === 'network' && !e.data.success)
      .map(e => ({
        url: e.data.url || 'unknown',
        error: e.data.error || 'unknown error',
      }));
  }

  private analyzeStateTransitions(session: DebugSession): Array<{ from: string; to: string; count: number }> {
    const transitions = new Map<string, number>();

    session.events
      .filter(e => e.type === 'state' && e.data.transition)
      .forEach(e => {
        const { from, to } = e.data.transition;
        const key = `${from} -> ${to}`;
        transitions.set(key, (transitions.get(key) || 0) + 1);
      });

    return Array.from(transitions.entries())
      .map(([transition, count]) => {
        const [from, to] = transition.split(' -> ');
        return { from, to, count };
      })
      .sort((a, b) => b.count - a.count);
  }

  private notifyListeners(event: DebugEvent): void {
    const listeners = this.eventListeners.get(event.type);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          logger.error('Error in debug event listener:', error);
        }
      });
    }

    // Also notify general listeners
    const generalListeners = this.eventListeners.get('*');
    if (generalListeners) {
      generalListeners.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          logger.error('Error in general debug event listener:', error);
        }
      });
    }
  }

  private createEmptyMetrics(): PipelineMetrics {
    return {
      totalCommands: 0,
      successfulCommands: 0,
      failedCommands: 0,
      averageCommandTime: 0,
      totalRenders: 0,
      averageRenderTime: 0,
      networkRequests: 0,
      failedNetworkRequests: 0,
      stateTransitions: 0,
      errorCount: 0,
    };
  }

  private generateSessionId(): string {
    return `debug-session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateEventId(): string {
    return `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * React hook for debugging
 */
import { useState, useEffect, useCallback } from 'react';

export function usePipelineDebugger(enabled: boolean = false) {
  const [debugger] = useState(() => PipelineDebugger.getInstance());
  const [currentSession, setCurrentSession] = useState<DebugSession | null>(null);
  const [insights, setInsights] = useState(debugger.getPerformanceInsights());

  useEffect(() => {
    debugger.setEnabled(enabled);
  }, [debugger, enabled]);

  useEffect(() => {
    const updateSession = () => {
      setCurrentSession(debugger.getCurrentSession());
      setInsights(debugger.getPerformanceInsights());
    };

    const unsubscribe = debugger.subscribe('*', updateSession);
    updateSession();

    return unsubscribe;
  }, [debugger]);

  const startSession = useCallback((id?: string) => {
    const sessionId = debugger.startSession(id);
    setCurrentSession(debugger.getCurrentSession());
    return sessionId;
  }, [debugger]);

  const endSession = useCallback((id?: string) => {
    const session = debugger.endSession(id);
    setCurrentSession(debugger.getCurrentSession());
    return session;
  }, [debugger]);

  const logEvent = useCallback((event: Omit<DebugEvent, 'id' | 'timestamp'>) => {
    debugger.logEvent(event);
  }, [debugger]);

  const exportSession = useCallback((id?: string) => {
    const sessionId = id || currentSession?.id;
    return sessionId ? debugger.exportSession(sessionId) : null;
  }, [debugger, currentSession]);

  return {
    currentSession,
    insights,
    startSession,
    endSession,
    logEvent,
    exportSession,
    getAllSessions: debugger.getAllSessions.bind(debugger),
    clearSessions: debugger.clearSessions.bind(debugger),
  };
}

/**
 * Performance monitoring utilities
 */
export const PerformanceMonitor = {
  /**
   * Time a function execution
   */
  async timeFunction<T>(
    name: string,
    fn: () => Promise<T>,
    debugger?: PipelineDebugger
  ): Promise<{ result: T; duration: number }> {
    const startTime = performance.now();

    try {
      const result = await fn();
      const duration = performance.now() - startTime;

      debugger?.logEvent({
        type: 'performance',
        category: 'function',
        title: `Function: ${name}`,
        description: `Function ${name} completed successfully`,
        data: { functionName: name, success: true },
        duration,
      });

      return { result, duration };
    } catch (error) {
      const duration = performance.now() - startTime;

      debugger?.logEvent({
        type: 'error',
        category: 'function',
        title: `Function Error: ${name}`,
        description: `Function ${name} failed`,
        data: { functionName: name, error: (error as Error).message },
        duration,
        stackTrace: (error as Error).stack,
      });

      throw error;
    }
  },

  /**
   * Monitor React component render
   */
  monitorComponentRender(
    componentName: string,
    debugger?: PipelineDebugger
  ) {
    const startTime = performance.now();

    return () => {
      const duration = performance.now() - startTime;

      debugger?.logEvent({
        type: 'render',
        category: 'component',
        title: `Component Render: ${componentName}`,
        description: `Component ${componentName} rendered`,
        data: { componentName },
        duration,
      });
    };
  },

  /**
   * Monitor network request
   */
  monitorNetworkRequest(
    url: string,
    method: string,
    debugger?: PipelineDebugger
  ) {
    const startTime = performance.now();

    return {
      success: (response: Response) => {
        const duration = performance.now() - startTime;

        debugger?.logEvent({
          type: 'network',
          category: 'request',
          title: `Network Request: ${method} ${url}`,
          description: `Network request to ${url} completed`,
          data: {
            url,
            method,
            status: response.status,
            success: true,
          },
          duration,
        });
      },

      error: (error: Error) => {
        const duration = performance.now() - startTime;

        debugger?.logEvent({
          type: 'error',
          category: 'network',
          title: `Network Error: ${method} ${url}`,
          description: `Network request to ${url} failed`,
          data: {
            url,
            method,
            error: error.message,
            success: false,
          },
          duration,
        });
      },
    };
  },
};
