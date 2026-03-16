import { defineConfig } from 'vitest/config';
import path from 'path';

const root = path.resolve(import.meta.dirname, '../..');

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
    fileParallelism: false,
    env: {
      // AgentPolicyService defaults to process.cwd()/policies/agents.
      // Tests run from packages/backend, so point explicitly to the repo-root policies.
      AGENT_POLICY_DIR: path.resolve(root, 'policies/agents'),
    },
  },
  resolve: {
    alias: {
      '@shared': path.resolve(root, 'packages/shared/src'),
      '@backend': path.resolve(root, 'packages/backend/src'),
      '@mcp': path.resolve(root, 'packages/mcp'),
    },
  },
});
