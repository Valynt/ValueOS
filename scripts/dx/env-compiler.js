#!/usr/bin/env node

/**
 * DX Environment Compiler
 *
 * Single source of truth: config/ports.json
 *
 * Generates only port-mapping env files:
 * - ops/env/.env.ports (canonical generated artifact)
 * - legacy mirrors for backward compatibility
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { formatPortsEnv, loadPorts } from "./ports.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");
const opsEnvDir = path.join(projectRoot, "ops", "env");
const opsEnvPortsPath = path.join(opsEnvDir, ".env.ports");
const legacyEnvPortsPath = path.join(projectRoot, ".env.ports");
const legacyDeployEnvPortsPath = path.join(projectRoot, "deploy/envs/.env.ports");
const legacyScriptsEnvPortsPath = path.join(projectRoot, "scripts/.env.ports");

const URL_KEYS = ["API_UPSTREAM", "FRONTEND_UPSTREAM"];

function extractAuthority(urlValue) {
  try {
    return new URL(urlValue).host;
  } catch {
    return null;
  }
}

function parseEnvText(content) {
  const parsed = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIndex = line.indexOf("=");
    if (eqIndex === -1) continue;
    const key = line.slice(0, eqIndex).trim();
    const value = line.slice(eqIndex + 1).trim();
    parsed[key] = value;
  }
  return parsed;
}

function assertNoDuplicateAuthorities(envContent) {
  const parsed = parseEnvText(envContent);
  const seen = new Map();
  const duplicates = [];

  for (const key of URL_KEYS) {
    const value = parsed[key];
    if (!value) continue;
    const authority = extractAuthority(value);
    if (!authority) continue;
    const existing = seen.get(authority);
    if (existing) {
      duplicates.push(
        `${key} and ${existing} both resolve to authority ${authority}. Adjust config/ports.json so each authority is unique.`
      );
    } else {
      seen.set(authority, key);
    }
  }

  if (duplicates.length > 0) {
    throw new Error(`Duplicate URL authorities detected:\n${duplicates.join("\n")}`);
  }
}

function generateEnvPorts(ports) {
  const content = formatPortsEnv(ports);
  assertNoDuplicateAuthorities(content);
  return content;
}

function writeEnvFiles(options = {}) {
  const ports = loadPorts();
  const dryRun = options.dryRun || false;
  const envPortsContent = generateEnvPorts(ports);

  if (dryRun) {
    console.log("=== ops/env/.env.ports (dry run) ===");
    console.log(envPortsContent);
    return;
  }

  fs.mkdirSync(opsEnvDir, { recursive: true });
  fs.writeFileSync(opsEnvPortsPath, envPortsContent, "utf8");
  console.log(`✓ Wrote ${opsEnvPortsPath}`);

  fs.writeFileSync(legacyEnvPortsPath, envPortsContent, "utf8");
  console.log(`✓ Wrote ${legacyEnvPortsPath} (legacy)`);

  if (fs.existsSync(path.dirname(legacyDeployEnvPortsPath))) {
    fs.writeFileSync(legacyDeployEnvPortsPath, envPortsContent, "utf8");
    console.log(`✓ Wrote ${legacyDeployEnvPortsPath} (legacy)`);
  }

  if (fs.existsSync(path.dirname(legacyScriptsEnvPortsPath))) {
    fs.writeFileSync(legacyScriptsEnvPortsPath, envPortsContent, "utf8");
    console.log(`✓ Wrote ${legacyScriptsEnvPortsPath} (legacy)`);
  }
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  writeEnvFiles({ dryRun });
}

export { generateEnvPorts, writeEnvFiles, assertNoDuplicateAuthorities };

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
