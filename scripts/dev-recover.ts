import * as fs from "fs";
import * as path from "path";
import * as net from "net";
import { execSync, spawn } from "child_process";
import { get_db_host, get_db_port } from "../packages/shared/src/lib/database";

/**
 * ValueOS Disaster Recovery Script
 * Automatically attempts to fix common infrastructure issues when dev-verify fails
 */

const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const BLUE = "\x1b[34m";
const RESET = "\x1b[0m";

const log = (msg: string, color: string = RESET) => console.log(`${color}${msg}${RESET}`);
const error = (msg: string) => console.error(`${RED}✖ ${msg}${RESET}`);
const success = (msg: string) => console.log(`${GREEN}✔ ${msg}${RESET}`);
const info = (msg: string) => console.log(`${BLUE}ℹ ${msg}${RESET}`);
const warn = (msg: string) => console.log(`${YELLOW}⚠ ${msg}${RESET}`);

/**
 * Check if Docker daemon is running
 */
function checkDockerDaemon(): boolean {
  try {
    execSync("docker info", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if required containers are running
 */
function checkContainers(): { postgres: boolean; localstack: boolean } {
  try {
    const output = execSync(
      "docker-compose -f infra/docker/docker-compose.yml ps --services --filter status=running",
      {
        encoding: "utf8",
      }
    );
    const runningServices = output.trim().split("\n").filter(Boolean);

    return {
      postgres: runningServices.includes("db") || runningServices.includes("postgres"),
      localstack: runningServices.includes("localstack"),
    };
  } catch {
    return { postgres: false, localstack: false };
  }
}

/**
 * Check if Supabase CLI is available
 */
function checkSupabaseCLI(): boolean {
  try {
    execSync("supabase --version", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Start Supabase services using CLI
 */
async function startSupabaseServices(): Promise<boolean> {
  return new Promise((resolve) => {
    info("Starting Supabase services...");

    const child = spawn("supabase", ["start"], {
      stdio: ["inherit", "inherit", "inherit"],
      cwd: process.cwd(),
    });

    child.on("close", (code) => {
      if (code === 0) {
        success("Supabase services started successfully");
        resolve(true);
      } else {
        warn(`Supabase start failed with exit code: ${code}`);
        resolve(false);
      }
    });

    child.on("error", (err) => {
      warn(`Error starting Supabase: ${err.message}`);
      resolve(false);
    });
  });
}

/**
 * Start a specific service
 */
async function startSpecificService(service: string): Promise<boolean> {
  return new Promise((resolve) => {
    info(`Starting ${service} service...`);

    const child = spawn(
      "docker-compose",
      ["-f", "infra/docker/docker-compose.yml", "up", "-d", service],
      {
        stdio: ["inherit", "inherit", "inherit"],
        cwd: process.cwd(),
      }
    );

    child.on("close", (code) => {
      if (code === 0) {
        success(`${service} service started successfully`);
        resolve(true);
      } else {
        error(`Failed to start ${service} service (exit code: ${code})`);
        resolve(false);
      }
    });

    child.on("error", (err) => {
      error(`Error starting ${service}: ${err.message}`);
      resolve(false);
    });
  });
}

/**
 * Start Docker containers (full stack)
 */
async function startContainers(): Promise<boolean> {
  return new Promise((resolve) => {
    info("Starting full container stack...");

    const child = spawn("docker-compose", ["-f", "infra/docker/docker-compose.yml", "up", "-d"], {
      stdio: ["inherit", "inherit", "inherit"],
      cwd: process.cwd(),
    });

    child.on("close", (code) => {
      if (code === 0) {
        success("Full container stack started successfully");
        resolve(true);
      } else {
        error(`Failed to start full container stack (exit code: ${code})`);
        resolve(false);
      }
    });

    child.on("error", (err) => {
      error(`Error starting full container stack: ${err.message}`);
      resolve(false);
    });
  });
}

/**
 * Wait for services to be ready
 */
async function waitForServices(): Promise<boolean> {
  const checkPort = (
    service: string,
    host: string,
    port: number,
    timeoutMs: number = 30000
  ): Promise<boolean> => {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      let resolved = false;

      const cleanup = () => {
        if (!resolved) {
          resolved = true;
          socket.destroy();
          resolve(false);
        }
      };

      socket.setTimeout(timeoutMs);

      socket.on("connect", () => {
        if (!resolved) {
          resolved = true;
          socket.destroy();
          success(`${service} is now ready on ${host}:${port}`);
          resolve(true);
        }
      });

      socket.on("timeout", cleanup);
      socket.on("error", cleanup);

      socket.connect(port, host);
    });
  };

  info("Waiting for services to be ready...");

  const dbHost = process.env.DB_HOST || get_db_host();
  const dbPort = parseInt(process.env.DB_PORT || get_db_port().toString(), 10);

  const checks = [
    checkPort("Postgres", dbHost, dbPort),
    checkPort("LocalStack", "127.0.0.1", 4566),
  ];

  const results = await Promise.all(checks);
  const allReady = results.every(Boolean);

  if (allReady) {
    success("All services are ready!");
  } else {
    warn("Some services are still not ready after waiting");
  }

  return allReady;
}

/**
 * Run the verification script
 */
async function runVerification(): Promise<boolean> {
  return new Promise((resolve) => {
    info("Running environment verification...");

    const child = spawn("pnpm", ["run", "dev:verify"], {
      stdio: ["inherit", "pipe", "pipe"],
      cwd: process.cwd(),
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      if (code === 0) {
        success("Environment verification passed!");
        resolve(true);
      } else {
        error("Environment verification failed");
        if (stderr) {
          console.log(stderr);
        }
        resolve(false);
      }
    });

    child.on("error", (err) => {
      error(`Error running verification: ${err.message}`);
      resolve(false);
    });
  });
}

/**
 * Main disaster recovery flow
 */
async function main() {
  console.log("🚑  ValueOS Disaster Recovery  🚑\n");

  // Step 1: Initial verification
  const initialCheck = await runVerification();
  if (initialCheck) {
    success("Environment is already healthy - no recovery needed!");
    return;
  }

  warn("Environment verification failed - attempting automatic recovery...\n");

  // Step 2: Check Docker daemon
  info("Step 1: Checking Docker daemon...");
  if (!checkDockerDaemon()) {
    error("Docker daemon is not running. Please start Docker and try again.");
    error("On macOS: Open Docker Desktop");
    error("On Linux: sudo systemctl start docker");
    process.exit(1);
  }
  success("Docker daemon is running");

  // Step 3: Check container status
  info("Step 2: Checking container status...");
  const containers = checkContainers();

  if (!containers.postgres && !containers.localstack) {
    warn("No containers are running - attempting to start development services...");

    // Try Supabase CLI first (preferred for development)
    const hasSupabase = checkSupabaseCLI();
    if (hasSupabase) {
      info("Supabase CLI detected - starting Supabase services...");
      const supabaseStarted = await startSupabaseServices();
      if (supabaseStarted) {
        success("Supabase services started successfully");
      } else {
        warn("Supabase CLI failed - falling back to Docker Compose");
      }
    }

    // If Supabase didn't work or isn't available, try Docker Compose
    if (!hasSupabase) {
      info("Starting containers with Docker Compose...");
      const started = await startContainers();
      if (!started) {
        error("Failed to start containers with Docker Compose.");
        error("Try running one of these commands manually:");
        error("  • pnpm run dx:up (for full development environment)");
        error("  • supabase start (if Supabase CLI is installed)");
        error("  • docker-compose -f infra/docker/docker-compose.dev.yml up -d db localstack");
        process.exit(1);
      }
    }
  } else if (!containers.postgres) {
    warn("Postgres container not running");
    // Try Supabase first, then Docker
    const hasSupabase = checkSupabaseCLI();
    let started = false;

    if (hasSupabase) {
      started = await startSupabaseServices();
    }

    if (!started) {
      started = await startSpecificService("postgres");
    }

    if (!started) {
      error("Failed to start Postgres service");
      process.exit(1);
    }
  } else if (!containers.localstack) {
    warn("LocalStack container not running");
    const started = await startSpecificService("localstack");
    if (!started) {
      error("Failed to start LocalStack service");
      process.exit(1);
    }
  } else {
    info("Containers appear to be running - they may just need time to start up");
  }

  // Step 4: Wait for services
  info("Step 4: Waiting for services to be ready...");
  const servicesReady = await waitForServices();
  if (!servicesReady) {
    warn("Services are taking longer than expected to start");
    warn("You may need to wait a bit more or check the service logs:");
    warn("  • supabase status (if using Supabase CLI)");
    warn("  • docker-compose -f infra/docker/docker-compose.yml logs -f");
  }

  // Step 5: Final verification
  info("Step 5: Running final verification...");
  const finalCheck = await runVerification();

  if (finalCheck) {
    success("\n🎉 Disaster recovery successful!");
    success("Your environment is now ready for development.");
    success("💡 Tip: Run 'pnpm run dev:recover' anytime services go down");
  } else {
    error("\n💥 Automatic recovery failed.");
    error("Manual intervention may be required. Try:");
    error("  1. supabase status (check Supabase services)");
    error("  2. docker-compose -f infra/docker/docker-compose.yml logs (check container logs)");
    error(
      "  3. docker-compose -f infra/docker/docker-compose.yml down && pnpm run dx:up (restart services)"
    );
    error("  4. Check that ports 5432 and 4566 are not in use by other services");
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on("SIGINT", () => {
  warn("\nRecovery interrupted by user");
  process.exit(130);
});

process.on("SIGTERM", () => {
  warn("\nRecovery terminated");
  process.exit(143);
});

main().catch((err) => {
  error(`Unexpected error during recovery: ${err.message}`);
  process.exit(1);
});
