#!/usr/bin/env node

/**
 * Devcontainer Diagnostic Agent
 *
 * Purpose: Deterministic diagnosis and repair of VS Code devcontainer environments
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

const devcontainerDir = path.join(projectRoot, ".devcontainer");
const devcontainerJsonPath = path.join(devcontainerDir, "devcontainer.json");
const composeFilePath = path.join(devcontainerDir, "docker-compose.devcontainer.yml");

// Required Inputs Check
function checkRequiredInputs() {
  const missing = [];
  if (!fs.existsSync(devcontainerJsonPath)) missing.push(".devcontainer/devcontainer.json");
  if (!fs.existsSync(composeFilePath))
    missing.push(".devcontainer/docker-compose.devcontainer.yml");

  if (missing.length > 0) {
    console.error("Missing required inputs:");
    missing.forEach((file) => console.error(`- ${file}`));
    process.exit(1);
  }

  // Check if docker compose config works
  try {
    execSync(`docker compose -f ${composeFilePath} config`, { stdio: "pipe" });
  } catch (error) {
    console.error("docker compose config failed:");
    console.error(error.stdout?.toString() || error.message);
    process.exit(1);
  }
}

// Phase 1: Establish Ground Truth
function establishGroundTruth() {
  const devcontainerJson = JSON.parse(fs.readFileSync(devcontainerJsonPath, "utf8"));

  console.log("## Ground Truth Findings");

  const hasBuild = devcontainerJson.build;
  const hasFeatures = devcontainerJson.features;
  const hasDockerComposeFile = devcontainerJson.dockerComposeFile;

  if (hasDockerComposeFile && (hasBuild || hasFeatures)) {
    console.log("- Devcontainer mode: Both single-container and compose-based present (CONFLICT)");
  } else if (hasDockerComposeFile) {
    console.log("- Devcontainer mode: Compose-based (GOOD)");
  } else if (hasBuild) {
    console.log("- Devcontainer mode: Single-container (GOOD)");
  } else {
    console.log("- Devcontainer mode: Undefined (BAD)");
  }

  // Check Dockerfiles
  const dockerfiles = fs
    .readdirSync(devcontainerDir)
    .filter((file) => file.startsWith("Dockerfile") && !file.includes(".deprecated"));
  console.log(
    `- Dockerfile used: ${dockerfiles.length === 1 ? dockerfiles[0] : `Multiple: ${dockerfiles.join(", ")}`}`
  );

  if (hasDockerComposeFile) {
    console.log("- Effective build context: Defined by compose file");
    const composeContent = fs.readFileSync(composeFilePath, "utf8");
    const hasWorkingDir = composeContent.includes("working_dir");
    console.log(
      `- Container WORKDIR: ${hasWorkingDir ? "Explicitly set" : "Not explicitly set (BAD)"}`
    );
    console.log("- Repo mount: Defined by compose volumes");
    if (hasBuild || hasFeatures) {
      console.log(
        "- Ignored fields in devcontainer.json: build, features, runArgs, mounts (due to compose mode)"
      );
    }
  } else if (hasBuild) {
    console.log("- Effective build context: Defined by devcontainer.json build");
    console.log("- Container WORKDIR: Defined by Dockerfile or workspaceFolder");
    console.log("- Repo mount: Defined by devcontainer.json mounts");
  }
}

// Phase 2: Drift Detection
function detectDrift() {
  const devcontainerJson = JSON.parse(fs.readFileSync(devcontainerJsonPath, "utf8"));
  const hasBuild = devcontainerJson.build;
  const hasFeatures = devcontainerJson.features;
  const hasDockerComposeFile = devcontainerJson.dockerComposeFile;

  console.log("\n## Drift Detection");

  const dockerfiles = fs
    .readdirSync(devcontainerDir)
    .filter((file) => file.startsWith("Dockerfile") && !file.includes(".deprecated"));
  if (dockerfiles.length > 1) {
    console.log(`- Multiple Dockerfiles: ${dockerfiles.join(", ")}`);
  }

  if (hasDockerComposeFile && (hasBuild || hasFeatures)) {
    console.log(
      "- Redundant/ignored fields: devcontainer.json has build/features/runArgs (ignored in compose mode)"
    );
    console.log("- Conflicting build contexts: devcontainer.json build vs compose build");
    console.log("- Multiple networking strategies: devcontainer.json runArgs vs compose networks");
    console.log("- Multiple workspace assumptions: workspaceFolder vs compose volumes");
  } else {
    console.log("- No drift detected: Single mode active");
  }
}

// Phase 3: Root Cause Analysis
function rootCauseAnalysis() {
  const devcontainerJson = JSON.parse(fs.readFileSync(devcontainerJsonPath, "utf8"));
  const hasBuild = devcontainerJson.build;
  const hasFeatures = devcontainerJson.features;
  const hasDockerComposeFile = devcontainerJson.dockerComposeFile;

  console.log("\n## Root Cause Analysis");

  if (hasDockerComposeFile && (hasBuild || hasFeatures)) {
    console.log("- Immediate cause: Presence of both modes in devcontainer.json");
    console.log("- Mechanism: VS Code prioritizes compose mode, ignoring single-container fields");
    console.log("- Systemic cause: Lack of canonical architecture decision");
  } else {
    console.log("- No root cause: Configuration is canonical");
  }
}

// Phase 4: Canonical Architecture Decision
function canonicalArchitecture() {
  const devcontainerJson = JSON.parse(fs.readFileSync(devcontainerJsonPath, "utf8"));
  const hasDockerComposeFile = devcontainerJson.dockerComposeFile;

  console.log("\n## Canonical Architecture Choice");
  if (hasDockerComposeFile) {
    console.log("Compose-based devcontainer (currently active).");
  } else {
    console.log("Single-container devcontainer (currently active).");
  }
  console.log("This choice is canonical. No changes needed.");
}

// Phase 5: Produce the Fix
function produceFix() {
  const devcontainerJson = JSON.parse(fs.readFileSync(devcontainerJsonPath, "utf8"));
  const hasBuild = devcontainerJson.build;
  const hasFeatures = devcontainerJson.features;
  const hasDockerComposeFile = devcontainerJson.dockerComposeFile;

  const dockerfiles = fs
    .readdirSync(devcontainerDir)
    .filter((file) => file.startsWith("Dockerfile") && !file.includes(".deprecated"));
  const hasMultipleDockerfiles = dockerfiles.length > 1;

  const needsFix = (hasDockerComposeFile && (hasBuild || hasFeatures)) || hasMultipleDockerfiles;

  if (!needsFix) {
    console.log("\n## Exact Fixes");
    console.log("No fixes needed. Configuration is canonical.");
    return;
  }

  console.log("\n## Exact Fixes");

  if (hasDockerComposeFile && (hasBuild || hasFeatures)) {
    // Canonical devcontainer.json
    const canonicalDevcontainerJson = {
      name: "ValueOS Dev Container",
      dockerComposeFile: "docker-compose.devcontainer.yml",
      service: "app",
      workspaceFolder: "/workspaces/ValueOS",
      shutdownAction: "stopCompose",
      postCreateCommand: devcontainerJson.postCreateCommand,
      remoteEnv: devcontainerJson.remoteEnv,
      customizations: devcontainerJson.customizations,
    };

    console.log("### 1. Canonical .devcontainer/devcontainer.json");
    console.log("```json");
    console.log(JSON.stringify(canonicalDevcontainerJson, null, 2));
    console.log("```");
  }

  if (hasMultipleDockerfiles) {
    console.log("### 2. Deprecate unused Dockerfiles");
    const deprecatedFiles = fs
      .readdirSync(devcontainerDir)
      .filter((file) => file.startsWith("Dockerfile") && file !== "Dockerfile.optimized");
    console.log(
      `Rename the following files with .deprecated extension: ${deprecatedFiles.join(", ")}`
    );
  }
}

// Verification Steps
function verificationSteps() {
  console.log("\n## Verification Steps");
  console.log("### Commands");
  console.log("1. docker compose -f .devcontainer/docker-compose.devcontainer.yml config");
  console.log("2. Rebuild devcontainer in VS Code");
  console.log("3. Verify workspace root is /workspaces/ValueOS");
  console.log("4. Check tool availability: node, pnpm, docker");
  console.log("### Expected Outcomes");
  console.log("- Config validates without errors");
  console.log("- Rebuilds produce identical behavior");
  console.log("- No ignored fields in devcontainer.json");
  console.log("### Success Criteria");
  console.log("- Exactly one devcontainer mode active");
  console.log("- Rebuilding twice yields identical behavior");
  console.log("- Workspace root deterministic");
  console.log("- Tool availability predictable");
  console.log("- Repo scripts independent of launch context");
  console.log("- Future contributors cannot reintroduce drift");
}

// Main execution
function main() {
  console.log("# Devcontainer Diagnostic Agent Report\n");

  const devcontainerJson = JSON.parse(fs.readFileSync(devcontainerJsonPath, "utf8"));
  const hasBuild = devcontainerJson.build;
  const hasFeatures = devcontainerJson.features;
  const hasDockerComposeFile = devcontainerJson.dockerComposeFile;

  const dockerfiles = fs
    .readdirSync(devcontainerDir)
    .filter((file) => file.startsWith("Dockerfile") && !file.includes(".deprecated"));
  const hasMultipleDockerfiles = dockerfiles.length > 1;

  console.log("## Executive Summary");

  if (hasDockerComposeFile && (hasBuild || hasFeatures)) {
    console.log("- Diagnosed conflicting devcontainer configuration");
    console.log("- Both single-container and compose modes present");
    console.log("- Compose mode ignores devcontainer.json build/features");
    console.log("- Recommendation: Adopt compose-based mode exclusively");
  } else if (hasMultipleDockerfiles) {
    console.log("- Diagnosed multiple Dockerfiles");
    console.log("- Unclear precedence between Dockerfiles");
    console.log("- Recommendation: Deprecate unused Dockerfiles");
  } else {
    console.log("- Devcontainer configuration is canonical");
    console.log("- No issues detected");
    console.log("- Status: GOOD");
  }

  checkRequiredInputs();
  establishGroundTruth();
  detectDrift();
  rootCauseAnalysis();
  canonicalArchitecture();
  produceFix();
  verificationSteps();
}

main();
