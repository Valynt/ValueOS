import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

const projectRoot = process.cwd();
const reportPath = path.join(projectRoot, ".typecheck-telemetry.json");
const configPath = path.join(projectRoot, "config/strict-zones.json");
const summaryPath = path.join(projectRoot, "GOVERNANCE_PULSE.md");
const workspaceMapPath = path.join(projectRoot, "workspace_map.json");

interface TelemetryReport {
  totalErrors: number;
  filesWithErrors: number;
  errorsByPackage: Record<string, number>;
}

interface StrictZonesConfig {
  strict_zones: string[];
}

interface PackageInfo {
  name: string;
  dependencies: Record<string, string>;
}

function getDependencyGraph(): Record<string, PackageInfo> {
  const pnpmLock = fs.readFileSync("pnpm-lock.yaml", "utf-8");
  // Parse pnpm-lock.yaml for workspace dependencies
  // Simplified parsing - in practice, use a proper YAML parser
  const graph: Record<string, PackageInfo> = {};
  // ... implementation to build graph from lockfile
  return graph;
}

function isTopologicallyHealthy(
  packageName: string,
  graph: Record<string, PackageInfo>,
  strictZones: string[]
): boolean {
  const pkg = graph[packageName];
  if (!pkg) return false;

  for (const dep of Object.keys(pkg.dependencies)) {
    if (dep.startsWith("@valynt/") && !strictZones.includes(dep.replace("@valynt/", "packages/"))) {
      return false; // Dependency not in strict zone
    }
  }
  return true;
}

function getWorkspaceGraph(): { graph: Record<string, string[]>; pathMap: Record<string, string> } {
  if (!fs.existsSync(workspaceMapPath)) {
    execSync("pnpm list -r --json > workspace_map.json");
  }
  const data: any[] = JSON.parse(fs.readFileSync(workspaceMapPath, "utf-8"));
  const graph: Record<string, string[]> = {};
  const pathMap: Record<string, string> = {};

  data.forEach((pkg) => {
    const relPath = path.relative(projectRoot, pkg.path) || ".";
    pathMap[relPath] = pkg.name;

    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    const internalDeps = Object.entries(deps)
      .filter(([_, info]: [any, any]) => {
        const version = typeof info === "string" ? info : info.version;
        return version && (version.startsWith("link:") || version.startsWith("workspace:"));
      })
      .map(([name, _]) => name);
    graph[pkg.name] = internalDeps;
  });

  return { graph, pathMap };
}

async function main() {
  console.log("🔍 Scanning for potential Green Island promotions (Topological Analysis)...");

  if (!fs.existsSync(reportPath)) {
    console.log("Generating fresh telemetry report...");
    execSync("pnpm run typecheck:signal:json", { stdio: "inherit" });
  }

  const report: TelemetryReport = JSON.parse(fs.readFileSync(reportPath, "utf-8"));
  const config: StrictZonesConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  const { graph, pathMap } = getWorkspaceGraph();

  const nameToPathMap: Record<string, string> = {};
  for (const [p, n] of Object.entries(pathMap)) {
    nameToPathMap[n] = p;
  }

  const currentStrictZones = new Set(config.strict_zones);
  const potentialPromotions: string[] = [];
  const blockers: Record<string, string[]> = {};

  const eligibleCandidates = Object.entries(report.errorsByPackage)
    .filter(([path, errorCount]) => errorCount === 0 && !currentStrictZones.has(path))
    .map(([path]) => path);

  for (const pkgPath of eligibleCandidates) {
    const pkgName = pathMap[pkgPath];
    if (!pkgName) continue;

    const deps = graph[pkgName] || [];
    const dirtyDeps = deps.filter((depName) => {
      const depPath = nameToPathMap[depName];
      if (!depPath) return false;
      return !currentStrictZones.has(depPath) && (report.errorsByPackage[depPath] || 0) > 0;
    });

    if (dirtyDeps.length === 0) {
      potentialPromotions.push(pkgPath);
    } else {
      blockers[pkgPath] = dirtyDeps.map((d) => nameToPathMap[d] || d);
    }
  }

  let markdown = "# Quality Governor: Governance Pulse\n\n";
  const errorDensity = ((report.filesWithErrors / 1397) * 100).toFixed(1);

  markdown += `**Scorecard:**\n`;
  markdown += `- **Total Errors:** \`${report.totalErrors}\` \n`;
  markdown += `- **Error Density:** \`${errorDensity}%\` of files impacted\n`;
  markdown += `- **Island Coverage:** \`${currentStrictZones.size + potentialPromotions.length}\` packages locked\n\n`;

  markdown += "## 🏝️ Green Island Status\n";
  markdown += "| Package | Status | Errors | Dependency Health |\n";
  markdown += "| :--- | :--- | :--- | :--- |\n";

  const allPackages = Object.keys(report.errorsByPackage).sort();
  for (const pkgPath of allPackages) {
    const isStrict = currentStrictZones.has(pkgPath);
    const isNew = potentialPromotions.includes(pkgPath);
    const errors = report.errorsByPackage[pkgPath];

    let status = "🌊 Debt";
    if (isStrict) status = "✅ Strict";
    else if (isNew) status = "🚀 Promoted";
    else if (errors === 0) status = "⚠️ Blocked";

    const pkgName = pathMap[pkgPath];
    const deps = pkgName ? graph[pkgName] || [] : [];
    const health = deps.length === 0 ? "🍃 Leaf" : `🔗 ${deps.length} deps`;

    markdown += `| \`${pkgPath}\` | ${status} | ${errors} | ${health} |\n`;
  }

  if (Object.keys(blockers).length > 0) {
    markdown += "\n### 🧱 Promotion Blockers\n";
    markdown += "The following packages have 0 errors but depend on 'Dirty' packages:\n";
    for (const [pkg, deps] of Object.entries(blockers)) {
      markdown += `- \`${pkg}\` blocked by: ${deps.map((d) => `\`${d}\``).join(", ")}\n`;
    }
  }

  if (potentialPromotions.length > 0) {
    markdown += "\n### 📈 Active Promotions\n";
    potentialPromotions.forEach((pkg) => {
      markdown += `- \`${pkg}\` (Topologically verified)\n`;
    });

    config.strict_zones = [...config.strict_zones, ...potentialPromotions].sort();
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log(`\n✅ Promoted ${potentialPromotions.length} packages to Green Island status.`);
  }

  fs.writeFileSync(summaryPath, markdown);
  console.log(`\n📊 Governance Pulse report saved to ${summaryPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
