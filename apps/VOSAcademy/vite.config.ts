import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

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
          server.middlewares.use("/api/oauth/login", async (req: any, res: any, next: any) => {
            try {
              const oauthModule = await import("./src/data/_core/oauth" as any);
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
          server.middlewares.use("/api/oauth/callback", async (req: any, res: any, next: any) => {
            try {
              const url = new URL(req.url || "", `http://${req.headers.host}`);
              const code = url.searchParams.get("code");
              const state = url.searchParams.get("state");

              if (!code || !state) {
                res.statusCode = 400;
                res.end("Missing code or state parameter");
                return;
              }

              const oauthModule = await import("./src/data/_core/oauth" as any);
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
          server.middlewares.use("/api/trpc", async (req: any, res: any, next: any) => {
            try {
              const { createHTTPHandler } = await import("@trpc/server/adapters/standalone");
              const routersModule = await import("./src/data/routers/index" as any);
              const trpcModule = await import("./src/data/_core/trpc" as any);

              const trpcHandler = createHTTPHandler({
                router: routersModule.appRouter,
                createContext: (opts: any) => trpcModule.createContext(opts),
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
      port: 5173,
      strictPort: true,
      hmr: {
        protocol: "ws",
        host: "localhost",
        port: 5173,
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
