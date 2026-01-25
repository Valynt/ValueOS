#!/usr/bin/env node

import process from "process";

const userAgent = process.env.npm_config_user_agent || "";
const execPath = process.env.npm_execpath || "";
const isPnpm = userAgent.includes("pnpm") || execPath.includes("pnpm");

if (!isPnpm) {
  console.error("❌ This repo uses pnpm only.");
  console.error("   Use: corepack enable");
  console.error("   Then: pnpm install");
  process.exit(1);
}
