import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  console.log(`[Vite] Loading config for mode: ${mode}`);

  // Base configuration (Aliases, etc.)
  const baseConfig = {
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
    // Exclude server-side secrets management and heavy telemetry from browser bundle
    build: {
      chunkSizeWarningLimit: 500,
      rollupOptions: {
        external: [
          // Server-side code paths
          /src\/config\/secrets\/.*/,
          // Node.js specific OpenTelemetry packages
          "@opentelemetry/sdk-node",
          "@opentelemetry/auto-instrumentations-node",
          "@opentelemetry/exporter-trace-otlp-http",
          "@opentelemetry/exporter-metrics-otlp-http",
          "@opentelemetry/sdk-metrics",
          "@opentelemetry/resources",
          "@opentelemetry/semantic-conventions",
          // Other backend deps
          "node-vault",
          "@aws-sdk/client-secrets-manager",
          "winston",
          "winston-cloudwatch",
        ],
        output: {
          manualChunks: (id: string) => {
            // Core React vendor chunk
            if (
              id.includes("node_modules/react-dom") ||
              id.includes("node_modules/react-router") ||
              (id.includes("node_modules/react/") && !id.includes("react-dom"))
            ) {
              return "vendor-react";
            }
            // UI libraries
            if (
              id.includes("node_modules/lucide-react") ||
              id.includes("node_modules/clsx") ||
              id.includes("node_modules/tailwind-merge")
            ) {
              return "vendor-ui";
            }
            // Heavy export libraries - separate chunks for lazy loading
            if (id.includes("node_modules/jspdf")) {
              return "vendor-pdf";
            }
            if (id.includes("node_modules/exceljs")) {
              return "vendor-excel";
            }
            // Supabase client
            if (id.includes("node_modules/@supabase")) {
              return "vendor-supabase";
            }
            // Charts and visualization
            if (id.includes("node_modules/recharts")) {
              return "vendor-charts";
            }
            // Date utilities
            if (id.includes("node_modules/date-fns")) {
              return "vendor-date";
            }
          },
        },
      },
    },
  };

  // Bare Mode (No plugins, minimal server)
  if (mode === "bare") {
    return {
      ...baseConfig,
      server: {
        host: "0.0.0.0",
        port: 5173,
        strictPort: true,
        hmr: false,
        watch: null,
      },
    };
  }

  // Ultra-Minimal Mode (Localhost only, no watch)
  if (mode === "ultra-minimal") {
    return {
      ...baseConfig,
      server: {
        host: "127.0.0.1",
        port: 5173,
        strictPort: true,
        watch: null,
        hmr: false,
      },
      optimizeDeps: {
        noDiscovery: true,
        include: [],
      },
    };
  }

  // React-Only Mode (Basic React support, restricted deps)
  if (mode === "react-only") {
    return {
      ...baseConfig,
      plugins: [react()],
      server: {
        host: "0.0.0.0",
        port: 5173,
        strictPort: true,
        hmr: false,
        watch: null,
      },
      optimizeDeps: {
        noDiscovery: true,
        include: ["react", "react-dom"],
      },
    };
  }

  // Debug Mode (Alternative port)
  if (mode === "debug") {
    return {
      ...baseConfig,
      plugins: [react()],
      server: {
        host: "0.0.0.0",
        port: 5176,
      },
    };
  }

  // Minimal Mode (Legacy minimal config, typically used for debugging imports)
  if (mode === "minimal") {
    return {
      ...baseConfig,
      plugins: [react()],
      define: {
        global: "globalThis",
      },
      server: {
        host: "0.0.0.0",
        port: 5173,
        strictPort: false,
      },
    };
  }

  // Default / Standard Development Mode
  // Note: Vite uses 'development' or 'production' by default.
  // We treat anything else (or standard modes) as default config.
  return {
    ...baseConfig,
    plugins: [react()],
    root: "src", // Entry point in src
    publicDir: "../public",
    server: {
      host: "0.0.0.0", // Bind to all interfaces for Docker
      port: 5173,
      strictPort: true,
      watch: {
        usePolling: true, // Required for Docker
        interval: 100,
      },
      hmr: {
        port: 5173,
        clientPort: 5173,
      },
      fs: {
        strict: true,
        allow: [".."],
      },
    },
    optimizeDeps: {
      noDiscovery: true,
      include: [],
    },
  };
});
