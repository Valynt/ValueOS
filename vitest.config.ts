/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'node', // Use node env for backend/repo tests
    setupFiles: ['./tests/setup.ts', './src/test/setup-integration.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'tests/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'test/',
        'tests/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData',
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
        'dist/',
        '.storybook/',
        'storybook-static/',
      ],
    },
    exclude: [
      'node_modules',
      'dist',
      '.storybook',
      'storybook-static',
      'test/performance/**',
    ],
    // ⚠️ Important: Run sequentially to avoid race conditions on the single container
    fileParallelism: false,
    // Increase test timeout for db operations
    testTimeout: 30000,
    hookTimeout: 120000, // Increased for Docker operations
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@services': path.resolve(__dirname, './src/services'),
      '@lib': path.resolve(__dirname, './src/lib'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@types': path.resolve(__dirname, './src/types'),
      '@config': path.resolve(__dirname, './src/config'),
      '@security': path.resolve(__dirname, './src/security'),
    },
  },
});
