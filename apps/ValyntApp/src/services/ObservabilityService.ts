export interface HealthMetric {
  component: string;
  status: "healthy" | "degraded" | "failed";
  latency: number;
  errorRate: number;
  lastVMRTCheck: boolean;
}

export class ObservabilityService {
  private static instance: ObservabilityService;

  private constructor() {}

  public static getInstance(): ObservabilityService {
    if (!ObservabilityService.instance) {
      ObservabilityService.instance = new ObservabilityService();
    }
    return ObservabilityService.instance;
  }

  /**
   * Logs critical agentic and financial failures.
   */
  public logAlert(level: "warn" | "critical", message: string, metadata: unknown) {
    console.error(`[ALERT][${level.toUpperCase()}] ${message}`, {
      ...metadata,
      timestamp: new Date().toISOString(),
      traceId: Math.random().toString(36).substring(7),
    });

    // In production, this would push to Sentry/Datadog/PagerDuty
    if (level === "critical") {
      this.triggerCircuitBreaker(metadata.component);
    }
  }

  private triggerCircuitBreaker(component: string) {
    console.warn(`[CIRCUIT BREAKER] Tripped for ${component}. Diverting to fallback/static mode.`);
  }

  /**
   * Monitors for "Silent Failures" in financial reasoning.
   */
  public verifyVMRTIntegrity(log: unknown): boolean {
    const isValid = log.hash && log.validatedValue !== undefined;
    if (!isValid) {
      this.logAlert("critical", "VMRT Integrity Violation Detected", {
        component: "IntegrityAgent",
        logId: log.id,
        reason: "Missing verification hash or validation state",
      });
    }
    return isValid;
  }
}
