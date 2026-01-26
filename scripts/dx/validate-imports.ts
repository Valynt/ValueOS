#!/usr/bin/env tsx
/**
 * Pre-flight import validation
 * Scans all backend TypeScript files and validates imports resolve correctly
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");

interface ImportScanResult {
  file: string;
  imports: string[];
  missing: string[];
}

const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
};

function log(msg: string, color?: string) {
  console.log(`${color || ""}${msg}${colors.reset}`);
}

/**
 * Extract import paths from a TypeScript file
 */
function extractImports(filePath: string): string[] {
  const content = fs.readFileSync(filePath, "utf8");
  const importRegex = /from\s+['"](\.\.?\/[^'"]+|@[^'"]+)['"]/g;
  const imports: string[] = [];
  let match;

  while ((match = importRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }

  return imports;
}

/**
 * Resolve import path to actual file location
 */
function resolveImport(importPath: string, fromFile: string): string | null {
  const dir = path.dirname(fromFile);
  
  if (importPath.startsWith("@shared/") || importPath.startsWith("@/")) {
    // Handle path aliases - simplified check
    return "alias-resolved";
  }

  // Strip .js extension if present (ESM imports use .js but source files are .ts)
  const basePath = importPath.endsWith(".js") 
    ? importPath.slice(0, -3) 
    : importPath;

  const candidates = [
    path.resolve(dir, basePath + ".ts"),
    path.resolve(dir, basePath + ".tsx"),
    path.resolve(dir, importPath), // Try exact path (might be directory or have extension)
    path.resolve(dir, basePath, "index.ts"),
    path.resolve(dir, basePath, "index.tsx"),
    path.resolve(dir, importPath, "index.ts"),
    path.resolve(dir, importPath, "index.tsx"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

/**
 * Scan directory for TypeScript files
 */
function scanDirectory(dir: string, extensions = [".ts", ".tsx"]): string[] {
  const files: string[] = [];

  function walk(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        if (!entry.name.startsWith(".") && entry.name !== "node_modules") {
          walk(fullPath);
        }
      } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
        files.push(fullPath);
      }
    }
  }

  walk(dir);
  return files;
}

/**
 * Main validation function
 */
async function validateImports(): Promise<boolean> {
  log("🔍 Validating backend imports...\n", colors.yellow);

  const backendDir = path.join(projectRoot, "packages/backend/src");
  const files = scanDirectory(backendDir);

  log(`Found ${files.length} TypeScript files\n`);

  const results: ImportScanResult[] = [];
  let totalMissing = 0;

  for (const file of files) {
    const imports = extractImports(file);
    const missing: string[] = [];

    for (const imp of imports) {
      if (!imp.startsWith(".")) continue; // Skip external packages

      const resolved = resolveImport(imp, file);
      if (!resolved) {
        missing.push(imp);
      }
    }

    if (missing.length > 0) {
      results.push({ file: path.relative(projectRoot, file), imports, missing });
      totalMissing += missing.length;
    }
  }

  if (totalMissing === 0) {
    log("✅ All imports resolved successfully\n", colors.green);
    return true;
  }

  log(`❌ Found ${totalMissing} unresolved imports:\n`, colors.red);

  for (const result of results) {
    log(`\n📄 ${result.file}`, colors.yellow);
    for (const missing of result.missing) {
      log(`   ❌ ${missing}`, colors.red);
    }
  }

  log("\n💡 Fix: Ensure all imported modules exist or create them", colors.yellow);
  return false;
}

// Run validation
if (import.meta.url === `file://${process.argv[1]}`) {
  validateImports()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      log(`\n❌ Validation failed: ${error.message}`, colors.red);
      process.exit(1);
    });
}

export { validateImports };
