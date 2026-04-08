import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGet, mockGetSession } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockGetSession: vi.fn(),
}));

vi.mock("@/api/client", () => ({
  apiClient: {
    get: mockGet,
  },
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
    },
  },
}));

import { fetchUserTenants, getTenantById } from "../tenant";

describe("tenant api security", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGet.mockResolvedValue({ data: { data: [], error: null } });
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: "session-user-123" } } },
    });
  });

  it("rejects mismatched caller user id", async () => {
    const result = await fetchUserTenants({ expectedUserId: "attacker-user-456" });

    expect(result.data).toBeNull();
    expect(result.error).toBeTruthy();
  });

  it("sanitizes tenantId before tenant lookup query", async () => {
    const dangerousTenantId = "tenant-1<script>alert(1)</script>";

    await getTenantById(dangerousTenantId);

    expect(mockGet).toHaveBeenCalledWith("/v1/tenant/tenant-1");
  });
});
