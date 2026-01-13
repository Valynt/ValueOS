#!/usr/bin/env node

/**
 * Port Registry Lint Script
 * Detects drift between config/ports.json and hardcoded ports in docs/scripts.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { loadPorts } from "./ports.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");

const ports = loadPorts();

// Build a map of canonical port values
const canonicalPorts = {
  frontend: ports.frontend.port,
  hmr: ports.frontend.hmrPort,
  backend: ports.backend.port,
  postgres: ports.postgres.port,
  redis: ports.redis.port,
  supabaseApi: ports.supabase.apiPort,
  supabaseStudio: ports.supabase.studioPort,
  caddyHttp: ports.edge.httpPort,
  caddyHttps: ports.edge.httpsPort,
  caddyAdmin: ports.edge.adminPort,
  prometheus: ports.observability.prometheusPort,
  grafana: ports.observability.grafanaPort,
};

// Known hardcoded port patterns to check (port -> what it should be)
const portAliases = {
  5173: ["frontend", "vite"],
  24678: ["hmr"],
  3001: ["backend", "api"],
  5432: ["postgres", "database"],
  6379: ["redis"],
  54321: ["supabase api"],
  54323: ["supabase studio"],
  8080: ["caddy http", "edge http"],
  8443: ["caddy https", "edge https"],
  9090: ["prometheus"],
  3000: ["grafana"],
};

// Legacy/wrong ports that should be flagged
const legacyPorts = {
  8000: { expected: 3001, context: "backend/API port (was 8000, now 3001)" },
  4000: { expected: 3001, context: "backend/API port (was 4000, now 3001)" },
};

// Files/patterns to scan
const scanPatterns = [
  { glob: "docs/**/*.md", type: "docs" },
  { glob: "scripts/**/*.sh", type: "scripts" },
  { glob: "scripts/**/*.js", type: "scripts" },
  { glob: ".env.example", type: "env" },
  { glob: ".env.*.example", type: "env" },
];

// Directories to skip
const skipDirs = ["node_modules", ".git", "dist", "build", ".next"];

function walkDir(dir, callback) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (skipDirs.includes(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath, callback);
    } else {
      callback(fullPath);
    }
  }
}

function matchesPattern(filePath, pattern) {
  const relativePath = path.relative(projectRoot, filePath);
  if (pattern.includes("**")) {
    const [prefix, suffix] = pattern.split("**");
    return (
      relativePath.startsWith(prefix.replace(/\/$/, "")) &&
      (suffix === "" || relativePath.endsWith(suffix.replace(/^\//, "")))
    );
  }
  return relativePath === pattern || relativePath.endsWith(pattern);
}

function scanFile(filePath) {
  const issues = [];
  const relativePath = path.relative(projectRoot, filePath);

  let content;
  try {
    content = fs.readFileSync(filePath, "utf8");
  } catch {
    return issues;
  }

  const lines = content.split("\n");

  lines.forEach((line, lineNum) => {
    // Check for legacy/wrong ports
    for (const [legacyPort, info] of Object.entries(legacyPorts)) {
      const portRegex = new RegExp(`\\b${legacyPort}\\b`, "g");
      if (portRegex.test(line)) {
        // Skip if it's in a comment explaining the change
        if (line.includes("was") || line.includes("changed") || line.includes("legacy")) {
          continue;
        }
        // Skip variable definitions that use the correct default
        if (line.includes(`:-${info.expected}`) || line.includes(`||${info.expected}`)) {
          continue;
        }
        issues.push({
          file: relativePath,
          line: lineNum + 1,
          type: "legacy_port",
          message: `Found legacy port ${legacyPort} - ${info.context}`,
          content: line.trim().substring(0, 80),
        });
      }
    }
  });

  return issues;
}

function main() {
  console.log("\n🔍 Port Registry Lint\n");
  console.log("Canonical ports from config/ports.json:");
  console.log(`  Frontend:       ${canonicalPorts.frontend}`);
  console.log(`  Backend:        ${canonicalPorts.backend}`);
  console.log(`  Postgres:       ${canonicalPorts.postgres}`);
  console.log(`  Redis:          ${canonicalPorts.redis}`);
  console.log(`  Supabase API:   ${canonicalPorts.supabaseApi}`);
  console.log(`  Supabase Studio:${canonicalPorts.supabaseStudio}`);
  console.log(`  Caddy HTTP:     ${canonicalPorts.caddyHttp}`);
  console.log(`  Caddy HTTPS:    ${canonicalPorts.caddyHttps}`);
  console.log("");

  const allIssues = [];
  const filesToScan = [];

  // Collect files to scan
  for (const pattern of scanPatterns) {
    walkDir(projectRoot, (filePath) => {
      if (matchesPattern(filePath, pattern.glob)) {
        filesToScan.push({ path: filePath, type: pattern.type });
      }
    });
  }

  // Scan each file
  for (const file of filesToScan) {
    const issues = scanFile(file.path);
    allIssues.push(...issues);
  }

  if (allIssues.length === 0) {
    console.log("✅ No port drift detected.\n");
    process.exit(0);
  }

  console.log(`❌ Found ${allIssues.length} potential issue(s):\n`);

  // Group by file
  const byFile = {};
  for (const issue of allIssues) {
    if (!byFile[issue.file]) byFile[issue.file] = [];
    byFile[issue.file].push(issue);
  }

  for (const [file, issues] of Object.entries(byFile)) {
    console.log(`📄 ${file}`);
    for (const issue of issues) {
      console.log(`   Line ${issue.line}: ${issue.message}`);
      console.log(`   > ${issue.content}`);
    }
    console.log("");
  }

  console.log("Fix: Update hardcoded ports to match config/ports.json\n");
  process.exit(1);
}

main();
