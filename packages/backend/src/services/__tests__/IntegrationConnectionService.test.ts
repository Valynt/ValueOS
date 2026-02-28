import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthorizationError, ValidationError } from "../errors.js";
import { IntegrationConnectionService } from "../IntegrationConnectionService.js";

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

vi.mock("@shared/lib/logger", () => ({
  createLogger: () => mockLogger,
}));

const mockSupabase = vi.hoisted(() => ({
  from: vi.fn(),
}));

vi.mock("../../lib/supabase", () => ({
  createServerSupabaseClient: () => mockSupabase,
  supabase: mockSupabase,
}));

const buildUserTenantsQuery = (data: any[] = []) => ({
  select: vi.fn(() => ({
    eq: vi.fn(() => ({
      eq: vi.fn(() => Promise.resolve({ data, error: null })),
    })),
  })),
});

const buildTenantIntegrationsQuery = (data: any) => ({
  upsert: vi.fn(() => ({
    select: vi.fn(() => ({
      single: vi.fn().mockResolvedValue({ data, error: null }),
    })),
  })),
  select: vi.fn(() => ({
    eq: vi.fn(() => ({
      single: vi.fn().mockResolvedValue({ data, error: null }),
    })),
  })),
  update: vi.fn(() => ({
    eq: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({ data, error: null }),
      })),
    })),
  })),
});

const buildUsageLogQuery = () => ({
  insert: vi.fn().mockResolvedValue({ data: null, error: null }),
});

describe("IntegrationConnectionService", () => {
  let service: IntegrationConnectionService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new IntegrationConnectionService();
  });

  it("blocks access when user is not a tenant member", async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "user_tenants") {
        return buildUserTenantsQuery([]);
      }
      return buildTenantIntegrationsQuery(null);
    });

    await expect(service.listConnections("user-1", "tenant-1")).rejects.toBeInstanceOf(
      AuthorizationError
    );
  });

  it("requires instance URL for Salesforce connections", async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "user_tenants") {
        return buildUserTenantsQuery([{ tenant_id: "tenant-1" }]);
      }
      return buildTenantIntegrationsQuery(null);
    });

    await expect(
      service.connect("user-1", "tenant-1", {
        provider: "salesforce",
        accessToken: "token-1234567890",
      })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("connects HubSpot and returns sanitized data", async () => {
    const integrationRow = {
      id: "int-1",
      tenant_id: "tenant-1",
      provider: "hubspot",
      status: "active",
      connected_at: new Date().toISOString(),
      last_used_at: new Date().toISOString(),
      last_refreshed_at: null,
      token_expires_at: null,
      instance_url: null,
      scopes: [],
      error_message: null,
    };

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "user_tenants") {
        return buildUserTenantsQuery([{ tenant_id: "tenant-1" }]);
      }
      if (table === "tenant_integrations") {
        return buildTenantIntegrationsQuery(integrationRow);
      }
      if (table === "integration_usage_log") {
        return buildUsageLogQuery();
      }
      return buildTenantIntegrationsQuery(integrationRow);
    });

    const result = await service.connect("user-1", "tenant-1", {
      provider: "hubspot",
      accessToken: "token-1234567890",
    });

    expect(result.provider).toBe("hubspot");
    expect(result.status).toBe("active");
    expect(result.tenantId).toBe("tenant-1");
  });
});
