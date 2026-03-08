import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

const SCOPES = {
  appLib: "apps/ValyntApp/src/lib/",
  backend: "packages/backend/src/",
};

const importRegex = /(?:import|export)\s+(?:[^"']+\s+from\s+)?["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)/g;

const violations = [];

for (const file of walk(repoRoot)) {
  const rel = toRel(file);
  if (!isSourceFile(file)) continue;

  const source = fs.readFileSync(file, "utf8");
  const imports = [...source.matchAll(importRegex)].map((m) => m[1] ?? m[2]).filter(Boolean);

  for (const spec of imports) {
    const resolvedRel = resolveRelativeImport(rel, spec);

    if (rel.startsWith(SCOPES.appLib)) {
      if (spec.startsWith("@valueos/") && spec.includes("/src/")) {
        violations.push(`${rel}: app lib import reaches package internals via \"${spec}\"`);
      }
      if (resolvedRel?.startsWith("packages/")) {
        violations.push(`${rel}: app lib crosses boundary via relative import \"${spec}\"`);
      }
    }

    if (rel.startsWith(SCOPES.backend)) {
      if (["../lib/agent-fabric", "../lib/agent-fabric.ts", "./lib/agent-fabric", "./lib/agent-fabric.ts"].includes(spec) && !rel.endsWith("lib/agent-fabric.ts")) {
        violations.push(`${rel}: backend must consume package APIs, not backend-local agent-fabric entrypoints (\"${spec}\")`);
      }
      if (resolvedRel?.startsWith("apps/ValyntApp/")) {
        violations.push(`${rel}: backend imports app layer via \"${spec}\"`);
      }
    }

    // @valueos/agents was deleted in Sprint 2. Flag any surviving imports.
    if (spec === '@valueos/agents' || spec.startsWith('@valueos/agents/')) {
      violations.push(`${rel}: @valueos/agents was deleted in Sprint 2; import from packages/backend/src/lib/agents/ instead ("${spec}")`);
    }
  }
}

if (violations.length > 0) {
  console.error("❌ Module boundary check failed:\n");
  for (const v of violations) console.error(` - ${v}`);
  process.exit(1);
}

console.log("✅ Module boundary check passed.");

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (["node_modules", ".git", "dist", "build", "coverage", ".turbo"].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else files.push(full);
  }
  return files;
}

function isSourceFile(filePath) {
  return SOURCE_EXTENSIONS.has(path.extname(filePath));
}

function toRel(absPath) {
  return path.relative(repoRoot, absPath).replaceAll(path.sep, "/");
}

function resolveRelativeImport(importerRel, specifier) {
  if (!specifier.startsWith(".")) return null;
  const importerDir = path.dirname(importerRel);
  const candidate = path.normalize(path.join(importerDir, specifier)).replaceAll(path.sep, "/");
  return candidate;
}
