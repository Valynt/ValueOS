#!/usr/bin/env node

import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = resolve(import.meta.dirname, "../..");
const env = process.env;

function requireEnv(name) {
  const value = env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function utcTimestamp(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function ensureDir(path) {
  mkdirSync(path, { recursive: true });
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? ROOT,
    env: { ...process.env, ...(options.env ?? {}) },
    encoding: "utf8",
  });

  if (options.stdoutPath) {
    writeFileSync(options.stdoutPath, result.stdout ?? "", "utf8");
  }
  if (options.stderrPath) {
    writeFileSync(options.stderrPath, result.stderr ?? "", "utf8");
  }

  if (!options.allowFailure && result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}`);
  }

  return result;
}

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

function queryPrometheus(baseUrl, token, query) {
  const args = [
    "-fsSL",
    `${baseUrl.replace(/\/$/, "")}/api/v1/query?query=${encodeURIComponent(query)}`,
  ];
  if (token) {
    args.unshift("-H", `Authorization: Bearer ${token}`);
  }

  const result = run("curl", args, { allowFailure: true });
  if (result.status !== 0 || !result.stdout) {
    return { available: false, error: result.stderr?.trim() || `curl exit ${result.status}` };
  }

  try {
    const payload = JSON.parse(result.stdout);
    const value = payload?.data?.result?.[0]?.value?.[1];
    return {
      available: true,
      value: value == null ? null : Number(value),
      raw: payload,
    };
  } catch (error) {
    return { available: false, error: `invalid prometheus payload: ${error.message}` };
  }
}

function collectPrometheusTelemetry(namespace) {
  const baseUrl = env.PROMETHEUS_URL;
  if (!baseUrl) {
    return {
      provider: "prometheus",
      available: false,
      reason: "PROMETHEUS_URL not configured",
    };
  }

  const token = env.PROMETHEUS_TOKEN ?? "";
  const queries = {
    backend_pod_count: env.BACKEND_POD_COUNT_QUERY ?? `sum(kube_deployment_status_replicas_available{namespace="${namespace}",deployment=~"backend.*"})`,
    worker_pod_count: env.WORKER_POD_COUNT_QUERY ?? `sum(kube_deployment_status_replicas_available{namespace="${namespace}",deployment=~"worker.*"})`,
    queue_depth: env.QUEUE_DEPTH_QUERY ?? "sum(queue_jobs_waiting)",
  };

  const metrics = Object.fromEntries(
    Object.entries(queries).map(([name, query]) => [name, { query, ...queryPrometheus(baseUrl, token, query) }]),
  );

  return {
    provider: "prometheus",
    available: Object.values(metrics).every((metric) => metric.available),
    metrics,
  };
}

function collectKubectlTelemetry(namespace) {
  const kubectl = env.KUBECTL_BIN || "kubectl";
  const probe = spawnSync(kubectl, ["version", "--client"], { encoding: "utf8" });
  if (probe.status !== 0) {
    return {
      provider: "kubectl",
      available: false,
      reason: probe.stderr?.trim() || `${kubectl} not available`,
    };
  }

  const result = run(kubectl, ["get", "pods", "-n", namespace, "-o", "json"], { allowFailure: true });
  if (result.status !== 0) {
    return {
      provider: "kubectl",
      available: false,
      reason: result.stderr?.trim() || `kubectl exit ${result.status}`,
    };
  }

  const payload = JSON.parse(result.stdout);
  const items = payload.items ?? [];
  const running = items.filter((item) => item.status?.phase === "Running").length;
  return {
    provider: "kubectl",
    available: true,
    running_pods: running,
    pods: items.map((item) => ({
      name: item.metadata?.name,
      phase: item.status?.phase,
      ready: (item.status?.containerStatuses ?? []).every((status) => status.ready),
    })),
  };
}

function summarizeCombined(loadSummary, scalingSummary, telemetry) {
  return {
    load_test: {
      p50_ms: loadSummary.latency_ms.overall.p50,
      p95_ms: loadSummary.latency_ms.overall.p95,
      p99_ms: loadSummary.latency_ms.overall.p99,
      error_rate: loadSummary.error_rate,
      thresholds_passed: loadSummary.thresholds.passed,
    },
    scaling_policy: {
      p50_ms: scalingSummary.latency_ms.overall.p50,
      p95_ms: scalingSummary.latency_ms.overall.p95,
      p99_ms: scalingSummary.latency_ms.overall.p99,
      error_rate: scalingSummary.error_rate,
      thresholds_passed: scalingSummary.thresholds.passed,
    },
    infrastructure: {
      backend_pod_count: telemetry.prometheus.metrics?.backend_pod_count?.value ?? telemetry.kubectl.running_pods ?? null,
      worker_pod_count: telemetry.prometheus.metrics?.worker_pod_count?.value ?? null,
      queue_depth: telemetry.prometheus.metrics?.queue_depth?.value ?? null,
    },
  };
}

const baseUrl = requireEnv("BASE_URL");
const benchmarkEnv = env.BENCHMARK_ENV || "staging";
const outputRoot = resolve(ROOT, env.BENCHMARK_OUTPUT_ROOT || `docs/operations/load-test-artifacts/${benchmarkEnv}`);
const timestamp = env.BENCHMARK_TIMESTAMP || utcTimestamp();
const runDir = join(outputRoot, timestamp);
const namespace = env.K8S_NAMESPACE || (benchmarkEnv === "production" ? "valynt" : "valynt-staging");
const k6Binary = env.K6_BIN || "k6";

ensureDir(runDir);

const loadStdout = join(runDir, "load-test.stdout.log");
const loadStderr = join(runDir, "load-test.stderr.log");
const scalingStdout = join(runDir, "scaling-policy.stdout.log");
const scalingStderr = join(runDir, "scaling-policy.stderr.log");

const sharedK6Env = {
  BASE_URL: baseUrl,
  AUTH_TOKEN: env.AUTH_TOKEN ?? "",
  TENANT_ID: env.TENANT_ID ?? "",
};

const loadRun = run(
  k6Binary,
  [
    "run",
    "--env",
    `BASE_URL=${baseUrl}`,
    "--env",
    `AUTH_TOKEN=${env.AUTH_TOKEN ?? ""}`,
    "--env",
    `TENANT_ID=${env.TENANT_ID ?? ""}`,
    "--env",
    `VUS=${env.VUS || "50"}`,
    "--env",
    `DURATION=${env.DURATION || "2m"}`,
    "--env",
    `RAMP_UP=${env.RAMP_UP || "30s"}`,
    "--env",
    `RAMP_DOWN=${env.RAMP_DOWN || "30s"}`,
    "--env",
    "SUMMARY_NAME=load-test",
    resolve(ROOT, "infra/testing/load-test.k6.js"),
  ],
  {
    cwd: runDir,
    env: sharedK6Env,
    stdoutPath: loadStdout,
    stderrPath: loadStderr,
    allowFailure: true,
  },
);

const scalingRun = run(
  k6Binary,
  [
    "run",
    "--env",
    `BASE_URL=${baseUrl}`,
    "--env",
    `AUTH_TOKEN=${env.AUTH_TOKEN ?? ""}`,
    "--env",
    `TENANT_ID=${env.TENANT_ID ?? ""}`,
    "--env",
    `STEADY_RAMP_DURATION=${env.STEADY_RAMP_DURATION || "2m"}`,
    "--env",
    `STEADY_HOLD_DURATION=${env.STEADY_HOLD_DURATION || "8m"}`,
    "--env",
    `STEADY_RAMP_DOWN_DURATION=${env.STEADY_RAMP_DOWN_DURATION || "2m"}`,
    "--env",
    `STEADY_TARGET_VUS=${env.STEADY_TARGET_VUS || "40"}`,
    "--env",
    `SPIKE_WARMUP_DURATION=${env.SPIKE_WARMUP_DURATION || "1m"}`,
    "--env",
    `SPIKE_PEAK_DURATION=${env.SPIKE_PEAK_DURATION || "90s"}`,
    "--env",
    `SPIKE_RECOVERY_DURATION=${env.SPIKE_RECOVERY_DURATION || "2m"}`,
    "--env",
    `SPIKE_WARMUP_RATE=${env.SPIKE_WARMUP_RATE || "20"}`,
    "--env",
    `SPIKE_PEAK_RATE=${env.SPIKE_PEAK_RATE || "160"}`,
    "--env",
    `SPIKE_RECOVERY_RATE=${env.SPIKE_RECOVERY_RATE || "20"}`,
    "--env",
    `SOAK_DURATION=${env.SOAK_DURATION || "30m"}`,
    "--env",
    `SOAK_RATE=${env.SOAK_RATE || "35"}`,
    "--env",
    `SPIKE_START_TIME=${env.SPIKE_START_TIME || "12m"}`,
    "--env",
    `SOAK_START_TIME=${env.SOAK_START_TIME || "16m30s"}`,
    "--env",
    "SUMMARY_NAME=scaling-policy",
    resolve(ROOT, "infra/testing/scaling-policy.k6.js"),
  ],
  {
    cwd: runDir,
    env: sharedK6Env,
    stdoutPath: scalingStdout,
    stderrPath: scalingStderr,
    allowFailure: true,
  },
);

const loadSummary = readJson(join(runDir, "load-test-summary.json"));
const scalingSummary = readJson(join(runDir, "scaling-policy-summary.json"));
const telemetry = {
  prometheus: collectPrometheusTelemetry(namespace),
  kubectl: collectKubectlTelemetry(namespace),
};

const manifest = {
  timestamp: loadSummary.timestamp,
  benchmark_environment: benchmarkEnv,
  base_url: baseUrl,
  namespace,
  canonical_production_path: "infra/k8s/overlays/production",
  reference_only_paths: [
    "ops/compose/",
    "infra/docker/",
    "infra/k8s/overlays/staging/",
    "infra/k8s/observability/",
  ],
  source_scripts: [
    "infra/testing/load-test.k6.js",
    "infra/testing/scaling-policy.k6.js",
  ],
  run_status: {
    load_test_exit_code: loadRun.status,
    scaling_policy_exit_code: scalingRun.status,
    live_validation_passed:
      loadRun.status === 0 &&
      scalingRun.status === 0 &&
      loadSummary.thresholds.passed &&
      scalingSummary.thresholds.passed,
  },
  load_test: loadSummary,
  scaling_policy: scalingSummary,
  telemetry,
  benchmark_summary: summarizeCombined(loadSummary, scalingSummary, telemetry),
};

writeFileSync(join(runDir, "benchmark-manifest.json"), json(manifest), "utf8");
writeFileSync(
  join(runDir, "benchmark-summary.md"),
  [
    `# ${benchmarkEnv} load-test benchmark`,
    "",
    `- Timestamp: ${manifest.timestamp}`,
    `- Target: ${baseUrl}`,
    `- Namespace: ${namespace}`,
    `- Canonical production path: \`infra/k8s/overlays/production\``,
    `- Live validation passed: ${manifest.run_status.live_validation_passed ? "yes" : "no"}`,
    "",
    "## Aggregate metrics",
    `- Load test p50/p95/p99: ${manifest.benchmark_summary.load_test.p50_ms} / ${manifest.benchmark_summary.load_test.p95_ms} / ${manifest.benchmark_summary.load_test.p99_ms} ms`,
    `- Load test error rate: ${manifest.benchmark_summary.load_test.error_rate}`,
    `- Scaling p50/p95/p99: ${manifest.benchmark_summary.scaling_policy.p50_ms} / ${manifest.benchmark_summary.scaling_policy.p95_ms} / ${manifest.benchmark_summary.scaling_policy.p99_ms} ms`,
    `- Scaling error rate: ${manifest.benchmark_summary.scaling_policy.error_rate}`,
    `- Backend pod count: ${manifest.benchmark_summary.infrastructure.backend_pod_count ?? "unavailable"}`,
    `- Worker pod count: ${manifest.benchmark_summary.infrastructure.worker_pod_count ?? "unavailable"}`,
    `- Queue depth: ${manifest.benchmark_summary.infrastructure.queue_depth ?? "unavailable"}`,
    "",
    "## Telemetry availability",
    `- Prometheus: ${telemetry.prometheus.available ? "available" : telemetry.prometheus.reason ?? "partial"}`,
    `- kubectl: ${telemetry.kubectl.available ? "available" : telemetry.kubectl.reason ?? "partial"}`,
  ].join("\n") + "\n",
  "utf8",
);

const latestPath = join(outputRoot, "latest.json");
copyFileSync(join(runDir, "benchmark-manifest.json"), latestPath);
try {
  rmSync(join(outputRoot, "latest"), { force: true });
  symlinkSync(timestamp, join(outputRoot, "latest"), "dir");
} catch {
  // Symlink support is best-effort; the copied latest.json is the stable pointer.
}

console.log(json({ output_root: outputRoot, run_dir: relative(ROOT, runDir), latest: relative(ROOT, latestPath) }));

if (!manifest.run_status.live_validation_passed) {
  process.exitCode = 1;
}
