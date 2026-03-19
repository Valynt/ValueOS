import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(new URL("../..", import.meta.url).pathname);
const canonicalPath = path.join(repoRoot, "packages/backend/src/config/slo.ts");
const canonicalSource = readFileSync(canonicalPath, "utf8");

function extractNumber(pattern, label) {
  const match = canonicalSource.match(pattern);
  if (!match) {
    throw new Error(`Unable to find canonical ${label} in ${canonicalPath}`);
  }
  return Number(match[1]);
}

const canonical = {
  interactiveMs: extractNumber(/interactiveLatencyP95Ms:\s*(\d+)/, "interactive completion target"),
  orchestrationAckMs: extractNumber(
    /orchestrationAcknowledgmentP95Ms:\s*(\d+)/,
    "orchestration acknowledgment target",
  ),
  orchestrationCompletionMs: extractNumber(
    /orchestrationCompletionP95Ms:\s*(\d+)/,
    "orchestration completion target",
  ),
};

const monitoredPrefixes = [
  "infra/testing/",
  "infra/prometheus/alerts/",
  "infra/k8s/base/",
  "infra/grafana/dashboards/",
  "docs/operations/",
];
const monitoredExtensions = new Set([".js", ".mjs", ".ts", ".md", ".yml", ".yaml", ".json"]);
const monitoredNameRegex = /(alert|benchmark|load-test|latency|slo|scaling|dashboard|observability)/i;
const contextRegex = /(latency|acknowledg|ttfb|response time|http_req_duration|p\(95\)|p95|slo|benchmark|threshold)/i;
const allowlistContextRegex = /(do\b.*not\b.*reintroduce|replace legacy universal budgets|legacy universal budgets such as)/i;
const forbiddenPatterns = [
  { regex: /450\s*ms|450ms/i, reason: "legacy 450ms budget" },
  { regex: /550\s*ms|550ms/i, reason: "legacy 550ms budget" },
  { regex: /600\s*ms|600ms|p\(95\)\s*<\s*600|p95\s*<\s*600/i, reason: "legacy 600ms budget" },
  { regex: /800\s*ms|800ms/i, reason: "legacy 800ms escalation budget" },
  { regex: /(?:^|\W)1\s*s(?:\W|$)|(?:^|\W)1s(?:\W|$)|1000\s*ms|1000ms/i, reason: "legacy 1s / 1000ms budget" },
  { regex: /1200\s*ms|1200ms|p\(99\)\s*<\s*1200|p99\s*<\s*1200/i, reason: "legacy 1200ms budget" },
  { regex: /backend_http_p95_latency_ms/, reason: "legacy generic backend latency external metric" },
];

const files = execFileSync("git", ["ls-files"], { cwd: repoRoot, encoding: "utf8" })
  .split("\n")
  .filter(Boolean)
  .filter((file) => monitoredPrefixes.some((prefix) => file.startsWith(prefix)))
  .filter((file) => monitoredExtensions.has(path.extname(file)))
  .filter((file) => monitoredNameRegex.test(file));

const violations = [];
for (const file of files) {
  const fullPath = path.join(repoRoot, file);
  const source = readFileSync(fullPath, "utf8");
  const lines = source.split(/\r?\n/);

  for (const [index, line] of lines.entries()) {
    if (!contextRegex.test(line) || allowlistContextRegex.test(line)) {
      continue;
    }

    for (const rule of forbiddenPatterns) {
      if (rule.regex.test(line)) {
        violations.push(`${file}:${index + 1} ${rule.reason} -> ${line.trim()}`);
      }
    }
  }
}

if (violations.length > 0) {
  console.error("Latency target consistency check failed.");
  console.error(
    `Canonical targets: interactive completion p95 < ${canonical.interactiveMs}ms; orchestration acknowledgment p95 < ${canonical.orchestrationAckMs}ms; orchestration completion p95 < ${canonical.orchestrationCompletionMs}ms.`,
  );
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log(
  `Latency target consistency check passed. Canonical targets: interactive completion p95 < ${canonical.interactiveMs}ms; orchestration acknowledgment p95 < ${canonical.orchestrationAckMs}ms; orchestration completion p95 < ${canonical.orchestrationCompletionMs}ms.`,
);
