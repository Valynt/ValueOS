import path from 'path';

import { defineConfig } from 'vitest/config';

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
    alias: [
      // Workspace package aliases — keep in sync with tsconfig.app.json paths.
      { find: '@shared', replacement: path.resolve(root, 'packages/shared/src') },
      { find: '@backend', replacement: path.resolve(root, 'packages/backend/src') },
      { find: '@mcp', replacement: path.resolve(root, 'packages/mcp') },
      // @valueos/memory sub-path exports: @valueos/memory/<sub> → packages/memory/<sub>/index.ts
      // Must be listed before the bare @valueos/memory entry so the more-specific
      // pattern matches first.
      {
        find: /^@valueos\/memory\/(.+)$/,
        replacement: path.resolve(root, 'packages/memory/$1/index.ts'),
      },
      { find: '@valueos/memory', replacement: path.resolve(root, 'packages/memory/index.ts') },
    ],
  },
});
