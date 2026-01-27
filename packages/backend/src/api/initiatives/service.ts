import {
  DbValidationError,
} from "../../lib/db/errors";
import { InitiativesRepository } from "./repository.js"
import type {
  CreateInitiativeInput,
  Initiative,
  ListInitiativesQuery,
  PaginatedResponse,
  UpdateInitiativeInput,
} from "./types";
import type { PoolClient } from "pg";

const encodeCursor = (payload: Record<string, unknown>): string =>
  Buffer.from(JSON.stringify(payload), "utf8").toString("base64");

const decodeCursor = (cursor: string): Record<string, unknown> => {
  try {
    const decoded = Buffer.from(cursor, "base64").toString("utf8");
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    throw new DbValidationError("Invalid cursor provided");
  }
};

type TenantDbContext = {
  client: PoolClient;
  query: PoolClient["query"];
};

export class InitiativesService {
  private repository: InitiativesRepository;

  constructor(db: TenantDbContext) {
    this.repository = new InitiativesRepository(db);
  }

  async create(
    tenantId: string,
    userId: string,
    input: CreateInitiativeInput
  ): Promise<Initiative> {
    return this.repository.create(tenantId, userId, input);
  }

  async getById(tenantId: string, id: string): Promise<Initiative> {
    return this.repository.getById(tenantId, id);
  }

  async list(
    tenantId: string,
    query: ListInitiativesQuery
  ): Promise<PaginatedResponse<Initiative>> {
    let cursorData: { sortBy: string; sortValue: string | number; id: string } | undefined;

    if (query.cursor) {
      const decoded = decodeCursor(query.cursor);
      const sortBy = decoded.sortBy;
      const sortValue = decoded.sortValue;
      const id = decoded.id;

      if (!sortBy || !id) {
        throw new DbValidationError("Cursor missing required fields");
      }
      if (sortBy !== query.sortBy) {
        throw new DbValidationError("Cursor sortBy mismatch");
      }

      cursorData = {
        sortBy: String(sortBy),
        sortValue: sortValue as string | number,
        id: String(id),
      };
    }

    const items = await this.repository.list(tenantId, query, cursorData);

    const pageItems = items.slice(0, query.limit);
    const nextItem = items.length > query.limit ? pageItems[pageItems.length - 1] : null;

    return {
      items: pageItems,
      nextCursor: nextItem
        ? encodeCursor({
            sortBy: query.sortBy,
            sortValue: nextItem[query.sortBy === "created_at" ? "createdAt" : query.sortBy],
            id: nextItem.id,
          })
        : undefined,
    };
  }

  async update(
    tenantId: string,
    userId: string,
    id: string,
    input: UpdateInitiativeInput
  ): Promise<Initiative> {
    return this.repository.update(tenantId, userId, id, input);
  }

  async remove(tenantId: string, userId: string, id: string): Promise<void> {
    return this.repository.softDelete(tenantId, userId, id);
  }
}
