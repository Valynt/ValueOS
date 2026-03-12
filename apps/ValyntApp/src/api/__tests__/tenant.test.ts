import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockEq,
  mockSelect,
  mockFrom,
  mockGetUser,
} = vi.hoisted(() => ({
  mockEq: vi.fn(),
  mockSelect: vi.fn(),
  mockFrom: vi.fn(),
  mockGetUser: vi.fn(),
}));

vi.mock("../../lib/supabase", () => ({
  supabase: {
    auth: {
      getUser: mockGetUser,
    },
    from: mockFrom,
  },
}));

import { fetchUserTenants, getTenantById } from "../tenant";

describe("tenant api security", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockEq.mockResolvedValue({ data: [], error: null });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ select: mockSelect });

    mockGetUser.mockResolvedValue({
      data: { user: { id: "session-user-123" } },
      error: null,
    });
  });

  it("rejects mismatched caller user id and does not query memberships", async () => {
    const result = await fetchUserTenants({ expectedUserId: "attacker-user-456" });

    expect(result.data).toBeNull();
    expect(result.error).toBeTruthy();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("sanitizes tenantId before tenant lookup query", async () => {
    const dangerousTenantId = "tenant-1<script>alert(1)</script>";

    await getTenantById(dangerousTenantId);

    expect(mockEq).toHaveBeenCalledWith("id", "tenant-1&lt;script&gt;alert(1)&lt;&#x2F;script&gt;");
  });
});
