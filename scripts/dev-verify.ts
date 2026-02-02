import { execSync, spawnSync } from "child_process";
import * as fs from "fs";
import * as net from "net";
import * as path from "path";

const projectRoot = process.cwd();
const args = process.argv.slice(2);
const shouldFix = args.includes("--fix");

/**
 * VALUEOS IRONCLAD BOOT: Force Determinism at the Gateway
 */

function logTitle(title: string) {
  console.log(`\n=== ${title} ===`);
}

/**
 * Identify and remove conflicting Docker containers and processes.
 */
function remediateDockerConflicts() {
  console.log("🛠️  Remediating potential Docker conflicts...");

  try {
    // SLEDGEHAMMER: Find and kill all related containers
    const output = execSync('docker ps -a --format "{{.Names}}" | grep valueos || true', {
      encoding: "utf-8",
    });
    const containers = output
      .split("\n")
      .map((n) => n.trim())
      .filter((n) => n !== "");

    for (const name of containers) {
      console.log(`🗑️  SLEDGEHAMMER: Forcing removal of container: ${name}`);
      try {
        execSync(`docker rm -f ${name}`, { stdio: "inherit" });
      } catch (e) {
        // Ignored
      }
    }
  } catch (e) {
    // Ignored
  }

  const composeFiles = [".devcontainer/docker-compose.devcontainer.yml", "docker-compose.deps.yml"];
  for (const file of composeFiles) {
    if (fs.existsSync(path.join(projectRoot, file))) {
      console.log(`📉 SLEDGEHAMMER: docker compose -f ${file} down...`);
      try {
        execSync(`docker compose -f ${file} down`, { stdio: "inherit" });
      } catch (e) {
        // Ignored
      }
    }
  }

  const ports = [54321, 54322];
  for (const port of ports) {
    try {
      const pid = execSync(`lsof -t -i :${port}`, { encoding: "utf-8" }).trim();
      if (pid) {
        console.log(`🔫 Port conflict: Port ${port} occupied by PID ${pid}. Purging...`);
        execSync(`kill -9 ${pid}`);
      }
    } catch (e) {
      // No process found or lsof missing
    }
  }
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

    const getKeys = (content: string) => {
      const keys = new Set<string>();
      content.split("\n").forEach((line) => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
          keys.add(trimmed.split("=")[0].trim());
        }
      });
      return keys;
    };

    const envKeys = getKeys(envContent);
    const toAppend: string[] = [];
    const missingKeys: string[] = [];

    for (const line of exampleLines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const key = trimmed.split("=")[0].trim();
      if (key && !envKeys.has(key)) {
        toAppend.push(line);
        missingKeys.push(key);
      }
    }

    if (missingKeys.length > 0) {
      if (shouldFix) {
        console.log(`🛠️  Auto-fixing: Patching .env with ${missingKeys.length} missing keys...`);
        const header = "\n# Added by dev-verify --fix";
        let newContent = envContent;
        if (!newContent.endsWith("\n")) newContent += "\n";

        if (!newContent.includes(header)) {
          newContent += header + "\n";
        }
        newContent += toAppend.join("\n") + "\n";

        fs.writeFileSync(envPath, newContent);
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

function checkPort(port: number, name: string, retries = 1, delay = 500): Promise<boolean> {
  return new Promise(async (resolve) => {
    for (let i = 0; i < retries; i++) {
      const success = await new Promise<boolean>((res) => {
        const socket = new net.Socket();
        const timeout = 1000;
        socket.setTimeout(timeout);

        socket.on("connect", () => {
          socket.destroy();
          res(true);
        });

        socket.on("error", () => res(false));
        socket.on("timeout", () => {
          socket.destroy();
          res(false);
        });

        socket.connect(port, "127.0.0.1");
      });

      if (success) {
        console.log(`✅ ${name} reachable on port ${port}`);
        resolve(true);
        return;
      }

      if (i < retries - 1) {
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    resolve(false);
  });
}

function checkDockerImages(): boolean {
  console.log("🔍 Checking required Docker images...");
  const required = ["postgres:15-alpine", "kong/kong-gateway"];
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
  } catch (e) {
    return false;
  }
}

function checkSchemaDrift(): boolean {
  const driftScript = "infra/scripts/check_drift.sh";
  if (!fs.existsSync(path.join(projectRoot, driftScript))) {
    console.log("⚠️ Schema drift script missing. Skipping check.");
    return true;
  }

  try {
    execSync(`bash ${driftScript}`, { stdio: "pipe" });
    console.log("✅ Database schema aligned.");
    return true;
  } catch (e) {
    console.error("⚠️ Database schema drift detected!");
    return true; // Don't block boot
  }
}

function checkSignalBaseline(): boolean {
  const baselinePath = path.join(projectRoot, "ts-signal-report.json");
  if (!fs.existsSync(baselinePath)) {
    console.error("❌ Typecheck signal baseline (ts-signal-report.json) missing.");
    console.error("👉 Run 'pnpm run typecheck:signal' to generate it.");
    return false;
  }
  console.log("✅ Typecheck signal baseline found.");
  return true;
}

async function main() {
  logTitle("VALUEOS IRONCLAD BOOT: Force Determinism at the Gateway");

  if (shouldFix) {
    console.log("🛠️  Tier 0: Clearing network conflicts...");
    try {
      execSync("docker network prune -f", { stdio: "inherit" });
    } catch (e) {}
  }

  const v = checkVersion("node") && checkVersion("pnpm") && checkVersion("docker");
  const env = checkEnv();
  const gov = checkGovernanceIntegrity();
  const img = checkDockerImages();
  const sig = checkSignalBaseline();

  let pg = await checkPort(54322, "Postgres (Primary)", 2, 200);
  if (!pg) {
    pg = await checkPort(5432, "Postgres (Legacy/Deps)", 1, 0);
  }

  let kg = await checkPort(54321, "Kong Gateway", 2, 200);

  if ((!pg || !kg) && shouldFix) {
    remediateDockerConflicts();
    console.log(
      "🛠️  Auto-fixing: Starting infrastructure via 'bash scripts/dev/start-dev-env.sh'..."
    );
    try {
      execSync("bash scripts/dev/start-dev-env.sh", { stdio: "inherit" });

      console.log("⏳ Waiting for health checks (10s)...");
      await new Promise((r) => setTimeout(r, 10000));
      pg =
        (await checkPort(54322, "Postgres (Primary)", 3, 1000)) ||
        (await checkPort(5432, "Postgres (Legacy/Deps)", 1, 0));
      kg = await checkPort(54321, "Kong Gateway", 3, 1000);
    } catch (e) {
      console.error(
        "❌ Failed to orchestrate infrastructure. Suggestion: Check 'docker ps -a' for naming conflicts or 'docker logs' for service failures."
      );
    }
  }

  const sch = pg ? checkSchemaDrift() : false;

  const allPassed = v && env && gov && img && sig && pg && kg && sch;

  if (!allPassed) {
    console.error("\n🛑 Gateway Closed: Environment is non-deterministic.");
    console.error("Run 'pnpm dev:verify --fix' to force determinism at the gateway.");
    process.exit(1);
  }

  console.log("\n✅ Determinism Guaranteed. Force Determinism at the Gateway: SUCCESS.");
  spawnSync("pnpm", ["dx:doctor", "--soft"], { stdio: "inherit" });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
