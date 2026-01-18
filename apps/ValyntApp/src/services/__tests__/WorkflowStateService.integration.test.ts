import { beforeEach, describe, expect, it, vi } from "vitest";
import { WorkflowStateService } from "../WorkflowStateService";

// In-memory stub for agent_sessions table
const sessionStore: Record<string, any> = {};

/**
 * Creates a thenable mock builder that maintains chainability
 * and correctly handles multiple .eq() calls.
 */
const createBuilder = (table: string) => {
  const builder: any = {
    select: vi.fn().mockImplementation(() => builder),
    insert: vi.fn().mockImplementation((payload: any) => {
      const id = `sess-${Object.keys(sessionStore).length + 1}`;
      sessionStore[id] = {
        id,
        ...payload,
        workflow_state: payload.workflow_state,
        status: payload.status || "active",
        created_at: payload.created_at || new Date().toISOString(),
        updated_at: payload.updated_at || new Date().toISOString(),
      };

      // For inserts, returns another builder for .select().single() pattern
      const insertResultBuilder: any = {
        select: vi.fn().mockImplementation(() => insertResultBuilder),
        single: vi.fn().mockResolvedValue({ data: { id }, error: null }),
        then: (resolve: any) => resolve({ data: { id }, error: null }),
      };
      return insertResultBuilder;
    }),
    update: vi.fn().mockImplementation((payload: any) => {
      const updateBuilder: any = {
        eq: vi.fn().mockImplementation((field: string, value: string) => {
          if (field === "id" && sessionStore[value]) {
            sessionStore[value] = {
              ...sessionStore[value],
              ...payload,
              updated_at: new Date().toISOString(),
            };
          }
          return updateBuilder;
        }),
        then: (resolve: any) => resolve({ error: null }),
      };
      return updateBuilder;
    }),
    delete: vi.fn().mockImplementation(() => builder),
    eq: vi.fn().mockImplementation((field: string, value: any) => {
      // Filter sessions for matching rows if needed, but for simple tests
      // we can just return a result object that handles single().
      const rows = Object.values(sessionStore).filter((row: any) => row[field] === value);

      const eqBuilder: any = {
        eq: vi.fn().mockImplementation(() => eqBuilder),
        single: vi.fn().mockImplementation(async () => {
          return {
            data: rows[0] || null,
            error: rows[0] ? null : { message: "not found" },
          };
        }),
        order: vi.fn().mockImplementation(() => eqBuilder),
        limit: vi.fn().mockImplementation(() => eqBuilder),
        then: (resolve: any) => {
          // If called as await query, return all matching rows
          resolve({ data: rows, error: null });
        },
      };
      return eqBuilder;
    }),
    lt: vi.fn().mockImplementation(() => builder),
    neq: vi.fn().mockImplementation(() => builder),
    order: vi.fn().mockImplementation(() => builder),
    limit: vi.fn().mockImplementation(() => builder),
    then: (resolve: any) => {
      // Default resolve for select('*') without filters
      resolve({ data: Object.values(sessionStore), error: null });
    },
  };
  return builder;
};

const supabaseStub = {
  from: vi.fn((table: string) => createBuilder(table)),
};

describe("WorkflowStateService (integration-ish)", () => {
  beforeEach(() => {
    Object.keys(sessionStore).forEach((k) => delete sessionStore[k]);
    vi.clearAllMocks();
  });

  it("creates session and saves/reads state round-trip", async () => {
    const service = new WorkflowStateService(supabaseStub as any);

    const { sessionId, state } = await service.loadOrCreateSession({
      caseId: "case-1",
      userId: "user-1",
      tenantId: "tenant-1",
      initialStage: "opportunity",
      context: { company: "Acme" },
    });

    expect(sessionId).toBeDefined();
    expect(state.context.caseId).toBe("case-1");

    const updated = {
      currentStage: "target",
      status: "in_progress" as const,
      completedStages: ["opportunity"],
      context: state.context,
    };
    await service.saveWorkflowState(sessionId, updated, "tenant-1");

    const fetched = await service.getWorkflowState(sessionId, "tenant-1");
    expect(fetched?.currentStage).toBe("target");
    expect(fetched?.completedStages).toContain("opportunity");
  });
});
