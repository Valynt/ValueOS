import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../lib/supabase.js", () => ({
  supabase: { from: vi.fn() },
}));

vi.mock("../../lib/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { supabase } from "../../lib/supabase.js";

import { persistenceService } from "./PersistenceService.js";

const mockFrom = supabase.from as ReturnType<typeof vi.fn>;

function makeChain(terminal: unknown) {
  const chain: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(terminal),
    maybeSingle: vi.fn().mockResolvedValue(terminal),
    then: (onFulfilled?: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(terminal).then(onFulfilled, onRejected),
  };

  return chain;
}

const ORGANIZATION_ID = "org-123";
const OTHER_ORGANIZATION_ID = "org-999";
const CASE_ID = "case-123";
const COMPONENT_ID = "component-123";

const COMPONENT = {
  id: COMPONENT_ID,
  type: "note",
  position: { x: 20, y: 40 },
  size: { width: 240, height: 120 },
  props: { title: "Widget" },
};

describe("PersistenceService tenant isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    persistenceService.flushSaveQueue();
  });

  it("rejects missing organizationId for every public workflow persistence entry point", async () => {
    await expect(
      persistenceService.createBusinessCase("", "Case", "Client", "user-1")
    ).rejects.toThrow("PersistenceService.createBusinessCase: organizationId is required");

    await expect(
      persistenceService.getBusinessCase("", CASE_ID)
    ).rejects.toThrow("PersistenceService.getBusinessCase: organizationId is required");

    await expect(
      persistenceService.updateBusinessCase("", CASE_ID, { name: "Updated" })
    ).rejects.toThrow("PersistenceService.updateBusinessCase: organizationId is required");

    await expect(
      persistenceService.saveComponent("", CASE_ID, COMPONENT)
    ).rejects.toThrow("PersistenceService.saveComponent: organizationId is required");

    await expect(
      persistenceService.updateComponent("", COMPONENT_ID, { position: { x: 1, y: 2 } })
    ).rejects.toThrow("PersistenceService.updateComponent: organizationId is required");

    expect(() =>
      persistenceService.debouncedUpdateComponent(
        "",
        COMPONENT_ID,
        { position: { x: 1, y: 2 } },
      )
    ).toThrow("PersistenceService.debouncedUpdateComponent: organizationId is required");

    await expect(
      persistenceService.deleteComponent("", COMPONENT_ID)
    ).rejects.toThrow("PersistenceService.deleteComponent: organizationId is required");

    await expect(
      persistenceService.loadComponents("", CASE_ID)
    ).rejects.toThrow("PersistenceService.loadComponents: organizationId is required");

    await expect(
      persistenceService.logHistory("", COMPONENT_ID, "created", "user", {})
    ).rejects.toThrow("PersistenceService.logHistory: organizationId is required");

    await expect(
      persistenceService.getComponentHistory("", COMPONENT_ID)
    ).rejects.toThrow("PersistenceService.getComponentHistory: organizationId is required");

    await expect(
      persistenceService.getGlobalHistory("", CASE_ID)
    ).rejects.toThrow("PersistenceService.getGlobalHistory: organizationId is required");

    await expect(
      persistenceService.logAgentActivity(
        "",
        CASE_ID,
        "NarrativeAgent",
        "narrative",
        "Title",
        "content"
      )
    ).rejects.toThrow("PersistenceService.logAgentActivity: organizationId is required");

    await expect(
      persistenceService.getAgentActivities("", CASE_ID)
    ).rejects.toThrow("PersistenceService.getAgentActivities: organizationId is required");
  });

  it("persists organization_id on component and history inserts", async () => {
    const insertChain = makeChain({
      data: { id: COMPONENT_ID },
      error: null,
    });
    const historyChain = makeChain({ data: null, error: null });

    mockFrom
      .mockReturnValueOnce(insertChain)
      .mockReturnValueOnce(historyChain);

    const componentId = await persistenceService.saveComponent(
      ORGANIZATION_ID,
      CASE_ID,
      COMPONENT,
      "analyst"
    );

    expect(componentId).toBe(COMPONENT_ID);
    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: ORGANIZATION_ID,
        case_id: CASE_ID,
        created_by: "analyst",
      })
    );
    expect(historyChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: ORGANIZATION_ID,
        component_id: COMPONENT_ID,
        action_type: "created",
      })
    );
  });

  it("scopes business case reads to organization_id and blocks cross-tenant reads", async () => {
    const chain = makeChain({
      data: null,
      error: { code: "PGRST116", message: "No rows" },
    });
    mockFrom.mockReturnValue(chain);

    const result = await persistenceService.getBusinessCase(
      OTHER_ORGANIZATION_ID,
      CASE_ID
    );

    expect(result).toBeNull();
    expect(chain.eq).toHaveBeenCalledWith("id", CASE_ID);
    expect(chain.eq).toHaveBeenCalledWith(
      "organization_id",
      OTHER_ORGANIZATION_ID
    );
  });

  it("returns false for cross-tenant component updates and scopes the update query", async () => {
    const chain = makeChain({ data: null, error: null });
    mockFrom.mockReturnValue(chain);

    const result = await persistenceService.updateComponent(
      OTHER_ORGANIZATION_ID,
      COMPONENT_ID,
      { position: { x: 1, y: 2 } },
      "analyst"
    );

    expect(result).toBe(false);
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ organization_id: OTHER_ORGANIZATION_ID })
    );
    expect(chain.eq).toHaveBeenCalledWith("id", COMPONENT_ID);
    expect(chain.eq).toHaveBeenCalledWith(
      "organization_id",
      OTHER_ORGANIZATION_ID
    );
  });

  it("returns false for cross-tenant component deletes and scopes the delete query", async () => {
    const chain = makeChain({ data: null, error: null });
    mockFrom.mockReturnValue(chain);

    const result = await persistenceService.deleteComponent(
      OTHER_ORGANIZATION_ID,
      COMPONENT_ID,
      "analyst"
    );

    expect(result).toBe(false);
    expect(chain.eq).toHaveBeenCalledWith("id", COMPONENT_ID);
    expect(chain.eq).toHaveBeenCalledWith(
      "organization_id",
      OTHER_ORGANIZATION_ID
    );
  });

  it("filters component, history, and activity reads by organization_id", async () => {
    const componentsChain = makeChain({
      data: [
        {
          id: COMPONENT_ID,
          type: "note",
          position_x: 20,
          position_y: 40,
          width: 240,
          height: 120,
          props: { title: "Widget" },
        },
      ],
      error: null,
    });
    const historyChain = makeChain({ data: [], error: null });
    const globalHistoryChain = makeChain({ data: [], error: null });
    const activitiesChain = makeChain({ data: [], error: null });

    mockFrom
      .mockReturnValueOnce(componentsChain)
      .mockReturnValueOnce(historyChain)
      .mockReturnValueOnce(globalHistoryChain)
      .mockReturnValueOnce(activitiesChain);

    const components = await persistenceService.loadComponents(
      OTHER_ORGANIZATION_ID,
      CASE_ID
    );
    const history = await persistenceService.getComponentHistory(
      OTHER_ORGANIZATION_ID,
      COMPONENT_ID
    );
    const globalHistory = await persistenceService.getGlobalHistory(
      OTHER_ORGANIZATION_ID,
      CASE_ID,
      25
    );
    const activities = await persistenceService.getAgentActivities(
      OTHER_ORGANIZATION_ID,
      CASE_ID,
      10
    );

    expect(components).toHaveLength(1);
    expect(history).toEqual([]);
    expect(globalHistory).toEqual([]);
    expect(activities).toEqual([]);

    expect(componentsChain.eq).toHaveBeenCalledWith(
      "organization_id",
      OTHER_ORGANIZATION_ID
    );
    expect(historyChain.eq).toHaveBeenCalledWith(
      "organization_id",
      OTHER_ORGANIZATION_ID
    );
    expect(globalHistoryChain.eq).toHaveBeenCalledWith(
      "organization_id",
      OTHER_ORGANIZATION_ID
    );
    expect(globalHistoryChain.eq).toHaveBeenCalledWith(
      "canvas_components.organization_id",
      OTHER_ORGANIZATION_ID
    );
    expect(activitiesChain.eq).toHaveBeenCalledWith(
      "organization_id",
      OTHER_ORGANIZATION_ID
    );
  });

  it("persists organization_id on legacy business case and agent activity inserts", async () => {
    const businessCaseChain = makeChain({
      data: { id: CASE_ID, organization_id: ORGANIZATION_ID },
      error: null,
    });
    const activityChain = makeChain({ data: null, error: null });

    mockFrom
      .mockReturnValueOnce(businessCaseChain)
      .mockReturnValueOnce(activityChain);

    await persistenceService.createBusinessCase(
      ORGANIZATION_ID,
      "Case",
      "Client",
      "user-1"
    );
    await persistenceService.logAgentActivity(
      ORGANIZATION_ID,
      CASE_ID,
      "NarrativeAgent",
      "narrative",
      "Title",
      "Body",
      { source: "test" }
    );

    expect(businessCaseChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ organization_id: ORGANIZATION_ID })
    );
    expect(activityChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: ORGANIZATION_ID,
        case_id: CASE_ID,
        agent_name: "NarrativeAgent",
      })
    );
  });
});
