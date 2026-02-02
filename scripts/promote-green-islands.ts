import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

const projectRoot = process.cwd();
const reportPath = path.join(projectRoot, ".typecheck-telemetry.json");
const configPath = path.join(projectRoot, "config/strict-zones.json");

interface TelemetryReport {
  errorsByPackage: Record<string, number>;
}

interface StrictZonesConfig {
  strict_zones: string[];
}

async function main() {
  console.log("🔍 Scanning for potential Green Island promotions...");

  if (!fs.existsSync(reportPath)) {
    console.log("Generating fresh telemetry report...");
    execSync("pnpm run typecheck:signal:json", { stdio: "inherit" });
  }

  const report: TelemetryReport = JSON.parse(fs.readFileSync(reportPath, "utf-8"));
  const config: StrictZonesConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));

  const currentStrictZones = new Set(config.strict_zones);
  const potentialPromotions: string[] = [];

  for (const [pkg, errorCount] of Object.entries(report.errorsByPackage)) {
    if (errorCount === 0 && !currentStrictZones.has(pkg)) {
      potentialPromotions.push(pkg);
    }
  }

  if (potentialPromotions.length === 0) {
    console.log("✅ No new packages qualify for Green Island status (0 errors).");
    return;
  }

  console.log(`\n🎉 Found ${potentialPromotions.length} potential promotions:`);
  potentialPromotions.forEach((pkg) => console.log(` - ${pkg}`));

  // Automatically update config/strict-zones.json
  config.strict_zones = [...config.strict_zones, ...potentialPromotions].sort();
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

  console.log(`\n✅ Updated ${configPath} with new strict zones.`);
  console.log("Run 'pnpm run typecheck:islands' to verify.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
