import type { NextFunction, Request, Response } from "express";
import { Pool, type PoolClient } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

type TenantDbRequest = Request & {
  dbClient?: PoolClient;
};

export function tenantDbContextMiddleware() {
  return async (req: TenantDbRequest, res: Response, next: NextFunction) => {
    const tenantId = (req as { tenantId?: string }).tenantId;
    if (!tenantId) {
      return next();
    }

    let client: PoolClient | null = null;
    try {
      client = await pool.connect();
      await client.query("BEGIN");
      await client.query("SET LOCAL app.tenant_id = $1", [tenantId]);
      req.dbClient = client;

      let released = false;
      const release = async () => {
        if (released) return;
        released = true;
        try {
          await client?.query("ROLLBACK");
        } finally {
          client?.release();
        }
      };

      res.on("finish", () => {
        void release();
      });
      res.on("close", () => {
        void release();
      });

      return next();
    } catch (error) {
      if (client) {
        try {
          await client.query("ROLLBACK");
        } finally {
          client.release();
        }
      }
      return next(error);
    }
  };
}
