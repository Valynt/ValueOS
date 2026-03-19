import { logger } from "../logger.js";
/**
 * SDUI Telemetry
 */

export interface SDUITelemetryEvent {
  event_type: string;
  /** Alias for event_type — accepted for backward compatibility. */
  type?: string;
  component_id?: string;
  timestamp?: string;
  metadata?: Record<string, any>;
}

export class SDUITelemetry {
  track(event: SDUITelemetryEvent): void {
    logger.info('[SDUI Telemetry]', event);
  }

  recordEvent(event: SDUITelemetryEvent): void {
    this.track(event);
  }
}

export const sduiTelemetry = new SDUITelemetry();

export enum TelemetryEventType {
  CIRCUIT_BREAKER_TRIPPED = 'circuit_breaker_tripped',
  RETRY_SUCCESS = 'retry_success',
  RETRY_FAILED = 'retry_failed',
  COMPONENT_RENDERED = 'component_rendered',
  INTENT_RESOLVED = 'intent_resolved',
  ERROR = 'error',
}
