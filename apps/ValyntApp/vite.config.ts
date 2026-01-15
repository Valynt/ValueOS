import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@app": path.resolve(__dirname, "./src/app"),
      "@pages": path.resolve(__dirname, "./src/pages"),
      "@layouts": path.resolve(__dirname, "./src/layouts"),
      "@components": path.resolve(__dirname, "./src/components"),
      "@features": path.resolve(__dirname, "./src/features"),
      "@services": path.resolve(__dirname, "./src/services"),
      "@lib": path.resolve(__dirname, "./src/lib"),
      "@hooks": path.resolve(__dirname, "./src/hooks"),
      "@types": path.resolve(__dirname, "./src/types"),
      "@assets": path.resolve(__dirname, "./src/assets"),
    },
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    allowedHosts: [".gitpod.dev", ".gitpod.io", ".github.dev", "localhost"],
    hmr:
      process.env.REMOTE_CONTAINERS === "true" ||
      process.env.CODESPACES === "true"
        ? false
        : {
            clientPort:
              process.env.GITPOD_WORKSPACE_URL || process.env.CODESPACE_NAME
                ? 443
                : 24678,
            port: 24678,
          },
    // Proxy API requests to backend - enables relative URLs in browser
    // This eliminates hostname issues in Gitpod/Codespaces environments
    proxy: {
      "/api": {
        target: process.env.VITE_API_BASE_URL || "http://127.0.0.1:3001",
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
        target: process.env.VITE_SUPABASE_URL || "http://127.0.0.1:54321",
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
