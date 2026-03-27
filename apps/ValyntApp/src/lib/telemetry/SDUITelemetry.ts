import {
  SDUITelemetry as LibSDUITelemetry,
  type SDUITelemetryEvent,
  TelemetryEventType,
  sduiTelemetry,
} from "@valueos/sdui/lib/telemetry/SDUITelemetry";

declare global {
  interface Window {
    analytics?: { track: (event: string, props?: Record<string, unknown>) => void };
  }
}

/**
 * App-level telemetry implementation.
 * Forwards SDUI events to window.analytics when available.
 */
export class SDUITelemetry extends LibSDUITelemetry {
  override recordEvent(event: SDUITelemetryEvent): void {
    super.recordEvent(event);

    if (typeof window === "undefined" || !window.analytics) return;

    // Forward component-not-found events so product/engineering can alert on schema drift.
    if (event.type === TelemetryEventType.COMPONENT_NOT_FOUND) {
      window.analytics.track("sdui_component_not_found", {
        ...(event.metadata ?? {}),
      });
    }
  }
}

/**
 * Patch the library singleton with the app-level implementation.
 * Call once at app boot (e.g. in main.tsx before rendering).
 */
export function bootstrapSDUITelemetry(): void {
  const appTelemetry = new SDUITelemetry();
  sduiTelemetry.recordEvent = appTelemetry.recordEvent.bind(appTelemetry);
}

export default SDUITelemetry;
