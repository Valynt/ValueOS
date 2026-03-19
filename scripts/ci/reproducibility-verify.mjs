#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { cwd, exit } from "node:process";

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = {};

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith("--")) {
      continue;
    }

    const [rawKey, inlineValue] = token.slice(2).split("=", 2);
    if (inlineValue !== undefined) {
      options[rawKey] = inlineValue;
      continue;
    }

    const next = rest[index + 1];
    if (!next || next.startsWith("--")) {
      options[rawKey] = "true";
      continue;
    }

    options[rawKey] = next;
    index += 1;
  }

  return { command, options };
}

function ensureDir(pathname) {
  mkdirSync(pathname, { recursive: true });
}

function listFiles(rootDir) {
  const files = [];

  function visit(currentDir) {
    for (const entry of readdirSync(currentDir)) {
      const absolutePath = join(currentDir, entry);
      const stats = statSync(absolutePath);

      if (stats.isDirectory()) {
        visit(absolutePath);
        continue;
      }

      if (stats.isFile()) {
        files.push(absolutePath);
      }
    }
  }

  visit(rootDir);
  files.sort((left, right) => left.localeCompare(right));
  return files;
}

function toPosixPath(pathname) {
  return pathname.split(sep).join("/");
}

function hashFile(pathname) {
  return createHash("sha256").update(readFileSync(pathname)).digest("hex");
}

function readText(pathname) {
  return readFileSync(pathname, "utf8");
}

function buildManifest(rootDir) {
  const absoluteRoot = resolve(rootDir);
  const files = listFiles(absoluteRoot);

  return files
    .map((absolutePath) => {
      const relativePath = toPosixPath(relative(absoluteRoot, absolutePath));
      return `${hashFile(absolutePath)}  ${relativePath}`;
    })
    .join("\n")
    .concat(files.length > 0 ? "\n" : "");
}

function readManifest(manifestPath) {
  const entries = new Map();
  const lines = readText(manifestPath)
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    const [sha256, relativePath] = line.split(/\s{2,}/u);
    entries.set(relativePath, sha256);
  }

  return entries;
}

function compareManifestEntries(component, leftEntries, rightEntries) {
  const allPaths = new Set([...leftEntries.keys(), ...rightEntries.keys()]);
  const sortedPaths = [...allPaths].sort((left, right) => left.localeCompare(right));
  const diffs = [];

  for (const relativePath of sortedPaths) {
    const leftSha = leftEntries.get(relativePath) ?? null;
    const rightSha = rightEntries.get(relativePath) ?? null;

    if (leftSha === rightSha) {
      continue;
    }

    diffs.push({
      artifact_type: "package_manifest",
      component,
      path: relativePath,
      left: leftSha,
      right: rightSha,
    });
  }

  return diffs;
}

function loadAllowlist(pathname) {
  const parsed = JSON.parse(readText(pathname));
  const entries = Array.isArray(parsed.entries) ? parsed.entries : [];
  return {
    version: parsed.version ?? 1,
    entries: entries.map((entry, index) => ({
      id: entry.id ?? `allowlist-${index + 1}`,
      component: entry.component ?? "*",
      artifact_type: entry.artifact_type ?? "*",
      path_regex: entry.path_regex ?? null,
      left_regex: entry.left_regex ?? null,
      right_regex: entry.right_regex ?? null,
      reason: entry.reason ?? "No reason provided.",
      owner: entry.owner ?? "unassigned",
    })),
  };
}

function diffMatchesAllowlist(diff, entry) {
  if (entry.component !== "*" && entry.component !== diff.component) {
    return false;
  }

  if (entry.artifact_type !== "*" && entry.artifact_type !== diff.artifact_type) {
    return false;
  }

  if (entry.path_regex && !(new RegExp(entry.path_regex, "u")).test(diff.path ?? "")) {
    return false;
  }

  if (entry.left_regex && !(new RegExp(entry.left_regex, "u")).test(diff.left ?? "")) {
    return false;
  }

  if (entry.right_regex && !(new RegExp(entry.right_regex, "u")).test(diff.right ?? "")) {
    return false;
  }

  return true;
}

function annotateDiffs(diffs, allowlist) {
  return diffs.map((diff) => {
    const matchedEntry = allowlist.entries.find((entry) => diffMatchesAllowlist(diff, entry));
    return {
      ...diff,
      allowlisted: Boolean(matchedEntry),
      allowlist_entry_id: matchedEntry?.id ?? null,
      allowlist_reason: matchedEntry?.reason ?? null,
      allowlist_owner: matchedEntry?.owner ?? null,
    };
  });
}

function renderMarkdownReport(report) {
  const lines = [
    "# Reproducibility Comparison Report",
    "",
    `- commit: \`${report.commit}\``,
    `- overall_status: \`${report.status}\``,
    `- generated_at_utc: \`${report.generated_at_utc}\``,
    `- blocking_diff_count: \`${report.blocking_diff_count}\``,
    `- allowlisted_diff_count: \`${report.allowlisted_diff_count}\``,
    "",
    "## Artifact Summary",
    "",
    "| Artifact | Run A | Run B | Result |",
    "| --- | --- | --- | --- |",
  ];

  for (const comparison of report.comparisons) {
    lines.push(
      `| ${comparison.label} | \`${comparison.left}\` | \`${comparison.right}\` | ${comparison.result} |`,
    );
  }

  lines.push("", "## Detailed Diffs", "");

  if (report.diffs.length === 0) {
    lines.push("No differences detected.");
    return `${lines.join("\n")}\n`;
  }

  lines.push(
    "| Component | Artifact Type | Path | Run A | Run B | Allowlisted | Reason |",
    "| --- | --- | --- | --- | --- | --- | --- |",
  );

  for (const diff of report.diffs) {
    lines.push(
      `| ${diff.component} | ${diff.artifact_type} | ${diff.path ?? "—"} | \`${diff.left ?? "missing"}\` | \`${diff.right ?? "missing"}\` | ${diff.allowlisted ? "yes" : "no"} | ${diff.allowlist_reason ?? "blocking"} |`,
    );
  }

  return `${lines.join("\n")}\n`;
}

function captureManifests(options) {
  const outputDir = resolve(options["output-dir"] ?? "reproducibility");
  const backendDir = resolve(options["backend-dir"] ?? "packages/backend/dist");
  const frontendDir = resolve(options["frontend-dir"] ?? "apps/ValyntApp/dist");

  ensureDir(outputDir);

  const backendManifest = buildManifest(backendDir);
  const frontendManifest = buildManifest(frontendDir);

  writeFileSync(join(outputDir, "backend.sha256"), backendManifest, "utf8");
  writeFileSync(join(outputDir, "frontend.sha256"), frontendManifest, "utf8");

  const metadata = {
    generated_at_utc: new Date().toISOString(),
    backend_dir: toPosixPath(relative(cwd(), backendDir)),
    frontend_dir: toPosixPath(relative(cwd(), frontendDir)),
  };

  writeFileSync(join(outputDir, "artifact-metadata.json"), JSON.stringify(metadata, null, 2), "utf8");
}

function compareRuns(options) {
  const runADir = resolve(options["run-a"]);
  const runBDir = resolve(options["run-b"]);
  const outputDir = resolve(options["output-dir"] ?? "release-artifacts/reproducibility");
  const allowlistPath = resolve(options.allowlist ?? "scripts/ci/reproducibility-allowlist.json");
  const commit = options.commit ?? "unknown";

  ensureDir(outputDir);

  const allowlist = loadAllowlist(allowlistPath);
  const rawDiffs = [];
  const comparisons = [];

  const manifestFiles = [
    { component: "backend", file: "backend.sha256", label: "Backend package SHA-256 manifest" },
    { component: "frontend", file: "frontend.sha256", label: "Frontend package SHA-256 manifest" },
  ];

  for (const manifest of manifestFiles) {
    const leftPath = join(runADir, manifest.file);
    const rightPath = join(runBDir, manifest.file);
    const leftContent = readText(leftPath).trim();
    const rightContent = readText(rightPath).trim();
    const identical = leftContent === rightContent;

    comparisons.push({
      label: manifest.label,
      left: hashFile(leftPath),
      right: hashFile(rightPath),
      result: identical ? "match" : "diff",
    });

    if (!identical) {
      rawDiffs.push(
        ...compareManifestEntries(
          manifest.component,
          readManifest(leftPath),
          readManifest(rightPath),
        ),
      );
    }
  }

  for (const container of [
    { component: "backend", file: "backend-image-digest.txt", label: "Backend container digest" },
    { component: "frontend", file: "frontend-image-digest.txt", label: "Frontend container digest" },
  ]) {
    const left = readText(join(runADir, container.file)).trim();
    const right = readText(join(runBDir, container.file)).trim();
    const identical = left === right;

    comparisons.push({
      label: container.label,
      left,
      right,
      result: identical ? "match" : "diff",
    });

    if (!identical) {
      rawDiffs.push({
        artifact_type: "container_image_digest",
        component: container.component,
        path: null,
        left,
        right,
      });
    }
  }

  const annotatedDiffs = annotateDiffs(rawDiffs, allowlist);
  const blockingDiffs = annotatedDiffs.filter((diff) => !diff.allowlisted);
  const allowlistedDiffs = annotatedDiffs.filter((diff) => diff.allowlisted);

  const report = {
    commit,
    generated_at_utc: new Date().toISOString(),
    status:
      blockingDiffs.length > 0
        ? "blocking_diff"
        : allowlistedDiffs.length > 0
          ? "allowlisted_diff"
          : "reproducible",
    blocking_diff_count: blockingDiffs.length,
    allowlisted_diff_count: allowlistedDiffs.length,
    allowlist_version: allowlist.version,
    comparisons,
    diffs: annotatedDiffs,
  };

  writeFileSync(
    join(outputDir, "reproducibility-comparison.json"),
    JSON.stringify(report, null, 2),
    "utf8",
  );
  writeFileSync(
    join(outputDir, "reproducibility-allowlisted-diff.json"),
    JSON.stringify(
      {
        commit,
        generated_at_utc: report.generated_at_utc,
        status: report.status,
        allowlist,
        diffs: annotatedDiffs,
      },
      null,
      2,
    ),
    "utf8",
  );
  writeFileSync(join(outputDir, "reproducibility-report.md"), renderMarkdownReport(report), "utf8");
}

const { command, options } = parseArgs(process.argv.slice(2));

if (command === "capture-manifests") {
  captureManifests(options);
  exit(0);
}

if (command === "compare-runs") {
  compareRuns(options);
  exit(0);
}

console.error(
  "Usage:\n  node scripts/ci/reproducibility-verify.mjs capture-manifests --output-dir <dir>\n  node scripts/ci/reproducibility-verify.mjs compare-runs --run-a <dir> --run-b <dir> --output-dir <dir> [--allowlist <file>] [--commit <sha>]",
);
exit(1);
