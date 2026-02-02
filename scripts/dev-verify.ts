import { execSync, spawnSync } from "child_process";
import * as fs from "fs";
import * as net from "net";
import * as path from "path";

const projectRoot = process.cwd();
const args = process.argv.slice(2);
const shouldFix = args.includes("--fix");

/**
 * ValueOS Dev Verify (The Ironclad Boot)
 * 
 * Optimized for zero-dependency execution.
 * Tiers:
 * - Tier 0: Node/PNPM/Docker/Port readiness
 * - Tier 1: .env parity
 * - Tier 2: Governance Integrity (Strict Zones)
 * - Tier 3: Schema Schema (Drift Check)
 * - Tier 4: Hand-off to DX Doctor (soft)
 */

function checkVersion(command: string): boolean {
  try {
    const version = execSync(\`\${command} --version\`, { encoding: "utf8" }).trim();
    console.log(\`✅ \${command} version: \${version}\`);
    return true;
  } catch (error) {
    console.error(\`❌ \${command} not found or failed.\`);
    return false;
  }
}

function checkEnv(): boolean {
  const envPath = path.join(projectRoot, ".env");
  const examplePath = path.join(projectRoot, ".env.example");

  if (!fs.existsSync(envPath)) {
    if (shouldFix && fs.existsSync(examplePath)) {
      console.log("🛠️  Auto-fixing: Copying .env.example to .env...");
      fs.copyFileSync(examplePath, envPath);
    } else {
      console.error("❌ .env file missing. Run 'pnpm run dx:env' or copy .env.example.");
      return false;
    }
  }

  if (!fs.existsSync(examplePath)) {
    console.warn("⚠️ .env.example missing, skipping parity check.");
    return true;
  }

  try {
    const envContent = fs.readFileSync(envPath, "utf8");
    const exampleContent = fs.readFileSync(examplePath, "utf8");
    
    const getKeys = (content: string) => 
      content.split("\n")
        .filter(l => l.trim() && !l.trim().startsWith("#"))
        .map(l => l.split("=")[0].trim())
        .filter(k => k);

    const envKeys = getKeys(envContent);
    const exampleKeys = getKeys(exampleContent);

    const missing = exampleKeys.filter(k => !envKeys.includes(k));
    if (missing.length > 0) {
      console.error(\`❌ .env is missing keys from .env.example: \${missing.join(", ")}\`);
      return false;
    }

    console.log("✅ .env parity validated.");
    return true;
  } catch (error) {
    console.error("❌ Failed to validate .env parity:", error);
    return false;
  }
}

function checkPort(port: number, name: string): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const timeout = 1000;
    socket.setTimeout(timeout);

    socket.on("connect", () => {
      console.log(\`✅ \${name} reachable on port \${port}\`);
      socket.destroy();
      resolve(true);
    });

    socket.on("error", () => {
      resolve(false);
    });

    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });

    socket.connect(port, "127.0.0.1");
  });
}

function checkGovernanceIntegrity(): boolean {
  const configPath = path.join(projectRoot, "config/strict-zones.json");
  if (!fs.existsSync(configPath)) {
    console.warn("⚠️ config/strict-zones.json missing, skipping governance check.");
    return true;
  }

  try {
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    const zones: string[] = config.strict_zones || [];
    let allValid = true;

    for (const zone of zones) {
      const zonePath = path.join(projectRoot, zone);
      if (!fs.existsSync(zonePath)) {
        console.error(\`❌ Orphaned Island: Strict zone '\${zone}' does not exist.\`);
        allValid = false;
        continue;
      }

      const hasTsConfig = fs.existsSync(path.join(zonePath, "tsconfig.json"));
      if (!hasTsConfig) {
        console.error(\`❌ Invalid Island: Strict zone '\${zone}' lacks a tsconfig.json.\`);
        allValid = false;
      }
    }

    if (allValid) {
      console.log("✅ Governance integrity (Strict Zones) validated.");
    }
    return allValid;
  } catch (error) {
    console.error("❌ Failed to validate governance integrity:", error);
    return false;
  }
}

function checkSchemaDrift(): boolean {
  console.log("🔍 Checking for database schema drift...");
  try {
    execSync("bash infra/scripts/check_drift.sh", { stdio: "pipe" });
    console.log("✅ Database schema is aligned with migrations.");
    return true;
  } catch (error) {
    console.error("❌ Database schema drift detected!");
    return false;
  }
}

/**
 * Bridge logic to DX Doctor
 */
function runSoftDoctor(): void {
  console.log("🔍 Running DX Doctor (soft mode)...");
  try {
    spawnSync("pnpm", ["dx:doctor", "--soft"], { stdio: "inherit" });
  } catch (e) {
    console.warn("⚠️ DX Doctor check failed (non-blocking).");
  }
}

async function main() {
  console.log("--- ValueOS Pre-flight Verification ---");

  const versions = checkVersion("node") && checkVersion("pnpm");
  const env = checkEnv();
  const governance = checkGovernanceIntegrity();
  
  // Infrastructure check with auto-remediation attempt
  let postgres = await checkPort(5432, "Postgres");
  let localstack = await checkPort(4566, "LocalStack");

  if ((!postgres || !localstack) && shouldFix) {
    console.log("🛠️  Auto-fixing: Attempting to start infrastructure via Docker...");
    try {
      execSync("docker compose up -d postgres localstack", { stdio: "inherit" });
      await new Promise(resolve => setTimeout(resolve, 3000));
      postgres = await checkPort(5432, "Postgres");
      localstack = await checkPort(4566, "LocalStack");
    } catch (e) {
      console.error("❌ Failed to auto-start Docker containers.");
    }
  }

  if (!postgres) console.error("❌ Postgres NOT reachable on port 5432");
  if (!localstack) console.error("❌ LocalStack NOT reachable on port 4566");

  // Schema drift check (only if postgres is up)
  const schema = postgres ? checkSchemaDrift() : false;

  const allPassed = versions && env && governance && postgres && localstack && schema;

  if (!allPassed) {
    console.error("\n🛑 Environment verification failed.");
    console.error("Please fix the issues above or run 'pnpm dev:verify --fix'.");
    process.exit(1);
  }

  console.log("\n🚀 All core systems ready.");
  
  if (process.env.CI !== "true" && !args.includes("--quick")) {
    runSoftDoctor();
  }
  
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
