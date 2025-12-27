/**
 * Dependency Analyzer - Cognitive Pipeline Phase 0.1
 *
 * Analyzes TypeScript/JavaScript dependencies to determine:
 * 1. Direct dependencies of changed files
 * 2. Affected files (reverse dependencies)
 * 3. Blast radius (all transitively affected files)
 * 4. Risk score based on complexity and criticality
 *
 * Usage:
 *   npm run analyze:deps
 *   node scripts/analyze-dependencies.ts path/to/file.ts
 */

import * as ts from "typescript";
import * as path from "path";
import * as fs from "fs";
import { execSync } from "child_process";

interface DependencyNode {
  path: string;
  imports: string[];
  importedBy: string[];
}

interface DependencyGraph {
  nodes: Map<string, DependencyNode>;
}

interface ImpactAnalysis {
  changedFiles: string[];
  directDependencies: string[];
  affectedFiles: string[];
  blastRadius: number;
  riskScore: number;
  affectedTests: string[];
  affectedServices: string[];
}

/**
 * Build a dependency graph from TypeScript project
 */
export function buildDependencyGraph(rootDir: string): DependencyGraph {
  const graph: DependencyGraph = { nodes: new Map() };

  // Get all TS/TSX files
  const files = getAllTypeScriptFiles(rootDir);

  console.log(`📊 Analyzing ${files.length} TypeScript files...`);

  // Parse each file and extract imports
  for (const file of files) {
    const relativePath = path.relative(rootDir, file);
    const imports = extractImports(file, rootDir);

    graph.nodes.set(relativePath, {
      path: relativePath,
      imports,
      importedBy: [],
    });
  }

  // Build reverse dependencies (importedBy)
  for (const [filePath, node] of graph.nodes) {
    for (const importPath of node.imports) {
      const importedNode = graph.nodes.get(importPath);
      if (importedNode) {
        importedNode.importedBy.push(filePath);
      }
    }
  }

  return graph;
}

/**
 * Get all TypeScript files in directory
 */
function getAllTypeScriptFiles(dir: string): string[] {
  const files: string[] = [];

  function walk(currentPath: string) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);

      // Skip node_modules, dist, build
      if (
        entry.name === "node_modules" ||
        entry.name === "dist" ||
        entry.name === "build"
      ) {
        continue;
      }

      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
        files.push(fullPath);
      }
    }
  }

  walk(dir);
  return files;
}

/**
 * Extract imports from a TypeScript file
 */
function extractImports(filePath: string, rootDir: string): string[] {
  const imports: string[] = [];
  const sourceCode = fs.readFileSync(filePath, "utf-8");

  // Create a SourceFile
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceCode,
    ts.ScriptTarget.Latest,
    true
  );

  // Visit all import declarations
  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node)) {
      const moduleSpecifier = node.moduleSpecifier;
      if (ts.isStringLiteral(moduleSpecifier)) {
        const importPath = moduleSpecifier.text;

        // Only track relative imports (local files)
        if (importPath.startsWith(".")) {
          const resolvedPath = resolveImportPath(filePath, importPath, rootDir);
          if (resolvedPath) {
            imports.push(resolvedPath);
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return imports;
}

/**
 * Resolve relative import path to absolute
 */
function resolveImportPath(
  sourceFile: string,
  importPath: string,
  rootDir: string
): string | null {
  const sourceDir = path.dirname(sourceFile);
  let resolved = path.resolve(sourceDir, importPath);

  // Try common extensions
  const extensions = [".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.tsx"];

  for (const ext of extensions) {
    const candidate = resolved + ext;
    if (fs.existsSync(candidate)) {
      return path.relative(rootDir, candidate);
    }
  }

  // Check if resolved path itself exists
  if (fs.existsSync(resolved)) {
    return path.relative(rootDir, resolved);
  }

  return null;
}

/**
 * Find all files that import the given file (reverse dependencies)
 */
export function findAffectedFiles(
  graph: DependencyGraph,
  changedFiles: string[]
): string[] {
  const affected = new Set<string>();
  const queue = [...changedFiles];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const node = graph.nodes.get(current);

    if (!node) continue;

    for (const importer of node.importedBy) {
      if (!affected.has(importer)) {
        affected.add(importer);
        queue.push(importer); // Transitive dependencies
      }
    }
  }

  return Array.from(affected);
}

/**
 * Calculate risk score (0-10) for changes
 */
export function calculateRiskScore(
  changedFiles: string[],
  affectedFiles: string[],
  graph: DependencyGraph
): number {
  let score = 0;

  // Factor 1: Number of files changed (more changes = higher risk)
  score += Math.min(changedFiles.length * 0.5, 3);

  // Factor 2: Blast radius (affected files)
  const blastRadius = affectedFiles.length;
  if (blastRadius > 50) score += 4;
  else if (blastRadius > 20) score += 3;
  else if (blastRadius > 10) score += 2;
  else if (blastRadius > 5) score += 1;

  // Factor 3: Criticality (files with many importers are more critical)
  for (const file of changedFiles) {
    const node = graph.nodes.get(file);
    if (node && node.importedBy.length > 10) {
      score += 2; // High fan-out = critical
    }
  }

  // Factor 4: Core service files
  const coreServices = [
    "UnifiedAgentOrchestrator",
    "LlmProxyClient",
    "SessionManager",
    "SemanticMemory",
  ];
  for (const file of changedFiles) {
    if (coreServices.some((svc) => file.includes(svc))) {
      score += 3; // Core services are critical
    }
  }

  return Math.min(Math.round(score), 10);
}

/**
 * Map files to their test files
 */
export function findTestFiles(files: string[]): string[] {
  const tests: string[] = [];

  for (const file of files) {
    // Standard test patterns
    const testPatterns = [
      file.replace("/src/", "/tests/").replace(/\.(ts|tsx)$/, ".test.$1"),
      file.replace(/\.(ts|tsx)$/, ".test.$1"),
      file
        .replace("/src/", "/tests/__tests__/")
        .replace(/\.(ts|tsx)$/, ".test.$1"),
      file.replace(/\.(ts|tsx)$/, ".spec.$1"),
    ];

    for (const testPath of testPatterns) {
      if (fs.existsSync(testPath)) {
        tests.push(testPath);
      }
    }
  }

  return [...new Set(tests)];
}

/**
 * Identify affected services based on file paths
 */
export function identifyAffectedServices(files: string[]): string[] {
  const services = new Set<string>();

  const servicePatterns = {
    "Agent Orchestration": [
      "AgentOrchestrator",
      "AgentQuery",
      "AgentChat",
      "WorkflowExecution",
    ],
    "LLM Gateway": ["LlmProxy", "LLMCache", "LLMFallback", "LLMCost"],
    "Session Management": [
      "SessionManager",
      "SemanticMemory",
      "ConversationHistory",
    ],
    Security: ["AuthService", "RbacService", "Permission"],
    Observability: ["MetricsCollector", "AgentAudit", "Telemetry"],
  };

  for (const file of files) {
    for (const [service, patterns] of Object.entries(servicePatterns)) {
      if (patterns.some((pattern) => file.includes(pattern))) {
        services.add(service);
      }
    }
  }

  return Array.from(services);
}

/**
 * Get changed files from git
 */
export function getChangedFiles(): string[] {
  try {
    const output = execSync("git diff --name-only HEAD~1", {
      encoding: "utf-8",
    });
    return output.split("\n").filter((f) => f.trim() && /\.(ts|tsx)$/.test(f));
  } catch (error) {
    console.warn("Warning: Could not get changed files from git");
    return [];
  }
}

/**
 * Main analysis function
 */
export async function analyzeImpact(files?: string[]): Promise<ImpactAnalysis> {
  const rootDir = process.cwd();

  console.log("🔍 Building dependency graph...\n");
  const graph = buildDependencyGraph(path.join(rootDir, "src"));

  const changedFiles = files || getChangedFiles();

  if (changedFiles.length === 0) {
    console.log("ℹ️  No changed files detected\n");
    return {
      changedFiles: [],
      directDependencies: [],
      affectedFiles: [],
      blastRadius: 0,
      riskScore: 0,
      affectedTests: [],
      affectedServices: [],
    };
  }

  console.log(`📝 Changed files: ${changedFiles.length}`);
  changedFiles.forEach((f) => console.log(`   - ${f}`));
  console.log("");

  // Find affected files
  const affectedFiles = findAffectedFiles(graph, changedFiles);
  console.log(`📊 Affected files: ${affectedFiles.length}`);

  // Calculate risk
  const riskScore = calculateRiskScore(changedFiles, affectedFiles, graph);
  console.log(`⚠️  Risk Score: ${riskScore}/10\n`);

  // Find relevant tests
  const allAffected = [...changedFiles, ...affectedFiles];
  const affectedTests = findTestFiles(allAffected);
  console.log(`🧪 Affected tests: ${affectedTests.length}`);

  // Identify services
  const affectedServices = identifyAffectedServices(allAffected);
  console.log(
    `🏗️  Affected services: ${affectedServices.join(", ") || "None"}\n`
  );

  return {
    changedFiles,
    directDependencies: [],
    affectedFiles,
    blastRadius: affectedFiles.length,
    riskScore,
    affectedTests,
    affectedServices,
  };
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  analyzeImpact(args.length > 0 ? args : undefined)
    .then((result) => {
      console.log("📄 Writing impact.json...");
      fs.writeFileSync("impact.json", JSON.stringify(result, null, 2));
      console.log("✅ Done!\n");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Analysis failed:", error);
      process.exit(1);
    });
}
