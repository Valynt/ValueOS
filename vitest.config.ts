import { defineConfig } from "vitest/config";

import { rootVitestProjects } from "./scripts/ci/vitest-workspace-topology.mjs";

/**
 * Root Vitest workspace — package-local configs own environment + aliases.
 *
 * Guarded by scripts/ci/check-vitest-workspace-packages.mjs so any workspace
 * package that gains test files must be added here (via the shared topology manifest).
 */
export default defineConfig({
  test: {
    projects: rootVitestProjects,
  },
});
