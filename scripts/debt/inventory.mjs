#!/usr/bin/env node
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const args = new Set(process.argv.slice(2));
const writeBaseline = args.has("--write-baseline");
const baselinePath = path.join(repoRoot, "config/debt-baseline.json");
const strictZonesConfigPath = path.join(repoRoot, "config/debt-strict-zones.json");

function loadStrictZones() {
  const fallback = path.join(repoRoot, "config/strict-zones.json");
  const configPath = fs.existsSync(strictZonesConfigPath) ? strictZonesConfigPath : fallback;
  const raw = JSON.parse(fs.readFileSync(configPath, "utf8"));
  return raw.strict_zones ?? [];
}

function listCodeFiles() {
  const output = execSync(`rg --files -g '*.{ts,tsx,js,jsx,mjs,cjs,tf}' apps packages scripts infra`, {
    encoding: "utf8",
  });
  return output.split("\n").filter(Boolean);
}

function inStrictZone(file, strictZones) {
  return strictZones.some((zone) => file === zone || file.startsWith(`${zone}/`));
}

function collectTodoStats(strictZones) {
  const entries = [];
  const malformedStrict = [];
  const files = listCodeFiles();
  const requiredFormat = /(TODO|FIXME)\(ticket:[^\s)]+\s+owner:[^\s)]+\s+date:\d{4}-\d{2}-\d{2}\)/;

  for (const file of files) {
    const text = fs.readFileSync(path.join(repoRoot, file), "utf8");
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      if (!/(TODO|FIXME)/.test(lines[i])) continue;
      const strict = inStrictZone(file, strictZones);
      entries.push({ file, line: i + 1, strict, text: lines[i].trim() });
      if (strict && !requiredFormat.test(lines[i])) {
        malformedStrict.push({ file, line: i + 1, text: lines[i].trim() });
      }
    }
  }

  return {
    total: entries.length,
    strict: entries.filter((entry) => entry.strict).length,
    malformedStrict,
  };
}

function collectDeadExports(strictZones) {
  const cmd = "npx ts-prune -p packages/backend/tsconfig.json";
  let stdout = "";
  try {
    stdout = execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (error) {
    stdout = error.stdout?.toString() ?? "";
  }

  const lines = stdout
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("packages/"))
    .map((line) => {
      const [loc, symbolRaw] = line.split(" - ");
      return { location: loc, symbol: symbolRaw ?? "" };
    });

  return {
    total: lines.length,
    strict: lines.filter((entry) => inStrictZone(entry.location.split(":")[0], strictZones)).length,
    top20: lines.slice(0, 20),
  };
}

const strictZones = loadStrictZones();
const todoStats = collectTodoStats(strictZones);
const deadExportStats = collectDeadExports(strictZones);

const report = {
  generated_at: new Date().toISOString(),
  strict_zones: strictZones,
  todo_fixme: todoStats,
  dead_exports: deadExportStats,
};

fs.writeFileSync(
  path.join(repoRoot, "docs/debt/inventory-report.json"),
  `${JSON.stringify(report, null, 2)}\n`
);

const top20Md = [
  "# Top 20 dead/unused export candidates",
  "",
  "Source: `npx ts-prune -p packages/backend/tsconfig.json`.",
  "",
  ...deadExportStats.top20.map(
    (entry, index) => `${index + 1}. \`${entry.location}\` — \`${entry.symbol}\``
  ),
  "",
].join("\n");
fs.writeFileSync(path.join(repoRoot, "docs/debt/top-20-dead-exports.md"), top20Md);

if (writeBaseline) {
  const baseline = {
    updated_at: new Date().toISOString(),
    strict_zones: strictZones,
    strict_todo_fixme_count: todoStats.strict,
    strict_dead_export_count: deadExportStats.strict,
  };
  fs.writeFileSync(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`);
  console.log(`Wrote baseline to ${path.relative(repoRoot, baselinePath)}`);
  process.exit(0);
}

if (!fs.existsSync(baselinePath)) {
  console.error(
    "Missing config/debt-baseline.json. Run: node scripts/debt/inventory.mjs --write-baseline"
  );
  process.exit(1);
}

const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
let failed = false;

if (todoStats.strict > baseline.strict_todo_fixme_count) {
  console.error(
    `Strict-zone TODO/FIXME count increased: ${todoStats.strict} > ${baseline.strict_todo_fixme_count}`
  );
  failed = true;
}

if (deadExportStats.strict > baseline.strict_dead_export_count) {
  console.error(
    `Strict-zone dead-export count increased: ${deadExportStats.strict} > ${baseline.strict_dead_export_count}`
  );
  failed = true;
}

if (todoStats.malformedStrict.length > 0) {
  console.error(
    "Malformed TODO/FIXME annotations in strict zones (must include ticket/owner/date):"
  );
  for (const entry of todoStats.malformedStrict) {
    console.error(`- ${entry.file}:${entry.line} ${entry.text}`);
  }
  failed = true;
}

console.log(`TODO/FIXME total=${todoStats.total}, strict=${todoStats.strict}`);
console.log(`Dead exports total=${deadExportStats.total}, strict=${deadExportStats.strict}`);

if (failed) process.exit(1);
