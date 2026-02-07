#!/usr/bin/env node

/**
 * Local Dev Environment Diagnostic Agent
 *
 * Purpose: Deterministic diagnosis and repair of local development environment
 *
 * Role & Authority: Senior DevEx / Platform Engineer
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");

const infraDir = path.join(projectRoot, "infra");
const supabaseDir = path.join(infraDir, "supabase");

// Load environment variables from .env.local if it exists
function loadEnv() {
  const envPath = path.join(projectRoot, ".env.local");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf8");
    const envVars = envContent
      .split("\n")
      .filter((line) => line.includes("=") && !line.startsWith("#"));
    envVars.forEach((line) => {
      const [key, ...valueParts] = line.split("=");
      const value = valueParts.join("=");
      process.env[key] = value;
    });
  }
}

// Required Inputs Check
function checkRequiredInputs() {
  const missing = [];
  if (!fs.existsSync(path.join(projectRoot, "package.json"))) missing.push("package.json");
  if (!fs.existsSync(path.join(projectRoot, ".env.local"))) missing.push(".env.local");
  if (!fs.existsSync(path.join(infraDir, "supabase"))) missing.push("infra/supabase/");

  if (missing.length > 0) {
    console.error("Missing required inputs:");
    missing.forEach((file) => console.error(`- ${file}`));
    process.exit(1);
  }
}

// Phase 1: Establish Ground Truth
function establishGroundTruth() {
  console.log("## Ground Truth Findings");

  // Check current environment
  const envMode = process.env.DX_MODE || "local";
  console.log(`- Environment mode: ${envMode}`);

  // Check if services are running
  try {
    const dockerPs = execSync("docker ps --format 'table {{.Names}}\\t{{.Status}}\\t{{.Ports}}'", {
      encoding: "utf8",
    });
    const lines = dockerPs
      .split("\n")
      .filter((line) => line.includes("valueos") || line.includes("supabase"));
    console.log(`- Docker containers running: ${lines.length > 1 ? lines.slice(1).length : 0}`);
  } catch (error) {
    console.log("- Docker containers: Unable to check (docker not running?)");
  }

  // Check Supabase status
  try {
    const supabaseStatus = execSync("supabase status", {
      cwd: supabaseDir,
      encoding: "utf8",
      stdio: "pipe",
    });
    const isRunning = supabaseStatus.includes("running");
    console.log(`- Supabase status: ${isRunning ? "Running" : "Not running"}`);
  } catch (error) {
    console.log("- Supabase status: Not initialized or not running");
  }

  // Check database connectivity
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl) {
    console.log("- Database URL: Configured");
  } else {
    console.log("- Database URL: Not configured (BAD)");
  }

  // Check if frontend/backend are running
  try {
    const processes = execSync("ps aux | grep -E '(vite|tsx|node.*server)' | grep -v grep", {
      encoding: "utf8",
    });
    const processCount = processes.split("\n").filter((line) => line.trim()).length;
    console.log(`- Dev processes running: ${processCount}`);
  } catch (error) {
    console.log("- Dev processes: Unable to check");
  }
}

// Phase 2: Drift Detection
function detectDrift() {
  console.log("\n## Drift Detection");

  // Check for port conflicts
  const ports = [3000, 5173, 5432, 6379, 8000]; // Common dev ports
  const conflicts = [];
  for (const port of ports) {
    try {
      execSync(`lsof -i :${port}`, { stdio: "pipe" });
      conflicts.push(port);
    } catch (error) {
      // Port is free
    }
  }
  if (conflicts.length > 0) {
    console.log(`- Port conflicts detected: ${conflicts.join(", ")}`);
  } else {
    console.log("- No port conflicts detected");
  }

  // Check for mixed lockfiles
  const hasPackageLock = fs.existsSync(path.join(projectRoot, "package-lock.json"));
  const hasPnpmLock = fs.existsSync(path.join(projectRoot, "pnpm-lock.yaml"));
  if (hasPackageLock && hasPnpmLock) {
    console.log("- Mixed lockfiles: Both package-lock.json and pnpm-lock.yaml present");
  } else {
    console.log("- Lockfile consistency: OK");
  }

  // Check environment file consistency
  const envFiles = [".env", ".env.local", ".env.example"];
  const existingEnvFiles = envFiles.filter((file) => fs.existsSync(path.join(projectRoot, file)));
  if (existingEnvFiles.length > 1) {
    console.log(`- Multiple env files: ${existingEnvFiles.join(", ")} (potential confusion)`);
  }

  // Check migration drift
  try {
    const migrationStatus = execSync("supabase db diff --schema public", {
      cwd: supabaseDir,
      encoding: "utf8",
      stdio: "pipe",
    });
    if (migrationStatus.trim()) {
      console.log("- Migration drift: Local schema differs from migrations");
    } else {
      console.log("- Migration drift: None detected");
    }
  } catch (error) {
    console.log("- Migration drift: Unable to check (Supabase not running?)");
  }
}

// Phase 3: Root Cause Analysis
function rootCauseAnalysis() {
  console.log("\n## Root Cause Analysis");

  // Analyze common startup issues
  const issues = [];

  // Check if Docker is running
  try {
    execSync("docker info", { stdio: "pipe" });
  } catch (error) {
    issues.push({
      cause: "Docker daemon not running",
      mechanism: "All containerized services (Supabase, postgres, redis) require Docker",
      systemic: "Docker must be started before development environment",
    });
  }

  // Check Node version
  const nvmrcPath = path.join(projectRoot, ".nvmrc");
  if (fs.existsSync(nvmrcPath)) {
    const expectedVersion = fs.readFileSync(nvmrcPath, "utf8").trim();
    const currentVersion = process.version;
    if (!currentVersion.includes(expectedVersion.replace("v", ""))) {
      issues.push({
        cause: `Node version mismatch: expected ${expectedVersion}, got ${currentVersion}`,
        mechanism: "Version-specific dependencies may not work correctly",
        systemic: "Use nvm to switch to correct Node version",
      });
    }
  }

  // Check if ports are available
  const requiredPorts = [5432, 6379]; // postgres, redis
  for (const port of requiredPorts) {
    try {
      execSync(`lsof -i :${port}`, { stdio: "pipe" });
      issues.push({
        cause: `Port ${port} already in use`,
        mechanism: "Service startup will fail due to port conflict",
        systemic: "Stop conflicting service or use different ports",
      });
    } catch (error) {
      // Port is free
    }
  }

  if (issues.length === 0) {
    console.log("- No root causes identified: Environment appears healthy");
  } else {
    issues.forEach((issue, index) => {
      console.log(`${index + 1}. ${issue.cause}`);
      console.log(`   Mechanism: ${issue.mechanism}`);
      console.log(`   Systemic: ${issue.systemic}`);
      console.log("");
    });
  }
}

// Phase 4: Canonical Architecture Decision
function canonicalArchitecture() {
  console.log("\n## Canonical Architecture Choice");
  console.log("Local development stack (preferred for development).");
  console.log("Components: Supabase local + Docker deps + Frontend + Backend");
  console.log("This choice is canonical. No changes needed.");
}

// Phase 5: Produce the Fix
function produceFix() {
  console.log("\n## Exact Fixes");

  const fixes = [];

  // Check if Docker is running
  try {
    execSync("docker info", { stdio: "pipe" });
  } catch (error) {
    fixes.push({
      title: "Start Docker daemon",
      command: "sudo systemctl start docker  # Linux",
      alternative: "open -a Docker  # macOS",
      description: "Docker must be running for all containerized services",
    });
  }

  // Check Node version
  const nvmrcPath = path.join(projectRoot, ".nvmrc");
  if (fs.existsSync(nvmrcPath)) {
    const expectedVersion = fs.readFileSync(nvmrcPath, "utf8").trim();
    const currentVersion = process.version;
    if (!currentVersion.includes(expectedVersion.replace("v", ""))) {
      fixes.push({
        title: "Switch Node version",
        command: `nvm install ${expectedVersion} && nvm use ${expectedVersion}`,
        description: "Use correct Node version for this project",
      });
    }
  }

  // Check if environment is set up
  if (!fs.existsSync(path.join(projectRoot, ".env.local"))) {
    fixes.push({
      title: "Set up environment",
      command: "pnpm run dx:env",
      description: "Generate required environment files",
    });
  }

  // Check if Supabase is initialized
  if (!fs.existsSync(path.join(supabaseDir, "config.toml"))) {
    fixes.push({
      title: "Initialize Supabase",
      command: "pnpm run db:setup",
      description: "Set up local Supabase instance",
    });
  }

  // Check for unexpected port conflicts (not counting expected dev environment ports)
  const requiredPorts = [5432, 6379]; // postgres, redis - these are expected to be in use by dev env
  const unexpectedConflicts = [];
  for (const port of requiredPorts) {
    try {
      const output = execSync(`lsof -i :${port}`, { encoding: "utf8", stdio: "pipe" });
      // If expected containers are running, port usage is expected
      const expectedContainersRunning = execSync("docker ps", { encoding: "utf8" }).includes(
        "valueos"
      );
      if (!expectedContainersRunning) {
        unexpectedConflicts.push(port);
      }
    } catch (error) {
      // Port is free
    }
  }
  if (unexpectedConflicts.length > 0) {
    fixes.push({
      title: "Resolve unexpected port conflicts",
      command: `sudo lsof -ti:${unexpectedConflicts.join(",")} | xargs sudo kill -9`,
      alternative: "Change conflicting service ports in config",
      description: `Ports ${unexpectedConflicts.join(", ")} are already in use by unexpected services`,
    });
  }

  // Check database URL
  if (!process.env.DATABASE_URL) {
    fixes.push({
      title: "Configure database URL",
      command: "pnpm run dx:env  # Regenerate .env.local with DATABASE_URL",
      description: "Database URL is required for backend to connect to database",
    });
  }

  if (fixes.length === 0) {
    console.log("✅ No fixes needed. Environment is properly configured.");
  } else {
    fixes.forEach((fix, index) => {
      console.log(`### ${index + 1}. ${fix.title}`);
      console.log(`\`\`\`bash`);
      console.log(`${fix.command}`);
      if (fix.alternative) {
        console.log(`# Alternative: ${fix.alternative}`);
      }
      console.log(`\`\`\``);
      console.log(`${fix.description}`);
      console.log("");
    });
  }
}

// Verification Steps
function verificationSteps() {
  console.log("\n## Verification Steps");
  console.log("### Commands");
  console.log("1. pnpm run dx:doctor");
  console.log("2. ./dev up --mode local");
  console.log("3. Check browser: http://localhost:5173 (frontend)");
  console.log("4. Check API: http://localhost:3000 (backend)");
  console.log("5. Check Supabase Studio: http://localhost:54323");
  console.log("### Expected Outcomes");
  console.log("- All services start without errors");
  console.log("- Frontend loads in browser");
  console.log("- API endpoints respond");
  console.log("- Database connections work");
  console.log("### Success Criteria");
  console.log("- Full development stack running");
  console.log("- No port conflicts");
  console.log("- Database migrations applied");
  console.log("- Frontend and backend communicating");
  console.log("- Hot reload working");
}

// Main execution
function main() {
  console.log("# Local Dev Environment Diagnostic Agent Report\n");

  // Load environment variables
  loadEnv();

  console.log("## Executive Summary");
  console.log("- Diagnosed local development environment health");
  console.log("- Checked Supabase, database, frontend, and backend status");
  console.log("- Identified potential startup issues and conflicts");
  console.log("- Provided surgical fixes for common problems");
  console.log("- Recommended canonical local development setup");

  checkRequiredInputs();
  establishGroundTruth();
  detectDrift();
  rootCauseAnalysis();
  canonicalArchitecture();
  produceFix();
  verificationSteps();
}

main();
