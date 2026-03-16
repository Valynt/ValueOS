/**
 * Dev-Only Routes
 *
 * These routes are only available in development mode.
 * They support the Smart Remediation "Fix It" buttons in the Dev HUD.
 */

import { exec } from "child_process";
import { promisify } from "util";

import { Request, Response, Router } from "express";
import { z } from "zod";


import { logger } from "../lib/logger.js";
import { requireAuth } from "../middleware/auth.js";

import { isDevRouteHostAllowed, shouldEnableDevRoutes } from "./devRoutes.js";

const execAsync = promisify(exec);
const router = Router();
const CACHE_PREFIX = "valueos";

type RedisCacheClient = {
  scan(cursor: string, options: { MATCH: string; COUNT: number }): Promise<[string, string[]]>;
  del(keys: string | string[]): Promise<number>;
};

const cacheClearScopeSchema = z
  .object({
    scope: z.enum(["platform", "tenant"]),
    tenantId: z.string().trim().min(1).optional(),
  })
  .superRefine((value, context) => {
    if (value.scope === "tenant" && !value.tenantId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "tenantId is required for tenant scope",
        path: ["tenantId"],
      });
    }
  });

export function resolveCacheClearPattern(payload: unknown): { scope: "platform" | "tenant"; pattern: string } {
  const parsed = cacheClearScopeSchema.safeParse(payload);
  if (!parsed.success) {
    const formatted = parsed.error.issues.map((issue) => issue.message).join(", ");
    throw new Error(formatted || "Invalid scope for cache clear operation");
  }

  if (parsed.data.scope === "tenant") {
    return {
      scope: "tenant",
      pattern: `${CACHE_PREFIX}:tenant:${parsed.data.tenantId}:*`,
    };
  }

  return {
    scope: "platform",
    pattern: `${CACHE_PREFIX}:*`,
  };
}

export async function deleteKeysByPattern(client: RedisCacheClient, pattern: string): Promise<number> {
  let cursor = "0";
  let deleted = 0;

  do {
    const [nextCursor, keys] = await client.scan(cursor, {
      MATCH: pattern,
      COUNT: 100,
    });
    cursor = nextCursor;

    if (keys.length > 0) {
      deleted += await client.del(keys);
    }
  } while (cursor !== "0");

  return deleted;
}

const isDevRoutesEnabled = shouldEnableDevRoutes();

router.use((req: Request, res: Response, next) => {
  if (!isDevRoutesEnabled) {
    res.status(403).json({ error: "Dev routes disabled" });
    return;
  }

  if (!isDevRouteHostAllowed(req.hostname)) {
    res.status(403).json({ error: "Dev routes disabled for host" });
    return;
  }

  next();
});

// Require authentication for all dev routes
router.use(requireAuth);

/**
 * Guard for destructive dev operations — requires admin role from JWT claims.
 * This is acceptable here because dev routes are already gated by NODE_ENV + feature flag.
 */
function requireDevAdmin(req: Request, res: Response, next: () => void): void {
  const user = req.user;
  const role = user?.role ?? user?.app_metadata?.role;
  if (role !== "admin" && role !== "service_role") {
    res.status(403).json({ error: "Admin access required for this dev operation" });
    return;
  }
  next();
}

if (isDevRoutesEnabled) {
  router.get("/status", (_req: Request, res: Response) => {
    res.json({
      mode: "development",
      nodeEnv: process.env.NODE_ENV,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    });
  });

  router.get("/db/status", async (_req: Request, res: Response) => {
    try {
      const { Pool } = await import("pg");
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
      });

      const client = await pool.connect();
      const result = await client.query(
        "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = 'public'"
      );
      client.release();
      await pool.end();

      const tableCount = parseInt(result.rows[0]?.count || "0", 10);

      res.json({
        connected: true,
        empty: tableCount === 0,
        tableCount,
      });
    } catch (error) {
      res.json({
        connected: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  router.post("/seed", requireDevAdmin, async (_req: Request, res: Response) => {
    try {
      const { stdout, stderr } = await execAsync("npm run seed:demo", {
        cwd: process.cwd(),
        timeout: 60000,
      });

      res.json({
        success: true,
        stdout: stdout.slice(-500),
        stderr: stderr.slice(-500),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Seed failed",
      });
    }
  });

  router.get("/db/migrations/status", async (_req: Request, res: Response) => {
    try {
      const { stdout } = await execAsync(
        "npx supabase migration list --local",
        {
          cwd: process.cwd(),
          timeout: 30000,
        }
      );

      const pendingMatch = (stdout || "").match(/pending:\s*(\d+)/i);
      const pending = pendingMatch ? parseInt(pendingMatch[1], 10) : 0;

      res.json({
        pending,
        output: (stdout || "").slice(-500),
      });
    } catch (error) {
      res.json({
        pending: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  router.post("/db/migrations/run", requireDevAdmin, async (_req: Request, res: Response) => {
    try {
      const { stdout, stderr } = await execAsync("npm run db:push", {
        cwd: process.cwd(),
        timeout: 120000,
      });

      const appliedMatch = (stdout || "").match(/applied\s+(\d+)/i);
      const applied = appliedMatch ? parseInt(appliedMatch[1], 10) : 0;

      res.json({
        success: true,
        applied,
        stdout: (stdout || "").slice(-500),
        stderr: (stderr || "").slice(-500),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Migration failed",
      });
    }
  });

  router.post("/auth/dev-token", requireDevAdmin, async (_req: Request, res: Response) => {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      sub: "dev-user-001",
      email: "dev@valueos.local",
      role: "authenticated",
      iat: now,
      exp: now + 3600 * 24,
      aud: "authenticated",
    };

    const fakeToken = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${Buffer.from(
      JSON.stringify(payload)
    ).toString("base64")}.dev-signature`;

    res.json({
      token: fakeToken,
      refreshToken: `refresh-${Date.now()}`,
      expiresIn: 86400,
    });
  });

  router.post("/restart", requireDevAdmin, async (_req: Request, res: Response) => {
    res.json({
      success: true,
      message: "Restart signal sent. Server will restart shortly.",
    });

    setTimeout(() => {
      logger.info("[Dev] Restart requested via Dev HUD");
      process.exit(0);
    }, 500);
  });

  router.post("/clear-cache", requireDevAdmin, async (req: Request, res: Response) => {
    const payload = req.body as unknown;
    let parsedScope: { scope: "platform" | "tenant"; pattern: string };

    try {
      parsedScope = resolveCacheClearPattern(payload);
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : "Invalid scope for cache clear operation",
      });
      return;
    }

    try {
      const redisModule = (await import("../lib/redis")) as Record<
        string,
        unknown
      >;
      const getClient = redisModule.getRedisClient as
        | (() => Promise<RedisCacheClient | null>)
        | undefined;
      let deletedCount = 0;

      if (getClient) {
        const client = await getClient();
        if (client) {
          deletedCount = await deleteKeysByPattern(client, parsedScope.pattern);
        }
      }

      logger.info("dev.cache_clear.completed", {
        event: "dev.cache_clear.completed",
        scope: parsedScope.scope,
        deleted_key_count: deletedCount,
      });

      res.json({
        success: true,
        scope: parsedScope.scope,
        deletedKeyCount: deletedCount,
        message: "Cache cleared for requested scope",
      });
    } catch (error) {
      res.json({
        success: false,
        error: error instanceof Error ? error.message : "Cache clear failed",
      });
    }
  });
}

export default router;
