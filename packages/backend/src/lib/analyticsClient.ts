/* eslint-disable no-console */
/**
 * Analytics Client
 * 
 * Client for sending analytics events
 */

export interface AnalyticsEvent {
  event_name: string;
  user_id?: string;
  organization_id?: string;
  properties?: Record<string, any>;
  timestamp?: string;
}

export class AnalyticsClient {
  private enabled: boolean;

  constructor(enabled = true) {
    this.enabled = enabled;
  }

  track(event: AnalyticsEvent): void {
    if (!this.enabled) return;
    
    console.log('Analytics event', {
      ...event,
      timestamp: event.timestamp || new Date().toISOString(),
    });
  }

  identify(userId: string, traits?: Record<string, any>): void {
    if (!this.enabled) return;
    
    console.log('Analytics identify', { userId, traits });
  }

  page(name: string, properties?: Record<string, any>): void {
    if (!this.enabled) return;
    
    console.log('Analytics page', { name, properties });
  }
}

export const analyticsClient = new AnalyticsClient();
