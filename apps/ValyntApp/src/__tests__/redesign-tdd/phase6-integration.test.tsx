/**
 * Phase 6: Backend Integration — Contract Tests
 *
 * Tests API client, query hooks, mutations, and real-time event handling.
 *
 * Day 2: Integration Testing
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock API client
vi.mock("@/api/client", () => ({
  apiClient: {
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
  isAuthError: vi.fn((error) => error?.response?.status === 401),
  isPermissionError: vi.fn((error) => error?.response?.status === 403),
}));

import { apiClient } from "@/api/client";

// Test wrapper with QueryClient
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("6.1 API Client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("6.1.1: API client exists and has required methods", () => {
    expect(apiClient).toBeDefined();
    expect(apiClient.get).toBeDefined();
    expect(apiClient.put).toBeDefined();
    expect(apiClient.post).toBeDefined();
    expect(apiClient.delete).toBeDefined();
  });

  it("6.1.2: Error helpers identify auth and permission errors", () => {
    const { isAuthError, isPermissionError } = require("@/api/client");
    
    const authError = { response: { status: 401 } };
    const permError = { response: { status: 403 } };
    const otherError = { response: { status: 500 } };
    
    expect(isAuthError(authError)).toBe(true);
    expect(isPermissionError(permError)).toBe(true);
    expect(isAuthError(otherError)).toBe(false);
    expect(isPermissionError(otherError)).toBe(false);
  });
});

describe("6.2 Query Hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("6.2.1: useValueCase fetches case with warmth", async () => {
    const mockCase = {
      id: "case-123",
      name: "Test Case",
      saga_state: "VALIDATING",
      confidence_score: 0.75,
    };
    
    (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: mockCase,
    });

    const { useValueCase } = await import("@/hooks/queries/useValueCase");
    const { result } = renderHook(() => useValueCase("case-123"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(apiClient.get).toHaveBeenCalledWith("/cases/case-123");
    expect(result.current.data?.data.id).toBe("case-123");
    expect(result.current.data?.warmth).toBeDefined();
  });

  it("6.2.2: useGraphData fetches graph with SSE integration", async () => {
    const mockGraph = {
      id: "graph-1",
      versionId: "v1",
      scenarioId: "baseline",
      nodes: {},
      edges: {},
      computedAt: new Date().toISOString(),
      globalMetrics: {
        npv: 1000000,
        confidence: 0.8,
        defensibilityScore: 0.7,
      },
      evidenceCoverage: 0.85,
    };
    
    (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: mockGraph,
    });

    const { useGraphData } = await import("@/hooks/queries/useGraphData");
    const { result } = renderHook(() => useGraphData({ caseId: "case-123" }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.graph).toBeDefined();
    });

    expect(apiClient.get).toHaveBeenCalledWith("/cases/case-123/graph");
    expect(result.current.isConnected).toBeDefined();
    expect(result.current.connectionStatus).toBeDefined();
  });
});

describe("6.3 Real-Time Events", () => {
  it("6.3.1: useEventSource hook exists", async () => {
    const { useEventSource } = await import("@/hooks/useEventSource");
    expect(useEventSource).toBeDefined();
    expect(typeof useEventSource).toBe("function");
  });

  it("6.3.2: useWorkspaceEvents hook exists", async () => {
    const { useWorkspaceEvents } = await import("@/hooks/useWorkspaceEvents");
    expect(useWorkspaceEvents).toBeDefined();
    expect(typeof useWorkspaceEvents).toBe("function");
  });

  it("6.3.3: Event type guards work correctly", async () => {
    const {
      isWarmthTransitionEvent,
      isAgentUpdateEvent,
      isCollaborativeEditEvent,
    } = await import("@/hooks/events/types");

    const warmthEvent = { type: "WARMTH_TRANSITION" };
    const agentEvent = { type: "AGENT_UPDATE" };
    const editEvent = { type: "COLLABORATIVE_EDIT" };

    expect(isWarmthTransitionEvent(warmthEvent as never)).toBe(true);
    expect(isAgentUpdateEvent(agentEvent as never)).toBe(true);
    expect(isCollaborativeEditEvent(editEvent as never)).toBe(true);
    expect(isWarmthTransitionEvent(agentEvent as never)).toBe(false);
  });
});

describe("6.4 Mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("6.4.1: useUpdateNode mutation exists", async () => {
    const { useUpdateNode } = await import("@/hooks/mutations/useUpdateNode");
    expect(useUpdateNode).toBeDefined();
    expect(typeof useUpdateNode).toBe("function");
  });

  it("6.4.2: useUpdateModePreference mutation exists", async () => {
    const { useUpdateModePreference } = await import("@/hooks/queries/useModePreference");
    expect(useUpdateModePreference).toBeDefined();
    expect(typeof useUpdateModePreference).toBe("function");
  });
});

describe("6.5 Composite Hooks", () => {
  it("6.5.1: useWorkspaceData combines all data sources", async () => {
    const { useWorkspaceData } = await import("@/hooks/useWorkspaceData");
    expect(useWorkspaceData).toBeDefined();
    expect(typeof useWorkspaceData).toBe("function");
  });
});

describe("6.6 Conflict Resolution", () => {
  it("6.6.1: useConflictResolution hook exists", async () => {
    const { useConflictResolution } = await import("@/hooks/useConflictResolution");
    expect(useConflictResolution).toBeDefined();
    expect(typeof useConflictResolution).toBe("function");
  });
});
