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
  console.info("[Observability] release marker", { releaseMarker });

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
  console.debug("[Observability] metric", { name, value, tags });
}

export function startSpan(name: string, tags?: Record<string, string>): SpanHandle {
  const startedAt = performance.now();
  console.debug("[Observability] span.start", { name, tags });

  return {
    end: () => {
      const durationMs = performance.now() - startedAt;
      console.debug("[Observability] span.end", { name, tags, durationMs });
    },
  };
}
