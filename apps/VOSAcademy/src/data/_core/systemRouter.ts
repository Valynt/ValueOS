import { router, publicProcedure } from "./trpc";
import { getDb } from "../db";

export const systemRouter = router({
  health: publicProcedure.query(async () => {
    const checks = {
      api: "ok" as const,
      database: "unknown" as "ok" | "error" | "unknown",
      timestamp: new Date().toISOString(),
    };

    // Check database connection
    try {
      const db = await getDb();
      if (db) {
        // Try a simple query
        await db.execute('SELECT 1' as any);
        checks.database = "ok";
      } else {
        checks.database = "error";
      }
    } catch (error) {
      console.error('[Health] Database check failed:', error);
      checks.database = "error";
    }

    const overallStatus = checks.database === "ok" ? "healthy" : "degraded";

    return {
      status: overallStatus,
      checks,
    };
  }),

  version: publicProcedure.query(() => {
    return {
      version: "1.0.0",
      name: "VOS Academy",
      environment: process.env.NODE_ENV || "development",
    };
  }),
});
