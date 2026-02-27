# Service Template

## TenantAwareService Pattern (default)

```typescript
import { z } from "zod";
import { TenantAwareService, type TenantContext } from "./TenantAwareService.js";
import { createLogger } from "../lib/logger.js";
import { ErrorCode, ServiceError, ValidationError } from "./errors.js";

const logger = createLogger({ component: "{{EntityName}}Service" });

// --- Zod Schemas ---

export const {{entityName}}CreateSchema = z.object({
  name: z.string().min(1).max(255),
  // Add fields. No `id`, `tenant_id`, `created_at`, `updated_at` — those are managed.
});

export const {{entityName}}UpdateSchema = {{entityName}}CreateSchema.partial();

export type {{EntityName}}Create = z.infer<typeof {{entityName}}CreateSchema>;
export type {{EntityName}}Update = z.infer<typeof {{entityName}}UpdateSchema>;

// --- Domain Type ---

export interface {{EntityName}} {
  id: string;
  organization_id: string;
  name: string;
  // Mirror the DB columns
  created_at: string;
  updated_at: string;
}

// --- Service ---

export class {{EntityName}}Service extends TenantAwareService {
  private readonly TABLE = "{{table_name}}";

  constructor() {
    super("{{EntityName}}Service");
  }

  async list(userId: string): Promise<{{EntityName}}[]> {
    const ctx = await this.getTenantContext(userId);

    const { data, error } = await this.supabase
      .from(this.TABLE)
      .select("*")
      .in("organization_id", ctx.tenantIds)
      .order("created_at", { ascending: false });

    if (error) {
      logger.error("Failed to list {{entityName}}s", error, { userId });
      throw new ServiceError(error.message, ErrorCode.SERVER_ERROR);
    }

    return (data ?? []) as {{EntityName}}[];
  }

  async getById(userId: string, id: string): Promise<{{EntityName}}> {
    const ctx = await this.getTenantContext(userId);

    const { data, error } = await this.supabase
      .from(this.TABLE)
      .select("*")
      .eq("id", id)
      .in("organization_id", ctx.tenantIds)
      .single();

    if (error || !data) {
      throw new ServiceError("{{EntityName}} not found", ErrorCode.NOT_FOUND, 404);
    }

    return data as {{EntityName}};
  }

  async create(userId: string, input: unknown): Promise<{{EntityName}}> {
    const parsed = {{entityName}}CreateSchema.parse(input);
    const ctx = await this.getTenantContext(userId);

    const record = {
      ...parsed,
      organization_id: ctx.tenantId,
      created_by: userId,
    };

    const { data, error } = await this.supabase
      .from(this.TABLE)
      .insert(record)
      .select()
      .single();

    if (error) {
      logger.error("Failed to create {{entityName}}", error, { userId });
      throw new ServiceError(error.message, ErrorCode.SERVER_ERROR);
    }

    logger.info("{{EntityName}} created", { id: data.id, userId, tenantId: ctx.tenantId });
    return data as {{EntityName}};
  }

  async update(userId: string, id: string, input: unknown): Promise<{{EntityName}}> {
    const parsed = {{entityName}}UpdateSchema.parse(input);

    // Verify ownership via tenant check
    const existing = await this.getById(userId, id);

    const { data, error } = await this.supabase
      .from(this.TABLE)
      .update({ ...parsed, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("organization_id", existing.organization_id)
      .select()
      .single();

    if (error) {
      logger.error("Failed to update {{entityName}}", error, { id, userId });
      throw new ServiceError(error.message, ErrorCode.SERVER_ERROR);
    }

    logger.info("{{EntityName}} updated", { id, userId });
    return data as {{EntityName}};
  }

  async delete(userId: string, id: string): Promise<void> {
    // Verify ownership via tenant check
    const existing = await this.getById(userId, id);

    const { error } = await this.supabase
      .from(this.TABLE)
      .delete()
      .eq("id", id)
      .eq("organization_id", existing.organization_id);

    if (error) {
      logger.error("Failed to delete {{entityName}}", error, { id, userId });
      throw new ServiceError(error.message, ErrorCode.SERVER_ERROR);
    }

    logger.info("{{EntityName}} deleted", { id, userId });
  }
}

export const {{entityName}}Service = new {{EntityName}}Service();
```

## BaseTenantService Pattern (generic CRUD)

Use when the service is a thin wrapper around a single table with no custom business logic.

```typescript
import { BaseTenantService } from "./base-tenant-service.js";
import { supabase } from "../lib/supabase.js";

export interface {{EntityName}} {
  id: string;
  tenant_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export class {{EntityName}}Service extends BaseTenantService<{{EntityName}}> {
  constructor() {
    super(supabase, "{{table_name}}");
  }
}

export const {{entityName}}Service = new {{EntityName}}Service();
```

## BaseService Pattern (no Supabase)

Use for orchestration, computation, or services that delegate DB access to other services.

```typescript
import { BaseService } from "./BaseService.js";
import { createLogger } from "../lib/logger.js";

const logger = createLogger({ component: "{{EntityName}}Service" });

export class {{EntityName}}Service extends BaseService {
  constructor() {
    super("{{EntityName}}Service");
  }

  async compute(input: SomeValidatedType): Promise<SomeResult> {
    return this.executeRequest(async () => {
      // Business logic here — no direct Supabase calls
    });
  }
}

export const {{entityName}}Service = new {{EntityName}}Service();
```
