import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import viteCompression from "vite-plugin-compression";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    react(),
    viteCompression({
      algorithm: "gzip",
      ext: ".gz",
    }),
  ],
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
      "@valueos/shared": path.resolve(__dirname, "../packages/shared/src"),
    },
  },
  server: {
    host: "0.0.0.0",
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
        "ioredis",
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
      input: process.env.SSR
        ? {
            main: path.resolve(__dirname, "index.html"),
            server: path.resolve(__dirname, "src/entry-server.tsx"),
          }
        : undefined,
      output: {
        manualChunks: (id) => {
          if (id.includes("node_modules")) {
            if (id.includes("react-dom")) return "vendor";
            if (id.includes("react-router")) return "vendorRouter";
            if (id.includes("@supabase")) return "vendorSupabase";
            if (id.includes("lucide-react")) return "vendorUI";
            if (id.includes("@radix-ui")) return "vendorRadix";
            if (id.includes("zustand")) return "vendorState";
          }
        },
      },
    },
    minify: "terser",
    sourcemap: false,
    ssr: process.env.SSR ? true : false,
  },
  optimizeDeps: {
    include: ["react", "react-dom", "react-router-dom"],
  },
});
