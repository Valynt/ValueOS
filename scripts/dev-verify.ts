import * as fs from "fs";
import * as path from "path";
import * as net from "net";
import { execSync } from "child_process";

/**
 * CONFIGURATION
 */
const REQUIRED_NODE_VERSION = ">=18.0.0";
const REQUIRED_PNPM_VERSION = ">=8.0.0";
const REQUIRED_PORTS = [
  { service: "Postgres", port: parseInt(process.env.PGPORT || "5432") },
  { service: "LocalStack", port: 4566 },
];

const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RESET = "\x1b[0m";

const log = (msg: string, color: string = RESET) => console.log(`${color}${msg}${RESET}`);
const error = (msg: string) => console.error(`${RED}✖ ${msg}${RESET}`);
const success = (msg: string) => console.log(`${GREEN}✔ ${msg}${RESET}`);

/**
 * CHECKS
 */

// 1. Version Checks
function checkVersions() {
  log("--- Checking Runtime Versions ---", YELLOW);

  try {
    const nodeVersion = process.version;
    const majorNode = parseInt(nodeVersion.replace("v", "").split(".")[0], 10);
    if (majorNode < 18) {
      throw new Error(`Node version ${nodeVersion} is too old. Required: ${REQUIRED_NODE_VERSION}`);
    }
    success(`Node Version: ${nodeVersion}`);

    const pnpmVersion = execSync("pnpm --version").toString().trim();
    const majorPnpm = parseInt(pnpmVersion.split(".")[0], 10);
    if (majorPnpm < 8) {
      throw new Error(`PNPM version ${pnpmVersion} is too old. Required: ${REQUIRED_PNPM_VERSION}`);
    }
    success(`PNPM Version: ${pnpmVersion}`);
  } catch (e: any) {
    error(e.message);
    process.exit(1);
  }
}

// 2. Environment Parity
function checkEnvFiles() {
  log("\n--- Checking Environment Parity ---", YELLOW);

  const envPath = path.join(process.cwd(), ".env");
  const examplePath = path.join(process.cwd(), ".env.example");

  if (!fs.existsSync(examplePath)) {
    error(".env.example is missing! Cannot verify configuration.");
    process.exit(1);
  }

  if (!fs.existsSync(envPath)) {
    error('.env file is missing. Run "cp .env.example .env" and configure it.');
    process.exit(1);
  }

  const parseKeys = (content: string) =>
    content
      .split("\n")
      .filter((line) => line.trim() && !line.startsWith("#"))
      .map((line) => line.split("=")[0].trim());

  const exampleKeys = new Set(parseKeys(fs.readFileSync(examplePath, "utf-8")));
  const envKeys = new Set(parseKeys(fs.readFileSync(envPath, "utf-8")));

  const missingKeys = [...exampleKeys].filter((key) => !envKeys.has(key));

  if (missingKeys.length > 0) {
    error(`Missing keys in .env: ${missingKeys.join(", ")}`);
    process.exit(1);
  }

  success(".env matches .env.example schema");
}

// 3. Infrastructure Connectivity
async function checkPorts() {
  log("\n--- Checking Infrastructure ---", YELLOW);

  const checkPort = (service: string, host: string, port: number): Promise<void> => {
    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      socket.setTimeout(1000);

      socket.on("connect", () => {
        socket.destroy();
        success(`${service} is reachable on ${host}:${port}`);
        resolve();
      });

      socket.on("timeout", () => {
        socket.destroy();
        reject(`${service} unreachable on ${host}:${port} (Timeout)`);
      });

      socket.on("error", (err) => {
        socket.destroy();
        reject(`${service} unreachable on ${host}:${port} (${err.message})`);
      });

      socket.connect(port, host);
    });
  };

  // Use database helpers for dynamic host/port detection
  const { get_db_host, get_db_port } = await import("../packages/shared/src/lib/database");
  const dbHost = get_db_host();
  const dbPort = get_db_port();

  const portsToCheck = [
    { service: "Postgres", host: dbHost, port: dbPort },
    { service: "LocalStack", host: "127.0.0.1", port: 4566 },
  ];

  const results = await Promise.allSettled(
    portsToCheck.map((p) => checkPort(p.service, p.host, p.port))
  );

  const failures = results.filter((r) => r.status === "rejected");
  if (failures.length > 0) {
    failures.forEach((f: any) => error(f.reason));
    log("\nVerify that Docker containers are running:", YELLOW);
    log("  > docker-compose up -d");
    process.exit(1);
  }
}

async function main() {
  console.log("🛡️  ValueOS Environment Verification  🛡️\n");
  checkVersions();
  checkEnvFiles();
  await checkPorts();
  console.log("\n✨ Environment Verified. System is deterministic. ✨\n");
}

main();
