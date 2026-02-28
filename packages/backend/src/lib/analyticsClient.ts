/**
 * Analytics Client
 *
 * Client for sending analytics events via structured logger.
 */

import { logger } from "./logger.js";

export interface AnalyticsEvent {
  event_name: string;
  user_id?: string;
  organization_id?: string;
  properties?: Record<string, unknown>;
  timestamp?: string;
}

export class AnalyticsClient {
  private enabled: boolean;

  constructor(enabled = true) {
    this.enabled = enabled;
  }

  track(event: AnalyticsEvent): void {
    if (!this.enabled) return;

    logger.info("Analytics event", {
      ...event,
      timestamp: event.timestamp || new Date().toISOString(),
    });
  }

  identify(userId: string, traits?: Record<string, unknown>): void {
    if (!this.enabled) return;

    logger.info("Analytics identify", { userId, traits });
  }

  page(name: string, properties?: Record<string, unknown>): void {
    if (!this.enabled) return;

    logger.info("Analytics page", { name, properties });
  }
}

export const analyticsClient = new AnalyticsClient();
