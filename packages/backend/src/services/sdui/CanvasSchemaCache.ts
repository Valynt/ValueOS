import { SDUIPageDefinition } from "@valueos/sdui";

import { hashObject, shortHash } from "../../lib/contentHash";
import { logger } from "../../lib/logger.js";
import { SchemaCacheEntry } from "../../types/sdui-integration";

import { SDUICacheService } from "./SDUICacheService.js";

export interface SchemaHead {
  hash: string;
  version: number;
  updatedAt: number;
  workspaceId: string;
}

export class CanvasSchemaCache {
  constructor(
    private readonly cacheService: SDUICacheService,
    private readonly cachePrefix = "sdui:schema:",
    private readonly cacheTtlSeconds = 300
  ) {}

  async getCachedSchema(
    workspaceId: string
  ): Promise<SDUIPageDefinition | null> {
    try {
      const cacheKey = `${this.cachePrefix}${workspaceId}`;
      const cached = await this.cacheService.get<SchemaCacheEntry>(cacheKey);

      if (!cached) return null;

      if (Date.now() - cached.timestamp > cached.ttl * 1000) {
        await this.invalidateCache(workspaceId);
        return null;
      }

      return cached.schema as unknown as SDUIPageDefinition;
    } catch (error) {
      logger.error("Failed to get cached schema", {
        workspaceId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  async invalidateCache(workspaceId: string): Promise<void> {
    try {
      const cacheKey = `${this.cachePrefix}${workspaceId}`;
      await this.cacheService.delete(cacheKey);
      logger.debug("Invalidated schema cache", { workspaceId });
    } catch (error) {
      logger.error("Failed to invalidate cache", {
        workspaceId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async cacheSchema(
    workspaceId: string,
    schema: SDUIPageDefinition
  ): Promise<void> {
    try {
      const cacheKey = `${this.cachePrefix}${workspaceId}`;
      const entry: SchemaCacheEntry = {
        schema: schema as unknown as Record<string, unknown>,
        hash: hashObject(schema),
        timestamp: Date.now(),
        ttl: this.cacheTtlSeconds,
      };
      await this.cacheService.set(cacheKey, entry, this.cacheTtlSeconds);
      logger.debug("Cached schema", {
        workspaceId,
        ttl: this.cacheTtlSeconds,
      });
    } catch (error) {
      logger.error("Failed to cache schema", {
        workspaceId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async cacheSchemaWithCAS(
    workspaceId: string,
    schema: SDUIPageDefinition
  ): Promise<string> {
    try {
      const hash = hashObject(schema);
      const size = JSON.stringify(schema).length;

      await this.cacheService.setCAS(hash, schema);
      await this.cacheService.setHead(workspaceId, hash);

      logger.debug("Cached schema with CAS", {
        workspaceId,
        hash: shortHash(hash),
        size,
        version: schema.version,
      });

      return hash;
    } catch (error) {
      logger.error("Failed to cache schema with CAS", {
        workspaceId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async getSchemaHead(workspaceId: string): Promise<SchemaHead | null> {
    try {
      const head = await this.cacheService.getHead(workspaceId);
      if (!head) return null;

      return {
        hash: head.hash,
        version: 1,
        updatedAt: head.updatedAt,
        workspaceId,
      };
    } catch (error) {
      logger.error("Failed to get schema head", {
        workspaceId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  async getSchemaByHash(hash: string): Promise<SDUIPageDefinition | null> {
    try {
      const schema = await this.cacheService.getCAS<SDUIPageDefinition>(hash);

      if (schema) {
        logger.debug("Retrieved schema by hash", { hash: shortHash(hash) });
      }

      return schema;
    } catch (error) {
      logger.error("Failed to get schema by hash", {
        hash: shortHash(hash),
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  async getSchemaWithCAS(workspaceId: string): Promise<{
    schema: SDUIPageDefinition;
    hash: string;
    updatedAt: number;
  } | null> {
    try {
      const result =
        await this.cacheService.getByResourceId<SDUIPageDefinition>(workspaceId);

      if (!result) return null;

      logger.debug("Retrieved schema with CAS", {
        workspaceId,
        hash: shortHash(result.hash),
      });

      return {
        schema: result.value,
        hash: result.hash,
        updatedAt: result.updatedAt,
      };
    } catch (error) {
      logger.error("Failed to get schema with CAS", {
        workspaceId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }
}
