/**
 * SDUI Telemetry
 */

export interface SDUITelemetryEvent {
  event_type: string;
  component_id?: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export class SDUITelemetry {
  track(event: SDUITelemetryEvent): void {
    console.log('[SDUI Telemetry]', event);
  }

  recordEvent(event: SDUITelemetryEvent): void {
    this.track(event);
  }
}

export const sduiTelemetry = new SDUITelemetry();
