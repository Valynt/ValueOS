/**
 * conversation-history-tenant-isolation — integration test
 *
 * ConversationHistoryService must not return rows belonging to other tenants.
 * When queried with Tenant A's case_id but Tenant B's tenant_id, the result
 * must be null (0 rows).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Fixtures ─────────────────────────────────────────────────────────────────
const TENANT_A = "tenant-a-111";
const TENANT_B = "tenant-b-222";
const CASE_ID = "case-shared-001";

// Simulated database rows — only Tenant A has a conversation for this case
const DB_ROWS: Record<string, unknown>[] = [
  {
    id: "conv-1",
    case_id: CASE_ID,
    tenant_id: TENANT_A,
    messages: [
      {
        id: "m1",
        role: "user",
        content: "hello",
        timestamp: "2024-01-01T00:00:00Z",
      },
    ],
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
];

// ── Mock Supabase ────────────────────────────────────────────────────────────
function buildMockFrom() {
  return (_table: string) => {
    const filters: Array<{ col: string; val: unknown }> = [];

    const builder: Record<string, unknown> = {
      select: () => builder,
      eq: (col: string, val: unknown) => {
        filters.push({ col, val });
        return builder;
      },
      single: () => {
        const match = DB_ROWS.filter(r =>
          filters.every(f => r[f.col] === f.val)
        );
        if (match.length === 0) {
          return {
            data: null,
            error: { code: "PGRST116", message: "not found" },
          };
        }
        return { data: match[0], error: null };
      },
      upsert: () => ({ error: null }),
    };

    return builder;
  };
}

const mockFrom = buildMockFrom();

vi.mock("../../../lib/supabase.js", () => ({
  assertNotTestEnv: vi.fn(),
  supabase: { from: (...args: unknown[]) => mockFrom(...(args as [string])) },
  createServerSupabaseClient: () => ({ from: mockFrom }),
}));

vi.mock("../../../lib/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ── Import after mocks ──────────────────────────────────────────────────────
// Use dynamic import so the mock registrations above take effect first
const { conversationHistoryService } = await import(
  "../ConversationHistoryService.js"
);

// ── Tests ────────────────────────────────────────────────────────────────────
describe("conversation-history-tenant-isolation", () => {
  beforeEach(() => {
    // No internal cache to clear — the mock always hits the "database"
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns history for Tenant A's own case", async () => {
    const history = await conversationHistoryService.getHistory(
      CASE_ID,
      TENANT_A
    );
    expect(history).not.toBeNull();
    expect(history?.messages).toHaveLength(1);
    expect(history?.caseId).toBe(CASE_ID);
  });

  it("returns null when Tenant B queries Tenant A's case_id", async () => {
    const history = await conversationHistoryService.getHistory(
      CASE_ID,
      TENANT_B
    );
    expect(history).toBeNull();
  });

  it("getRecentMessages returns 0 rows for wrong tenant", async () => {
    const messages = await conversationHistoryService.getRecentMessages(
      CASE_ID,
      TENANT_B
    );
    expect(messages).toHaveLength(0);
  });
});
