/**
 * Customer Portal Analytics Tracking
 * 
 * Tracks user interactions, page views, and events in the customer portal.
 * Integrates with analytics providers (Google Analytics, Mixpanel, etc.)
 */

import { logger } from '../logger';

// Analytics event types
export enum PortalEventType {
  PAGE_VIEW = 'portal_page_view',
  SESSION_START = 'portal_session_start',
  SESSION_END = 'portal_session_end',
  EXPORT_PDF = 'portal_export_pdf',
  EXPORT_EXCEL = 'portal_export_excel',
  SHARE_EMAIL = 'portal_share_email',
  BENCHMARK_VIEW = 'portal_benchmark_view',
  METRIC_VIEW = 'portal_metric_view',
  ERROR = 'portal_error',
  TOKEN_VALIDATION = 'portal_token_validation',
  TOKEN_EXPIRED = 'portal_token_expired',
  TOKEN_INVALID = 'portal_token_invalid',
}

// Event properties interface
export interface PortalEventProperties {
  valueCaseId?: string;
  companyName?: string;
  token?: string;
  page?: string;
  duration?: number;
  errorMessage?: string;
  errorCode?: string;
  exportFormat?: 'pdf' | 'excel';
  recipientCount?: number;
  kpiName?: string;
  metricName?: string;
  timestamp?: string;
  sessionId?: string;
  userAgent?: string;
  [key: string]: any;
}

// Session tracking
interface SessionData {
  sessionId: string;
  startTime: number;
  lastActivityTime: number;
  pageViews: number;
  events: Array<{
    type: PortalEventType;
    timestamp: number;
    properties: PortalEventProperties;
  }>;
}

class CustomerPortalAnalytics {
  private currentSession: SessionData | null = null;
  private sessionTimeout = 30 * 60 * 1000; // 30 minutes
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private pageStartTime: number | null = null;
  private analyticsEnabled = true;

  constructor() {
    this.initializeSession();
    this.setupBeforeUnload();
    this.startHeartbeat();
  }

  /**
   * Initialize a new session
   */
  private initializeSession(): void {
    this.currentSession = {
      sessionId: this.generateSessionId(),
      startTime: Date.now(),
      lastActivityTime: Date.now(),
      pageViews: 0,
      events: [],
    };

    this.track(PortalEventType.SESSION_START, {
      sessionId: this.currentSession.sessionId,
      userAgent: navigator.userAgent,
    });
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Setup beforeunload handler to track session end
   */
  private setupBeforeUnload(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.endSession();
      });
    }
  }

  /**
   * Start heartbeat to track session activity
   */
  private startHeartbeat(): void {
    if (typeof window !== 'undefined') {
      this.heartbeatInterval = setInterval(() => {
        this.checkSessionTimeout();
      }, 60000); // Check every minute
    }
  }

  /**
   * Check if session has timed out
   */
  private checkSessionTimeout(): void {
    if (!this.currentSession) return;

    const now = Date.now();
    const timeSinceLastActivity = now - this.currentSession.lastActivityTime;

    if (timeSinceLastActivity > this.sessionTimeout) {
      this.endSession();
      this.initializeSession();
    }
  }

  /**
   * Update last activity time
   */
  private updateActivity(): void {
    if (this.currentSession) {
      this.currentSession.lastActivityTime = Date.now();
    }
  }

  /**
   * End current session
   */
  private endSession(): void {
    if (!this.currentSession) return;

    const duration = Date.now() - this.currentSession.startTime;

    this.track(PortalEventType.SESSION_END, {
      sessionId: this.currentSession.sessionId,
      duration,
      pageViews: this.currentSession.pageViews,
      eventCount: this.currentSession.events.length,
    });

    // Send session data to backend
    this.flushSession();
  }

  /**
   * Flush session data to backend
   */
  private async flushSession(): Promise<void> {
    if (!this.currentSession || !this.analyticsEnabled) return;

    try {
      await fetch('/api/analytics/portal/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.currentSession),
        keepalive: true, // Ensure request completes even if page is closing
      });
    } catch (error) {
      logger.error('Failed to flush analytics session', error as Error);
    }
  }

  /**
   * Track an event
   */
  public track(
    eventType: PortalEventType,
    properties: PortalEventProperties = {}
  ): void {
    if (!this.analyticsEnabled) return;

    this.updateActivity();

    const event = {
      type: eventType,
      timestamp: Date.now(),
      properties: {
        ...properties,
        sessionId: this.currentSession?.sessionId,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
      },
    };

    // Add to session events
    if (this.currentSession) {
      this.currentSession.events.push(event);
    }

    // Send to backend
    this.sendEvent(event);

    // Log for debugging
    logger.debug('Analytics event tracked', { eventType, properties });
  }

  /**
   * Send event to backend
   */
  private async sendEvent(event: any): Promise<void> {
    try {
      await fetch('/api/analytics/portal/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
      });
    } catch (error) {
      logger.error('Failed to send analytics event', error as Error);
    }
  }

  /**
   * Track page view
   */
  public trackPageView(page: string, properties: PortalEventProperties = {}): void {
    // End previous page timing
    if (this.pageStartTime) {
      const duration = Date.now() - this.pageStartTime;
      this.track(PortalEventType.PAGE_VIEW, {
        ...properties,
        page,
        duration,
      });
    }

    // Start new page timing
    this.pageStartTime = Date.now();

    if (this.currentSession) {
      this.currentSession.pageViews++;
    }

    this.track(PortalEventType.PAGE_VIEW, {
      ...properties,
      page,
    });
  }

  /**
   * Track export action
   */
  public trackExport(
    format: 'pdf' | 'excel',
    properties: PortalEventProperties = {}
  ): void {
    const eventType =
      format === 'pdf' ? PortalEventType.EXPORT_PDF : PortalEventType.EXPORT_EXCEL;

    this.track(eventType, {
      ...properties,
      exportFormat: format,
    });
  }

  /**
   * Track email share
   */
  public trackEmailShare(
    recipientCount: number,
    properties: PortalEventProperties = {}
  ): void {
    this.track(PortalEventType.SHARE_EMAIL, {
      ...properties,
      recipientCount,
    });
  }

  /**
   * Track benchmark view
   */
  public trackBenchmarkView(
    kpiName: string,
    properties: PortalEventProperties = {}
  ): void {
    this.track(PortalEventType.BENCHMARK_VIEW, {
      ...properties,
      kpiName,
    });
  }

  /**
   * Track metric view
   */
  public trackMetricView(
    metricName: string,
    properties: PortalEventProperties = {}
  ): void {
    this.track(PortalEventType.METRIC_VIEW, {
      ...properties,
      metricName,
    });
  }

  /**
   * Track error
   */
  public trackError(
    errorMessage: string,
    errorCode?: string,
    properties: PortalEventProperties = {}
  ): void {
    this.track(PortalEventType.ERROR, {
      ...properties,
      errorMessage,
      errorCode,
    });
  }

  /**
   * Track token validation
   */
  public trackTokenValidation(
    success: boolean,
    properties: PortalEventProperties = {}
  ): void {
    const eventType = success
      ? PortalEventType.TOKEN_VALIDATION
      : PortalEventType.TOKEN_INVALID;

    this.track(eventType, properties);
  }

  /**
   * Track token expiration
   */
  public trackTokenExpired(properties: PortalEventProperties = {}): void {
    this.track(PortalEventType.TOKEN_EXPIRED, properties);
  }

  /**
   * Enable analytics tracking
   */
  public enable(): void {
    this.analyticsEnabled = true;
  }

  /**
   * Disable analytics tracking
   */
  public disable(): void {
    this.analyticsEnabled = false;
  }

  /**
   * Get current session ID
   */
  public getSessionId(): string | null {
    return this.currentSession?.sessionId || null;
  }

  /**
   * Get session duration
   */
  public getSessionDuration(): number {
    if (!this.currentSession) return 0;
    return Date.now() - this.currentSession.startTime;
  }

  /**
   * Cleanup
   */
  public destroy(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    this.endSession();
  }
}

// Singleton instance
let analyticsInstance: CustomerPortalAnalytics | null = null;

/**
 * Get analytics instance
 */
export function getPortalAnalytics(): CustomerPortalAnalytics {
  if (!analyticsInstance) {
    analyticsInstance = new CustomerPortalAnalytics();
  }
  return analyticsInstance;
}

/**
 * Track page view
 */
export function trackPageView(page: string, properties?: PortalEventProperties): void {
  getPortalAnalytics().trackPageView(page, properties);
}

/**
 * Track export
 */
export function trackExport(
  format: 'pdf' | 'excel',
  properties?: PortalEventProperties
): void {
  getPortalAnalytics().trackExport(format, properties);
}

/**
 * Track email share
 */
export function trackEmailShare(
  recipientCount: number,
  properties?: PortalEventProperties
): void {
  getPortalAnalytics().trackEmailShare(recipientCount, properties);
}

/**
 * Track benchmark view
 */
export function trackBenchmarkView(
  kpiName: string,
  properties?: PortalEventProperties
): void {
  getPortalAnalytics().trackBenchmarkView(kpiName, properties);
}

/**
 * Track metric view
 */
export function trackMetricView(
  metricName: string,
  properties?: PortalEventProperties
): void {
  getPortalAnalytics().trackMetricView(metricName, properties);
}

/**
 * Track error
 */
export function trackError(
  errorMessage: string,
  errorCode?: string,
  properties?: PortalEventProperties
): void {
  getPortalAnalytics().trackError(errorMessage, errorCode, properties);
}

/**
 * Track token validation
 */
export function trackTokenValidation(
  success: boolean,
  properties?: PortalEventProperties
): void {
  getPortalAnalytics().trackTokenValidation(success, properties);
}

/**
 * Track token expiration
 */
export function trackTokenExpired(properties?: PortalEventProperties): void {
  getPortalAnalytics().trackTokenExpired(properties);
}

// Export singleton instance getter
export default getPortalAnalytics;
