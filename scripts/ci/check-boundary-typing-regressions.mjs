#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const DEFAULT_ALLOWLIST_PATH = path.resolve(ROOT, "scripts/ci/boundary-typing-allowlist.json");
const DEFAULT_ARTIFACT_PATH = path.resolve(
  ROOT,
  "artifacts/ci-lanes/unit-component-schema/boundary-typing-regressions.json",
);
const STRICT_EXCEPTION_CONFIG_PATH = path.resolve(ROOT, "packages/backend/tsconfig.strict-exceptions.json");

const RULES = [
  {
    id: "no-explicit-any",
    regex: /(^|[^\w$])any([^\w$]|$)/g,
  },
  {
    id: "unsafe-cast-any",
    regex: /\bas\s+any\b|<\s*any\s*>/g,
  },
  {
    id: "unsafe-broad-assertion",
    regex: /\bas\s+(?:unknown|object|\{\}|Record\s*<\s*string\s*,\s*(?:unknown|any)\s*>|unknown\[\]|any\[\])\b|\bas\s+unknown\s+as\b/g,
  },
  {
    id: "no-non-null-assertion",
    regex: /\b[A-Za-z_$][\w$\]\)]*!\s*(?:\.|\[|\(|,|;|:|\?|\|\||&&)/g,
  },
];

const TEST_PATH_PATTERN =
  /(?:^|\/)(?:__tests__|__mocks__)(?:\/|$)|\.(?:test|spec|integration\.test|integration\.spec|int\.test|int\.spec)\.[cm]?[jt]sx?$/;

const cli = parseArgs(process.argv.slice(2));
const allowlistPath = path.resolve(ROOT, cli.allowlist ?? DEFAULT_ALLOWLIST_PATH);
const artifactPath = path.resolve(ROOT, cli.artifact ?? DEFAULT_ARTIFACT_PATH);
const writeCurrentToAllowlist = Boolean(cli["write-current-to-allowlist"]);

if (!fs.existsSync(STRICT_EXCEPTION_CONFIG_PATH)) {
  console.error(`Missing strict exception config: ${STRICT_EXCEPTION_CONFIG_PATH}`);
  process.exit(1);
}

const strictConfig = JSON.parse(fs.readFileSync(STRICT_EXCEPTION_CONFIG_PATH, "utf8"));
const strictBoundaryGlobs = Array.isArray(strictConfig.protectedZeroNewZones)
  ? strictConfig.protectedZeroNewZones.map((glob) => `packages/backend/${glob}`)
  : [];

if (strictBoundaryGlobs.length === 0) {
  console.error("No strict boundary globs found in packages/backend/tsconfig.strict-exceptions.json (protectedZeroNewZones).");
  process.exit(1);
}

if (!fs.existsSync(allowlistPath) && !writeCurrentToAllowlist) {
  console.error(`Missing boundary typing allowlist: ${allowlistPath}`);
  process.exit(1);
}

const allowlistDocument = fs.existsSync(allowlistPath)
  ? JSON.parse(fs.readFileSync(allowlistPath, "utf8"))
  : { version: 1, strictBoundaryGlobs, entries: [] };

const files = collectFiles(strictBoundaryGlobs).filter((candidate) => {
  if (!candidate.endsWith(".ts") && !candidate.endsWith(".tsx")) {
    return false;
  }
  return !TEST_PATH_PATTERN.test(candidate);
});

const findings = scanFiles(files);
const currentCounts = toCountMap(findings);

if (writeCurrentToAllowlist) {
  const entries = Array.from(currentCounts.entries())
    .map(([key, count]) => {
      const [filePath, rule] = key.split("::");
      return { path: filePath, rule, count };
    })
    .sort((a, b) => (a.path === b.path ? a.rule.localeCompare(b.rule) : a.path.localeCompare(b.path)));

  const next = {
    version: 1,
    generatedAt: new Date().toISOString(),
    strictBoundaryGlobs,
    entries,
  };

  fs.mkdirSync(path.dirname(allowlistPath), { recursive: true });
  fs.writeFileSync(allowlistPath, `${JSON.stringify(next, null, 2)}\n`);
  console.log(`Wrote boundary typing allowlist baseline to ${path.relative(ROOT, allowlistPath)}`);
}

const allowlistMap = new Map(
  (allowlistDocument.entries ?? []).map((entry) => [`${entry.path}::${entry.rule}`, Number(entry.count ?? 0)]),
);

let failures = 0;
const regressions = [];
const staleAllowlistEntries = [];

for (const [key, count] of currentCounts.entries()) {
  const allowed = allowlistMap.get(key) ?? 0;
  if (count > allowed) {
    const [filePath, rule] = key.split("::");
    regressions.push({ path: filePath, rule, count, allowed, delta: count - allowed });
    failures += 1;
    console.error(`❌ boundary typing regression ${key}: ${count} > allowlist ${allowed}`);
  }
}

for (const [key, allowed] of allowlistMap.entries()) {
  const current = currentCounts.get(key) ?? 0;
  if (current < allowed) {
    const [filePath, rule] = key.split("::");
    staleAllowlistEntries.push({ path: filePath, rule, current, allowed, delta: allowed - current });
  }
}

const artifact = {
  generatedAt: new Date().toISOString(),
  strictBoundaryGlobs,
  totals: summarizeByRule(findings),
  regressions,
  staleAllowlistEntries,
  entries: Array.from(currentCounts.entries())
    .map(([key, count]) => {
      const [filePath, rule] = key.split("::");
      return { path: filePath, rule, count, allowed: allowlistMap.get(key) ?? 0 };
    })
    .sort((a, b) => (a.path === b.path ? a.rule.localeCompare(b.rule) : a.path.localeCompare(b.path))),
};

fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
fs.writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`);
console.log(`Boundary typing artifact: ${path.relative(ROOT, artifactPath)}`);

if (failures > 0) {
  console.error(`Boundary typing regression check failed with ${failures} regression(s).`);
  process.exit(1);
}

console.log("Boundary typing regression check passed (no new violations; allowlist counts non-increasing).");

function parseArgs(args) {
  const out = {};
  for (const raw of args) {
    if (!raw.startsWith("--")) {
      continue;
    }

    const trimmed = raw.slice(2);
    const eq = trimmed.indexOf("=");
    if (eq === -1) {
      out[trimmed] = true;
    } else {
      out[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
    }
  }
  return out;
}

function collectFiles(globs) {
  const out = new Set();
  for (const glob of globs) {
    const rg = spawnSync("rg", ["--files", "-g", glob], {
      cwd: ROOT,
      encoding: "utf8",
    });

    if (rg.status === 1) {
      continue;
    }
    if (rg.status !== 0) {
      throw new Error(rg.stderr || `Failed to glob with rg: ${glob}`);
    }

    for (const line of rg.stdout.split("\n")) {
      const candidate = line.trim();
      if (candidate) {
        out.add(candidate.split(path.sep).join("/"));
      }
    }
  }
  return [...out].sort();
}

function scanFiles(filesToScan) {
  const out = [];

  for (const filePath of filesToScan) {
    const abs = path.resolve(ROOT, filePath);
    const sourceText = fs.readFileSync(abs, "utf8");
    const lines = sourceText.split(/\r?\n/);

    lines.forEach((lineText, index) => {
      for (const rule of RULES) {
        const regex = new RegExp(rule.regex.source, rule.regex.flags);
        const matches = lineText.match(regex);
        if (!matches) {
          continue;
        }
        for (let i = 0; i < matches.length; i += 1) {
          out.push({
            path: filePath,
            rule: rule.id,
            line: index + 1,
          });
        }
      }
    });
  }

  return out;
}

function toCountMap(findingList) {
  const map = new Map();
  for (const item of findingList) {
    const key = `${item.path}::${item.rule}`;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return map;
}

function summarizeByRule(findingList) {
  const totals = {};
  for (const item of findingList) {
    totals[item.rule] = Number(totals[item.rule] ?? 0) + 1;
  }
  return totals;
}
