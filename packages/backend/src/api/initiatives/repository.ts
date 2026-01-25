import type { PoolClient } from "pg";
import {
  DbConflictError,
  DbNotFoundError,
  DbValidationError,
  TransientDbError,
} from "../../lib/db/errors";
import type {
  CreateInitiativeInput,
  Initiative,
  ListInitiativesQuery,
  UpdateInitiativeInput,
} from "./types";

const TRANSIENT_DB_CODES = new Set([
  "08001",
  "08006",
  "53300",
  "57P01",
  "57014",
  "55006",
]);

type TenantDbContext = {
  client: PoolClient;
  query: PoolClient["query"];
};

type InitiativeRow = {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  status: string;
  category: string;
  priority: number;
  owner_email: string;
  tags: string[];
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
  deleted_at: string | null;
};

const SORT_COLUMNS: Record<ListInitiativesQuery["sortBy"], string> = {
  created_at: "created_at",
  priority: "priority",
  name: "name",
};

const SORT_DIRECTIONS: Record<ListInitiativesQuery["sortDirection"], "ASC" | "DESC"> = {
  asc: "ASC",
  desc: "DESC",
};

const withSavepoint = async <T>(
  db: TenantDbContext,
  name: string,
  action: () => Promise<T>
): Promise<T> => {
  await db.query(`SAVEPOINT ${name}`);
  try {
    const result = await action();
    await db.query(`RELEASE SAVEPOINT ${name}`);
    return result;
  } catch (error) {
    await db.query(`ROLLBACK TO SAVEPOINT ${name}`);
    throw error;
  }
};

const mapRow = (row: InitiativeRow): Initiative => ({
  id: row.id,
  tenantId: row.tenant_id,
  name: row.name,
  description: row.description,
  status: row.status as Initiative["status"],
  category: row.category as Initiative["category"],
  priority: row.priority,
  ownerEmail: row.owner_email,
  tags: row.tags ?? [],
  startDate: row.start_date,
  endDate: row.end_date,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  createdBy: row.created_by,
  updatedBy: row.updated_by,
  deletedAt: row.deleted_at,
});

const mapDbError = (error: unknown, fallbackMessage: string): Error => {
  const err = error as { code?: string; message?: string };
  if (err.code === "23505") {
    return new DbConflictError("Initiative already exists", {
      code: err.code,
    });
  }
  if (err.code === "23502" || err.code === "23514") {
    return new DbValidationError(err.message || fallbackMessage, { code: err.code });
  }
  if (err.code && TRANSIENT_DB_CODES.has(err.code)) {
    return new TransientDbError("Database temporarily unavailable", {
      code: err.code,
    });
  }
  return error instanceof Error ? error : new Error(fallbackMessage);
};

const rethrowKnownErrors = (error: unknown, fallbackMessage: string): never => {
  if (
    error instanceof DbConflictError ||
    error instanceof DbNotFoundError ||
    error instanceof DbValidationError ||
    error instanceof TransientDbError
  ) {
    throw error;
  }
  throw mapDbError(error, fallbackMessage);
};

export class InitiativesRepository {
  private db: TenantDbContext;

  constructor(db: TenantDbContext) {
    this.db = db;
  }

  async create(
    tenantId: string,
    userId: string,
    input: CreateInitiativeInput
  ): Promise<Initiative> {
    const now = new Date().toISOString();
    return withSavepoint(this.db, "initiative_create", async () => {
      const insertSql = `
        INSERT INTO initiatives (
          tenant_id,
          name,
          description,
          status,
          category,
          priority,
          owner_email,
          tags,
          start_date,
          end_date,
          idempotency_key,
          created_at,
          updated_at,
          created_by,
          updated_by
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
        ON CONFLICT (tenant_id, idempotency_key)
          WHERE idempotency_key IS NOT NULL
        DO NOTHING
        RETURNING *;
      `;

      try {
        const insertResult = await this.db.query<InitiativeRow>(insertSql, [
          tenantId,
          input.name,
          input.description ?? null,
          input.status,
          input.category,
          input.priority,
          input.ownerEmail,
          input.tags,
          input.startDate ?? null,
          input.endDate ?? null,
          input.idempotencyKey ?? null,
          now,
          now,
          userId,
          userId,
        ]);

        if (insertResult.rows.length > 0) {
          return mapRow(insertResult.rows[0]);
        }

        if (input.idempotencyKey) {
          const existing = await this.db.query<InitiativeRow>(
            `
              SELECT *
              FROM initiatives
              WHERE tenant_id = $1
                AND idempotency_key = $2
                AND deleted_at IS NULL
              LIMIT 1;
            `,
            [tenantId, input.idempotencyKey]
          );

          if (existing.rows.length > 0) {
            return mapRow(existing.rows[0]);
          }
        }

        throw new DbConflictError("Initiative already exists");
      } catch (error) {
        rethrowKnownErrors(error, "Failed to create initiative");
      }
    });
  }

  async getById(tenantId: string, id: string): Promise<Initiative> {
    try {
      const result = await this.db.query<InitiativeRow>(
        `
          SELECT *
          FROM initiatives
          WHERE tenant_id = $1
            AND id = $2
            AND deleted_at IS NULL
          LIMIT 1;
        `,
        [tenantId, id]
      );

      if (result.rows.length === 0) {
        throw new DbNotFoundError("Initiative", id);
      }

      return mapRow(result.rows[0]);
    } catch (error) {
      rethrowKnownErrors(error, "Failed to fetch initiative");
    }
  }

  async list(
    tenantId: string,
    query: ListInitiativesQuery,
    cursor?: { sortValue: string | number; id: string }
  ): Promise<Initiative[]> {
    const conditions: string[] = ["tenant_id = $1", "deleted_at IS NULL"];
    const values: Array<string | number> = [tenantId];

    const addFilter = (clause: string, value: string | number) => {
      values.push(value);
      conditions.push(`${clause} $${values.length}`);
    };

    if (query.status) {
      addFilter("status =", query.status);
    }

    if (query.category) {
      addFilter("category =", query.category);
    }

    if (query.ownerEmail) {
      addFilter("owner_email =", query.ownerEmail);
    }

    if (query.priorityMin !== undefined) {
      addFilter("priority >=", query.priorityMin);
    }

    if (query.priorityMax !== undefined) {
      addFilter("priority <=", query.priorityMax);
    }

    if (query.search) {
      values.push(`%${query.search}%`);
      conditions.push(`name ILIKE $${values.length}`);
    }

    const sortColumn = SORT_COLUMNS[query.sortBy];
    const sortDirection = SORT_DIRECTIONS[query.sortDirection];

    if (cursor) {
      values.push(cursor.sortValue, cursor.id);
      const comparator = sortDirection === "DESC" ? "<" : ">";
      conditions.push(
        `(${sortColumn}, id) ${comparator} ($${values.length - 1}, $${
          values.length
        })`
      );
    }

    values.push(query.limit + 1);
    const sql = `
      SELECT *
      FROM initiatives
      WHERE ${conditions.join(" AND ")}
      ORDER BY ${sortColumn} ${sortDirection}, id ${sortDirection}
      LIMIT $${values.length};
    `;

    try {
      const result = await this.db.query<InitiativeRow>(sql, values);
      return result.rows.map(mapRow);
    } catch (error) {
      rethrowKnownErrors(error, "Failed to list initiatives");
    }
  }

  async update(
    tenantId: string,
    userId: string,
    id: string,
    input: UpdateInitiativeInput
  ): Promise<Initiative> {
    return withSavepoint(this.db, "initiative_update", async () => {
      const updates: string[] = [];
      const values: Array<string | number | string[] | null> = [];

      const pushUpdate = (column: string, value: string | number | string[] | null) => {
        values.push(value);
        updates.push(`${column} = $${values.length}`);
      };

      if (input.name !== undefined) pushUpdate("name", input.name);
      if (input.description !== undefined)
        pushUpdate("description", input.description ?? null);
      if (input.status !== undefined) pushUpdate("status", input.status);
      if (input.category !== undefined) pushUpdate("category", input.category);
      if (input.priority !== undefined) pushUpdate("priority", input.priority);
      if (input.ownerEmail !== undefined)
        pushUpdate("owner_email", input.ownerEmail);
      if (input.tags !== undefined) pushUpdate("tags", input.tags);
      if (input.startDate !== undefined) pushUpdate("start_date", input.startDate);
      if (input.endDate !== undefined) pushUpdate("end_date", input.endDate);

      const now = new Date().toISOString();
      values.push(now, userId, tenantId, id);

      const sql = `
        UPDATE initiatives
        SET ${updates.join(", ")},
            updated_at = $${values.length - 3},
            updated_by = $${values.length - 2}
        WHERE tenant_id = $${values.length - 1}
          AND id = $${values.length}
          AND deleted_at IS NULL
        RETURNING *;
      `;

      try {
        const result = await this.db.query<InitiativeRow>(sql, values);
        if (result.rows.length === 0) {
          throw new DbNotFoundError("Initiative", id);
        }
        return mapRow(result.rows[0]);
      } catch (error) {
        rethrowKnownErrors(error, "Failed to update initiative");
      }
    });
  }

  async softDelete(tenantId: string, userId: string, id: string): Promise<void> {
    try {
      const now = new Date().toISOString();
      const result = await this.db.query<InitiativeRow>(
        `
          UPDATE initiatives
          SET deleted_at = $1,
              updated_at = $1,
              updated_by = $2
          WHERE tenant_id = $3
            AND id = $4
            AND deleted_at IS NULL
          RETURNING *;
        `,
        [now, userId, tenantId, id]
      );

      if (result.rows.length === 0) {
        throw new DbNotFoundError("Initiative", id);
      }
    } catch (error) {
      rethrowKnownErrors(error, "Failed to delete initiative");
    }
  }
}
