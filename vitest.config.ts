import fs from "node:fs";
import path from "node:path";

import { defineConfig } from "vitest/config";

const root = path.resolve(import.meta.dirname);
const policyPath = path.resolve(root, "config/ci/workspace-package-policy.json");
const packagePolicy = JSON.parse(fs.readFileSync(policyPath, "utf8")) as {
  packages: Record<
    string,
    {
      shipped: boolean;
      ci: {
        rootVitest: {
          status: "covered" | "excluded";
          justification: string;
        };
      };
    }
  >;
};

const inlineProjects = {
  "packages/infra": {
    test: {
      name: "infra",
      globals: true,
      environment: "node",
      include: ["packages/infra/**/*.{test,spec}.ts"],
      exclude: ["**/node_modules/**", "**/dist/**"],
      fileParallelism: false,
    },
  },
  "packages/mcp/ground-truth": {
    test: {
      name: "mcp-ground-truth",
      globals: true,
      environment: "node",
      include: ["packages/mcp/ground-truth/**/*.test.ts"],
      exclude: ["**/node_modules/**", "**/dist/**"],
      fileParallelism: false,
    },
    resolve: {
      alias: {
        "@mcp-common": path.resolve(root, "packages/mcp/common"),
      },
    },
  },
  "packages/memory": {
    test: {
      name: "memory",
      globals: true,
      environment: "node",
      include: ["packages/memory/tests/**/*.{test,spec}.ts", "packages/memory/**/*.test.ts"],
      exclude: ["**/node_modules/**", "**/dist/**"],
      fileParallelism: false,
    },
    resolve: {
      alias: {
        "@shared": path.resolve(root, "packages/shared/src"),
      },
    },
  },
  "packages/sdui": {
    test: {
      name: "sdui",
      globals: true,
      environment: "jsdom",
      include: ["packages/sdui/src/**/*.{test,spec}.{ts,tsx}"],
      exclude: ["**/node_modules/**", "**/dist/**", "**/*.pure-unit.test.*"],
    },
    resolve: {
      alias: {
        "@shared": path.resolve(root, "packages/shared/src"),
        "@valueos/shared": path.resolve(root, "packages/shared/src"),
        "@valueos/sdui": path.resolve(root, "packages/sdui/src"),
        "@valueos/components": path.resolve(root, "packages/components"),
        "@sdui/components": path.resolve(root, "packages/sdui/src/components"),
        "@testing-library/react": path.resolve(root, "apps/ValyntApp/node_modules/@testing-library/react"),
        "@testing-library/jest-dom": path.resolve(root, "apps/ValyntApp/node_modules/@testing-library/jest-dom"),
        "@testing-library/user-event": path.resolve(root, "apps/ValyntApp/node_modules/@testing-library/user-event"),
      },
    },
  },
  "packages/shared": {
    test: {
      name: "shared",
      globals: true,
      environment: "node",
      include: ["packages/shared/**/*.{test,spec}.ts"],
      exclude: ["**/node_modules/**", "**/dist/**"],
      fileParallelism: false,
    },
  },
} as const;

const delegatedProjects = {
  "apps/ValyntApp": "apps/ValyntApp",
  "packages/backend": "packages/backend",
  "packages/components": "packages/components",
  "packages/components/design-system": "packages/components",
  "packages/integrations": "packages/integrations",
  "packages/services/domain-validator": "packages/services/domain-validator",
} as const;

const projectDefinitions = {
  ...inlineProjects,
  ...delegatedProjects,
};

const shippedEntries = Object.entries(packagePolicy.packages)
  .filter(([, packageEntry]) => packageEntry.shipped)
  .sort(([left], [right]) => left.localeCompare(right));
const coveredProjects = shippedEntries.filter(([, packageEntry]) => packageEntry.ci.rootVitest.status === "covered");
const missingProjectDefinitions = coveredProjects
  .map(([packagePath]) => packagePath)
  .filter((packagePath) => !(packagePath in projectDefinitions));

if (missingProjectDefinitions.length > 0) {
  throw new Error(
    `Root Vitest is missing explicit project definitions for shipped packages: ${missingProjectDefinitions.join(", ")}`,
  );
}

const excludedShippedPackages = shippedEntries.filter(([, packageEntry]) => packageEntry.ci.rootVitest.status === "excluded");
if (excludedShippedPackages.some(([, packageEntry]) => packageEntry.ci.rootVitest.justification.trim().length === 0)) {
  throw new Error("Shipped packages excluded from root Vitest must include a justification in workspace-package-policy.json.");
}

/**
 * Vitest workspace policy.
 *
 * Every shipped workspace package listed in config/ci/workspace-package-policy.json must be
 * either mapped here as an explicit project or excluded in that policy with a justification.
 *
 * Repository contract: `pnpm test` is the workspace unit-test lane. Package-local Vitest
 * configs may delegate broader suites (integration, perf/load, security, e2e) to separate
 * commands or configs, but the default workspace run must stay unit-only.
 */
const explicitProjects = Array.from(
  new Set(coveredProjects.map(([packagePath]) => projectDefinitions[packagePath as keyof typeof projectDefinitions])),
);

export default defineConfig({
  test: {
    projects: explicitProjects,
  },
});
