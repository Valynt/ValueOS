import { execSync, spawnSync } from "child_process";
import * as fs from "fs";
import * as net from "net";
import * as path from "path";

const projectRoot = process.cwd();

/**
 * ValueOS Dev Verify (The Ironclad Boot)
 * 
 * Optimized for zero-dependency execution.
 * Tiers:
 * - Tier 0: Node/PNPM/Docker/Port readiness
 * - Tier 1: .env parity
 * - Tier 2: Hand-off to DX Doctor (soft)
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
    console.error("❌ .env file missing. Run 'pnpm run dx:env' or copy .env.example.");
    return false;
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
      console.error(\`❌ \${name} NOT reachable on port \${port}\`);
      resolve(false);
    });

    socket.on("timeout", () => {
      console.error(\`❌ \${name} connection timed out on port \${port}\`);
      socket.destroy();
      resolve(false);
    });

    socket.connect(port, "127.0.0.1");
  });
}

/**
 * Bridge logic to DX Doctor
 * Allows us to reuse the mature check suite without duplicating large amounts of code.
 */
function runSoftDoctor(): void {
  console.log("🔍 Running DX Doctor (soft mode)...");
  try {
    // We run it as a separate process to avoid dependency pollution in this script
    spawnSync("pnpm", ["dx:doctor", "--soft"], { stdio: "inherit" });
  } catch (e) {
    console.warn("⚠️ DX Doctor check failed (non-blocking).");
  }
}

async function main() {
  console.log("--- ValueOS Pre-flight Verification ---");

  const versions = checkVersion("node") && checkVersion("pnpm");
  const env = checkEnv();
  
  // Infrastructure check
  const infrastructure = await Promise.all([
    checkPort(5432, "Postgres"),
    checkPort(4566, "LocalStack")
  ]);

  const allPassed = versions && env && infrastructure.every(p => p);

  if (!allPassed) {
    console.error("\n🛑 Environment verification failed.");
    console.error("Please fix the issues above and try again.");
    process.exit(1);
  }

  console.log("\n🚀 All core systems ready.");
  
  // Hand off to soft doctor for deeper non-blocking checks if in a full dev environment
  if (process.env.CI !== "true") {
    runSoftDoctor();
  }
  
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
