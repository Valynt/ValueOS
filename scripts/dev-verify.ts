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
 * CORE PRINCIPLE: Force Determinism at the Gateway.
 * 
 * Optimized for zero-dependency execution.
 */

function logTitle(title: string) {
  console.log(`\n=== ${title} ===`);
}

function checkVersion(command: string): boolean {
  try {
    const version = execSync(`${command} --version`, { encoding: "utf-8" }).trim();
    console.log(`✅ ${command} version: ${version}`);
    return true;
  } catch (error) {
    console.error(`❌ ${command} not found or failed.`);
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
    const exampleLines = fs.readFileSync(examplePath, "utf8").split("\n");
    
    const getKeys = (content: string) => 
      content.split("\n")
        .filter(l => l.trim() && !l.trim().startsWith("#"))
        .map(l => l.split("=")[0].trim())
        .filter(k => k);

    const envKeys = getKeys(envContent);
    const missingLines: string[] = [];
    const missingKeys: string[] = [];

    for (const line of exampleLines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const key = trimmed.split("=")[0].trim();
      if (key && !envKeys.includes(key)) {
        missingLines.push(line);
        missingKeys.push(key);
      }
    }

    if (missingKeys.length > 0) {
      if (shouldFix) {
        console.log(`🛠️  Auto-fixing: Patching .env with ${missingKeys.length} missing keys...`);
        fs.appendFileSync(envPath, "\n# Added by dev-verify --fix\n" + missingLines.join("\n") + "\n");
        console.log("✅ .env patched.");
        return true;
      } else {
        console.error(`❌ .env is missing keys from .env.example: ${missingKeys.join(", ")}`);
        return false;
      }
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
      console.log(`✅ ${name} reachable on port ${port}`);
      socket.destroy();
      resolve(true);
    });

    socket.on("error", () => { resolve(false); });
    socket.on("timeout", () => { socket.destroy(); resolve(false); });

    socket.connect(port, "127.0.0.1");
  });
}

function checkDockerImages(): boolean {
  console.log("🔍 Checking required Docker images...");
  const required = ["postgres:15-alpine", "localstack/localstack", "kong/kong-gateway"];
  let allPresent = true;

  for (const img of required) {
    try {
      execSync(`docker image inspect ${img}`, { stdio: "pipe" });
    } catch (e) {
      if (shouldFix) {
        console.log(`🛠️  Auto-fixing: Pulling ${img}...`);
        try {
           execSync(`docker pull ${img}`, { stdio: "inherit" });
        } catch (pullError) {
           console.error(`❌ Failed to pull ${img}`);
           allPresent = false;
        }
      } else {
        console.warn(`⚠️  Missing Docker image: ${img}`);
        allPresent = false;
      }
    }
  }
  return allPresent;
}

function checkGovernanceIntegrity(): boolean {
  const configPath = path.join(projectRoot, "config/strict-zones.json");
  if (!fs.existsSync(configPath)) return true;

  try {
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    const zones: string[] = config.strict_zones || [];
    let allValid = true;

    for (const zone of zones) {
      if (!fs.existsSync(path.join(projectRoot, zone))) {
        console.error(`❌ Orphaned Island: Strict zone '${zone}' does not exist.`);
        allValid = false;
      }
    }
    return allValid;
  } catch (e) { return false; }
}

function checkSchemaDrift(): boolean {
  try {
    execSync("bash infra/scripts/check_drift.sh", { stdio: "pipe" });
    console.log("✅ Database schema aligned.");
    return true;
  } catch (e) {
    console.error("❌ Database schema drift detected!");
    return false;
  }
}

async function main() {
  logTitle("VALUEOS IRONCLAD BOOT: Force Determinism at the Gateway");

  const v = checkVersion("node") && checkVersion("pnpm") && checkVersion("docker");
  const env = checkEnv();
  const gov = checkGovernanceIntegrity();
  const img = checkDockerImages();
  
  let pg = await checkPort(5432, "Postgres");
  let ls = await checkPort(4566, "LocalStack");

  if ((!pg || !ls) && shouldFix) {
    console.log("🛠️  Auto-fixing: Starting infrastructure...");
    const composeCmd = "docker compose -f docker-compose.deps.yml";
    try {
      try {
        execSync(`${composeCmd} up -d`, { stdio: "inherit" });
      } catch (e) {
        console.warn("⚠️  Initial 'up' failed (likely name conflict). Attempting 'down' then 'up'...");
        execSync(`${composeCmd} down`, { stdio: "inherit" });
        execSync(`${composeCmd} up -d`, { stdio: "inherit" });
      }
      
      console.log("⏳ Waiting for health checks...");
      await new Promise(r => setTimeout(r, 5000));
      pg = await checkPort(5432, "Postgres");
      ls = await checkPort(4566, "LocalStack");
    } catch (e) {
      console.error("❌ Failed to orchestrate Docker containers.");
    }
  }

  const sch = pg ? checkSchemaDrift() : false;

  const allPassed = v && env && gov && img && pg && ls && sch;

  if (!allPassed) {
    console.error("\n🛑 Gateway Closed: Environment is non-deterministic.");
    console.error("Run 'pnpm dev:verify --fix' to force determinism at the gateway.");
    process.exit(1);
  }

  console.log("\n✅ Determinism Guaranteed. Force Determinism at the Gateway: SUCCESS.");
  spawnSync("pnpm", ["dx:doctor", "--soft"], { stdio: "inherit" });
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
