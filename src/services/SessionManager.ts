/**
 * Session Management Service
 * Implements secure session timeouts and activity tracking
 *
 * Features:
 * - 30-minute idle timeout
 * - 1-hour absolute timeout
 * - Activity tracking
 * - Auto-logout warnings
 * - Session refresh
 */

import { logger } from '../lib/logger';
import { BaseService } from './BaseService';
import { authService } from './AuthService';

export interface SessionConfig {
  idleTimeoutMs: number;
  absoluteTimeoutMs: number;
  warningBeforeMs: number;
}

export interface SessionState {
  lastActivity: number;
  sessionStart: number;
  isActive: boolean;
  warningShown: boolean;
}

export type SessionEventType = 'idle_warning' | 'idle_timeout' | 'absolute_timeout' | 'activity' | 'logout';

export type SessionEventListener = (type: SessionEventType, data?: any) => void;

export class SessionManager extends BaseService {
  private static readonly DEFAULT_CONFIG: SessionConfig = {
    idleTimeoutMs: 30 * 60 * 1000, // 30 minutes
    absoluteTimeoutMs: 60 * 60 * 1000, // 1 hour
    warningBeforeMs: 5 * 60 * 1000, // 5 minutes before timeout
  };

  private static readonly STORAGE_KEY = 'session_state';
  private static readonly ACTIVITY_EVENTS = [
    'mousedown',
    'mousemove',
    'keydown',
    'scroll',
    'touchstart',
    'click',
  ];

  private config: SessionConfig;
  private checkInterval: number | null = null;
  private activityListenersBound = false;
  private eventListeners: SessionEventListener[] = [];
  private throttledActivityHandler: (() => void) | null = null;

  constructor(config?: Partial<SessionConfig>) {
    super('SessionManager');
    this.config = {
      ...SessionManager.DEFAULT_CONFIG,
      ...config,
    };
  }

  /**
   * Initialize session management
   */
  async initialize(): Promise<void> {
    if (typeof window === 'undefined') return;

    const isAuthenticated = await authService.isAuthenticated();
    if (!isAuthenticated) {
      this.clearSessionState();
      return;
    }

    let state = this.getSessionState();
    if (!state || !state.isActive) {
      state = this.createNewSession();
    }

    this.bindActivityListeners();
    this.startMonitoring();

    this.log('info', 'Session management initialized', {
      idleTimeoutMinutes: this.config.idleTimeoutMs / 60000,
      absoluteTimeoutMinutes: this.config.absoluteTimeoutMs / 60000,
    });
  }

  /**
   * Terminate session management
   */
  terminate(): void {
    this.unbindActivityListeners();
    this.stopMonitoring();
    this.log('info', 'Session management terminated');
  }

  /**
   * Create new session
   */
  private createNewSession(): SessionState {
    const now = Date.now();
    const state: SessionState = {
      lastActivity: now,
      sessionStart: now,
      isActive: true,
      warningShown: false,
    };

    this.saveSessionState(state);
    this.emitEvent('activity', state);

    return state;
  }

  /**
   * Get session state from storage
   */
  private getSessionState(): SessionState | null {
    if (typeof window === 'undefined') return null;

    try {
      const stored = sessionStorage.getItem(SessionManager.STORAGE_KEY);
      if (!stored) return null;

      return JSON.parse(stored) as SessionState;
    } catch (error) {
      this.log('error', 'Failed to parse session state', { error });
      return null;
    }
  }

  /**
   * Save session state to storage
   */
  private saveSessionState(state: SessionState): void {
    if (typeof window === 'undefined') return;

    try {
      sessionStorage.setItem(
        SessionManager.STORAGE_KEY,
        JSON.stringify(state)
      );
    } catch (error) {
      this.log('error', 'Failed to save session state', { error });
    }
  }

  /**
   * Clear session state
   */
  clearSessionState(): void {
    if (typeof window === 'undefined') return;

    try {
      sessionStorage.removeItem(SessionManager.STORAGE_KEY);
    } catch (error) {
      this.log('error', 'Failed to clear session state', { error });
    }
  }

  /**
   * Record user activity
   */
  private recordActivity(): void {
    const state = this.getSessionState();
    if (!state || !state.isActive) return;

    const now = Date.now();
    state.lastActivity = now;
    state.warningShown = false;

    this.saveSessionState(state);
    this.emitEvent('activity', { lastActivity: now });
  }

  /**
   * Bind activity listeners
   */
  private bindActivityListeners(): void {
    if (typeof window === 'undefined' || this.activityListenersBound) return;

    this.throttledActivityHandler = this.throttle(() => this.recordActivity(), 10000);

    SessionManager.ACTIVITY_EVENTS.forEach(event => {
      window.addEventListener(event, this.throttledActivityHandler!, { passive: true });
    });

    this.activityListenersBound = true;
  }

  /**
   * Unbind activity listeners
   */
  private unbindActivityListeners(): void {
    if (typeof window === 'undefined' || !this.activityListenersBound) return;

    if (this.throttledActivityHandler) {
      SessionManager.ACTIVITY_EVENTS.forEach(event => {
        window.removeEventListener(event, this.throttledActivityHandler!);
      });
      this.throttledActivityHandler = null;
    }

    this.activityListenersBound = false;
  }

  /**
   * Start monitoring session
   */
  private startMonitoring(): void {
    if (this.checkInterval !== null) return;

    this.checkInterval = window.setInterval(() => {
      this.checkSession();
    }, 60000); // Check every minute
  }

  /**
   * Stop monitoring session
   */
  private stopMonitoring(): void {
    if (this.checkInterval !== null) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Check session timeouts
   */
  private async checkSession(): Promise<void> {
    const state = this.getSessionState();
    if (!state || !state.isActive) return;

    const now = Date.now();
    const idleTime = now - state.lastActivity;
    const sessionAge = now - state.sessionStart;

    if (sessionAge >= this.config.absoluteTimeoutMs) {
      this.log('warn', 'Absolute session timeout reached', {
        sessionAgeMinutes: sessionAge / 60000,
      });
      await this.handleTimeout('absolute_timeout');
      return;
    }

    if (idleTime >= this.config.idleTimeoutMs) {
      this.log('warn', 'Idle timeout reached', {
        idleMinutes: idleTime / 60000,
      });
      await this.handleTimeout('idle_timeout');
      return;
    }

    const timeUntilIdleTimeout = this.config.idleTimeoutMs - idleTime;
    if (
      !state.warningShown &&
      timeUntilIdleTimeout <= this.config.warningBeforeMs
    ) {
      state.warningShown = true;
      this.saveSessionState(state);

      this.log('info', 'Showing idle warning', {
        minutesRemaining: Math.ceil(timeUntilIdleTimeout / 60000),
      });

      this.emitEvent('idle_warning', {
        timeoutIn: timeUntilIdleTimeout,
        minutesRemaining: Math.ceil(timeUntilIdleTimeout / 60000),
      });
    }
  }

  /**
   * Handle session timeout
   */
  private async handleTimeout(type: 'idle_timeout' | 'absolute_timeout'): Promise<void> {
    const state = this.getSessionState();
    if (state) {
      state.isActive = false;
      this.saveSessionState(state);
    }

    this.emitEvent(type);

    try {
      await authService.logout();
      this.clearSessionState();
      this.emitEvent('logout', { reason: type });
    } catch (error) {
      this.log('error', 'Failed to logout on timeout', { error });
    }
  }

  /**
   * Extend session (refresh activity)
   */
  extendSession(): void {
    this.recordActivity();
    this.log('info', 'Session extended');
  }

  /**
   * Get session info
   */
  getSessionInfo(): {
    idleMinutes: number;
    sessionAgeMinutes: number;
    timeUntilIdleTimeout: number;
    timeUntilAbsoluteTimeout: number;
  } | null {
    const state = this.getSessionState();
    if (!state) return null;

    const now = Date.now();
    const idleTime = now - state.lastActivity;
    const sessionAge = now - state.sessionStart;

    return {
      idleMinutes: idleTime / 60000,
      sessionAgeMinutes: sessionAge / 60000,
      timeUntilIdleTimeout: Math.max(0, this.config.idleTimeoutMs - idleTime),
      timeUntilAbsoluteTimeout: Math.max(
        0,
        this.config.absoluteTimeoutMs - sessionAge
      ),
    };
  }

  /**
   * Add event listener
   */
  addEventListener(listener: SessionEventListener): void {
    this.eventListeners.push(listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(listener: SessionEventListener): void {
    const index = this.eventListeners.indexOf(listener);
    if (index > -1) {
      this.eventListeners.splice(index, 1);
    }
  }

  /**
   * Emit event to listeners
   */
  private emitEvent(type: SessionEventType, data?: any): void {
    this.eventListeners.forEach(listener => {
      try {
        listener(type, data);
      } catch (error) {
        this.log('error', 'Event listener error', { type, error });
      }
    });
  }

  /**
   * Throttle function calls
   */
  private throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): (...args: Parameters<T>) => void {
    let inThrottle: boolean;
    return function(this: any, ...args: Parameters<T>) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  }
}

export const sessionManager = new SessionManager();
