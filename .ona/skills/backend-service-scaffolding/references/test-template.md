# Test Template

## Standard Service Test

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { {{EntityName}}Service } from "../{{EntityName}}Service.js";
import { supabase } from "../../lib/supabase.js";

// Mock supabase client with chainable API
vi.mock("../../lib/supabase", () => {
  const chain = () => {
    const obj: Record<string, unknown> = {};
    const methods = ["from", "select", "insert", "update", "delete", "eq", "in", "order", "single", "match"];
    for (const m of methods) {
      obj[m] = vi.fn().mockReturnValue(obj);
    }
    return obj;
  };
  return { supabase: chain() };
});

// Mock logger to avoid noise
vi.mock("../../lib/logger", () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("{{EntityName}}Service", () => {
  let service: {{EntityName}}Service;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new {{EntityName}}Service();
  });

  describe("list", () => {
    it("should filter by tenant", async () => {
      // Mock getUserTenants (from TenantAwareService)
      const tenantIds = ["tenant-1"];
      vi.spyOn(service as any, "getUserTenants").mockResolvedValue(tenantIds);

      (supabase.from("{{table_name}}").order as any).mockResolvedValue({
        data: [{ id: "1", organization_id: "tenant-1", name: "Test" }],
        error: null,
      });

      const result = await service.list("user-1");

      expect(supabase.from).toHaveBeenCalledWith("{{table_name}}");
      expect(supabase.from("{{table_name}}").in).toHaveBeenCalledWith(
        "organization_id",
        tenantIds
      );
      expect(result).toHaveLength(1);
    });
  });

  describe("getById", () => {
    it("should return entity when tenant matches", async () => {
      vi.spyOn(service as any, "getUserTenants").mockResolvedValue(["tenant-1"]);

      (supabase.from("{{table_name}}").single as any).mockResolvedValue({
        data: { id: "1", organization_id: "tenant-1", name: "Test" },
        error: null,
      });

      const result = await service.getById("user-1", "1");
      expect(result.id).toBe("1");
    });

    it("should throw NOT_FOUND when entity missing", async () => {
      vi.spyOn(service as any, "getUserTenants").mockResolvedValue(["tenant-1"]);

      (supabase.from("{{table_name}}").single as any).mockResolvedValue({
        data: null,
        error: { message: "not found" },
      });

      await expect(service.getById("user-1", "missing")).rejects.toThrow();
    });
  });

  describe("create", () => {
    it("should set organization_id from tenant context", async () => {
      vi.spyOn(service as any, "getUserTenants").mockResolvedValue(["tenant-1"]);

      (supabase.from("{{table_name}}").single as any).mockResolvedValue({
        data: { id: "new-1", organization_id: "tenant-1", name: "New" },
        error: null,
      });

      const result = await service.create("user-1", { name: "New" });

      expect(supabase.from("{{table_name}}").insert).toHaveBeenCalledWith(
        expect.objectContaining({ organization_id: "tenant-1" })
      );
      expect(result.organization_id).toBe("tenant-1");
    });

    it("should reject invalid input via Zod", async () => {
      await expect(service.create("user-1", { name: "" })).rejects.toThrow();
    });
  });

  describe("delete", () => {
    it("should verify tenant ownership before deleting", async () => {
      vi.spyOn(service as any, "getUserTenants").mockResolvedValue(["tenant-1"]);

      // Mock getById (ownership check)
      vi.spyOn(service, "getById").mockResolvedValue({
        id: "1",
        organization_id: "tenant-1",
        name: "Test",
        created_at: "",
        updated_at: "",
      });

      (supabase.from("{{table_name}}").eq as any).mockResolvedValue({
        error: null,
      });

      await service.delete("user-1", "1");

      expect(supabase.from("{{table_name}}").eq).toHaveBeenCalledWith(
        "organization_id",
        "tenant-1"
      );
    });
  });
});
```

## Key Testing Patterns

### Mocking TenantAwareService internals

`getUserTenants` and `getTenantContext` are protected methods. Spy on them via `service as any`:

```typescript
vi.spyOn(service as any, "getUserTenants").mockResolvedValue(["tenant-1"]);
```

### Verifying tenant isolation

Every test that touches Supabase should assert that `organization_id` or `tenant_id` appears in the query chain:

```typescript
expect(supabase.from("table").eq).toHaveBeenCalledWith("organization_id", "tenant-1");
// or
expect(supabase.from("table").in).toHaveBeenCalledWith("organization_id", ["tenant-1"]);
```

### Testing cross-tenant rejection

```typescript
it("should block cross-tenant access", async () => {
  vi.spyOn(service as any, "getUserTenants").mockResolvedValue(["tenant-1"]);

  // Entity belongs to tenant-2
  (supabase.from("table").single as any).mockResolvedValue({
    data: { id: "1", organization_id: "tenant-2" },
    error: null,
  });

  await expect(service.getById("user-1", "1")).rejects.toThrow();
});
```
