import path from 'path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

import { createBackendResolveAliases } from './vitest.aliases';

const root = path.resolve(import.meta.dirname, '../..');

export default defineConfig({
  // @ts-expect-error — @vitejs/plugin-react targets vite 6, vitest/config resolves vite 7
  plugins: [react()],
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
    fileParallelism: false,
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
    alias: createBackendResolveAliases(root),
  },
});
