#!/usr/bin/env node
/**
 * Runtime Config Injection Script
 *
 * Injects window.__CONFIG__ into index.html at build/deploy time.
 * This enables the "Build Once, Deploy Anywhere" pattern.
 *
 * Usage:
 *   node scripts/inject-runtime-config.js [options]
 *
 * Options:
 *   --input <path>    Input HTML file (default: dist/index.html)
 *   --output <path>   Output HTML file (default: same as input)
 *   --env <name>      Environment name (development, staging, production)
 *
 * Environment variables used:
 *   VITE_API_BASE_URL, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY,
 *   VITE_AGENT_API_URL, VITE_APP_VERSION
 */

const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);

function getArg(name, defaultValue) {
  const index = args.indexOf(`--${name}`);
  if (index !== -1 && args[index + 1]) {
    return args[index + 1];
  }
  return defaultValue;
}

const inputPath = getArg("input", "dist/index.html");
const outputPath = getArg("output", inputPath);
const environment = getArg("env", process.env.NODE_ENV || "production");

const config = {
  api: process.env.VITE_API_BASE_URL || "/api",
  supabaseUrl: process.env.VITE_SUPABASE_URL || "",
  supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY || "",
  agentApiUrl: process.env.VITE_AGENT_API_URL || "/api/agents",
  environment: environment,
  version:
    process.env.VITE_APP_VERSION || process.env.npm_package_version || "0.0.0",
  buildTime: process.env.BUILD_TIME || new Date().toISOString(),
};

const configScript = `<script>window.__CONFIG__=${JSON.stringify(config)
  .replace(/</g, "\\u003c")
  .replace(/>/g, "\\u003e")
  .replace(/&/g, "\\u0026")};</script>`;

try {
  const absoluteInput = path.resolve(process.cwd(), inputPath);
  const absoluteOutput = path.resolve(process.cwd(), outputPath);

  if (!fs.existsSync(absoluteInput)) {
    console.error(`Error: Input file not found: ${absoluteInput}`);
    process.exit(1);
  }

  let html = fs.readFileSync(absoluteInput, "utf-8");

  // Remove any existing __CONFIG__ script
  html = html.replace(/<script>window\.__CONFIG__=.*?<\/script>/g, "");

  // Inject before </head>
  if (html.includes("</head>")) {
    html = html.replace("</head>", `${configScript}\n</head>`);
  } else {
    // Fallback: inject at start of body
    html = html.replace("<body", `${configScript}\n<body`);
  }

  fs.writeFileSync(absoluteOutput, html, "utf-8");

  console.log(`✅ Runtime config injected into ${absoluteOutput}`);
  console.log(`   Environment: ${environment}`);
  console.log(`   API: ${config.api}`);
  console.log(`   Supabase: ${config.supabaseUrl ? "configured" : "not set"}`);
} catch (error) {
  console.error("Error injecting runtime config:", error.message);
  process.exit(1);
}
