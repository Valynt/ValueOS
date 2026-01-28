export interface TelemetryMetric {
  metricId: string;
  value: number;
  timestamp: string;
}

export class TelemetryService {
  private static instance: TelemetryService;
  private subscribers: ((metric: TelemetryMetric) => void)[] = [];

  private constructor() {}

  public static getInstance(): TelemetryService {
    if (!TelemetryService.instance) {
      TelemetryService.instance = new TelemetryService();
    }
    return TelemetryService.instance;
  }

  /**
   * Simulates receiving a telemetry update from an external system.
   */
  public simulateUpdate(metricId: string, value: number) {
    const metric: TelemetryMetric = {
      metricId,
      value,
      timestamp: new Date().toISOString(),
    };
    this.subscribers.forEach((s) => s(metric));
    console.log(`[Telemetry] Received update for ${metricId}: ${value}`);
  }

  public subscribe(callback: (metric: TelemetryMetric) => void) {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter((s) => s !== callback);
    };
  }
}
