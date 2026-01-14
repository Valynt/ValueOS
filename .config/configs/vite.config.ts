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
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
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
          vendorCharts: ["recharts"],
          vendorUtils: ["date-fns"],
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
