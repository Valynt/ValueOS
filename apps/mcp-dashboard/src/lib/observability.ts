export interface FrontendObservabilityConfig {
  appName: string;
  release: string;
  environment: string;
}

export function initFrontendObservability(
  config: FrontendObservabilityConfig
): void {
  const releaseMarker = `release:${config.appName}:${config.release}:${config.environment}`;
  window.dispatchEvent(
    new CustomEvent("valueos:release-marker", { detail: releaseMarker })
  );
  console.info("[Observability] release marker", { releaseMarker });

  window.addEventListener("error", event => {
    console.error("[Observability] uncaught exception", {
      app: config.appName,
      release: config.release,
      message: event.message,
    });
  });

  window.addEventListener("unhandledrejection", event => {
    console.error("[Observability] unhandled rejection", {
      app: config.appName,
      release: config.release,
      reason: String(event.reason),
    });
  });
}
