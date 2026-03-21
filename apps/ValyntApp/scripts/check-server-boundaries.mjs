import fs from "node:fs";
import path from "node:path";

const appRoot = path.resolve(process.cwd());
const srcRoot = path.join(appRoot, "src");

const browserBoundaryRoots = [
  "api",
  "app",
  "components",
  "contexts",
  "dashboards",
  "features",
  "hooks",
  "lib",
  "pages",
  "repositories",
  "views",
];

const rootLevelBrowserFiles = new Set(["App.tsx", "AppRoutes.tsx", "GuestAccessService.ts", "main.tsx"]);
const importPatterns = [
  /\bimport\s+[^'"]*?from\s+["']([^"']+)["']/g,
  /\bexport\s+[^'"]*?from\s+["']([^"']+)["']/g,
  /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
  /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
];

const shouldInspect = (relativePath) => {
  if (!/\.(ts|tsx)$/.test(relativePath)) {
    return false;
  }

  if (
    relativePath.endsWith(".server.ts") ||
    relativePath.endsWith(".server.tsx") ||
    relativePath.endsWith(".test.ts") ||
    relativePath.endsWith(".test.tsx") ||
    relativePath.endsWith(".spec.ts") ||
    relativePath.endsWith(".spec.tsx") ||
    relativePath.includes(`${path.sep}__tests__${path.sep}`)
  ) {
    return false;
  }

  const normalized = relativePath.split(path.sep);
  if (normalized.length === 1) {
    return rootLevelBrowserFiles.has(relativePath);
  }

  return browserBoundaryRoots.includes(normalized[0]);
};

const walk = (dir) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === "dist") {
      continue;
    }

    const absolutePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(absolutePath));
      continue;
    }

    const relativePath = path.relative(srcRoot, absolutePath);
    if (shouldInspect(relativePath)) {
      files.push(absolutePath);
    }
  }

  return files;
};

const findForbiddenImports = (source) => {
  const matches = [];

  for (const pattern of importPatterns) {
    pattern.lastIndex = 0;
    for (const match of source.matchAll(pattern)) {
      const specifier = match[1];
      if (specifier.includes(".server")) {
        matches.push(specifier);
      }
    }
  }

  return matches;
};

const violations = [];

for (const filePath of walk(srcRoot)) {
  const source = fs.readFileSync(filePath, "utf8");
  const forbiddenImports = findForbiddenImports(source);

  if (forbiddenImports.length === 0) {
    continue;
  }

  violations.push({
    filePath: path.relative(appRoot, filePath),
    imports: [...new Set(forbiddenImports)].sort(),
  });
}

if (violations.length > 0) {
  console.error(
    [
      "Server-only import boundary violations found:",
      ...violations.flatMap(({ filePath, imports }) => [
        `- ${filePath}`,
        ...imports.map((specifier) => `  • ${specifier}`),
      ]),
    ].join("\n"),
  );
  process.exit(1);
}

console.log("Server-only import boundaries passed.");
