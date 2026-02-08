#!/usr/bin/env node

/**
 * Configuration Validator: Validates environment variables and Docker configs
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");

let allValid = true;
const results = [];

/**
 * Validation result
 */
function validate(name, isValid, message = "") {
  const status = isValid ? "✅ VALID" : "❌ INVALID";
  console.log(`${status} ${name}${message ? `: ${message}` : ""}`);

  results.push({
    name,
    valid: isValid,
    message,
  });

  if (!isValid) {
    allValid = false;
  }
}

/**
 * Check if environment variable is set and not a placeholder
 */
function validateEnvVar(varName, description = "") {
  const value = process.env[varName];
  const isSet =
    value &&
    value !== "" &&
    value !== "your-" &&
    !value.includes("placeholder") &&
    !value.includes("change-me");

  validate(
    `Environment variable ${varName}`,
    isSet,
    isSet ? "" : `${description || "Not set or using placeholder value"}`
  );

  return isSet;
}

/**
 * Check if file exists
 */
function validateFileExists(filePath, description = "") {
  const fullPath = path.join(projectRoot, filePath);
  const exists = fs.existsSync(fullPath);

  validate(
    `File ${filePath}`,
    exists,
    exists ? "" : `${description || "File not found"}`
  );

  return exists;
}

/**
 * Validate Docker Compose file syntax
 */
function validateDockerCompose(filePath) {
  try {
    execSync(`docker compose -f ${filePath} config --quiet`, {
      cwd: projectRoot,
      stdio: "pipe",
    });
    validate(`Docker Compose ${filePath}`, true);
    return true;
  } catch (error) {
    validate(
      `Docker Compose ${filePath}`,
      false,
      "Invalid syntax or configuration"
    );
    return false;
  }
}

/**
 * Check port availability
 */
function validatePort(port, service) {
  try {
    // Use netstat or similar to check if port is available
    execSync(`netstat -an | find "LISTENING" | find ":${port} "`, {
      stdio: "pipe",
    });
    validate(`Port ${port} (${service})`, false, "Port already in use");
    return false;
  } catch {
    // Port is available (command failed because no listening socket found)
    validate(`Port ${port} (${service})`, true);
    return true;
  }
}

/**
 * Validate environment file format
 */
function validateEnvFile(filePath) {
  try {
    if (!fs.existsSync(path.join(projectRoot, filePath))) {
      validate(`Environment file ${filePath}`, false, "File not found");
      return false;
    }

    const content = fs.readFileSync(path.join(projectRoot, filePath), "utf8");
    const lines = content
      .split("\n")
      .filter((line) => line.trim() && !line.startsWith("#"));

    let validLines = 0;
    for (const line of lines) {
      if (line.includes("=")) {
        const [key, ...valueParts] = line.split("=");
        const value = valueParts.join("=");
        if (key.trim() && value.trim()) {
          validLines++;
        }
      }
    }

    const isValid = validLines === lines.length;
    validate(
      `Environment file ${filePath}`,
      isValid,
      isValid ? `${validLines} valid entries` : "Contains malformed entries"
    );

    return isValid;
  } catch (error) {
    validate(`Environment file ${filePath}`, false, error.message);
    return false;
  }
}

/**
 * Main validation execution
 */
function runValidation() {
  console.log("🔧 Configuration Validation\n");

  // Required environment files
  validateFileExists("ops/env/.env.local", "Required for local development");
  validateFileExists("ops/env/.env.ports", "Required for port configuration");

  // Environment file validation
  validateEnvFile("ops/env/.env.ports");

  // Critical environment variables
  validateEnvVar(
    "NODE_ENV",
    "Should be 'development', 'staging', or 'production'"
  );

  // Supabase configuration
  validateEnvVar("VITE_SUPABASE_URL", "Required for frontend API calls");
  validateEnvVar(
    "VITE_SUPABASE_ANON_KEY",
    "Required for frontend authentication"
  );
  validateEnvVar("SUPABASE_URL", "Required for backend API calls");
  validateEnvVar("SUPABASE_ANON_KEY", "Required for backend authentication");

  // API Keys (optional but warn if missing)
  const hasTogetherAI = validateEnvVar(
    "TOGETHER_API_KEY",
    "Optional: Enables AI features"
  );
  const hasOpenAI = validateEnvVar(
    "OPENAI_API_KEY",
    "Optional: Enables AI features as fallback"
  );

  if (!hasTogetherAI && !hasOpenAI) {
    console.log(
      "⚠️  Warning: No AI API keys configured - AI features will be limited"
    );
  }

  // Port validation
  const portsEnvPath = path.join(projectRoot, "ops", "env", ".env.ports");
  const portsContent = fs.existsSync(portsEnvPath)
    ? fs.readFileSync(portsEnvPath, "utf8")
    : "";
  const portConfig = {};
  portsContent
    .split("\n")
    .filter((line) => line.trim() && !line.startsWith("#"))
    .forEach((line) => {
      const [key, ...rest] = line.split("=");
      if (!key) return;
      portConfig[key.trim()] = rest.join("=").trim();
    });

  validatePort(portConfig.API_PORT || 3001, "Backend API");
  validatePort(portConfig.VITE_PORT || 5173, "Frontend dev server");
  validatePort(portConfig.POSTGRES_PORT || 5432, "PostgreSQL database");
  validatePort(portConfig.REDIS_PORT || 6379, "Redis cache");

  // Docker configuration validation
  validateDockerCompose("infra/docker/docker-compose.yml");
  validateDockerCompose("infra/docker/docker-compose.dev.yml");

  // Node.js version check
  try {
    const nodeVersion = execSync("node --version", { encoding: "utf8" }).trim();
    const majorVersion = parseInt(nodeVersion.replace("v", "").split(".")[0]);
    const isValidVersion = majorVersion >= 18 && majorVersion <= 20;
    validate(
      "Node.js version",
      isValidVersion,
      isValidVersion
        ? `v${nodeVersion}`
        : `v${nodeVersion} (recommended: v18-20)`
    );
  } catch {
    validate("Node.js version", false, "Could not determine Node.js version");
  }

  // Docker availability
  try {
    execSync("docker --version", { stdio: "pipe" });
    validate("Docker", true, "Available");
  } catch {
    validate("Docker", false, "Docker CLI not found");
  }

  // Summary
  console.log(
    `\n${allValid ? "🎉" : "⚠️"} Configuration Status: ${allValid ? "VALID" : "INVALID"}`
  );
  console.log(
    `Valid checks: ${results.filter((r) => r.valid).length}/${results.length}`
  );

  if (!allValid) {
    console.log("\nFailed validations:");
    results
      .filter((r) => !r.valid)
      .forEach((result) => {
        console.log(`  - ${result.name}: ${result.message}`);
      });
  }

  return allValid;
}

// Handle command line arguments
const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  console.log(`
Configuration Validator

Usage: node validate-config.js [options]

Options:
  --help, -h    Show this help message
  --json        Output results as JSON
  --fix         Attempt to fix common issues

Validates:
  - Required environment variables
  - Environment file formats
  - Docker Compose configurations
  - Port availability
  - System dependencies

Exit codes:
  0 - All validations passed
  1 - One or more validations failed
`);
  process.exit(0);
}

if (args.includes("--json")) {
  // JSON output mode
  runValidation();
  console.log(
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        overallValid: allValid,
        results,
      },
      null,
      2
    )
  );
} else {
  // Normal mode
  const success = runValidation();
  process.exit(success ? 0 : 1);
}
