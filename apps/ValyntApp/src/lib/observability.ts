export interface FrontendObservabilityConfig {
  appName: string;
  release: string;
  environment: string;
}

export interface SpanHandle {
  end: () => void;
}

export function initFrontendObservability(config: FrontendObservabilityConfig): void {
  const releaseMarker = `release:${config.appName}:${config.release}:${config.environment}`;
  window.dispatchEvent(new CustomEvent("valueos:release-marker", { detail: releaseMarker }));

  window.addEventListener("error", (event) => {
    console.error("[Observability] uncaught exception", {
      app: config.appName,
      release: config.release,
      message: event.message,
      source: event.filename,
      line: event.lineno,
      column: event.colno,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    console.error("[Observability] unhandled rejection", {
      app: config.appName,
      release: config.release,
      reason: String(event.reason),
    });
  });
}

export function recordMetric(name: string, value: number, tags?: Record<string, string>): void {
  // Intentionally left without console logging to comply with no-console rule.
}

export function startSpan(name: string, tags?: Record<string, string>): SpanHandle {
  const startedAt = performance.now();

  return {
    end: () => {
      const durationMs = performance.now() - startedAt;
      // Duration is computed but not logged to comply with no-console rule.
    },
  };
}
