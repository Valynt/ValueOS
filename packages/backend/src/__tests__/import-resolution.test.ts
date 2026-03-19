/**
 * Import Resolution Tests
 * Ensures backend imports align with TypeScript and Vitest module resolution.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import ts from "typescript";
import { describe, expect, it } from "vitest";

import { createBackendResolveAliases } from "../../vitest.aliases";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(backendRoot, "..", "..", "..");
const backendTsconfigPath = path.resolve(backendRoot, "..", "tsconfig.json");
const appTsconfigPath = path.resolve(repoRoot, "tsconfig.app.json");
const workspaceImportPrefixes = ["@shared", "@valueos/", "@backend", "@mcp", "@sdui/"];

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

function extractImports(filePath: string): string[] {
  const content = fs.readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const imports = new Set<string>();

  function recordSpecifier(specifier: ts.Expression | undefined) {
    if (!specifier || !ts.isStringLiteralLike(specifier)) {
      return;
    }

    imports.add(specifier.text);
  }

  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      recordSpecifier(node.moduleSpecifier);
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const [firstArg] = node.arguments;
      recordSpecifier(firstArg);
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return [...imports];
}

function readCompilerOptions(tsconfigPath: string): ts.CompilerOptions {
  const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
  if (configFile.error) {
    throw new Error(ts.flattenDiagnosticMessageText(configFile.error.messageText, "\n"));
  }

  const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, path.dirname(tsconfigPath));
  if (parsed.errors.length > 0) {
    throw new Error(
      parsed.errors.map((error) => ts.flattenDiagnosticMessageText(error.messageText, "\n")).join("\n")
    );
  }

  return parsed.options;
}

function isWorkspaceImport(specifier: string): boolean {
  return workspaceImportPrefixes.some((prefix) => specifier.startsWith(prefix));
}

function isImportUnderTest(specifier: string): boolean {
  return specifier.startsWith(".") || isWorkspaceImport(specifier);
}

function classifyUnresolvedImport(specifier: string): string {
  if (specifier.startsWith(".")) {
    return specifier.endsWith(".js") ? "relative .js specifier without matching TS source" : "relative target missing";
  }

  return "workspace alias or package export drift";
}

function resolveWithTypeScript(specifier: string, fromFile: string, compilerOptions: ts.CompilerOptions): boolean {
  const { resolvedModule } = ts.resolveModuleName(specifier, fromFile, compilerOptions, ts.sys);
  return resolvedModule !== undefined;
}

type VitestAlias = ReturnType<typeof createBackendResolveAliases>[number];

function aliasMatchesImport(alias: VitestAlias, specifier: string): boolean {
  if (typeof alias.find === "string") {
    return specifier === alias.find || specifier.startsWith(`${alias.find}/`);
  }

  return alias.find.test(specifier);
}

function pathKeyMatchesImport(pathKey: string, specifier: string): boolean {
  if (pathKey.endsWith("/*")) {
    const prefix = pathKey.slice(0, -1);
    return specifier.startsWith(prefix);
  }

  return specifier === pathKey;
}

function formatGroupedFailures(
  unresolvedImports: Array<{ file: string; import: string; reason: string }>
): string {
  const grouped = new Map<string, string[]>();

  for (const unresolved of unresolvedImports) {
    const bucket = grouped.get(unresolved.reason) ?? [];
    bucket.push(`  ${unresolved.file}: ${unresolved.import}`);
    grouped.set(unresolved.reason, bucket);
  }

  return [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([reason, entries]) => `${reason} (${entries.length})\n${entries.join("\n")}`)
    .join("\n\n");
}

describe("Import Resolution", () => {
  const backendCompilerOptions = readCompilerOptions(backendTsconfigPath);
  const appCompilerOptions = readCompilerOptions(appTsconfigPath);
  const vitestAliases = createBackendResolveAliases(repoRoot);
  const files = getAllTsFiles(backendRoot);
  const fileImports = new Map(files.map((file) => [file, extractImports(file)]));
  const importedWorkspaceModules = new Set(
    files.flatMap((file) => fileImports.get(file)?.filter(isWorkspaceImport) ?? [])
  );

  it("should resolve backend relative and workspace imports with TypeScript semantics", () => {
    const unresolvedImports: Array<{ file: string; import: string; reason: string }> = [];

    for (const file of files) {
      const imports = (fileImports.get(file) ?? []).filter(isImportUnderTest);

      for (const importedModule of imports) {
        if (!resolveWithTypeScript(importedModule, file, backendCompilerOptions)) {
          unresolvedImports.push({
            file: path.relative(backendRoot, file),
            import: importedModule,
            reason: classifyUnresolvedImport(importedModule),
          });
        }
      }
    }

    if (unresolvedImports.length > 0) {
      throw new Error(
        `Found ${unresolvedImports.length} unresolved backend imports grouped by root cause:\n${formatGroupedFailures(
          unresolvedImports
        )}`
      );
    }

    expect(unresolvedImports).toHaveLength(0);
  });

  it("should keep backend Vitest aliases aligned with backend-used tsconfig paths", { timeout: 15_000 }, () => {
    const tsconfigPaths = appCompilerOptions.paths ?? {};
    const driftedImports: Array<{ import: string; tsconfigPath: string }> = [];

    for (const importedModule of [...importedWorkspaceModules].sort()) {
      const matchingPathKey = Object.keys(tsconfigPaths).find((pathKey) => pathKeyMatchesImport(pathKey, importedModule));

      if (!matchingPathKey) {
        continue;
      }

      const coveredByVitest = vitestAliases.some((alias) => aliasMatchesImport(alias, importedModule));
      if (!coveredByVitest) {
        driftedImports.push({ import: importedModule, tsconfigPath: matchingPathKey });
      }
    }

    if (driftedImports.length > 0) {
      const errorMsg = driftedImports
        .map(({ import: importedModule, tsconfigPath }) => `  ${importedModule} (tsconfig path: ${tsconfigPath})`)
        .join("\n");
      throw new Error(
        `Vitest aliases are missing backend-used tsconfig path coverage for ${driftedImports.length} imports:\n${errorMsg}`
      );
    }

    expect(driftedImports).toHaveLength(0);
  });

  it("should have required module exports", async () => {
    // Test observability module exists and exports required functions
    const observabilityPath = path.join(backendRoot, "lib/observability/index.ts");
    expect(fs.existsSync(observabilityPath), "observability/index.ts should exist").toBe(true);

    const { createCounter, createHistogram, createObservableGauge } = await import(
      "../lib/observability/index.js"
    );

    expect(typeof createCounter).toBe("function");
    expect(typeof createHistogram).toBe("function");
    expect(typeof createObservableGauge).toBe("function");
  });

  it("should have shutdown module with required exports", async () => {
    const shutdownPath = path.join(backendRoot, "lib/shutdown/gracefulShutdown.ts");
    expect(fs.existsSync(shutdownPath), "shutdown/gracefulShutdown.ts should exist").toBe(true);

    const { registerShutdownHandler } = await import("../lib/shutdown/gracefulShutdown.js");
    expect(typeof registerShutdownHandler).toBe("function");
  });
});
