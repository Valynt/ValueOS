import { execSync } from "child_process";
import * as fs from "fs";
import * as net from "net";
import * as path from "path";

const projectRoot = process.cwd();

function checkVersion(command: string, expected: string): boolean {
  try {
    const version = execSync(`${command} --version`, { encoding: "utf8" }).trim();
    console.log(`✅ ${command} version: ${version}`);
    return true; // Simplified version check
  } catch (error) {
    console.error(`❌ ${command} not found or failed.`);
    return false;
  }
}

function checkEnv(): boolean {
  const envPath = path.join(projectRoot, ".env");
  const examplePath = path.join(projectRoot, ".env.example");

  if (!fs.existsSync(envPath)) {
    console.error("❌ .env file missing.");
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
      content
        .split("\n")
        .filter((l) => l.trim() && !l.trim().startsWith("#"))
        .map((l) => l.split("=")[0].trim())
        .filter((k) => k);

    const envKeys = getKeys(envContent);
    const exampleKeys = getKeys(exampleContent);

    const missing = exampleKeys.filter((k) => !envKeys.includes(k));
    if (missing.length > 0) {
      console.error(`❌ .env is missing keys from .env.example: ${missing.join(", ")}`);
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
    const timeout = 2000;
    socket.setTimeout(timeout);

    socket.on("connect", () => {
      console.log(`✅ ${name} reachable on port ${port}`);
      socket.destroy();
      resolve(true);
    });

    socket.on("error", () => {
      console.error(`❌ ${name} NOT reachable on port ${port}`);
      resolve(false);
    });

    socket.on("timeout", () => {
      console.error(`❌ ${name} connection timed out on port ${port}`);
      socket.destroy();
      resolve(false);
    });

    socket.connect(port, "127.0.0.1");
  });
}

async function main() {
  console.log("--- ValueOS Pre-flight Verification ---");

  const v1 = checkVersion("node", ">=20");
  const v2 = checkVersion("pnpm", ">=9");
  const v3 = checkEnv();

  const p1 = await checkPort(5432, "Postgres");
  const p2 = await checkPort(4566, "LocalStack");

  if (v1 && v2 && v3 && p1 && p2) {
    console.log("🚀 All systems ready. Proceeding to boot.");
    process.exit(0);
  } else {
    console.error("🛑 Environment verification failed.");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
