import { logger } from './logger';
import { getConsoleLogs } from '../utils/consoleRecorder';

declare global {
  interface Window {
    analytics?: {
      track: (event: string, properties?: Record<string, any>) => void;
      identify: (userId: string, traits?: Record<string, any>) => void;
    };
    Intercom?: any;
  }
}

interface AnalyticsOptions {
  betaCohort?: boolean;
}

class AnalyticsClient {
  private initialized = false;
  private userId?: string;
  private traits: Record<string, any> = {};
  private betaCohort = false;
  private queue: Array<{
    type: 'track' | 'identify';
    payload: any;
  }> = [];

  initialize(options?: AnalyticsOptions) {
    if (this.initialized) return;

    this.betaCohort = options?.betaCohort ?? false;
    this.loadSegment();
    this.loadIntercom();
    this.initialized = true;
  }

  identify(userId: string, traits?: Record<string, any>) {
    this.userId = userId;
    this.traits = { ...traits, beta_cohort: this.betaCohort, environment: import.meta.env.MODE };

    if (!this.dispatchIdentify()) {
      this.queue.push({ type: 'identify', payload: { userId, traits: this.traits } });
    }

    this.updateIntercomUser();
  }

  track(event: string, properties?: Record<string, any>) {
    const payload = {
      ...properties,
      userId: this.userId,
      beta_cohort: this.betaCohort,
      environment: import.meta.env.MODE,
      timestamp: new Date().toISOString(),
    };

    const dispatched = this.dispatchTrack(event, payload);

    if (!dispatched) {
      this.queue.push({ type: 'track', payload: { event, properties: payload } });
    }

    this.flushQueue();
    this.trackIntercomEvent(event, payload);
  }

  trackWorkflowEvent(event: string, workflow: string, properties?: Record<string, any>) {
    this.track(event, { workflow, ...properties });
  }

  trackTimeToValue(event: string, createdAt?: string | null, extra?: Record<string, any>) {
    if (!createdAt) return;

    const created = new Date(createdAt).getTime();
    const timeToValueMs = Date.now() - created;

    this.track(event, {
      time_to_first_value_ms: timeToValueMs,
      time_to_first_value_minutes: Math.round(timeToValueMs / 60000),
      ...extra,
    });
  }

  trackFeedback(submission: {
    summary: string;
    severity: string;
    includeConsoleLogs: boolean;
    screenshotIncluded: boolean;
  }) {
    this.track('feedback_submitted', {
      ...submission,
      browser: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      console_logs: submission.includeConsoleLogs ? getConsoleLogs().slice(-50) : undefined,
      tags: ['beta_cohort', 'in_app_feedback'],
    });
  }

  private dispatchIdentify() {
    if (typeof window === 'undefined') return false;
    if (window.analytics?.identify) {
      window.analytics.identify(this.userId as string, this.traits);
      logger.info('Analytics identify', { userId: this.userId });
      return true;
    }
    return false;
  }

  private dispatchTrack(event: string, properties: Record<string, any>) {
    if (typeof window === 'undefined') return false;
    if (window.analytics?.track) {
      window.analytics.track(event, properties);
      logger.debug('Analytics track', { event, properties });
      return true;
    }

    logger.debug('Buffered analytics event', { event, properties });
    return false;
  }

  private flushQueue() {
    if (!window.analytics?.track) return;

    const pending = [...this.queue];
    this.queue = [];

    pending.forEach((item) => {
      if (item.type === 'track') {
        window.analytics?.track(item.payload.event, item.payload.properties);
      }
      if (item.type === 'identify') {
        window.analytics?.identify(item.payload.userId, item.payload.traits);
      }
    });
  }

  private loadSegment() {
    if (typeof document === 'undefined') return;
    if (window.analytics) return;

    const writeKey = import.meta.env.VITE_SEGMENT_WRITE_KEY;
    if (!writeKey) return;

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://cdn.segment.com/analytics.js/v1/${writeKey}/analytics.min.js`;
    document.head.appendChild(script);
  }

  private loadIntercom() {
    const appId = import.meta.env.VITE_INTERCOM_APP_ID;
    if (!appId || typeof window === 'undefined') return;

    if (!window.Intercom) {
      (function () {
        const w = window as any;
        const ic = w.Intercom;
        if (typeof ic === 'function') {
          ic('reattach_activator');
          ic('update', {});
        } else {
          const d = document;
          const i: any = function () {
            i.c(arguments);
          };
          i.q = [];
          i.c = function (args: any) {
            i.q.push(args);
          };
          w.Intercom = i;
          const l = function () {
            const s = d.createElement('script');
            s.type = 'text/javascript';
            s.async = true;
            s.src = 'https://widget.intercom.io/widget/' + appId;
            const x = d.getElementsByTagName('script')[0];
            x.parentNode?.insertBefore(s, x);
          };
          if (d.readyState === 'complete') {
            l();
          } else {
            w.addEventListener('load', l, false);
          }
        }
      })();
    }

    const bootPayload = {
      app_id: appId,
      hide_default_launcher: true,
      user_id: this.userId,
      ...this.traits,
      beta_cohort: this.betaCohort,
      custom_attributes: {
        beta_cohort: true,
        priority: 'high',
      },
    };

    window.Intercom?.('boot', bootPayload);
  }

  private updateIntercomUser() {
    if (!window.Intercom || !this.userId) return;

    window.Intercom('update', {
      user_id: this.userId,
      ...this.traits,
      custom_attributes: {
        ...this.traits,
        beta_cohort: true,
        priority: 'high',
      },
    });
  }

  private trackIntercomEvent(event: string, payload: Record<string, any>) {
    if (!window.Intercom) return;
    window.Intercom('trackEvent', event, payload);
  }
}

export const analyticsClient = new AnalyticsClient();
