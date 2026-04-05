#!/usr/bin/env tsx
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { pathToFileURL } from "node:url";

type LegacyZone = {
  name: string;
  path: string;
  characterizationPatterns: string[];
};

type DebtHeavyModule = {
  name: string;
  path: string;
  complexityBaseline: number;
  churnBaseline: number;
};

type StrictIsland = {
  name: string;
  path: string;
};

type Config = {
  legacyZones: LegacyZone[];
  debtHeavyModules: DebtHeavyModule[];
  strictIslands: StrictIsland[];
};

type Numstat = {
  added: number;
  deleted: number;
};

type ServiceDelta = {
  service: string;
  files: number;
  added: number;
  deleted: number;
  complexityDelta: number;
};

const repoRoot = process.cwd();
const configPath = path.join(repoRoot, "config/legacy-risk-gates.json");
const reportPath = path.join(repoRoot, "artifacts/legacy-risk-report.md");
const reportJsonPath = path.join(repoRoot, "artifacts/legacy-risk-report.json");

function sh(cmd: string): string {
  return execSync(cmd, { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] }).trim();
}

function trySh(cmd: string): string | null {
  try {
    return sh(cmd);
  } catch {
    return null;
  }
}

function toPosix(value: string): string {
  return value.replace(/\\/g, "/");
}

function loadConfig(): Config {
  return JSON.parse(fs.readFileSync(configPath, "utf8")) as Config;
}

export function getMissingLegacyZonePaths(config: Config, rootDir: string): LegacyZone[] {
  return config.legacyZones.filter((zone) => !fs.existsSync(path.join(rootDir, zone.path)));
}

function getArg(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index > -1 ? process.argv[index + 1] : null;
}

function resolveBaseSha(): string {
  const explicitBase = getArg("--base") || process.env.GITHUB_BASE_SHA;
  if (explicitBase) {
    return explicitBase;
  }

  const mergeBase = trySh("git merge-base origin/main HEAD");
  if (mergeBase) {
    return mergeBase;
  }

  return sh("git rev-parse HEAD~1");
}

function resolveHeadSha(): string {
  return getArg("--head") || process.env.GITHUB_HEAD_SHA || sh("git rev-parse HEAD");
}

function getChangedFiles(base: string, head: string): string[] {
  const output = sh(`git diff --name-only --diff-filter=ACMR ${base}...${head}`);
  if (!output) {
    return [];
  }

  return output
    .split("\n")
    .map((file) => toPosix(file.trim()))
    .filter(Boolean);
}

function getChangedTestFiles(base: string, head: string): string[] {
  const output = sh(`git diff --name-only --diff-filter=ACMR ${base}...${head}`);
  if (!output) {
    return [];
  }

  return output
    .split("\n")
    .map((file) => toPosix(file.trim()))
    .filter((file) => /(?:__tests__|\.test\.|\.spec\.)/.test(file));
}

function getAddedImportLines(base: string, head: string, filePath: string): string[] {
  const raw = trySh(`git diff -U0 ${base}...${head} -- ${filePath}`);
  if (!raw) {
    return [];
  }

  return raw
    .split("\n")
    .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
    .map((line) => line.slice(1).trim())
    .filter((line) => line.startsWith("import ") || line.includes("require("));
}

function readFileAtRev(rev: string, filePath: string): string {
  const result = trySh(`git show ${rev}:${filePath}`);
  return result ?? "";
}

function computeComplexityScore(source: string): number {
  const matches = source.match(/\b(if|for|while|case|catch|&&|\|\||\?)\b/g);
  return matches ? matches.length : 0;
}

function parseNumstat(base: string, head: string): Map<string, Numstat> {
  const map = new Map<string, Numstat>();
  const output = sh(`git diff --numstat ${base}...${head}`);
  if (!output) {
    return map;
  }

  for (const line of output.split("\n")) {
    const [addedRaw, deletedRaw, file] = line.split("\t");
    if (!file) {
      continue;
    }

    map.set(toPosix(file), {
      added: Number.parseInt(addedRaw, 10) || 0,
      deleted: Number.parseInt(deletedRaw, 10) || 0,
    });
  }

  return map;
}

function getServiceName(filePath: string): string {
  const parts = toPosix(filePath).split("/");
  if (parts.length >= 2 && (parts[0] === "apps" || parts[0] === "packages")) {
    return `${parts[0]}/${parts[1]}`;
  }

  return "root";
}

function matchesPattern(filePath: string, pattern: string): boolean {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "::DOUBLE_STAR::")
    .replace(/\*/g, "[^/]*")
    .replace(/::DOUBLE_STAR::/g, ".*");

  const regex = new RegExp(`^${escaped}$`);
  return regex.test(toPosix(filePath));
}

function hasCharacterizationSignal(filePath: string): boolean {
  const content = fs.readFileSync(path.join(repoRoot, filePath), "utf8");
  return /@characterization|characterization|legacy behavior/i.test(content);
}

function writeReport(markdown: string, payload: Record<string, unknown>): void {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, markdown);
  fs.writeFileSync(reportJsonPath, JSON.stringify(payload, null, 2));

  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`);
  }
}

function main(): void {
  const config = loadConfig();
  const base = resolveBaseSha();
  const head = resolveHeadSha();

  const changedFiles = getChangedFiles(base, head);
  const changedTests = getChangedTestFiles(base, head);
  const numstat = parseNumstat(base, head);

  const failures: string[] = [];

  const missingLegacyZonePaths = getMissingLegacyZonePaths(config, repoRoot);
  for (const zone of missingLegacyZonePaths) {
    failures.push(
      `Legacy zone '${zone.name}' is configured with missing path '${zone.path}'. Remove or relocate this legacy zone configuration.`
    );
  }

  const legacySourceFiles = changedFiles.filter((file) =>
    config.legacyZones.some((zone) => file.startsWith(toPosix(zone.path)))
  );

  for (const zone of config.legacyZones) {
    const zoneChanges = legacySourceFiles.filter((file) => file.startsWith(toPosix(zone.path)));
    if (zoneChanges.length === 0) {
      continue;
    }

    const hasZoneCharacterization = changedTests.some((testFile) =>
      zone.characterizationPatterns.some((pattern) => matchesPattern(testFile, pattern))
    );

    const hasSignal = hasZoneCharacterization
      ? changedTests.some(
          (testFile) =>
            zone.characterizationPatterns.some((pattern) => matchesPattern(testFile, pattern)) &&
            hasCharacterizationSignal(testFile)
        )
      : false;

    if (!hasZoneCharacterization || !hasSignal) {
      failures.push(
        `Legacy zone '${zone.name}' changed (${zoneChanges.length} files) without a changed characterization test matching ${zone.characterizationPatterns.join(", ")}.`
      );
    }
  }

  const debtDeltas = config.debtHeavyModules.map((module) => {
    const touched = changedFiles.filter((file) => file.startsWith(toPosix(module.path)));

    const complexity = touched.reduce((acc, filePath) => {
      const fullPath = path.join(repoRoot, filePath);
      if (!fs.existsSync(fullPath)) {
        return acc;
      }
      return acc + computeComplexityScore(fs.readFileSync(fullPath, "utf8"));
    }, 0);

    const churn = touched.reduce((acc, filePath) => {
      const stat = numstat.get(filePath);
      return acc + (stat?.added ?? 0) + (stat?.deleted ?? 0);
    }, 0);

    if (complexity > module.complexityBaseline) {
      failures.push(
        `Debt-heavy module '${module.name}' complexity ${complexity} exceeds baseline ${module.complexityBaseline}.`
      );
    }

    if (churn > module.churnBaseline) {
      failures.push(
        `Debt-heavy module '${module.name}' churn ${churn} exceeds baseline ${module.churnBaseline}.`
      );
    }

    return {
      module: module.name,
      touchedFiles: touched.length,
      complexity,
      complexityBaseline: module.complexityBaseline,
      complexityDelta: complexity - module.complexityBaseline,
      churn,
      churnBaseline: module.churnBaseline,
      churnDelta: churn - module.churnBaseline,
    };
  });

  const strictPrefixes = config.strictIslands.map((island) => toPosix(island.path));
  const strictViolations: Array<{ file: string; importLine: string }> = [];

  for (const filePath of legacySourceFiles) {
    const addedImports = getAddedImportLines(base, head, filePath);
    for (const importLine of addedImports) {
      if (strictPrefixes.some((prefix) => importLine.includes(prefix))) {
        strictViolations.push({ file: filePath, importLine });
      }
    }
  }

  if (strictViolations.length > 0) {
    failures.push(
      `Detected ${strictViolations.length} strict-island dependency edge(s) added from legacy code.`
    );
  }

  const serviceMap = new Map<string, ServiceDelta>();
  for (const filePath of changedFiles) {
    const service = getServiceName(filePath);
    const stat = numstat.get(filePath) || { added: 0, deleted: 0 };

    const current = fs.existsSync(path.join(repoRoot, filePath))
      ? fs.readFileSync(path.join(repoRoot, filePath), "utf8")
      : "";
    const previous = readFileAtRev(base, filePath);

    const complexityDelta = computeComplexityScore(current) - computeComplexityScore(previous);

    const snapshot = serviceMap.get(service) || {
      service,
      files: 0,
      added: 0,
      deleted: 0,
      complexityDelta: 0,
    };

    snapshot.files += 1;
    snapshot.added += stat.added;
    snapshot.deleted += stat.deleted;
    snapshot.complexityDelta += complexityDelta;
    serviceMap.set(service, snapshot);
  }

  const perService = [...serviceMap.values()].sort((a, b) => a.service.localeCompare(b.service));

  const debtRows = debtDeltas
    .map(
      (item) =>
        `| ${item.module} | ${item.touchedFiles} | ${item.complexity} (${item.complexityDelta >= 0 ? "+" : ""}${item.complexityDelta}) | ${item.churn} (${item.churnDelta >= 0 ? "+" : ""}${item.churnDelta}) |`
    )
    .join("\n");

  const serviceRows = perService
    .map(
      (item) =>
        `| ${item.service} | ${item.files} | +${item.added} / -${item.deleted} | ${item.complexityDelta >= 0 ? "+" : ""}${item.complexityDelta} |`
    )
    .join("\n");

  const strictViolationsBlock =
    strictViolations.length === 0
      ? "- None"
      : strictViolations
          .map((violation) => `- ${violation.file}: \`${violation.importLine}\``)
          .join("\n");

  const markdown = `## Legacy Risk Quality Gates\n\n- Base: \`${base}\`\n- Head: \`${head}\`\n- Changed files: **${changedFiles.length}**\n\n### Debt-Heavy Module Deltas\n| Module | Touched Files | Complexity (Δ vs baseline) | Churn (Δ vs baseline) |\n|---|---:|---:|---:|\n${debtRows || "| _none_ | 0 | 0 | 0 |"}\n\n### Per-Service PR Trend Deltas\n| Service | Files | Churn (+/-) | Complexity Δ |\n|---|---:|---:|---:|\n${serviceRows || "| _none_ | 0 | 0 | 0 |"}\n\n### Strict-Island Boundary Violations\n${strictViolationsBlock}\n\n### Gate Result\n${failures.length === 0 ? "✅ Passed" : "❌ Failed"}\n${failures.map((f) => `- ${f}`).join("\n")}`;

  const payload = {
    base,
    head,
    changedFiles,
    missingLegacyZonePaths: missingLegacyZonePaths.map((zone) => ({
      name: zone.name,
      path: zone.path,
    })),
    debtDeltas,
    perService,
    strictViolations,
    failures,
  };

  writeReport(markdown, payload);

  if (failures.length > 0) {
    console.error(markdown);
    process.exit(1);
  }

  console.log(markdown);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
