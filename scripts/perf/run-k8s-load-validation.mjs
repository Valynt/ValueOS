#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { dirname, join, relative } from "node:path";

const CANONICAL_PRODUCTION_PATH = "infra/k8s/overlays/production";
const REFERENCE_ONLY_PATHS = [
  "infra/k8s/overlays/staging",
  "ops/compose/",
  "infra/docker/",
  "infra/reference/terraform-archived-ecs/",
];

function parseArgs(argv) {
  const args = {};
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    const [key, inlineValue] = arg.slice(2).split("=", 2);
    if (inlineValue != null) {
      args[key] = inlineValue;
      continue;
    }
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      args[key] = next;
      index += 1;
    } else {
      args[key] = "true";
    }
  }
  return args;
}

function envOrArg(args, key, fallback = "") {
  const envKey = key.toUpperCase().replace(/-/g, "_");
  return args[key] ?? process.env[envKey] ?? fallback;
}

function timestampSlug(date = new Date()) {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

function ensureDir(dir) {
  mkdirSync(dir, { recursive: true });
}

function writeJson(filePath, payload) {
  ensureDir(dirname(filePath));
  writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function writeText(filePath, payload) {
  ensureDir(dirname(filePath));
  writeFileSync(filePath, payload, "utf8");
}

function loadJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function hasCommand(command, args = ["--version"]) {
  const result = spawnSync(command, args, { stdio: "ignore" });
  return result.status === 0;
}

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function fetchStatus(url) {
  const result = runCommand("curl", [
    "-sS",
    "-o",
    "/tmp/valueos-load-validation-body",
    "-w",
    "%{http_code}",
    "--max-time",
    "20",
    url,
  ]);
  if (result.status !== 0) {
    return {
      ok: false,
      statusCode: null,
      error: result.stderr.trim() || `curl exited with ${result.status}`,
      bodyPreview: "",
    };
  }

  const statusCode = Number(result.stdout.trim());
  let bodyPreview = "";
  if (existsSync("/tmp/valueos-load-validation-body")) {
    bodyPreview = readFileSync(
      "/tmp/valueos-load-validation-body",
      "utf8",
    ).slice(0, 240);
    rmSync("/tmp/valueos-load-validation-body", { force: true });
  }

  return {
    ok: statusCode >= 200 && statusCode < 400,
    statusCode,
    error: null,
    bodyPreview,
  };
}

function queryPrometheus(prometheusUrl, prometheusToken, query) {
  if (!prometheusUrl) {
    return {
      available: false,
      value: null,
      error: "PROMETHEUS_URL not set",
      query,
    };
  }

  const encodedQuery = encodeURIComponent(query);
  const args = ["-sS", "--max-time", "20"];
  if (prometheusToken) {
    args.push("-H", `Authorization: Bearer ${prometheusToken}`);
  }
  args.push(
    `${prometheusUrl.replace(/\/$/, "")}/api/v1/query?query=${encodedQuery}`,
  );

  const result = runCommand("curl", args);
  if (result.status !== 0) {
    return {
      available: false,
      value: null,
      error: result.stderr.trim() || "Prometheus query failed",
      query,
    };
  }

  try {
    const payload = JSON.parse(result.stdout);
    const value = payload?.data?.result?.[0]?.value?.[1];
    return {
      available: true,
      value: value == null ? null : Number(value),
      error: null,
      query,
    };
  } catch (error) {
    return {
      available: false,
      value: null,
      error: error instanceof Error ? error.message : String(error),
      query,
    };
  }
}

function collectPodCounts(namespace) {
  if (!hasCommand("kubectl")) {
    return {
      available: false,
      namespace,
      total: null,
      running: null,
      phases: {},
      error: "kubectl not installed",
    };
  }

  const result = runCommand("kubectl", [
    "get",
    "pods",
    "-n",
    namespace,
    "-o",
    "json",
  ]);
  if (result.status !== 0) {
    return {
      available: false,
      namespace,
      total: null,
      running: null,
      phases: {},
      error: result.stderr.trim() || `kubectl exited with ${result.status}`,
    };
  }

  try {
    const payload = JSON.parse(result.stdout);
    const phases = {};
    for (const item of payload.items ?? []) {
      const phase = item?.status?.phase ?? "Unknown";
      phases[phase] = (phases[phase] ?? 0) + 1;
    }
    return {
      available: true,
      namespace,
      total: payload.items?.length ?? 0,
      running: phases.Running ?? 0,
      phases,
      error: null,
    };
  } catch (error) {
    return {
      available: false,
      namespace,
      total: null,
      running: null,
      phases: {},
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function chooseK6Runner(repoRoot) {
  if (hasCommand("k6")) {
    return {
      command: "k6",
      argsFor(scriptPath, env) {
        return [
          "run",
          ...Object.entries(env).flatMap(([key, value]) => [
            "--env",
            `${key}=${value}`,
          ]),
          scriptPath,
        ];
      },
      workdir: repoRoot,
      mode: "binary",
    };
  }

  if (hasCommand("docker")) {
    return {
      command: "docker",
      argsFor(scriptPath, env) {
        return [
          "run",
          "--rm",
          "-v",
          `${repoRoot}:/work`,
          "-w",
          "/work",
          ...Object.entries(env).flatMap(([key, value]) => [
            "-e",
            `${key}=${value}`,
          ]),
          "grafana/k6:0.53.0",
          "run",
          scriptPath,
        ];
      },
      workdir: repoRoot,
      mode: "docker",
    };
  }

  return null;
}

function runK6Scenario(runner, scriptPath, env, outputFiles, runDirectory) {
  const result = runCommand(runner.command, runner.argsFor(scriptPath, env), {
    cwd: runner.workdir,
  });
  const execution = {
    script: scriptPath,
    runner: runner.mode,
    status: result.status === 0 ? "passed" : "failed",
    exit_code: result.status,
    stdout_file: relative(process.cwd(), outputFiles.stdoutFile),
    stderr_file: relative(process.cwd(), outputFiles.stderrFile),
  };

  writeText(outputFiles.stdoutFile, result.stdout);
  writeText(outputFiles.stderrFile, result.stderr);

  const summaryExists = existsSync(outputFiles.summaryFile);
  const resultsExists = existsSync(outputFiles.resultsFile);
  if (!summaryExists || !resultsExists) {
    execution.status = "failed";
    execution.error = `Expected k6 artifacts missing (summary=${summaryExists}, results=${resultsExists})`;
    return execution;
  }

  execution.summary_file = relative(process.cwd(), outputFiles.summaryFile);
  execution.results_file = relative(process.cwd(), outputFiles.resultsFile);
  execution.summary = loadJson(outputFiles.summaryFile);
  execution.results_size_bytes = readFileSync(outputFiles.resultsFile).length;
  execution.run_directory = relative(process.cwd(), runDirectory);
  return execution;
}

function summarizeExecution(execution) {
  const summary = execution.summary ?? {};
  return {
    script: execution.script,
    status: execution.status,
    latency_ms: summary.latency_ms ?? {},
    error_rate: summary.error_rate ?? null,
    total_requests: summary.total_requests ?? null,
    rps: summary.rps ?? null,
    saturation: summary.saturation ?? {},
    thresholds_passed: summary.thresholds_passed ?? false,
  };
}

function buildMarkdown(manifest, runArtifactPath) {
  const lines = [
    "# Load Test Validation Snapshot",
    "",
    `- Timestamp: \`${manifest.timestamp}\``,
    `- Environment: \`${manifest.environment}\``,
    `- Target: \`${manifest.target.base_url}\``,
    `- Canonical production path: \`${manifest.target.canonical_production_path}\``,
    `- Status: **${manifest.status.toUpperCase()}**`,
    `- Stable artifact: \`${runArtifactPath}\``,
    "",
    "## Preflight",
    `- Health endpoint: ${manifest.preflight.health_endpoint}`,
    `- Health status code: ${manifest.preflight.status_code ?? "unavailable"}`,
  ];

  if (manifest.preflight.error) {
    lines.push(`- Preflight error: ${manifest.preflight.error}`);
  }

  lines.push("", "## Load test", `- Status: ${manifest.load_test.status}`);
  if (manifest.load_test.summary) {
    lines.push(
      `- p50 / p95 / p99 (ms): ${manifest.load_test.summary.latency_ms?.p50 ?? "n/a"} / ${manifest.load_test.summary.latency_ms?.p95 ?? "n/a"} / ${manifest.load_test.summary.latency_ms?.p99 ?? "n/a"}`,
    );
    lines.push(
      `- Error rate: ${manifest.load_test.summary.error_rate ?? "n/a"}`,
    );
  }

  lines.push(
    "",
    "## Scaling policy",
    `- Status: ${manifest.scaling_policy.status}`,
  );
  if (manifest.scaling_policy.summary) {
    lines.push(
      `- p50 / p95 / p99 (ms): ${manifest.scaling_policy.summary.latency_ms?.p50 ?? "n/a"} / ${manifest.scaling_policy.summary.latency_ms?.p95 ?? "n/a"} / ${manifest.scaling_policy.summary.latency_ms?.p99 ?? "n/a"}`,
    );
    lines.push(
      `- Error rate: ${manifest.scaling_policy.summary.error_rate ?? "n/a"}`,
    );
  }

  lines.push("", "## Infra telemetry");
  lines.push(
    `- Pod counts available: ${manifest.infra_observability.pod_counts.available}`,
  );
  lines.push(
    `- Queue depth available: ${manifest.infra_observability.queue_depth.available}`,
  );
  if (manifest.infra_observability.queue_depth.value != null) {
    lines.push(
      `- Queue depth: ${manifest.infra_observability.queue_depth.value}`,
    );
  }
  if (manifest.failure_reason) {
    lines.push("", `## Failure reason\n- ${manifest.failure_reason}`);
  }

  return `${lines.join("\n")}\n`;
}

const args = parseArgs(process.argv);
const environment = envOrArg(args, "environment", "staging");
const baseUrl = envOrArg(args, "base-url", "https://staging.valueos.app");
const namespace = envOrArg(
  args,
  "namespace",
  environment === "production" ? "valynt" : "valynt-staging",
);
const repoRoot = process.cwd();
const artifactRoot = envOrArg(args, "artifacts-root", "artifacts/load-tests");
const stableRoot = envOrArg(
  args,
  "stable-root",
  "docs/operations/load-test-artifacts",
);
const prometheusUrl = envOrArg(args, "prometheus-url", "");
const prometheusToken = envOrArg(args, "prometheus-token", "");
const authToken = envOrArg(args, "auth-token", "");
const tenantId = envOrArg(args, "tenant-id", "");
const vus = envOrArg(args, "vus", "100");
const duration = envOrArg(args, "duration", "5m");
const timestamp = timestampSlug();
const runName = `${timestamp}-${environment}`;
const runArtifactDir = join(repoRoot, artifactRoot, runName);
const runStableDir = join(repoRoot, stableRoot, runName);
ensureDir(runArtifactDir);
ensureDir(runStableDir);

const manifest = {
  schema_version: 1,
  timestamp: new Date().toISOString(),
  environment,
  status: "failed",
  target: {
    base_url: baseUrl,
    namespace,
    canonical_production_path: CANONICAL_PRODUCTION_PATH,
    reference_only_paths: REFERENCE_ONLY_PATHS,
  },
  preflight: {
    health_endpoint: `${baseUrl.replace(/\/$/, "")}/api/health`,
    status_code: null,
    error: null,
    body_preview: "",
  },
  load_test: { status: "not_run" },
  scaling_policy: { status: "not_run" },
  infra_observability: {
    pod_counts: collectPodCounts(namespace),
    queue_depth: queryPrometheus(
      prometheusUrl,
      prometheusToken,
      "sum(queue_jobs_waiting)",
    ),
    backend_pod_count: queryPrometheus(
      prometheusUrl,
      prometheusToken,
      `count(kube_pod_status_phase{namespace="${namespace}", phase="Running", pod=~"backend.*"})`,
    ),
  },
  failure_reason: null,
};

const preflight = fetchStatus(manifest.preflight.health_endpoint);
manifest.preflight.status_code = preflight.statusCode;
manifest.preflight.error = preflight.error;
manifest.preflight.body_preview = preflight.bodyPreview;

const runner = chooseK6Runner(repoRoot);
if (!runner) {
  manifest.failure_reason =
    "Neither k6 nor docker is available to execute the benchmark suite.";
} else if (!preflight.ok) {
  manifest.failure_reason = preflight.error
    ? `Target preflight failed before k6 execution: ${preflight.error}`
    : `Target preflight returned status ${preflight.statusCode}.`;
} else {
  const commonEnv = {
    BASE_URL: baseUrl,
    AUTH_TOKEN: authToken,
    TENANT_ID: tenantId,
  };

  const loadOutput = {
    summaryFile: join(runArtifactDir, "load-test-summary.json"),
    resultsFile: join(runArtifactDir, "load-test-results.json"),
    stdoutFile: join(runArtifactDir, "load-test.stdout.log"),
    stderrFile: join(runArtifactDir, "load-test.stderr.log"),
  };
  const loadExecution = runK6Scenario(
    runner,
    "infra/testing/load-test.k6.js",
    {
      ...commonEnv,
      VUS: vus,
      DURATION: duration,
      K6_SUMMARY_JSON: relative(repoRoot, loadOutput.summaryFile),
      K6_RESULTS_JSON: relative(repoRoot, loadOutput.resultsFile),
    },
    loadOutput,
    runArtifactDir,
  );
  manifest.load_test = {
    ...loadExecution,
    summary: loadExecution.summary ?? null,
  };

  const scalingOutput = {
    summaryFile: join(runArtifactDir, "scaling-policy-summary.json"),
    resultsFile: join(runArtifactDir, "scaling-policy-results.json"),
    stdoutFile: join(runArtifactDir, "scaling-policy.stdout.log"),
    stderrFile: join(runArtifactDir, "scaling-policy.stderr.log"),
  };
  const scalingExecution = runK6Scenario(
    runner,
    "infra/testing/scaling-policy.k6.js",
    {
      ...commonEnv,
      K6_SUMMARY_JSON: relative(repoRoot, scalingOutput.summaryFile),
      K6_RESULTS_JSON: relative(repoRoot, scalingOutput.resultsFile),
    },
    scalingOutput,
    runArtifactDir,
  );
  manifest.scaling_policy = {
    ...scalingExecution,
    summary: scalingExecution.summary ?? null,
  };

  if (
    loadExecution.status === "passed" &&
    scalingExecution.status === "passed"
  ) {
    manifest.status = "passed";
  } else {
    manifest.failure_reason =
      loadExecution.error ??
      scalingExecution.error ??
      "One or more benchmark suites failed.";
  }
}

const stableSummary = {
  schema_version: manifest.schema_version,
  timestamp: manifest.timestamp,
  environment: manifest.environment,
  status: manifest.status,
  target: manifest.target,
  preflight: manifest.preflight,
  load_test: summarizeExecution(manifest.load_test),
  scaling_policy: summarizeExecution(manifest.scaling_policy),
  infra_observability: manifest.infra_observability,
  failure_reason: manifest.failure_reason,
};

writeJson(join(runArtifactDir, "benchmark-manifest.json"), manifest);
writeJson(join(runStableDir, "summary.json"), stableSummary);
writeText(
  join(runStableDir, "summary.md"),
  buildMarkdown(
    stableSummary,
    relative(repoRoot, join(runStableDir, "summary.json")),
  ),
);
writeJson(join(repoRoot, stableRoot, "latest.json"), stableSummary);
writeText(
  join(repoRoot, stableRoot, "latest.md"),
  buildMarkdown(
    stableSummary,
    relative(repoRoot, join(runStableDir, "summary.json")),
  ),
);

console.log(
  JSON.stringify(
    {
      status: stableSummary.status,
      run: runName,
      latest: relative(repoRoot, join(repoRoot, stableRoot, "latest.json")),
      summary: relative(repoRoot, join(runStableDir, "summary.json")),
      failure_reason: stableSummary.failure_reason,
    },
    null,
    2,
  ),
);

if (stableSummary.status !== "passed") {
  process.exitCode = 1;
}
