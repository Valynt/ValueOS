/**
 * TDD tests for WorkspacePage — Phase 2 Integration
 *
 * Tests the top-level workspace page that integrates warmth derivation,
 * mode selection, and mode-specific views.
 * Written before implementation.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { WarmthResult } from "@shared/domain/Warmth";
import { deriveWarmth } from "@shared/domain/Warmth";

// Mock react-router-dom
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useParams: () => ({ caseId: "case-123" }),
    useNavigate: () => vi.fn(),
  };
});

// Mock API/data hooks
vi.mock("@/hooks/queries/useValueCase", () => ({
  useValueCase: () => ({
    data: {
      id: "case-123",
      name: "Acme Corporation",
      saga_state: "VALIDATING",
      confidence_score: 0.78,
    },
    warmth: deriveWarmth("VALIDATING", 0.78),
    availableModes: ["canvas", "narrative", "copilot", "evidence"],
    isLoading: false,
    error: null,
  }),
}));

// Mock mode store
vi.mock("@/stores/modeStore", () => ({
  useModeStore: Object.assign(
    () => ({
      activeMode: "canvas",
      inspectorOpen: false,
      density: "comfortable",
      setActiveMode: vi.fn(),
      setInspectorOpen: vi.fn(),
      setDensity: vi.fn(),
    }),
    {
      getState: () => ({
        activeMode: "canvas",
        inspectorOpen: false,
        density: "comfortable",
        setActiveMode: vi.fn(),
        setInspectorOpen: vi.fn(),
        setDensity: vi.fn(),
      }),
    },
  ),
}));

// Mock React Flow
vi.mock("@xyflow/react", () => ({
  ReactFlow: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="react-flow">{children}</div>
  ),
  Background: () => null,
  Controls: () => null,
  MiniMap: () => null,
  useNodesState: () => [[], vi.fn(), vi.fn()],
  useEdgesState: () => [[], vi.fn(), vi.fn()],
  Handle: () => null,
  Position: { Top: "top", Bottom: "bottom", Left: "left", Right: "right" },
}));

// Mock useChat
vi.mock("@/features/chat/hooks/useChat", () => ({
  useChat: () => ({
    messages: [],
    isStreaming: false,
    error: null,
    sendMessage: vi.fn(),
    clearMessages: vi.fn(),
  }),
}));

// @ts-expect-error — TDD: module will be created during Phase 2 implementation
import { WorkspacePage } from "./WorkspacePage";

describe("WorkspacePage", () => {
  it("renders WarmthHeader with case data", () => {
    render(<WorkspacePage />);

    expect(screen.getByText(/Acme Corporation/i)).toBeInTheDocument();
  });

  it("renders ModeSelector with available modes", () => {
    render(<WorkspacePage />);

    expect(screen.getByRole("tablist")).toBeInTheDocument();
    expect(screen.getAllByRole("tab")).toHaveLength(4);
  });

  it("renders CanvasView when mode is canvas", () => {
    render(<WorkspacePage />);

    expect(screen.getByTestId("react-flow")).toBeInTheDocument();
  });

  it("derives warmth from saga_state and confidence", () => {
    // The mock returns saga_state VALIDATING → firm
    render(<WorkspacePage />);

    expect(screen.getByText(/firm/i)).toBeInTheDocument();
  });

  it("renders warmth badge", () => {
    render(<WorkspacePage />);

    // VALIDATING maps to firm warmth
    expect(screen.getByText(/firm/i)).toBeInTheDocument();
  });

  it("renders loading skeleton while case data fetches", () => {
    // Override mock with loading state
    const { useValueCase } = require("@/hooks/queries/useValueCase") as {
      useValueCase: ReturnType<typeof vi.fn>;
    };
    vi.mocked(useValueCase).mockReturnValueOnce({
      data: null,
      warmth: null,
      availableModes: [],
      isLoading: true,
      error: null,
    });

    render(<WorkspacePage />);

    expect(screen.getByLabelText(/loading|skeleton/i)).toBeInTheDocument();
  });

  it("renders error state on data fetch failure", () => {
    const { useValueCase } = require("@/hooks/queries/useValueCase") as {
      useValueCase: ReturnType<typeof vi.fn>;
    };
    vi.mocked(useValueCase).mockReturnValueOnce({
      data: null,
      warmth: null,
      availableModes: [],
      isLoading: false,
      error: new Error("Failed to fetch"),
    });

    render(<WorkspacePage />);

    expect(screen.getByText(/something went wrong|error|failed/i)).toBeInTheDocument();
  });
});
