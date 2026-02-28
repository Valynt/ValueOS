import { createLogger } from "@shared/lib/logger";
import type { NextFunction, Request, Response } from "express";
import type { Pool, PoolClient } from "pg";

import { getDatabaseUrl } from "../config/database.js"
import { settings } from "../config/settings.js"

const logger = createLogger({ component: "TenantDbContextMiddleware" });

let pool: Pool | null = null;
let poolShutdownRegistered = false;

const closePool = async () => {
  if (!pool) {
    return;
  }
  try {
    await pool.end();
  } finally {
    pool = null;
  }
};

const registerPoolShutdownHooks = () => {
  if (poolShutdownRegistered) {
    return;
  }
  poolShutdownRegistered = true;
  process.once("SIGTERM", () => void closePool());
  process.once("SIGINT", () => void closePool());
  process.once("beforeExit", () => void closePool());
};

const getPool = async (): Promise<Pool | null> => {
  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) {
    return null;
  }

  if (!pool) {
    const { Pool } = await import("pg");
    pool = new Pool({
      connectionString: databaseUrl,
      max: settings.databasePool.max,
      idleTimeoutMillis: settings.databasePool.idleTimeoutMs,
      connectionTimeoutMillis: settings.databasePool.connectionTimeoutMs,
      statement_timeout: settings.databasePool.statementTimeoutMs,
      query_timeout: settings.databasePool.queryTimeoutMs,
    });
    pool.on("error", (error) => {
      logger.error("Unexpected database pool error", error instanceof Error ? error : undefined);
    });
    registerPoolShutdownHooks();
  }

  return pool;
};

type TenantDbContext = {
  client: PoolClient;
  query: PoolClient["query"];
  tx: PoolClient["query"];
};

export function tenantDbContextMiddleware(enforce = true) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const tenantId = (req as any).tenantId as string | undefined;
    if (!tenantId) {
      if (enforce) {
        return res.status(403).json({
          error: "tenant_required",
          message: "Tenant context is required for database access.",
        });
      }
      return next();
    }

    const poolInstance = await getPool();
    if (!poolInstance) {
      logger.error("DATABASE_URL missing; tenant database context unavailable");
      if (enforce) {
        return res.status(500).json({
          error: "tenant_db_unavailable",
          message: "Tenant database connection is not configured.",
        });
      }
      return next();
    }

    let client: PoolClient | null = null;
    let finalized = false;

    const finalize = async (hadError: boolean, reason?: unknown) => {
      if (!client || finalized) {
        return;
      }
      finalized = true;
      try {
        await client.query(hadError ? "ROLLBACK" : "COMMIT");
      } catch (error) {
        logger.error("Failed to finalize tenant transaction", error instanceof Error ? error : undefined, {
          hadError,
          reason,
        });
      } finally {
        client.release();
      }
    };

    try {
      client = await poolInstance.connect();
      await client.query("BEGIN");
      await client.query("SET LOCAL app.tenant_id = $1", [tenantId]);

      (req as any).db = {
        client,
        query: client.query.bind(client),
        tx: client.query.bind(client),
      } satisfies TenantDbContext;

      res.on("finish", () => {
        const failed = res.statusCode >= 400;
        void finalize(failed, { statusCode: res.statusCode });
      });
      res.on("close", () => {
        void finalize(true, "response_closed");
      });
      res.on("error", (error) => {
        void finalize(true, error);
      });

      return next();
    } catch (error) {
      if (client) {
        try {
          await client.query("ROLLBACK");
        } catch (rollbackError) {
          logger.error(
            "Failed to rollback tenant transaction after error",
            rollbackError instanceof Error ? rollbackError : undefined
          );
        }
        client.release();
      }

      logger.error("Failed to establish tenant database context", error instanceof Error ? error : undefined, {
        tenantId,
      });
      return next(error);
    }
  };
}
