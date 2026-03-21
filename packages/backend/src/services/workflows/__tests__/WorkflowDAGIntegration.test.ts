import { beforeEach, describe, expect, it, vi } from "vitest";

const { supabaseMock } = vi.hoisted(() => {
  const rows = [
    {
      id: "shared-execution-id",
      organization_id: "org-1",
      status: "running",
      error_message: null as string | null,
      completed_at: null as string | null,
    },
    {
      id: "shared-execution-id",
      organization_id: "org-2",
      status: "running",
      error_message: null as string | null,
      completed_at: null as string | null,
    },
  ];

  const update = vi.fn((values: Record<string, unknown>) => {
    const filters: Record<string, unknown> = {};

    const chain = {
      eq: vi.fn((column: string, value: unknown) => {
        filters[column] = value;

        if (Object.prototype.hasOwnProperty.call(filters, "id") && Object.prototype.hasOwnProperty.call(filters, "organization_id")) {
          rows.forEach((row) => {
            if (row.id === filters.id && row.organization_id === filters.organization_id) {
              row.status = values.status as string;
              row.error_message = values.error_message as string;
              row.completed_at = values.completed_at as string;
            }
          });
        }

        return chain;
      }),
    };

    return chain;
  });

  return {
    supabaseMock: {
      rows,
      from: vi.fn(() => ({ update })),
      update,
    },
  };
});

vi.mock("../../../lib/supabase.js", () => ({
  supabase: supabaseMock,
}));

vi.mock("../../../lib/logger.js", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
}));

import { WorkflowDAGExecutor } from "../WorkflowDAGIntegration.js";

type WorkflowFailureInvoker = {
  handleWorkflowFailure: (executionId: string, organizationId: string, error: string) => Promise<void>;
};

describe("WorkflowDAGIntegration tenant-safe failure handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseMock.rows[0].status = "running";
    supabaseMock.rows[0].error_message = null;
    supabaseMock.rows[0].completed_at = null;
    supabaseMock.rows[1].status = "running";
    supabaseMock.rows[1].error_message = null;
    supabaseMock.rows[1].completed_at = null;
  });

  it("updates only the matching-tenant row to failed when execution ids overlap", async () => {
    const executor = new WorkflowDAGExecutor();
    const failureInvoker = executor as unknown as WorkflowFailureInvoker;

    await failureInvoker.handleWorkflowFailure("shared-execution-id", "org-1", "agent timed out");

    expect(supabaseMock.rows[0]).toMatchObject({
      id: "shared-execution-id",
      organization_id: "org-1",
      status: "failed",
      error_message: "agent timed out",
    });
    expect(supabaseMock.rows[1]).toMatchObject({
      id: "shared-execution-id",
      organization_id: "org-2",
      status: "running",
      error_message: null,
      completed_at: null,
    });
  });
});
