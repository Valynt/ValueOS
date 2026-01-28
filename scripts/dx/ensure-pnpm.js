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

// Check Node version
const expectedNodeVersion = "20.19.0";
const currentNodeVersion = process.version.slice(1); // remove 'v'
if (currentNodeVersion !== expectedNodeVersion) {
  console.error(
    `❌ Node.js version mismatch. Expected ${expectedNodeVersion}, got ${currentNodeVersion}.`
  );
  console.error("   Use: nvm use 20.19.0 or update .nvmrc");
  process.exit(1);
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
