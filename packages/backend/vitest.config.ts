import path from 'path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const root = path.resolve(import.meta.dirname, '../..');

export default defineConfig({
  // @ts-expect-error — @vitejs/plugin-react targets vite 6, vitest/config resolves vite 7
  plugins: [react()],
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
    fileParallelism: false,
    setupFiles: ['./src/test/setup.ts'],
    env: {
      // AgentPolicyService defaults to process.cwd()/policies/agents.
      // Tests run from packages/backend, so point explicitly to the repo-root policies.
      AGENT_POLICY_DIR: path.resolve(root, 'policies/agents'),
      // Required by environment config — prevents CORS validation throw in tests
      CORS_ORIGINS: 'http://localhost:5173',
      // Required by AuthService / TCT middleware
      TCT_SECRET: 'test-tct-secret-32-bytes-minimum!!',
      TCT_ALLOW_EPHEMERAL_SECRET: 'true',
      LOCAL_TEST_MODE: 'true',
      // Required by WEB_SCRAPER
      WEB_SCRAPER_ENCRYPTION_KEY: 'a'.repeat(64),
      // Supabase stubs
      SUPABASE_URL: 'http://localhost:54321',
      SUPABASE_ANON_KEY: 'test-anon-key',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
      VITE_SUPABASE_URL: 'http://localhost:54321',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
      // JWT
      JWT_SECRET: 'test-jwt-secret-for-tests-only',
      // Redis (not running in tests — services should handle gracefully)
      REDIS_URL: 'redis://localhost:6379',
    },
  },
  resolve: {
    alias: [
      // Workspace package aliases — keep in sync with tsconfig.app.json paths.
      { find: '@shared', replacement: path.resolve(root, 'packages/shared/src') },
      { find: '@valueos/shared', replacement: path.resolve(root, 'packages/shared/src') },
      { find: '@valueos/sdui', replacement: path.resolve(root, 'packages/sdui/src') },
      { find: /^@sdui\/(.+)$/, replacement: path.resolve(root, 'packages/sdui/src/$1') },
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
