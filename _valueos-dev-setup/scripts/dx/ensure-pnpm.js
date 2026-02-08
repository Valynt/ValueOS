#!/usr/bin/env node

import process from "process";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const userAgent = process.env.npm_config_user_agent || "";
const execPath = process.env.npm_execpath || "";
const isPnpm = userAgent.includes("pnpm") || execPath.includes("pnpm");

if (!isPnpm) {
  console.error("❌ This repo uses pnpm only.");
  console.error("   Use: corepack enable && corepack prepare pnpm@9.15.0 --activate");
  console.error("   Then: pnpm install");
  process.exit(1);
}

// Check Node version (major version match required, minor/patch warnings only)
const expectedNodeVersion = "20.20.0";
const currentNodeVersion = process.version.slice(1); // remove 'v'
const [expectedMajor] = expectedNodeVersion.split(".");
const [currentMajor] = currentNodeVersion.split(".");

if (currentMajor !== expectedMajor) {
  console.error(
    `❌ Node.js major version mismatch. Expected ${expectedMajor}.x, got ${currentNodeVersion}.`
  );
  console.error("   Use: nvm use 20 or update .nvmrc");
  process.exit(1);
}

if (currentNodeVersion !== expectedNodeVersion) {
  console.warn(
    `⚠️  Node.js version ${currentNodeVersion} differs from pinned ${expectedNodeVersion} (continuing)`
  );
}

// Check pnpm version
const expectedPnpmVersion = "9.15.0";
try {
  const pnpmVersion = execSync("pnpm --version", { encoding: "utf8" }).trim();
  if (pnpmVersion !== expectedPnpmVersion) {
    console.error(`❌ pnpm version mismatch. Expected ${expectedPnpmVersion}, got ${pnpmVersion}.`);
    console.error("   Use: corepack prepare pnpm@9.15.0 --activate");
    process.exit(1);
  }
} catch (error) {
  console.error("❌ Failed to check pnpm version.");
  process.exit(1);
}

console.log("✅ Toolchain versions verified.");
