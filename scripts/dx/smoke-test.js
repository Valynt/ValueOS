#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { resolveMode } from "./lib/mode.js";
import { loadPorts, resolvePort } from "./ports.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");

const args = process.argv.slice(2);
let mode = "local";
try {
  mode = resolveMode(args);
} catch {
  mode = "local";
}

const ports = loadPorts();
const frontendPort = resolvePort(process.env.VITE_PORT, ports.frontend.port);
const backendPort = resolvePort(process.env.API_PORT, ports.backend.port);
const supabaseApiPort = resolvePort(
  process.env.SUPABASE_API_PORT,
  ports.supabase.apiPort
);
const caddyHttpPort = resolvePort(
  process.env.CADDY_HTTP_PORT,
  ports.edge.httpPort
);

const checks = [
  {
    name: "Gateway (Caddy) /healthz",
    url: `http://127.0.0.1:${caddyHttpPort}/healthz`,
  },
  {
    name: "Frontend",
    url: `http://127.0.0.1:${frontendPort}/`,
  },
  {
    name: "Backend /health",
    url: `http://127.0.0.1:${backendPort}/health`,
  },
  {
    name: "Backend Readiness",
    url: `http://127.0.0.1:${backendPort}/health/ready`,
  },
  {
    name: "Backend DB readiness",
    url: `http://127.0.0.1:${backendPort}/health/dependencies`,
  },
  {
    name: "Supabase Auth health",
    url: `http://127.0.0.1:${supabaseApiPort}/auth/v1/health`,
  },
];

async function checkUrl(name, url) {
  try {
    const response = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(5000),
    });
    if (response.status >= 200 && response.status < 400) {
      console.log(`✅ ${name} (${response.status})`);
      return true;
    }
    console.log(`❌ ${name} (${response.status})`);
    return false;
  } catch (error) {
    console.log(`❌ ${name} (${error.message})`);
    return false;
  }
}

async function main() {
  console.log(`\n🧪 DX Smoke Test (mode: ${mode})\n`);

  if (!fs.existsSync(path.join(projectRoot, ".env.ports"))) {
    console.log("⚠️  .env.ports not found. Run: pnpm run dx:env --mode local --force");
  }

  const results = [];
  for (const check of checks) {
    results.push(await checkUrl(check.name, check.url));
  }

  const failed = results.filter((result) => !result).length;
  if (failed > 0) {
    console.log(`\n❌ Smoke test failed (${failed} checks failed).`);
    process.exit(1);
  }

  console.log("\n✅ Smoke test passed.\n");
}

main().catch((error) => {
  console.error("❌ Smoke test failed:", error.message);
  process.exit(1);
});
