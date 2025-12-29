import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";
// Temporarily commented out for debugging
// import { getEnvironmentHeaders } from './src/lib/security/headers.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Detect Codespaces environment
const isCodespaces = process.env.CODESPACES === "true";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    global: "globalThis",
    "process.env": "{}",
    process: { env: {} },
  },
  server: {
    host: process.env.VITE_HOST || "0.0.0.0", // Listen on all interfaces for container/Codespace access
    port: parseInt(process.env.VITE_PORT || "5173"),
    strictPort: false, // Allow fallback to other ports if port is busy
    // headers: getEnvironmentHeaders("development"),
    // CORS configuration for cross-origin requests
    cors: true,
    // HMR configuration for hot module replacement
    hmr: isCodespaces
      ? true
      : {
          host: process.env.VITE_HMR_HOST || undefined,
          protocol: process.env.VITE_HMR_PROTOCOL || "ws",
          timeout: 30000, // Increase timeout for slower connections
          overlay: true, // Show error overlay
        },
    // Optional: Enable HTTPS for local development
    // Uncomment the next line to use HTTPS (will use self-signed certificate)
    // https: true,
  },
  preview: {
    host: "0.0.0.0",
    port: 4173,
    strictPort: false,
    // headers: getEnvironmentHeaders("production"),
    cors: true,
  },
  build: {
    rollupOptions: {
      external: [
        "fs",
        "path",
        "crypto",
        "node-vault",
        "zlib",
        "stream",
        "buffer",
        "util",
        "url",
        "os",
        "child_process",
        // Aggressively exclude all Node.js OpenTelemetry modules
        "@opentelemetry/sdk-node",
        "@opentelemetry/auto-instrumentations-node",
        "@opentelemetry/instrumentation-fs",
        "@opentelemetry/instrumentation-http",
        "@opentelemetry/instrumentation-express",
        "@opentelemetry/instrumentation-pg",
        "@opentelemetry/instrumentation-redis",
        "@opentelemetry/instrumentation-net",
        "@opentelemetry/resource-detector-aws",
        "@opentelemetry/resource-detector-azure",
        "@opentelemetry/resource-detector-alibaba-cloud",
        "@opentelemetry/resource-detector-container",
        "@opentelemetry/otlp-exporter-base",
        "@opentelemetry/exporter-jaeger",
        "@opentelemetry/exporter-prometheus",
        "@opentelemetry/exporter-zipkin",
        "@opentelemetry/otlp-grpc-exporter-base",
        "@opentelemetry/otlp-proto-exporter-base",
        "@opentelemetry/otlp-transformer",
        "@opentelemetry/sdk-logs",
        "@opentelemetry/sdk-trace-base",
        "@opentelemetry/sdk-trace-node",
        "@opentelemetry/sdk-metrics-base",
        "@opentelemetry/instrumentation",
        "@opentelemetry/context-async-hooks",
        "@opentelemetry/core",
        "@opentelemetry/semantic-conventions",
        "@opentelemetry/resources",
        "@opentelemetry/propagator-b3",
        "@opentelemetry/propagator-jaeger",
        "@opentelemetry/propagator-xtrace",
        "google-logging-utils",
        "@grpc/grpc-js",
        "@opentelemetry/otlp-exporter-base",
      ],
      output: {
        manualChunks: {
          // React core
          "react-vendor": ["react", "react-dom", "react-router-dom"],
          // UI libraries
          "ui-vendor": ["lucide-react"],
          // Data/state management
          "data-vendor": ["zustand", "zod"],
          // Supabase
          "supabase-vendor": ["@supabase/supabase-js"],
          // Utilities
          "utils-vendor": ["html2canvas", "dompurify", "lz-string"],
        },
      },
    },
  },
  optimizeDeps: {
    include: ["lucide-react"],
    exclude: [
      "node-vault",
      // Exclude all Node.js OpenTelemetry modules from pre-bundling
      "@opentelemetry/sdk-node",
      "@opentelemetry/auto-instrumentations-node",
      "@opentelemetry/instrumentation-fs",
      "@opentelemetry/instrumentation-http",
      "@opentelemetry/instrumentation-express",
      "@opentelemetry/instrumentation-pg",
      "@opentelemetry/instrumentation-redis",
      "@opentelemetry/instrumentation-net",
      "@opentelemetry/resource-detector-aws",
      "@opentelemetry/resource-detector-azure",
      "@opentelemetry/resource-detector-alibaba-cloud",
      "@opentelemetry/resource-detector-container",
      "@opentelemetry/otlp-exporter-base",
      "@opentelemetry/exporter-jaeger",
      "@opentelemetry/exporter-prometheus",
      "@opentelemetry/exporter-zipkin",
      "@opentelemetry/otlp-grpc-exporter-base",
      "@opentelemetry/otlp-proto-exporter-base",
      "@opentelemetry/otlp-transformer",
      "@opentelemetry/sdk-logs",
      "@opentelemetry/sdk-trace-base",
      "@opentelemetry/sdk-trace-node",
      "@opentelemetry/sdk-metrics-base",
      "@opentelemetry/instrumentation",
      "@opentelemetry/context-async-hooks",
      "@opentelemetry/core",
      "@opentelemetry/semantic-conventions",
      "@opentelemetry/resources",
      "@opentelemetry/propagator-b3",
      "@opentelemetry/propagator-jaeger",
      "@opentelemetry/propagator-xtrace",
      "google-logging-utils",
      "@grpc/grpc-js",
    ],
  },
  test: {
    environment: "jsdom",
    setupFiles: "./vitest.setup.ts",
    globals: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      lines: 70,
      functions: 70,
      branches: 70,
      statements: 70,
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@components": path.resolve(__dirname, "./src/components"),
      "@services": path.resolve(__dirname, "./src/services"),
      "@lib": path.resolve(__dirname, "./src/lib"),
      "@utils": path.resolve(__dirname, "./src/utils"),
      "@types": path.resolve(__dirname, "./src/types"),
      "@config": path.resolve(__dirname, "./src/config"),
      "@security": path.resolve(__dirname, "./src/security"),
    },
  },
});
