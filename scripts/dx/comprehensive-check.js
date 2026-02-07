#!/usr/bin/env node

/**
 * Comprehensive DX Check: Validates complete development setup
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { getPortRegistry } from "./port-registry.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");

const args = process.argv.slice(2);
const softMode = args.includes("--soft");
const {
  backend: { port: backendPort },
} = getPortRegistry();

const checks = [];
let allPassed = true;

function check(name, test, failureMsg, fixCmd) {
  try {
    const result = test();
    if (result) {
      console.log(`✅ ${name}`);
      checks.push({ name, status: "PASS" });
    } else {
      console.log(`❌ ${name}: ${failureMsg}`);
      console.log(`   Fix: ${fixCmd}`);
      checks.push({ name, status: "FAIL", message: failureMsg, fix: fixCmd });
      allPassed = false;
    }
  } catch (error) {
    console.log(`❌ ${name}: ${error.message}`);
    console.log(`   Fix: ${fixCmd}`);
    checks.push({ name, status: "ERROR", message: error.message, fix: fixCmd });
    allPassed = false;
  }
}

function runCommand(command) {
  return execSync(command, { cwd: projectRoot, stdio: "pipe" })
    .toString()
    .trim();
}

function fileExists(filePath) {
  return fs.existsSync(path.join(projectRoot, filePath));
}

function envVarSet(varName) {
  return (
    process.env[varName] &&
    process.env[varName] !== "" &&
    process.env[varName] !== "your-" &&
    !process.env[varName].includes("placeholder")
  );
}

console.log("🔍 Comprehensive Development Environment Check\n");

// Environment Files
check(
  "Environment files exist",
  () => fileExists("ops/env/.env.local") && fileExists("ops/env/.env.ports"),
  "Missing required environment files",
  "pnpm run dx:env --mode local --force"
);

check(
  "Supabase anon key configured",
  () => envVarSet("VITE_SUPABASE_ANON_KEY") && envVarSet("SUPABASE_ANON_KEY"),
  "Supabase anon keys are missing or using placeholders",
  "Update ops/env/.env.local and ops/env/.env.ports with real anon key"
);

check(
  "Supabase URL configured",
  () => envVarSet("VITE_SUPABASE_URL") && envVarSet("SUPABASE_URL"),
  "Supabase URLs are missing",
  "Set VITE_SUPABASE_URL=http://localhost:54321 and SUPABASE_URL=http://localhost:54321"
);

// Docker Services
check(
  "Docker running",
  () => {
    try {
      runCommand("docker ps");
      return true;
    } catch {
      return false;
    }
  },
  "Docker daemon is not running",
  "Start Docker Desktop or run: sudo systemctl start docker"
);

check(
  "DX containers running",
  () => {
    try {
      const output = runCommand("docker ps --format '{{.Names}}'");
      return (
        output.includes("valueos-postgres") && output.includes("valueos-redis")
      );
    } catch {
      return false;
    }
  },
  "DX containers are not running",
  "pnpm run dx"
);

// Database Connectivity
check(
  "Postgres accessible",
  () => {
    try {
      runCommand("docker exec valueos-postgres pg_isready -U postgres");
      return true;
    } catch {
      return false;
    }
  },
  "PostgreSQL is not ready",
  "Wait for database to start or run: pnpm run dx:reset && pnpm run dx"
);

check(
  "Redis accessible",
  () => {
    try {
      runCommand("docker exec valueos-redis redis-cli ping");
      return true;
    } catch {
      return false;
    }
  },
  "Redis is not ready",
  "Wait for Redis to start or run: pnpm run dx:reset && pnpm run dx"
);

// Frontend Configuration
check(
  "Frontend environment loading",
  () => {
    try {
      const result = runCommand(
        'node -r dotenv/config -e "console.log(process.env.VITE_SUPABASE_ANON_KEY?.length || 0)"'
      );
      return parseInt(result) > 100; // Real JWT tokens are long
    } catch {
      return false;
    }
  },
  "Frontend is not loading environment variables correctly",
  "Check .env.local file and ensure dotenv is configured"
);

// API Connectivity
check(
  "Backend API accessible",
  () => {
    try {
      const result = runCommand(
        `curl -s -o /dev/null -w '%{http_code}' http://localhost:${backendPort}/health`
      );
      return result === "200";
    } catch {
      return false;
    }
  },
  "Backend API is not responding",
  "Check backend logs: pnpm run dx:logs backend"
);

check(
  "Frontend accessible",
  () => {
    try {
      const result = runCommand(
        "curl -s -o /dev/null -w '%{http_code}' http://localhost:5173"
      );
      return result === "200";
    } catch {
      return false;
    }
  },
  "Frontend is not accessible",
  "Check frontend logs: pnpm run dx:logs frontend"
);

// Summary
console.log("\n📊 Check Summary:");
const passed = checks.filter((c) => c.status === "PASS").length;
const total = checks.length;
console.log(`Passed: ${passed}/${total}`);

if (checks.some((c) => c.status === "FAIL" || c.status === "ERROR")) {
  console.log("\n🔧 Failed Checks:");
  checks
    .filter((c) => c.status === "FAIL" || c.status === "ERROR")
    .forEach((check) => {
      console.log(`  ❌ ${check.name}: ${check.message}`);
      console.log(`     Fix: ${check.fix}`);
    });
}

console.log(
  "\n" +
    (allPassed
      ? "🎉 All checks passed! Development environment is ready."
      : "⚠️  Some checks failed. Run the suggested fixes and try again.")
);

if (!allPassed && softMode) {
  console.log("\n⚠️  Soft mode enabled: Exiting with success (0) despite failures.");
  process.exit(0);
}

process.exit(allPassed ? 0 : 1);
