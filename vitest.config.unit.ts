/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom', // Use jsdom for React component tests
    setupFiles: ['./tests/setup-minimal.ts'], // Minimal setup, no database
    include: [
      'src/config/__tests__/*.test.ts',
      'src/security/__tests__/*.test.ts',
      'src/utils/__tests__/*.test.ts',
      'src/lib/__tests__/*.test.ts',
      'src/components/**/__tests__/*.test.tsx',
      'src/views/**/__tests__/*.test.tsx',
      'src/sdui/__tests__/*.unit.test.tsx',
      'src/sdui/__tests__/*.benchmark.test.ts',
      'src/sdui/__tests__/load.test.ts',
      'src/sdui/components/__tests__/*.test.tsx',
    ],
    exclude: [
      'node_modules',
      'dist',
      '**/*.integration.test.{ts,tsx}',
      'src/repositories/**',
      'src/__tests__/integration/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@services': path.resolve(__dirname, './src/services'),
      '@lib': path.resolve(__dirname, './src/lib'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@types': path.resolve(__dirname, './src/types'),
    },
  },
});
