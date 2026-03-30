/**
 * Telemetry System
 * 
 * PostHog analytics integration stub.
 * Install posthog-js to enable full functionality:
 *   pnpm add posthog-js
 */

// Stub types for when PostHog is not available
type PostHogStub = {
  init: (key: string, config: unknown) => void;
  capture: (event: string, props?: unknown) => void;
  identify: (id: string) => void;
  reset: () => void;
  opt_in_capturing: () => void;
  opt_out_capturing: () => void;
  startSessionRecording: () => void;
  stopSessionRecording: () => void;
};

// Lazy-loaded PostHog instance
let posthogInstance: PostHogStub | null = null;
let loadAttempted = false;

const loadPostHog = async (): Promise<PostHogStub | null> => {
  if (posthogInstance) return posthogInstance;
  if (loadAttempted) return null;
  
  loadAttempted = true;
  
  try {
    const posthogModule = await import('posthog-js');
    posthogInstance = posthogModule.default as PostHogStub;
    return posthogInstance;
  } catch {
    // PostHog not installed - telemetry will be disabled
    return null;
  }
};

export interface TelemetryConfig {
  enabled: boolean;
  apiKey: string;
  host: string;
  debug?: boolean;
  disableSessionRecording?: boolean;
  superProperties?: Record<string, unknown>;
}

export interface TelemetryEvent {
  event: string;
  properties?: Record<string, unknown>;
  timestamp?: Date;
  distinctId?: string;
}

export interface UserProperties {
  email?: string;
  organization?: string;
  role?: string;
  plan?: string;
  [key: string]: unknown;
}

class TelemetryService {
  private initialized = false;
  private enabled = false;

  async init(config: TelemetryConfig): Promise<void> {
    if (this.initialized) return;

    if (!config.enabled || !config.apiKey) {
      this.enabled = false;
      this.initialized = true;
      return;
    }

    const posthog = await loadPostHog();
    
    if (!posthog) {
      if (config.debug) {
        console.log('[Telemetry] PostHog not available - telemetry disabled');
      }
      this.enabled = false;
      this.initialized = true;
      return;
    }

    try {
      posthog.init(config.apiKey, {
        api_host: config.host || 'https://app.posthog.com',
        capture_pageview: false,
        disable_session_recording: config.disableSessionRecording,
        persistence: 'localStorage+cookie',
        autocapture: false,
      });

      this.enabled = true;
      this.initialized = true;

      if (config.debug) {
        console.log('[Telemetry] Initialized');
      }
    } catch (error) {
      console.error('[Telemetry] Failed to initialize:', error);
      this.enabled = false;
      this.initialized = true;
    }
  }

  async identify(userId: string, properties?: UserProperties): Promise<void> {
    if (!this.enabled) return;
    const posthog = await loadPostHog();
    if (!posthog) return;
    
    try {
      posthog.identify(userId);
    } catch (error) {
      console.error('[Telemetry] Failed to identify:', error);
    }
  }

  async capture(event: TelemetryEvent): Promise<void> {
    if (!this.enabled) return;
    const posthog = await loadPostHog();
    if (!posthog) return;
    
    try {
      posthog.capture(event.event, event.properties);
    } catch (error) {
      console.error('[Telemetry] Failed to capture:', error);
    }
  }

  async pageView(path: string, title?: string, properties?: Record<string, unknown>): Promise<void> {
    await this.capture({
      event: '$pageview',
      properties: {
        $current_url: path,
        $page_title: title || document.title,
        ...properties,
      },
    });
  }

  async featureUsed(featureName: string, properties?: Record<string, unknown>): Promise<void> {
    await this.capture({
      event: 'feature_used',
      properties: { feature: featureName, ...properties },
    });
  }

  async error(error: Error, context?: Record<string, unknown>): Promise<void> {
    await this.capture({
      event: 'error',
      properties: {
        error_message: error.message,
        error_name: error.name,
        ...context,
      },
    });
  }

  async reset(): Promise<void> {
    if (!this.enabled) return;
    const posthog = await loadPostHog();
    if (!posthog) return;
    posthog.reset();
  }

  isEnabled(): boolean {
    return this.enabled && this.initialized;
  }
}

export const telemetry = new TelemetryService();

export function useTelemetry() {
  return {
    capture: (event: string, properties?: Record<string, unknown>) =>
      telemetry.capture({ event, properties }),
    identify: (userId: string, properties?: UserProperties) =>
      telemetry.identify(userId, properties),
    pageView: (path: string, title?: string, properties?: Record<string, unknown>) =>
      telemetry.pageView(path, title, properties),
    featureUsed: (feature: string, properties?: Record<string, unknown>) =>
      telemetry.featureUsed(feature, properties),
    error: (err: Error, context?: Record<string, unknown>) =>
      telemetry.error(err, context),
    isEnabled: () => telemetry.isEnabled(),
  };
}
