#!/usr/bin/env node

/**
 * Unified Development Server
 * Starts all services with unified logging
 */

import { execSync, spawn } from "child_process";
import fs from "fs";
import net from "net";
import path from "path";
import { fileURLToPath } from "url";
import { resolveMode } from "./lib/mode.js";
import { loadPorts, resolvePort, writePortsEnvFile } from "./ports.js";
import { composeCommand, parseComposeProfiles } from "./lib/compose.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, "../..");
const ports = loadPorts();
const frontendPort = resolvePort(process.env.VITE_PORT, ports.frontend.port);
const backendPort = resolvePort(process.env.API_PORT, ports.backend.port);
const supabaseApiPort = resolvePort(
  process.env.SUPABASE_API_PORT,
  ports.supabase.apiPort
);
const supabaseStudioPort = resolvePort(
  process.env.SUPABASE_STUDIO_PORT,
  ports.supabase.studioPort
);

// ANSI color codes
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  blue: "\x1b[34m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
};

const dxLockPath = path.join(projectRoot, ".dx-lock");
const dxStatePath = path.join(projectRoot, ".dx-state.json");

/**
 * Format log line with service prefix
 */
function formatLog(service, line, color) {
  const timestamp = new Date().toLocaleTimeString();
  const prefix = `${color}[${service}]${colors.reset}`;
  return `${colors.bright}${timestamp}${colors.reset} ${prefix} ${line}`;
}

function ensurePortsEnvFile() {
  const portsFile = path.join(projectRoot, "ops", "env", ".env.ports");
  writePortsEnvFile(portsFile);
}

function readDxState() {
  if (!fs.existsSync(dxStatePath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(dxStatePath, "utf8"));
  } catch {
    return null;
  }
}

function writeDxState(state) {
  fs.writeFileSync(dxStatePath, JSON.stringify(state, null, 2));
}

function clearDxState() {
  if (fs.existsSync(dxStatePath)) {
    fs.unlinkSync(dxStatePath);
  }
}

function readDxLock() {
  if (!fs.existsSync(dxLockPath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(dxLockPath, "utf8"));
  } catch {
    return null;
  }
}

function writeDxLock(state) {
  fs.writeFileSync(dxLockPath, JSON.stringify(state, null, 2));
}

function assertNoActiveDx() {
  const state = readDxState();
  if (!state?.pid) {
    return;
  }

  try {
    process.kill(state.pid, 0);
    console.error(
      formatLog(
        "dx",
        `Another DX session is already running (pid ${state.pid}, mode ${state.mode}).`,
        colors.yellow
      )
    );
    console.error(
      formatLog("dx", "Stop it first or run: pnpm run dx:down", colors.yellow)
    );
    process.exit(1);
  } catch {
    clearDxState();
  }
}

/**
 * Check whether a port is already in use.
 */
function isPortInUse(port, host = "127.0.0.1") {
  return new Promise((resolve) => {
    const tester = net
      .createServer()
      .once("error", (error) => {
        if (error.code === "EADDRINUSE") {
          resolve(true);
        } else {
          resolve(false);
        }
      })
      .once("listening", () => {
        tester.close(() => resolve(false));
      })
      .listen(port, host);
  });
}

/**
 * Log a warning with service prefix.
 */
function logWarning(service, message) {
  console.log(formatLog(service, `⚠️ ${message}`, colors.yellow));
}

/**
 * Start a service
 */
function startService(name, command, color) {
  console.log(formatLog(name, `Starting...`, color));

  const [cmd, ...args] = command.split(" ");
  const proc = spawn(cmd, args, {
    cwd: projectRoot,
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
  });

  proc.stdout.on("data", (data) => {
    const lines = data.toString().trim().split("\n");
    lines.forEach((line) => {
      if (line.trim()) {
        console.log(formatLog(name, line, color));
      }
    });
  });

  proc.stderr.on("data", (data) => {
    const lines = data.toString().trim().split("\n");
    lines.forEach((line) => {
      if (line.trim()) {
        console.log(formatLog(name, line, color));
      }
    });
  });

  proc.on("exit", (code) => {
    if (code !== 0 && code !== null) {
      console.log(formatLog(name, `Exited with code ${code}`, color));
    }
  });

  return proc;
}

/**
 * Run a command and stream output.
 */
function runCommand(name, command) {
  return new Promise((resolve, reject) => {
    console.log(formatLog(name, `Running "${command}"...`, colors.yellow));
    const proc = spawn(command, {
      cwd: projectRoot,
      stdio: "inherit",
      shell: true,
    });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${name} exited with code ${code}`));
      }
    });
  });
}

function getRunningComposeServices(mode, profiles = []) {
  try {
    const { command } = composeCommand("ps", {
      mode,
      profiles,
      extraArgs: ["--status", "running", "--services"],
    });
    const output = execSync(command, {
      cwd: projectRoot,
      encoding: "utf8",
    });
    return output.trim().split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Check whether Docker is publishing a host port.
 */
function isDockerPortPublished(port) {
  let output = "";
  try {
    output = execSync('docker ps --format "{{.Ports}}"', {
      cwd: projectRoot,
      encoding: "utf8",
    }).trim();
  } catch (error) {
    return false;
  }

  if (!output) {
    return false;
  }

  const matcher = new RegExp(`(^|,\\s*)(?:[^\\s,]+:)?${port}->`);
  return output.split("\n").some((line) => matcher.test(line));
}

/**
 * Main function
 */
async function main() {
  let mode;
  try {
    mode = resolveMode(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
  process.env.DX_MODE = mode;

  if (!["local", "docker"].includes(mode)) {
    console.error(
      `❌ Invalid mode "${mode}". Use --mode local or --mode docker.`
    );
    process.exit(1);
  }

  const composeProfiles = parseComposeProfiles(process.argv.slice(2));
  const composeFile = "ops/compose";

  ensurePortsEnvFile();
  assertNoActiveDx();

  const dockerRunning = getRunningComposeServices("docker", composeProfiles);
  const localRunning = getRunningComposeServices("local", composeProfiles);
  const runningSummary = [
    `docker=${dockerRunning.length ? dockerRunning.join(", ") : "none"}`,
    `local=${localRunning.length ? localRunning.join(", ") : "none"}`,
  ].join("; ");

  console.log(
    formatLog(
      "dx",
      `Detected mode "${mode}" (${composeFile}). Compose state: ${runningSummary}.`,
      colors.cyan
    )
  );

  const lock = readDxLock();
  if (lock && (lock.mode !== mode || lock.composeFile !== composeFile)) {
    console.error(
      formatLog(
        "dx",
        `DX lock indicates ${lock.mode} (${lock.composeFile}). Run "pnpm run dx:down" before starting ${mode}.`,
        colors.yellow
      )
    );
    process.exit(1);
  }

  console.log("\n" + "=".repeat(60));
  console.log("🚀 Starting ValueOS development environment...");
  console.log("=".repeat(60) + "\n");

  const services = [];
  process.on("exit", clearDxState);

  if (mode === "docker") {
    if (dockerRunning.length > 0) {
      console.log(
        formatLog("dx", "Full Docker stack is already running.", colors.green)
      );
      console.log(
        formatLog("dx", 'Use "pnpm run dx:down" to stop it.', colors.yellow)
      );
      process.exit(0);
    }

    if (localRunning.length > 0) {
      console.error(
        formatLog(
          "dx",
          `Local deps are running (${localRunning.join(", ")}). Stop them with "pnpm run dx:down".`,
          colors.yellow
        )
      );
      process.exit(1);
    }

    const dockerPortConflicts = [];
    if (
      (await isPortInUse(frontendPort)) &&
      !isDockerPortPublished(frontendPort)
    ) {
      dockerPortConflicts.push(
        `Frontend port ${frontendPort} is already in use`
      );
    }
    if (
      (await isPortInUse(backendPort)) &&
      !isDockerPortPublished(backendPort)
    ) {
      dockerPortConflicts.push(`Backend port ${backendPort} is already in use`);
    }

    if (
      dockerPortConflicts.length > 0 &&
      process.env.DX_ALLOW_PORT_IN_USE !== "1"
    ) {
      console.error(
        formatLog(
          "dx",
          `${dockerPortConflicts.join(". ")}. Free the ports or set DX_ALLOW_PORT_IN_USE=1.`,
          colors.yellow
        )
      );
      process.exit(1);
    }

    writeDxLock({ mode, composeFile, createdAt: new Date().toISOString() });
    writeDxState({
      pid: process.pid,
      mode,
      startedAt: new Date().toISOString(),
    });
    const { command: composeUpCommand } = composeCommand("up", {
      mode: "docker",
      profiles: composeProfiles,
      extraArgs: ["-d", "--build", "--pull=missing"],
    });
    await runCommand("docker", composeUpCommand);
    console.log("\n" + "=".repeat(60));
    console.log("✅ Docker services are running!");
    console.log("=".repeat(60) + "\n");
    console.log('💡 Run "pnpm run dx:down" to stop the environment.\n');
    return;
  }

  // Start Docker dependency services first
  if (dockerRunning.length > 0) {
    console.error(
      formatLog(
        "dx",
        `Full Docker stack already running (${dockerRunning.join(", ")}). Stop it with "pnpm run dx:down" or use "pnpm run dx:docker".`,
        colors.yellow
      )
    );
    process.exit(1);
  }

  writeDxLock({ mode, composeFile, createdAt: new Date().toISOString() });
  const { command: composeDepsUpCommand } = composeCommand("up", {
    mode: "local",
    profiles: composeProfiles,
    extraArgs: ["-d"],
  });
  await runCommand("docker", composeDepsUpCommand);

  const conflicts = [];
  if (isDockerPortPublished(backendPort)) {
    conflicts.push(`Backend already running in Docker on ${backendPort}`);
  }
  if (isDockerPortPublished(frontendPort)) {
    conflicts.push(`Frontend already running in Docker on ${frontendPort}`);
  }

  if (conflicts.length > 0) {
    console.error(
      formatLog(
        "dx",
        `${conflicts.join(". ")}. Run "pnpm run dx:down" or start with "pnpm run dx:docker".`,
        colors.yellow
      )
    );
    process.exit(1);
  }

  // Start backend
  const backendPortInUse = await isPortInUse(backendPort);
  if (backendPortInUse) {
    if (process.env.DX_ALLOW_PORT_IN_USE === "1") {
      logWarning(
        "backend",
        `Port ${backendPort} already in use. Skipping local backend start.`
      );
    } else {
      console.error(
        formatLog(
          "backend",
          `Port ${backendPort} already in use. Stop the process or run with DX_ALLOW_PORT_IN_USE=1.`,
          colors.yellow
        )
      );
      process.exit(1);
    }
  } else {
    const backendProc = startService(
      "backend",
      "pnpm run backend:dev",
      colors.blue
    );
    services.push(backendProc);
  }

  // Wait a bit for backend to start
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Start frontend
  const frontendPortInUse = await isPortInUse(frontendPort);
  if (frontendPortInUse) {
    if (process.env.DX_ALLOW_PORT_IN_USE === "1") {
      logWarning(
        "frontend",
        `Port ${frontendPort} already in use. Skipping local frontend start.`
      );
    } else {
      console.error(
        formatLog(
          "frontend",
          `Port ${frontendPort} already in use. Stop the process or run with DX_ALLOW_PORT_IN_USE=1.`,
          colors.yellow
        )
      );
      process.exit(1);
    }
  } else {
    const frontendProc = startService("frontend", "pnpm run dev", colors.green);
    services.push(frontendProc);
  }

  // Wait for services to initialize
  await new Promise((resolve) => setTimeout(resolve, 5000));

  // Display service URLs
  console.log("\n" + "=".repeat(60));
  console.log("✅ All services ready!");
  console.log("=".repeat(60) + "\n");
  console.log("📍 Service URLs:");
  console.log(
    `   ${colors.green}Frontend:${colors.reset}  http://localhost:${frontendPort}`
  );
  console.log(
    `   ${colors.blue}Backend:${colors.reset}   http://localhost:${backendPort}`
  );
  console.log(
    `   ${colors.yellow}Supabase API:${colors.reset}     http://localhost:${supabaseApiPort}`
  );
  console.log(
    `   ${colors.yellow}Supabase Studio:${colors.reset}  http://localhost:${supabaseStudioPort}`
  );
  console.log("\n💡 Press Ctrl+C to stop all services\n");

  writeDxState({ pid: process.pid, mode, startedAt: new Date().toISOString() });

  // Handle shutdown
  const shutdown = () => {
    console.log("\n\n🛑 Shutting down services...\n");
    services.forEach((proc) => {
      try {
        proc.kill("SIGTERM");
      } catch (error) {
        // Ignore errors during shutdown
      }
    });

    setTimeout(() => {
      console.log("✅ All services stopped\n");
      clearDxState();
      process.exit(0);
    }, 2000);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // Keep process alive
  await new Promise(() => {});
}

// Run
main().catch((error) => {
  console.error("❌ Failed to start services:", error);
  process.exit(1);
});
