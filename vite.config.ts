import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { getEnvironmentHeaders } from './src/lib/security/headers';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Listen on all interfaces for container/Codespace access
    port: 3000,
    strictPort: false, // Allow fallback to other ports if 3000 is busy
    headers: getEnvironmentHeaders('development'),
    // CORS configuration for cross-origin requests
    cors: true,
    // HMR configuration for hot module replacement
    hmr: {
      clientPort: 3000,
      host: 'localhost',
    },
    // Optional: Enable HTTPS for local development
    // Uncomment the next line to use HTTPS (will use self-signed certificate)
    // https: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    strictPort: false,
    headers: getEnvironmentHeaders('production'),
    cors: true,
  },
  build: {
    rollupOptions: {
      external: ['fs', 'path', 'crypto', 'node-vault'],
    },
  },
  optimizeDeps: {
    include: ['lucide-react'],
    exclude: ['node-vault'],
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
