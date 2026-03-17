import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { IncomingMessage, ServerResponse } from "node:http";

import react from "@vitejs/plugin-react-swc";
import { defineConfig, loadEnv } from "vite";

type NextFunction = (err?: unknown) => void;

// ESM-safe __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");

  // Make env vars available to server-side code
  process.env = { ...process.env, ...env };

  return {
    plugins: [
      react(),
      {
        name: "api-server",
        configureServer(server) {
          // OAuth login handler
          server.middlewares.use("/api/oauth/login", async (req: IncomingMessage, res: ServerResponse, next: NextFunction) => {
            try {
              const errorHandlingModule = await import(/* @vite-ignore */ "./src/data/_core/error-handling");
              const loginRateLimitResult = await errorHandlingModule.checkRateLimit(
                errorHandlingModule.buildRateLimitKey(
                  "auth:oauth-login",
                  errorHandlingModule.getRateLimitIdentifiers(req, {
                    id: null,
                    tenantId: process.env.VITE_APP_ID || null,
                  })
                ),
                20,
                60_000
              );

              errorHandlingModule.applyRateLimitHeaders(res, loginRateLimitResult);

              if (!loginRateLimitResult.allowed) {
                res.statusCode = 429;
                res.end("Rate limit exceeded. Please try again later.");
                return;
              }

              const oauthModule = await import(/* @vite-ignore */ "./src/data/_core/oauth");
              const result = await oauthModule.handleOAuthLogin(req, res);

              res.statusCode = 302;
              res.setHeader("Location", result.redirectUrl);
              res.end();
            } catch (error) {
              console.error("OAuth login error:", error);
              res.statusCode = 302;
              res.setHeader("Location", "/?error=oauth_error");
              res.end();
            }
          });

          // OAuth callback handler
          server.middlewares.use("/api/oauth/callback", async (req: IncomingMessage, res: ServerResponse, next: NextFunction) => {
            try {
              const url = new URL(req.url || "", `http://${req.headers.host}`);
              const code = url.searchParams.get("code");
              const state = url.searchParams.get("state");

              if (!code || !state) {
                res.statusCode = 400;
                res.end("Missing code or state parameter");
                return;
              }

              const errorHandlingModule = await import(/* @vite-ignore */ "./src/data/_core/error-handling");
              const callbackRateLimitResult = await errorHandlingModule.checkRateLimit(
                errorHandlingModule.buildRateLimitKey(
                  "auth:oauth-callback",
                  errorHandlingModule.getRateLimitIdentifiers(req, {
                    id: null,
                    tenantId: process.env.VITE_APP_ID || null,
                  })
                ),
                40,
                60_000
              );

              errorHandlingModule.applyRateLimitHeaders(res, callbackRateLimitResult);

              if (!callbackRateLimitResult.allowed) {
                res.statusCode = 429;
                res.end("Rate limit exceeded. Please try again later.");
                return;
              }

              const oauthModule = await import(/* @vite-ignore */ "./src/data/_core/oauth");
              const result = await oauthModule.handleOAuthCallback(code, state, req, res);

              // Redirect to appropriate page
              res.statusCode = 302;
              res.setHeader("Location", result.redirectUrl);
              res.end();
            } catch (error) {
              console.error("OAuth callback error:", error);
              res.statusCode = 302;
              res.setHeader("Location", "/?error=oauth_error");
              res.end();
            }
          });

          // tRPC handler
          server.middlewares.use("/api/trpc", async (req: IncomingMessage, res: ServerResponse, next: NextFunction) => {
            try {
              const { createHTTPHandler } = await import("@trpc/server/adapters/standalone");
              const routersModule = await import(/* @vite-ignore */ "./src/data/routers/index");
              const trpcModule = await import(/* @vite-ignore */ "./src/data/_core/trpc");

              const trpcHandler = createHTTPHandler({
                router: routersModule.appRouter,
                createContext: (opts) => trpcModule.createContext(opts),
              });

              trpcHandler(req, res);
            } catch (error) {
              console.error("tRPC handler error:", error);
              next(error);
            }
          });
        },
      },
    ],
    server: {
      host: "0.0.0.0",
      port: 5174,
      strictPort: true,
      allowedHosts: [".gitpod.dev", ".gitpod.io", ".github.dev", "localhost"],
      hmr: {
        protocol: "ws",
        host: "localhost",
        port: 5174,
      },
    },
    resolve: {
      alias: {
        "@": resolve(__dirname, "src"),
        "@shared/const": resolve(__dirname, "packages/shared/src/const.ts"),
        "@valueos/shared": resolve(__dirname, "../../packages/shared/src"),
        "@shared": resolve(__dirname, "../../packages/shared/src"),
      },
    },
  };
});
