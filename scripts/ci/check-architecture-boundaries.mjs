import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

import { architectureBoundaryPolicy } from "../../config/architecture-boundaries.mjs";

const repoRoot = process.cwd();
const SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];
const IMPORT_RE = /\b(?:import|export)\s+(?:type\s+)?(?:[^'"\n]*?\s+from\s+)?["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;

const zoneEntries = Object.entries(architectureBoundaryPolicy.zones).map(
  ([zoneName, zone]) => ({ zoneName, ...zone }),
);

const monitoredRoots = Array.from(new Set(zoneEntries.flatMap((zone) => zone.roots)));
const sharedZoneName = architectureBoundaryPolicy.sharedPackage.zone;
const sharedServerOnlyRules = architectureBoundaryPolicy.sharedPackage.documentedExceptions.serverOnly;
const sharedMixedRuntimeRules = architectureBoundaryPolicy.sharedPackage.documentedExceptions.mixedRuntime;

const internalAliasPrefixes = [
  "@/",
  "@app/",
  "@pages/",
  "@layouts/",
  "@components/",
  "@features/",
  "@services/",
  "@lib/",
  "@hooks/",
  "@types/",
  "@assets/",
  "@mcp/",
  "@mcp-common/",
  "@memory/",
  "@agents/",
  "@integrations/",
  "@valueos/components",
  "@valueos/components/",
  "@valueos/memory",
  "@valueos/memory/",
  "@valueos/integrations",
  "@valueos/integrations/",
  "@valueos/mcp",
  "@valueos/mcp/",
  "@valueos/templates",
  "@valueos/business-case",
];

function toPosix(value) {
  return value.split(path.sep).join("/");
}

function escapeRegex(value) {
  return value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}

function globToRegex(glob) {
  const tokens = toPosix(glob).split("**");
  const escaped = tokens.map((token) => escapeRegex(token).replace(/\\\*/g, "[^/]*"));
  return new RegExp(`^${escaped.join(".*")}$`);
}

function walkFiles(dirPath) {
  const output = [];
  if (!existsSync(dirPath)) {
    return output;
  }

  for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
    const absolutePath = path.join(dirPath, entry.name);
    const relativePath = toPosix(path.relative(repoRoot, absolutePath));

    if (entry.isDirectory()) {
      if (["node_modules", "dist", "build", "coverage", ".turbo"].includes(entry.name)) {
        continue;
      }
      output.push(...walkFiles(absolutePath));
      continue;
    }

    if (!SOURCE_EXTENSIONS.includes(path.extname(entry.name))) {
      continue;
    }

    if (
      relativePath.includes("/__tests__/")
      || /\.(test|spec)\.[^.]+$/.test(relativePath)
      || relativePath.endsWith(".d.ts")
    ) {
      continue;
    }

    output.push(absolutePath);
  }

  return output;
}

function extractImports(sourceText) {
  const imports = [];
  for (const match of sourceText.matchAll(IMPORT_RE)) {
    const specifier = match[1] ?? match[2];
    if (specifier) {
      imports.push(specifier);
    }
  }
  return imports;
}

function getZoneForFile(relativePath) {
  return zoneEntries.find((zone) => zone.roots.some((root) => relativePath.startsWith(`${root}/`) || relativePath === root));
}

function resolveWithCandidates(basePath) {
  const candidates = [
    basePath,
    ...SOURCE_EXTENSIONS.map((extension) => `${basePath}${extension}`),
    ...SOURCE_EXTENSIONS.map((extension) => path.join(basePath, `index${extension}`)),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return basePath;
}

function resolveImport(sourceAbsolutePath, specifier) {
  if (internalAliasPrefixes.some((prefix) => specifier === prefix || specifier.startsWith(prefix))) {
    return null;
  }

  const sourceDir = path.dirname(sourceAbsolutePath);

  if (specifier.startsWith(".")) {
    return toPosix(path.relative(repoRoot, resolveWithCandidates(path.resolve(sourceDir, specifier))));
  }

  const aliasMappings = [
    ["@valueos/shared", "packages/shared/src/index.ts"],
    ["@valueos/shared/", "packages/shared/src/"],
    ["@shared/", "packages/shared/src/"],
    ["@valueos/sdui", "packages/sdui/src/index.ts"],
    ["@valueos/sdui/", "packages/sdui/src/"],
    ["@sdui/", "packages/sdui/src/"],
    ["@valueos/backend", "packages/backend/src/index.ts"],
    ["@valueos/backend/", "packages/backend/src/"],
    ["@backend/", "packages/backend/src/"],
    ["@valueos/infra", "packages/infra/index.ts"],
    ["@valueos/infra/", "packages/infra/"],
    ["@infra/", "packages/infra/"],
  ];

  for (const [prefix, target] of aliasMappings) {
    if (specifier === prefix && !prefix.endsWith("/")) {
      return toPosix(path.relative(repoRoot, resolveWithCandidates(path.join(repoRoot, target))));
    }
    if (prefix.endsWith("/") && specifier.startsWith(prefix)) {
      const suffix = specifier.slice(prefix.length);
      return toPosix(path.relative(repoRoot, resolveWithCandidates(path.join(repoRoot, target, suffix))));
    }
  }

  if (specifier.startsWith("/workspace/ValueOS/")) {
    return toPosix(path.relative(repoRoot, resolveWithCandidates(specifier)));
  }

  return null;
}

function matchPolicyRule(relativePath, rules) {
  return rules.find((rule) => globToRegex(rule.pattern).test(relativePath));
}

function classifySharedPath(relativePath) {
  const serverRule = matchPolicyRule(relativePath, sharedServerOnlyRules);
  if (serverRule) {
    return { classification: "server-only", reason: serverRule.reason };
  }

  const mixedRule = matchPolicyRule(relativePath, sharedMixedRuntimeRules);
  if (mixedRule) {
    return { classification: "mixed-runtime", reason: mixedRule.reason };
  }

  return {
    classification: architectureBoundaryPolicy.sharedPackage.defaultClassification,
    reason: "packages/shared defaults to browser-safe, domain-oriented modules.",
  };
}

const violations = [];
const files = monitoredRoots.flatMap((root) => walkFiles(path.join(repoRoot, root)));

for (const absoluteFilePath of files) {
  const sourceRelativePath = toPosix(path.relative(repoRoot, absoluteFilePath));
  const sourceZone = getZoneForFile(sourceRelativePath);

  if (!sourceZone) {
    continue;
  }

  const imports = extractImports(readFileSync(absoluteFilePath, "utf8"));

  for (const specifier of imports) {
    const targetRelativePath = resolveImport(absoluteFilePath, specifier);
    if (!targetRelativePath) {
      continue;
    }

    const targetZone = getZoneForFile(targetRelativePath);
    if (!targetZone) {
      continue;
    }

    if (
      sourceZone.zoneName !== targetZone.zoneName
      && !sourceZone.allowedZoneImports.includes(targetZone.zoneName)
    ) {
      violations.push({
        sourceRelativePath,
        specifier,
        targetRelativePath,
        message: `${sourceZone.zoneName} cannot depend on ${targetZone.zoneName}. Allowed zones: ${sourceZone.allowedZoneImports.join(", ") || "(none)"}.`,
      });
      continue;
    }

    if (sourceZone.runtime === "browser") {
      const browserBlockedRule = matchPolicyRule(
        targetRelativePath,
        architectureBoundaryPolicy.browserBlockedTargets,
      );
      if (browserBlockedRule) {
        violations.push({
          sourceRelativePath,
          specifier,
          targetRelativePath,
          message: browserBlockedRule.message,
        });
        continue;
      }

      if (targetZone.zoneName === sharedZoneName) {
        const sharedClassification = classifySharedPath(targetRelativePath);
        if (sharedClassification.classification !== "browser-safe") {
          violations.push({
            sourceRelativePath,
            specifier,
            targetRelativePath,
            message: `Browser code imported shared ${sharedClassification.classification} module. ${sharedClassification.reason}`,
          });
        }
      }
    }

    if (sourceZone.zoneName === sharedZoneName && targetZone.zoneName !== sharedZoneName) {
      violations.push({
        sourceRelativePath,
        specifier,
        targetRelativePath,
        message: "packages/shared is domain-only and must not import app/runtime code.",
      });
    }
  }
}

if (violations.length > 0) {
  console.error("Architecture boundary violations detected:\n");
  for (const violation of violations) {
    console.error(`- ${violation.sourceRelativePath}`);
    console.error(`    import: ${violation.specifier}`);
    console.error(`    target: ${violation.targetRelativePath}`);
    console.error(`    why: ${violation.message}`);
  }
  process.exit(1);
}

console.log("Architecture boundary check passed.");
for (const zone of zoneEntries) {
  const allowed = zone.allowedZoneImports.length > 0 ? zone.allowedZoneImports.join(", ") : "(leaf)";
  console.log(`- ${zone.zoneName} -> ${allowed}`);
}
console.log(
  `- ${sharedZoneName} default classification: ${architectureBoundaryPolicy.sharedPackage.defaultClassification}`,
);
