export interface SDUITelemetryEvent {
  type: string;
  component_id?: string;
  timestamp?: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export enum TelemetryEventType {
  COMPONENT_ERROR = "component_error",
  COMPONENT_MOUNT = "component_mount",
  COMPONENT_RESOLVE = "component_resolve",
  HYDRATION_CACHE_HIT = "hydration_cache_hit",
  CIRCUIT_BREAKER_EVENT = "circuit_breaker_event",
  COMPONENT_NOT_FOUND = "component_not_found",
}

export class SDUITelemetry {
  track(event: SDUITelemetryEvent): void {
    // no-op in library; consumers can override
  }

  recordEvent(event: SDUITelemetryEvent): void {
    this.track(event);
  }
}

export const sduiTelemetry = new SDUITelemetry();
