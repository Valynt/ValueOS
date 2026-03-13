/**
 * @valueos/infra/observability
 *
 * Logging, metrics, tracing infrastructure.
 */

export const observabilityAssets = {
  serviceDependencyMap:
    "packages/infra/observability/serviceDependencyMap.json",
  alerts: "packages/infra/observability/alerts.json",
  releaseHealthDashboard:
    "packages/infra/observability/releaseHealthDashboard.json",
} as const;
