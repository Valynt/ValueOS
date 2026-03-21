/**
 * Standalone Vitest configuration for enterprise quality remediation tests.
 *
 * These tests are static-analysis-based: they inspect source files, migrations,
 * and configuration files to verify that audit findings have been remediated.
 * They do not require a running server, browser, or database.
 *
 * Run with:
 *   npx vitest run --config tests/vitest.remediation.config.ts
 *
 * Or via the npm script:
 *   pnpm run test:remediation
 */

import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    name: 'remediation',
    globals: true,
    environment: 'node',
    include: [
      'tests/e2e/architecture-quality.spec.ts',
      'tests/e2e/ui-ux-design-system.spec.ts',
      'tests/e2e/security-multi-tenancy.spec.ts',
      'tests/e2e/performance-scalability.spec.ts',
      'tests/e2e/testing-cicd.spec.ts',
    ],
    exclude: ['**/node_modules/**', '**/dist/**'],
    // No coverage needed for static analysis tests
    coverage: {
      enabled: false,
    },
    // Increase timeout for file system operations
    testTimeout: 30000,
    // Run sequentially to avoid file system race conditions
    fileParallelism: false,
    // Root is the monorepo root so process.cwd() resolves correctly
    root: path.resolve(__dirname, '..'),
  },
});
