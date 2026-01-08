import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  root: "src", // Move the entry point into the src folder to restrict scanning
  publicDir: "../public",
  server: {
    host: "0.0.0.0", // ✅ Bind to all interfaces for Docker container access
    port: 5173,
    strictPort: true,
    watch: {
      // Enable file watching for HMR in development
      usePolling: true, // Required for Docker containers
      interval: 100,
    },
    hmr: {
      // Enable Hot Module Replacement
      host: "localhost", // Use localhost for HMR connections from browser
      protocol: "ws",
      clientPort: 5173, // Explicit client port for HMR
      port: 5173,
    },
    fs: {
      strict: true, // Prevent access outside allowed paths
      allow: [".."], // Only allow files within ValueOS
    },
  },
  optimizeDeps: {
    noDiscovery: true,
    include: [],
  },
});
