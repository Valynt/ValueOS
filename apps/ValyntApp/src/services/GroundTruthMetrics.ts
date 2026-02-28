/**
 * Ground Truth Metrics Exporter
 *
 * Exports metrics for Prometheus/Grafana monitoring:
 * - Coverage metrics (KPIs, traces, personas)
 * - Quality metrics (validation pass rate)
 * - Usage metrics (query counts, cache hits)
 */

import { logger } from "../lib/logger";
import { ALL_ESO_KPIS, EXTENDED_PERSONA_MAPS } from "../types/eso-data";
import { ALL_VMRT_SEEDS } from "../types/vos-pt1-seed";

// ============================================================================
// Types
// ============================================================================

interface MetricValue {
  name: string;
  help: string;
  type: "gauge" | "counter";
  value: number;
  labels?: Record<string, string>;
}

interface CoverageMetrics {
  total_kpis: number;
  total_vmrt_traces: number;
  total_personas: number;
  total_industries: number;
  kpis_by_industry: Record<string, number>;
  traces_by_outcome: Record<string, number>;
}

// ============================================================================
// Metrics Collection
// ============================================================================

export function collectCoverageMetrics(): CoverageMetrics {
  const kpisByIndustry: Record<string, number> = {};
  const tracesByOutcome: Record<string, number> = {};
  const industries = new Set<string>();

  for (const kpi of ALL_ESO_KPIS) {
    industries.add(kpi.domain);
    kpisByIndustry[kpi.domain] = (kpisByIndustry[kpi.domain] || 0) + 1;
  }

  for (const trace of ALL_VMRT_SEEDS) {
    const outcome = trace.valueModel?.outcomeCategory || "unknown";
    tracesByOutcome[outcome] = (tracesByOutcome[outcome] || 0) + 1;
  }

  return {
    total_kpis: ALL_ESO_KPIS.length,
    total_vmrt_traces: ALL_VMRT_SEEDS.length,
    total_personas: EXTENDED_PERSONA_MAPS.length,
    total_industries: industries.size,
    kpis_by_industry: kpisByIndustry,
    traces_by_outcome: tracesByOutcome,
  };
}

// ============================================================================
// Prometheus Format Export
// ============================================================================

export function exportPrometheusMetrics(): string {
  const metrics: MetricValue[] = [];
  const coverage = collectCoverageMetrics();

  // Coverage gauges
  metrics.push({
    name: "vos_ground_truth_kpis_total",
    help: "Total number of KPI definitions in ESO",
    type: "gauge",
    value: coverage.total_kpis,
  });

  metrics.push({
    name: "vos_ground_truth_vmrt_traces_total",
    help: "Total number of VMRT reasoning traces",
    type: "gauge",
    value: coverage.total_vmrt_traces,
  });

  metrics.push({
    name: "vos_ground_truth_personas_total",
    help: "Total number of persona value maps",
    type: "gauge",
    value: coverage.total_personas,
  });

  metrics.push({
    name: "vos_ground_truth_industries_total",
    help: "Total number of industry verticals covered",
    type: "gauge",
    value: coverage.total_industries,
  });

  // KPIs by industry
  for (const [industry, count] of Object.entries(coverage.kpis_by_industry)) {
    metrics.push({
      name: "vos_ground_truth_kpis_by_industry",
      help: "KPIs by industry vertical",
      type: "gauge",
      value: count,
      labels: { industry },
    });
  }

  // Traces by outcome
  for (const [outcome, count] of Object.entries(coverage.traces_by_outcome)) {
    metrics.push({
      name: "vos_ground_truth_traces_by_outcome",
      help: "VMRT traces by outcome category",
      type: "gauge",
      value: count,
      labels: { outcome },
    });
  }

  // Format as Prometheus text
  const lines: string[] = [];
  for (const metric of metrics) {
    lines.push(`# HELP ${metric.name} ${metric.help}`);
    lines.push(`# TYPE ${metric.name} ${metric.type}`);
    if (metric.labels) {
      const labelStr = Object.entries(metric.labels)
        .map(([k, v]) => `${k}="${v}"`)
        .join(",");
      lines.push(`${metric.name}{${labelStr}} ${metric.value}`);
    } else {
      lines.push(`${metric.name} ${metric.value}`);
    }
  }

  return lines.join("\n");
}

// ============================================================================
// JSON Format Export (for Grafana)
// ============================================================================

export function exportJSONMetrics(): object {
  const coverage = collectCoverageMetrics();

  return {
    timestamp: new Date().toISOString(),
    coverage,
    health: {
      status: "healthy",
      kpi_coverage_pct: Math.min(100, (coverage.total_kpis / 500) * 100),
      vmrt_coverage_pct: Math.min(
        100,
        (coverage.total_vmrt_traces / 100) * 100
      ),
    },
  };
}

// Console summary for quick checks
if (require.main === module) {
  logger.info("=== VOS Ground Truth Metrics ===");
  logger.info(exportPrometheusMetrics());
  logger.info("\n=== JSON Export ===");
  logger.info(JSON.stringify(exportJSONMetrics(), null, 2));
}
