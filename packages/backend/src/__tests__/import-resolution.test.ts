/**
 * Import Resolution Tests
 * Ensures all TypeScript imports can be resolved at runtime
 */

import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendSrc = path.resolve(__dirname, "..");

function getAllTsFiles(dir: string): string[] {
  const files: string[] = [];

  function walk(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
        walk(fullPath);
      } else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) {
        files.push(fullPath);
      }
    }
  }

  walk(dir);
  return files;
}

function extractRelativeImports(filePath: string): string[] {
  const content = fs.readFileSync(filePath, "utf8");
  const importRegex = /from\s+['"](\.\.[^'"]+)['"]/g;
  const imports: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = importRegex.exec(content)) !== null) {
    if (match[1] !== undefined) {
      imports.push(match[1] as string);
    }
  }

  return imports;
}

function resolveImport(importPath: string, fromFile: string): boolean {
  const dir = path.dirname(fromFile);
  const candidates = [
    path.resolve(dir, importPath + ".ts"),
    path.resolve(dir, importPath + ".js"),
    path.resolve(dir, importPath, "index.ts"),
    path.resolve(dir, importPath, "index.js"),
  ];

  return candidates.some((candidate) => fs.existsSync(candidate));
}

describe("Import Resolution", () => {
  it("should resolve all relative imports in backend", () => {
    const files = getAllTsFiles(backendSrc);
    const unresolvedImports: Array<{ file: string; import: string }> = [];

    for (const file of files) {
      const imports = extractRelativeImports(file);

      for (const imp of imports) {
        if (!resolveImport(imp, file)) {
          unresolvedImports.push({
            file: path.relative(backendSrc, file),
            import: imp,
          });
        }
      }
    }

    if (unresolvedImports.length > 0) {
      const errorMsg = unresolvedImports
        .map((u) => `  ${u.file}: ${u.import}`)
        .join("\n");
      throw new Error(`Found ${unresolvedImports.length} unresolved imports:\n${errorMsg}`);
    }

    expect(unresolvedImports).toHaveLength(0);
  });

  it("should have required module exports", async () => {
    // Test observability module exists and exports required functions
    const observabilityPath = path.join(backendSrc, "lib/observability/index.ts");
    expect(fs.existsSync(observabilityPath), "observability/index.ts should exist").toBe(true);

    const { createCounter, createHistogram, createObservableGauge } = await import(
      "../lib/observability/index.js"
    );

    expect(typeof createCounter).toBe("function");
    expect(typeof createHistogram).toBe("function");
    expect(typeof createObservableGauge).toBe("function");
  });

  it("should have shutdown module with required exports", async () => {
    const shutdownPath = path.join(backendSrc, "lib/shutdown/gracefulShutdown.ts");
    expect(fs.existsSync(shutdownPath), "shutdown/gracefulShutdown.ts should exist").toBe(true);

    const { registerShutdownHandler } = await import("../lib/shutdown/gracefulShutdown.js");
    expect(typeof registerShutdownHandler).toBe("function");
  });
});
