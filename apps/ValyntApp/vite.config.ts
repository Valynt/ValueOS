import path from "path";
import { fileURLToPath } from "url";

import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const vitePort = Number(process.env.VITE_PORT || 5173);
const hmrPort = process.env.VITE_HMR_PORT ? Number(process.env.VITE_HMR_PORT) : undefined;
const hmrClientPort = process.env.VITE_HMR_CLIENT_PORT
  ? Number(process.env.VITE_HMR_CLIENT_PORT)
  : undefined;
const hmrHost = process.env.VITE_HMR_HOST;
const hmrProtocol = process.env.VITE_HMR_PROTOCOL;
const viteHost = process.env.VITE_HOST || "0.0.0.0";

const isCi = process.env.CI === "true";
const isDockerMode =
  process.env.DX_MODE === "docker" ||
  process.env.DOCKER === "true" ||
  process.env.DX_DOCKER === "1";

const usePolling = process.env.VITE_USE_POLLING === "true";

const toKb = (bytes: number) => bytes / 1024;

type OutputChunk = {
  type: "chunk";
  fileName: string;
  code: string;
  isEntry?: boolean;
  isDynamicEntry?: boolean;
};

const performanceBudgetPlugin = (): Plugin => ({
  name: "performance-budget",
  generateBundle(_options, bundle) {
    const maxChunkSizeKb = Number(process.env.VITE_BUDGET_MAX_CHUNK_KB || 400);
    const maxInitialJsKb = Number(process.env.VITE_BUDGET_MAX_INITIAL_JS_KB || 700);

    const chunks = Object.values(bundle).filter(
      (asset): asset is OutputChunk => asset.type === "chunk" && typeof asset.code === "string"
    );

    const initialChunks = chunks.filter((chunk) => chunk.isEntry && !chunk.isDynamicEntry);

    const oversizedChunks = chunks
      .map((chunk) => ({ fileName: chunk.fileName, sizeKb: toKb(chunk.code.length) }))
      .filter((chunk) => chunk.sizeKb > maxChunkSizeKb);

    const totalInitialJsKb = initialChunks.reduce((sum, chunk) => sum + toKb(chunk.code.length), 0);

    if (oversizedChunks.length > 0) {
      const details = oversizedChunks
        .map((chunk) => `- ${chunk.fileName}: ${chunk.sizeKb.toFixed(1)}KB > ${maxChunkSizeKb}KB`)
        .join("\n");
      this.error(`Bundle budget exceeded (max chunk size).\n${details}`);
    }

    if (totalInitialJsKb > maxInitialJsKb) {
      this.error(
        `Bundle budget exceeded (initial JS total): ${totalInitialJsKb.toFixed(1)}KB > ${maxInitialJsKb}KB`
      );
    }
  },
});

export default defineConfig({
  envDir: __dirname,
  plugins: [react(), performanceBudgetPlugin()],
  resolve: {
    extensions: [".tsx", ".ts", ".jsx", ".js", ".mjs", ".json"],
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
      "@valueos/shared": path.resolve(__dirname, "../../packages/shared/src"),
      "@valueos/sdui": path.resolve(__dirname, "../../packages/sdui/src"),
      "@valueos/components": path.resolve(__dirname, "../../packages/components"),
      "@shared": path.resolve(__dirname, "../../packages/shared/src"),
    },
  },
  server: {
    host: isDockerMode ? "0.0.0.0" : viteHost,
    port: vitePort,
    strictPort: isCi,
    allowedHosts: [".gitpod.dev", ".gitpod.io", ".github.dev", "localhost"],
    hmr: {
      ...(hmrProtocol ? { protocol: hmrProtocol } : {}),
      ...(hmrHost ? { host: hmrHost } : {}),
      ...(hmrPort ? { port: hmrPort } : {}),
      // In Docker, ensure the browser uses the same port the server is binding.
      // Outside Docker, allow explicit override for remote/devcontainers.
      ...(isDockerMode
        ? { clientPort: hmrPort ?? vitePort }
        : hmrClientPort
          ? { clientPort: hmrClientPort }
          : {}),
    },
    watch: usePolling
      ? {
          usePolling: true,
          interval: 200,
        }
      : undefined,
    // Proxy API requests to backend - enables relative URLs in browser
    // This eliminates hostname issues in Gitpod/Codespaces environments
    proxy: {
      "/api": {
        target:
          process.env.VITE_API_PROXY_TARGET ||
          process.env.API_BASE_URL ||
          process.env.BACKEND_ORIGIN ||
          "http://127.0.0.1:8000",
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
      "/auth/v1": {
        target: "http://127.0.0.1:9999",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/auth\/v1/, ""),
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
    esbuildOptions: {
      loader: {
        ".js": "jsx",
      },
    },
  },
});
