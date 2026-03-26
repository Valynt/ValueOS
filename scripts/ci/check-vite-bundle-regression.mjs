#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const DEFAULT_CONFIG_PATH = ".github/metrics/vite-bundle-metrics.json";

function parseArgs(argv) {
  const args = argv.slice(2);
  const out = {
    log: null,
    metrics: DEFAULT_CONFIG_PATH,
    summaryOut: "artifacts/bundle/bundle-summary.md",
    jsonOut: "artifacts/bundle/bundle-metrics.json",
    historyOut: "artifacts/bundle/bundle-history.json",
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg.startsWith("--")) {
      continue;
    }
    const key = arg.slice(2);
    const value = args[i + 1];
    if (!value || value.startsWith("--")) {
      console.error(`Missing value for --${key}`);
      process.exit(1);
    }

    if (key === "log") out.log = value;
    else if (key === "metrics") out.metrics = value;
    else if (key === "summary-out") out.summaryOut = value;
    else if (key === "json-out") out.jsonOut = value;
    else if (key === "history-out") out.historyOut = value;
    else {
      console.error(`Unknown argument: --${key}`);
      process.exit(1);
    }

    i += 1;
  }

  if (!out.log) {
    console.error("Usage: node scripts/ci/check-vite-bundle-regression.mjs --log <vite-build.log> [--metrics <path>]");
    process.exit(1);
  }

  return out;
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    console.error(`Failed to read JSON from ${path}: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

function formatKb(value) {
  return `${value.toFixed(2)} kB`;
}

function parseViteAssets(logText) {
  const lines = logText.split(/\r?\n/);
  const jsAssets = [];

  const assetRegex = /^\s*(?:dist\/)?assets\/([^\s]+\.js)\s+([\d,.]+)\s*kB(?:\s*│\s*gzip:\s*([\d,.]+)\s*kB)?/;

  for (const line of lines) {
    const match = line.match(assetRegex);
    if (!match) continue;

    const file = match[1];
    const sizeKb = Number.parseFloat(match[2].replaceAll(",", ""));
    const gzipKb = match[3] ? Number.parseFloat(match[3].replaceAll(",", "")) : null;

    if (Number.isFinite(sizeKb)) {
      jsAssets.push({ file, sizeKb, gzipKb });
    }
  }

  return jsAssets.sort((a, b) => b.sizeKb - a.sizeKb);
}

function detectMainChunk(assets) {
  const explicitMain = assets.find((asset) => /^index-.*\.js$/i.test(asset.file) || /^main-.*\.js$/i.test(asset.file));
  if (explicitMain) return explicitMain;
  return assets[0] ?? null;
}

function ensureDirFor(path) {
  mkdirSync(dirname(path), { recursive: true });
}

const { log, metrics, summaryOut, jsonOut, historyOut } = parseArgs(process.argv);
const logText = readFileSync(log, "utf8");
const config = readJson(metrics);
const assets = parseViteAssets(logText);

if (assets.length === 0) {
  console.error(`No Vite JS chunk lines were parsed from ${log}.`);
  process.exit(1);
}

const thresholds = config.thresholds ?? {};
const regressionDeltasKb = config.regressionDeltasKb ?? {};
const history = Array.isArray(config.historical) ? config.historical : [];
const rawBaseline = history.at(-1) ?? null;
const baselineLooksUnset = rawBaseline
  ? Number(rawBaseline.mainBundleKb ?? 0) <= 0 && Number(rawBaseline.totalJsKb ?? 0) <= 0
  : true;
const baseline = baselineLooksUnset ? null : rawBaseline;

const mainChunk = detectMainChunk(assets);
if (!mainChunk) {
  console.error("Unable to determine main bundle chunk from Vite output.");
  process.exit(1);
}

const topSharedChunkCount = Number.isInteger(thresholds.topSharedChunkCount) ? thresholds.topSharedChunkCount : 3;
const sharedChunks = assets.filter((asset) => asset.file !== mainChunk.file);
const topSharedChunks = sharedChunks.slice(0, topSharedChunkCount);
const totalJsKb = assets.reduce((sum, asset) => sum + asset.sizeKb, 0);

const checks = [];

if (typeof thresholds.mainBundleKb === "number") {
  checks.push({
    label: "Main bundle threshold",
    passed: mainChunk.sizeKb <= thresholds.mainBundleKb,
    detail: `${formatKb(mainChunk.sizeKb)} <= ${formatKb(thresholds.mainBundleKb)}`,
  });
}

if (typeof thresholds.topSharedChunkKb === "number") {
  for (const chunk of topSharedChunks) {
    checks.push({
      label: `Shared chunk threshold (${chunk.file})`,
      passed: chunk.sizeKb <= thresholds.topSharedChunkKb,
      detail: `${formatKb(chunk.sizeKb)} <= ${formatKb(thresholds.topSharedChunkKb)}`,
    });
  }
}

if (baseline) {
  if (typeof regressionDeltasKb.mainBundleKb === "number") {
    const allowed = Number(baseline.mainBundleKb ?? 0) + regressionDeltasKb.mainBundleKb;
    checks.push({
      label: "Main bundle regression delta",
      passed: mainChunk.sizeKb <= allowed,
      detail: `${formatKb(mainChunk.sizeKb)} <= baseline ${formatKb(Number(baseline.mainBundleKb ?? 0))} + ${formatKb(regressionDeltasKb.mainBundleKb)} (${formatKb(allowed)})`,
    });
  }

  if (typeof regressionDeltasKb.totalJsKb === "number") {
    const allowed = Number(baseline.totalJsKb ?? 0) + regressionDeltasKb.totalJsKb;
    checks.push({
      label: "Total JS regression delta",
      passed: totalJsKb <= allowed,
      detail: `${formatKb(totalJsKb)} <= baseline ${formatKb(Number(baseline.totalJsKb ?? 0))} + ${formatKb(regressionDeltasKb.totalJsKb)} (${formatKb(allowed)})`,
    });
  }

  if (typeof regressionDeltasKb.sharedChunkKb === "number") {
    for (let index = 0; index < topSharedChunks.length; index += 1) {
      const chunk = topSharedChunks[index];
      const baselineValue = Number((baseline.topSharedChunksKb ?? [])[index] ?? 0);
      const allowed = baselineValue + regressionDeltasKb.sharedChunkKb;
      checks.push({
        label: `Shared chunk regression delta (rank ${index + 1}: ${chunk.file})`,
        passed: chunk.sizeKb <= allowed,
        detail: `${formatKb(chunk.sizeKb)} <= baseline ${formatKb(baselineValue)} + ${formatKb(regressionDeltasKb.sharedChunkKb)} (${formatKb(allowed)})`,
      });
    }
  }
}

const failed = checks.filter((check) => !check.passed);
const statusIcon = failed.length === 0 ? "✅" : "❌";

const markdownLines = [
  `# Frontend bundle summary (${statusIcon})`,
  "",
  `- Parsed from: \`${log}\``,
  `- Main bundle: \`${mainChunk.file}\` (${formatKb(mainChunk.sizeKb)})`,
  `- Total JS (all chunks): ${formatKb(totalJsKb)}`,
  baseline
    ? `- Baseline snapshot: ${baseline.date ?? "unknown-date"} (${baseline.sha ?? "unknown-sha"})`
    : "- Baseline snapshot: _none configured_",
  "",
  "## Top shared chunks",
  "",
  "| Rank | Chunk | Size |",
  "|---:|---|---:|",
  ...topSharedChunks.map((chunk, index) => `| ${index + 1} | ${chunk.file} | ${formatKb(chunk.sizeKb)} |`),
  "",
  "## Gate checks",
  "",
  "| Check | Result | Detail |",
  "|---|---|---|",
  ...checks.map((check) => `| ${check.label} | ${check.passed ? "✅ Pass" : "❌ Fail"} | ${check.detail} |`),
  "",
];

if (failed.length > 0) {
  markdownLines.push("### Regression failures");
  markdownLines.push("");
  for (const check of failed) {
    markdownLines.push(`- ${check.label}: ${check.detail}`);
  }
  markdownLines.push("");
}

ensureDirFor(summaryOut);
ensureDirFor(jsonOut);
ensureDirFor(historyOut);

const outputMetrics = {
  generatedAt: new Date().toISOString(),
  sourceLog: log,
  mainChunk,
  topSharedChunks,
  totalJsKb,
  checks,
  failedChecks: failed,
};

const outputHistory = {
  configPath: metrics,
  baseline,
  current: {
    mainBundleKb: mainChunk.sizeKb,
    topSharedChunksKb: topSharedChunks.map((chunk) => chunk.sizeKb),
    totalJsKb,
  },
};

writeFileSync(summaryOut, `${markdownLines.join("\n")}\n`, "utf8");
writeFileSync(jsonOut, `${JSON.stringify(outputMetrics, null, 2)}\n`, "utf8");
writeFileSync(historyOut, `${JSON.stringify(outputHistory, null, 2)}\n`, "utf8");

console.log(`Wrote bundle summary: ${summaryOut}`);
console.log(`Wrote bundle metrics JSON: ${jsonOut}`);
console.log(`Wrote bundle history comparison: ${historyOut}`);

if (failed.length > 0) {
  console.error(`Bundle regression gate failed with ${failed.length} check(s).`);
  process.exit(1);
}

console.log("Bundle regression gate passed.");
