/**
 * Dev-Only Routes
 *
 * These routes are only available in development mode.
 * They support the Smart Remediation "Fix It" buttons in the Dev HUD.
 */

import { Router, Request, Response } from "express";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);
const router = Router();

const isDev = process.env.NODE_ENV !== "production";

if (!isDev) {
  router.all("*", (_req: Request, res: Response) => {
    res.status(403).json({ error: "Dev routes disabled in production" });
  });
} else {
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

  router.post("/seed", async (_req: Request, res: Response) => {
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

  router.post("/db/migrations/run", async (_req: Request, res: Response) => {
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

  router.post("/auth/dev-token", async (_req: Request, res: Response) => {
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

  router.post("/restart", async (_req: Request, res: Response) => {
    res.json({
      success: true,
      message: "Restart signal sent. Server will restart shortly.",
    });

    setTimeout(() => {
      console.log("[Dev] Restart requested via Dev HUD");
      process.exit(0);
    }, 500);
  });

  router.post("/clear-cache", async (_req: Request, res: Response) => {
    try {
      const redisModule = (await import("../../lib/redis")) as Record<
        string,
        unknown
      >;
      const getClient = redisModule.getRedisClient as
        | (() => Promise<{ flushdb: () => Promise<void> }>)
        | undefined;
      if (getClient) {
        const client = await getClient();
        await client.flushdb();
      }
      res.json({ success: true, message: "Cache cleared" });
    } catch (error) {
      res.json({
        success: false,
        error: error instanceof Error ? error.message : "Cache clear failed",
      });
    }
  });
}

export default router;
