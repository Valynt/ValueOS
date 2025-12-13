import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { getEnvironmentHeaders } from './src/lib/security/headers';

// Detect Codespaces environment
const isCodespaces = process.env.CODESPACES === 'true';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: process.env.VITE_HOST || '0.0.0.0', // Listen on all interfaces for container/Codespace access
    port: parseInt(process.env.VITE_PORT || '5173'),
    strictPort: false, // Allow fallback to other ports if port is busy
    headers: getEnvironmentHeaders('development'),
    // CORS configuration for cross-origin requests
    cors: true,
    // HMR configuration for hot module replacement
    // In Codespaces, let Vite auto-detect the correct WebSocket URL
    hmr: isCodespaces ? true : {
      clientPort: parseInt(process.env.VITE_HMR_PORT || '24678'),
      host: process.env.VITE_HMR_HOST || 'localhost',
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
      output: {
        manualChunks: {
          // React core
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // UI libraries
          'ui-vendor': ['lucide-react'],
          // Data/state management
          'data-vendor': ['zustand', 'zod'],
          // Supabase
          'supabase-vendor': ['@supabase/supabase-js'],
          // Utilities
          'utils-vendor': ['html2canvas', 'dompurify', 'lz-string'],
        },
      },
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
