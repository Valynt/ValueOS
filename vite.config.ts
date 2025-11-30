import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { getEnvironmentHeaders } from './src/lib/security/headers';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    headers: getEnvironmentHeaders('development'),
    // Optional: Enable HTTPS for local development
    // Uncomment the next line to use HTTPS (will use self-signed certificate)
    // https: true,
  },
  preview: {
    headers: getEnvironmentHeaders('production'),
  },
  optimizeDeps: {
    include: ['lucide-react'],
  },
  test: {
    environment: 'jsdom',
    setupFiles: './vitest.setup.ts',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      lines: 70,
      functions: 70,
      branches: 70,
      statements: 70,
    },
  },
});
