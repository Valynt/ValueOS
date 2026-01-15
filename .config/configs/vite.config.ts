import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: path.resolve(__dirname, "../.."),
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "../../src"),
      "@components": path.resolve(__dirname, "../../src/components"),
      "@services": path.resolve(__dirname, "../../src/services"),
      "@lib": path.resolve(__dirname, "../../src/lib"),
      "@utils": path.resolve(__dirname, "../../src/utils"),
      "@types": path.resolve(__dirname, "../../src/types"),
      "@config": path.resolve(__dirname, "../../src/config"),
      "@security": path.resolve(__dirname, "../../src/security"),
      "@mcp-common": path.resolve(__dirname, "../../src/mcp-common"),
    },
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    allowedHosts: [".gitpod.dev", ".gitpod.io", ".github.dev", "localhost"],
    hmr:
      process.env.REMOTE_CONTAINERS === "true" || process.env.CODESPACES === "true"
        ? false
        : {
            clientPort:
              process.env.GITPOD_WORKSPACE_URL || process.env.CODESPACE_NAME ? 443 : 24678,
            port: 24678,
          },
    // Proxy API requests to backend - enables relative URLs in browser
    // This eliminates hostname issues in Gitpod/Codespaces environments
    proxy: {
      "/api": {
        target: process.env.VITE_API_BASE_URL || "http://localhost:3001",
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on("error", (err) => {
            console.warn("[vite proxy] API proxy error:", err.message);
          });
          proxy.on("proxyReq", (_proxyReq, req) => {
            console.debug("[vite proxy]", req.method, req.url);
          });
        },
      },
      "/auth/callback": {
        target: process.env.VITE_SUPABASE_URL || "http://localhost:54321",
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      external: [
        // Server-side OpenTelemetry packages
        "@opentelemetry/sdk-node",
        "@opentelemetry/auto-instrumentations-node",
        "@opentelemetry/exporter-trace-otlp-http",
        "@opentelemetry/exporter-metrics-otlp-http",
        "@opentelemetry/sdk-metrics",
        "@opentelemetry/resources",
        "@opentelemetry/semantic-conventions",
        "@opentelemetry/otlp-exporter-base",
        // Other backend deps
        "node-vault",
        "@aws-sdk/client-secrets-manager",
        "winston",
        "winston-cloudwatch",
        "redis",
        // Node.js built-ins
        "zlib",
        "stream",
        "fs",
        "path",
        "crypto",
        "util",
        "os",
        "buffer",
      ],
      output: {
        manualChunks: {
          vendor: ["react", "react-dom"],
          vendorRouter: ["react-router-dom"],
          vendorSupabase: ["@supabase/supabase-js"],
          vendorUI: ["lucide-react", "clsx", "tailwind-merge"],
        },
      },
    },
    minify: "terser",
    sourcemap: false,
  },
  optimizeDeps: {
    include: ["react", "react-dom", "react-router-dom"],
  },
});
