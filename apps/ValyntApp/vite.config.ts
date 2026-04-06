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

const performanceBudgetPlugin = (): Plugin => ({
  name: "performance-budget",
  generateBundle(_options, bundle) {
    // Defaults reflect realistic production targets for a B2B SaaS app:
    //   - 500 KB per chunk keeps individual network requests manageable.
    //   - 1200 KB total initial JS is the threshold above which LCP degrades
    //     noticeably on mid-range devices (Core Web Vitals guidance).
    // Override via env vars in CI to enforce stricter budgets over time.
    const maxChunkSizeKb = Number(process.env.VITE_BUDGET_MAX_CHUNK_KB || 500);
    const maxInitialJsKb = Number(process.env.VITE_BUDGET_MAX_INITIAL_JS_KB || 1200);

    const chunks = Object.values(bundle).filter(
      (asset): asset is typeof asset & { type: "chunk"; code: string } =>
        asset.type === "chunk" && "code" in asset && typeof asset.code === "string"
    );

    const initialChunks = chunks.filter((chunk) => "isEntry" in chunk && chunk.isEntry && !("isDynamicEntry" in chunk && chunk.isDynamicEntry));

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
  define: {
    "process.env": {},
  },
  resolve: {
    extensions: [".tsx", ".ts", ".jsx", ".js", ".mjs", ".json"],
    alias: {
      // Shim Node.js crypto for server-side modules that live in the frontend tree
      crypto: path.resolve(__dirname, "./src/lib/crypto-shim.ts"),
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
      "@sdui": path.resolve(__dirname, "../../packages/sdui/src"),
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
          "http://127.0.0.1:3001",
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
    // Warn at 500 KB to match the performanceBudgetPlugin default ceiling.
    chunkSizeWarningLimit: 500,
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
          if (!id.includes("node_modules")) return undefined;

          // ── Tier 1: React core — always needed, tiny, cache forever ──────────
          if (id.includes("/react-dom/") || id.includes("/react/") || id.includes("/scheduler/")) {
            return "vendor-react";
          }

          // ── Tier 2: Routing — loaded on first navigation ──────────────────────
          if (id.includes("/react-router") || id.includes("/react-router-dom/")) {
            return "vendor-router";
          }

          // ── Tier 3: Auth / data layer — needed before any protected page ─────
          if (id.includes("/@supabase/")) return "vendor-supabase";

          // ── Tier 4: State management — small, shared across all pages ─────────
          if (id.includes("/zustand/") || id.includes("/zundo/") || id.includes("/immer/")) {
            return "vendor-state";
          }

          // ── Tier 5: Data fetching ─────────────────────────────────────────────
          if (id.includes("/@tanstack/")) return "vendor-query";

          // ── Tier 6: UI primitives — Radix + class utilities ───────────────────
          if (id.includes("/@radix-ui/")) return "vendor-radix";
          if (
            id.includes("/class-variance-authority/") ||
            id.includes("/clsx/") ||
            id.includes("/tailwind-merge/") ||
            id.includes("/tailwindcss-animate/")
          ) {
            return "vendor-ui-utils";
          }

          // ── Tier 7: Icon library — large but static, cache aggressively ───────
          if (id.includes("/lucide-react/")) return "vendor-icons";

          // ── Tier 8: Animation — only pages that use motion need this ──────────
          if (id.includes("/framer-motion/")) return "vendor-motion";

          // ── Tier 9: Canvas / graph — heavy, only on canvas routes ─────────────
          // @xyflow/react (ReactFlow) + elkjs together are ~600 KB unminified.
          // They are only imported by ValueGraphVisualization (lazy-loaded SDUI
          // component) and LivingValueGraphPage, so they land in a separate chunk
          // that is never fetched on the dashboard or settings paths.
          if (id.includes("/@xyflow/") || id.includes("/reactflow/") || id.includes("/elkjs/")) {
            return "vendor-canvas";
          }

          // ── Tier 10: Markdown rendering ───────────────────────────────────────
          if (
            id.includes("/react-markdown/") ||
            id.includes("/remark-gfm/") ||
            id.includes("/remark-") ||
            id.includes("/rehype-") ||
            id.includes("/unified/") ||
            id.includes("/micromark") ||
            id.includes("/mdast-") ||
            id.includes("/hast-") ||
            id.includes("/vfile")
          ) {
            return "vendor-markdown";
          }

          // ── Tier 11: DnD — only canvas/workspace pages ────────────────────────
          if (id.includes("/react-dnd") || id.includes("/dnd-core/")) {
            return "vendor-dnd";
          }

          // ── Tier 12: Forms ────────────────────────────────────────────────────
          if (id.includes("/react-hook-form/") || id.includes("/zod/")) {
            return "vendor-forms";
          }

          // ── Tier 13: Numerics — financial modeling pages only ─────────────────
          if (id.includes("/decimal.js/") || id.includes("/hyperformula/")) {
            return "vendor-numerics";
          }

          // ── Tier 14: Observability / telemetry — backend-facing, small ────────
          if (id.includes("/@opentelemetry/")) return "vendor-otel";

          // ── Tier 15: Misc utilities — uuid, dompurify, web-vitals ────────────
          if (
            id.includes("/uuid/") ||
            id.includes("/dompurify/") ||
            id.includes("/isomorphic-dompurify/") ||
            id.includes("/web-vitals/")
          ) {
            return "vendor-utils";
          }

          // Everything else in node_modules goes into a catch-all vendor chunk
          // rather than being inlined into app chunks.
          return "vendor-misc";
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
