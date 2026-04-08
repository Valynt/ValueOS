#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();

const METRICS_SOURCE_FILE = "packages/backend/src/metrics/billingMetrics.ts";
const BILLING_ALERTS_FILE = "infra/k8s/monitoring/billing-alerts.yaml";
const DEFAULT_REPORT_FILE = "artifacts/ci-lanes/slo-rule-validation/billing-alert-metrics-report.json";

const PROMQL_RESERVED_WORDS = new Set([
  "abs", "absent", "absent_over_time", "avg", "avg_over_time", "by", "bool", "ceil", "changes", "clamp", "clamp_max", "clamp_min",
  "count", "count_over_time", "day_of_month", "day_of_week", "day_of_year", "delta", "deriv", "exp", "floor", "group_left", "group_right",
  "histogram_avg", "histogram_count", "histogram_fraction", "histogram_quantile", "histogram_sum", "holt_winters", "hour", "idelta", "ignoring",
  "increase", "irate", "label_join", "label_replace", "last_over_time", "ln", "log10", "log2", "max", "max_over_time", "min",
  "min_over_time", "minute", "month", "offset", "on", "or", "and", "unless", "predict_linear", "present_over_time", "quantile",
  "quantile_over_time", "rate", "resets", "round", "scalar", "sgn", "sort", "sort_desc", "sqrt", "stddev", "stddev_over_time", "stdvar",
  "stdvar_over_time", "sum", "sum_over_time", "time", "timestamp", "vector", "without", "year",
]);

const SYSTEM_METRIC_PREFIXES = ["kube_", "queue_", "process_", "node_", "go_", "promhttp_", "up", "scrape_"];
const HISTOGRAM_SUFFIXES = ["_bucket", "_sum", "_count"];

function parseArgs(argv) {
  const args = new Map();
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      continue;
    }

    const [key, inlineValue] = token.split("=", 2);
    if (inlineValue !== undefined) {
      args.set(key, inlineValue);
      continue;
    }

    const nextToken = argv[i + 1];
    if (!nextToken || nextToken.startsWith("--")) {
      args.set(key, "true");
      continue;
    }

    args.set(key, nextToken);
    i += 1;
  }
  return args;
}

function normalizeStringList(content) {
  return content
    .split(",")
    .map((value) => value.trim().replace(/^['\"]|['\"]$/g, ""))
    .filter(Boolean);
}

function extractMetricDefinitions(sourceText) {
  const definitions = new Map();
  const metricBlockRegex = /new\s+(Counter|Gauge|Histogram)(?:<[^>]+>)?\s*\(\s*\{([\s\S]*?)\}\s*\)/g;

  for (const match of sourceText.matchAll(metricBlockRegex)) {
    const metricType = match[1];
    const blockText = match[2];
    const nameMatch = blockText.match(/name:\s*"([a-zA-Z_:][a-zA-Z0-9_:]*)"/);

    if (!nameMatch) {
      continue;
    }

    const labelMatch = blockText.match(/labelNames:\s*\[([^\]]*)\]/);
    const labelNames = labelMatch ? normalizeStringList(labelMatch[1]) : [];

    definitions.set(nameMatch[1], {
      metricType,
      labelNames,
    });
  }

  return definitions;
}

function extractExprBlocks(yamlText) {
  const lines = yamlText.split("\n");
  const blocks = [];

  let currentGroup = "unknown";
  let currentAlert = "unknown";

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    const groupMatch = line.match(/^\s*-\s*name:\s*([^\s#]+)\s*$/);
    if (groupMatch) {
      currentGroup = groupMatch[1];
    }

    const alertMatch = line.match(/^\s*-\s*alert:\s*([^\s#]+)\s*$/);
    if (alertMatch) {
      currentAlert = alertMatch[1];
    }

    const blockExprMatch = line.match(/^\s*expr:\s*\|\s*$/);
    if (blockExprMatch) {
      const exprIndent = line.match(/^\s*/)?.[0].length ?? 0;
      const exprLines = [];
      for (let j = i + 1; j < lines.length; j += 1) {
        const candidate = lines[j];
        const candidateIndent = candidate.match(/^\s*/) ?? [""];
        const indentLength = candidateIndent[0].length;

        if (candidate.trim() && indentLength <= exprIndent) {
          i = j - 1;
          break;
        }

        if (!candidate.trim()) {
          continue;
        }

        exprLines.push(candidate.trim());
        if (j === lines.length - 1) {
          i = j;
        }
      }

      blocks.push({
        group: currentGroup,
        alert: currentAlert,
        expr: exprLines.join(" "),
      });
      continue;
    }

    const inlineExprMatch = line.match(/^\s*expr:\s*(.+)\s*$/);
    if (inlineExprMatch) {
      blocks.push({
        group: currentGroup,
        alert: currentAlert,
        expr: inlineExprMatch[1].trim(),
      });
    }
  }

  return blocks;
}

function parseSelectorLabels(selector) {
  const labels = new Set();
  const labelPattern = /([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:=~|!~|=|!=)/g;

  for (const match of selector.matchAll(labelPattern)) {
    labels.add(match[1]);
  }

  return labels;
}

function parseMetricReferences(expr) {
  const references = [];
  const selectorPattern = /([a-zA-Z_:][a-zA-Z0-9_:]*)\s*\{([^}]*)\}/g;
  const rangePattern = /([a-zA-Z_:][a-zA-Z0-9_:]*)\s*\[[^\]]+\]/g;
  const barePattern = /(?:^|[^a-zA-Z0-9_:])([a-zA-Z_:][a-zA-Z0-9_:]*)(?=\s*(?:==|!=|>=|<=|>|<|\)|\}|\]|,|$))/g;

  for (const match of expr.matchAll(selectorPattern)) {
    references.push({
      metric: match[1],
      selectorLabels: parseSelectorLabels(match[2]),
    });
  }

  for (const match of expr.matchAll(rangePattern)) {
    references.push({
      metric: match[1],
      selectorLabels: new Set(),
    });
  }

  for (const match of expr.matchAll(barePattern)) {
    references.push({
      metric: match[1],
      selectorLabels: new Set(),
    });
  }

  const deduped = new Map();
  for (const ref of references) {
    if (PROMQL_RESERVED_WORDS.has(ref.metric)) {
      continue;
    }

    const key = `${ref.metric}|${Array.from(ref.selectorLabels).sort().join(",")}`;
    if (!deduped.has(key)) {
      deduped.set(key, ref);
    }
  }

  return [...deduped.values()];
}

function isSystemMetric(metricName) {
  return SYSTEM_METRIC_PREFIXES.some((prefix) => metricName.startsWith(prefix));
}

function resolveMetricDefinition(metricName, metricDefinitions) {
  if (metricDefinitions.has(metricName)) {
    return { baseMetricName: metricName, syntheticHistogramLabel: false };
  }

  for (const suffix of HISTOGRAM_SUFFIXES) {
    if (metricName.endsWith(suffix)) {
      const baseMetricName = metricName.slice(0, -suffix.length);
      if (metricDefinitions.get(baseMetricName)?.metricType === "Histogram") {
        return { baseMetricName, syntheticHistogramLabel: suffix === "_bucket" };
      }
    }
  }

  return null;
}

function collectValidationResults(exprBlocks, metricDefinitions) {
  const matchedMetrics = new Set();
  const unmatchedMetrics = new Set();
  const labelMismatches = [];
  const referencesByAlert = [];

  for (const block of exprBlocks) {
    const references = parseMetricReferences(block.expr);
    const perAlert = [];

    for (const reference of references) {
      const metricName = reference.metric;
      if (isSystemMetric(metricName)) {
        continue;
      }

      const resolved = resolveMetricDefinition(metricName, metricDefinitions);
      if (!resolved) {
        unmatchedMetrics.add(metricName);
        perAlert.push({
          metric: metricName,
          status: "unknown_metric",
          selectorLabels: Array.from(reference.selectorLabels).sort(),
        });
        continue;
      }

      matchedMetrics.add(metricName);

      const definition = metricDefinitions.get(resolved.baseMetricName);
      const allowedLabels = new Set(definition?.labelNames ?? []);
      if (resolved.syntheticHistogramLabel) {
        allowedLabels.add("le");
      }

      const unknownSelectorLabels = Array.from(reference.selectorLabels).filter((label) => !allowedLabels.has(label));

      if (unknownSelectorLabels.length > 0) {
        labelMismatches.push({
          group: block.group,
          alert: block.alert,
          metric: metricName,
          resolvedBaseMetric: resolved.baseMetricName,
          selectorLabels: Array.from(reference.selectorLabels).sort(),
          expectedLabels: Array.from(allowedLabels).sort(),
          unknownSelectorLabels: unknownSelectorLabels.sort(),
        });

        perAlert.push({
          metric: metricName,
          status: "label_mismatch",
          selectorLabels: Array.from(reference.selectorLabels).sort(),
          expectedLabels: Array.from(allowedLabels).sort(),
          unknownSelectorLabels: unknownSelectorLabels.sort(),
        });
        continue;
      }

      perAlert.push({
        metric: metricName,
        status: "matched",
        selectorLabels: Array.from(reference.selectorLabels).sort(),
      });
    }

    referencesByAlert.push({
      group: block.group,
      alert: block.alert,
      expr: block.expr,
      references: perAlert,
    });
  }

  return {
    matchedMetrics: Array.from(matchedMetrics).sort(),
    unmatchedMetrics: Array.from(unmatchedMetrics).sort(),
    labelMismatches,
    referencesByAlert,
  };
}

async function writeMachineReadableReport(reportPath, payload) {
  const absoluteReportPath = path.resolve(repoRoot, reportPath);
  await mkdir(path.dirname(absoluteReportPath), { recursive: true });
  await writeFile(absoluteReportPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return absoluteReportPath;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const reportPath = args.get("--report") ?? DEFAULT_REPORT_FILE;

  const [metricsSourceText, billingAlertsText] = await Promise.all([
    readFile(path.resolve(repoRoot, METRICS_SOURCE_FILE), "utf8"),
    readFile(path.resolve(repoRoot, BILLING_ALERTS_FILE), "utf8"),
  ]);

  const metricDefinitions = extractMetricDefinitions(metricsSourceText);
  const exprBlocks = extractExprBlocks(billingAlertsText);
  const results = collectValidationResults(exprBlocks, metricDefinitions);

  const report = {
    generated_at: new Date().toISOString(),
    contract: {
      metrics_source_file: METRICS_SOURCE_FILE,
      alerts_file: BILLING_ALERTS_FILE,
    },
    summary: {
      backend_metric_definitions: metricDefinitions.size,
      alert_expressions: exprBlocks.length,
      matched_metrics: results.matchedMetrics.length,
      unmatched_metrics: results.unmatchedMetrics.length,
      label_mismatches: results.labelMismatches.length,
    },
    matched_metrics: results.matchedMetrics,
    unmatched_metrics: results.unmatchedMetrics,
    label_mismatches: results.labelMismatches,
    alert_references: results.referencesByAlert,
  };

  const absoluteReportPath = await writeMachineReadableReport(reportPath, report);

  const hasErrors = results.unmatchedMetrics.length > 0 || results.labelMismatches.length > 0;

  if (hasErrors) {
    console.error("❌ Billing alert metrics contract check failed.");

    if (results.unmatchedMetrics.length > 0) {
      console.error("Unknown metric references in billing alerts:");
      for (const metric of results.unmatchedMetrics) {
        console.error(` - ${metric}`);
      }
    }

    if (results.labelMismatches.length > 0) {
      console.error("Metric selector label mismatches in billing alerts:");
      for (const mismatch of results.labelMismatches) {
        console.error(
          ` - [${mismatch.group}/${mismatch.alert}] ${mismatch.metric} uses labels [${mismatch.selectorLabels.join(", ")}] but backend defines [${mismatch.expectedLabels.join(", ")}]`,
        );
      }
    }

    console.error(`Machine-readable report written to: ${absoluteReportPath}`);
    process.exit(1);
  }

  console.log("✅ Billing alert metrics contract check passed.");
  console.log(`Validated ${results.matchedMetrics.length} billing metric reference(s) across ${exprBlocks.length} alert expression(s).`);
  console.log(`Machine-readable report written to: ${absoluteReportPath}`);
}

await main();
