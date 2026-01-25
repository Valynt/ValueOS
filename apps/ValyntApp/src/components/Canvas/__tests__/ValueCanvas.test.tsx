import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { ValueCanvas } from "../ValueCanvas";

// Mock React Flow
vi.mock("@xyflow/react", () => ({
  ReactFlow: ({ children }: any) => <div data-testid="react-flow">{children}</div>,
  Background: () => <div data-testid="background" />,
  Controls: () => <div data-testid="controls" />,
  MiniMap: () => <div data-testid="minimap" />,
  useNodesState: () => [[], vi.fn(), vi.fn()],
  useEdgesState: () => [[], vi.fn(), vi.fn()],
  addEdge: vi.fn(),
  ReactFlowProvider: ({ children }: any) => <div>{children}</div>,
  Panel: ({ children }: any) => <div>{children}</div>,
}));

// Mock services and hooks
vi.mock("@/services/CalculationEngine", () => ({
  calculationEngine: {
    registerNode: vi.fn(),
    updateFormula: vi.fn(),
    serialize: vi.fn(),
  },
}));

vi.mock("@/services/PlaygroundSessionService", () => ({
  PlaygroundSessionService: vi.fn().mockImplementation(() => ({
    loadSession: vi.fn().mockResolvedValue({ data: {} }),
    updateSession: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock("@/hooks/useOrganization", () => ({
  useOrganization: () => ({ organizationId: "test-org" }),
}));

vi.mock("@/stores/valueCanvasStore", () => {
  const defaultStore = {
    nodes: [],
    edges: [],
    driverValues: {},
    driverDefinitions: {},
    isLibraryOpen: false,
    isEditorOpen: false,
    loadCanvas: vi.fn(),
    setIsSaving: vi.fn(),
    setLastSaved: vi.fn(),
    setError: vi.fn(),
    onConnect: vi.fn(),
  };
  return {
    __esModule: true,
    default: () => defaultStore,
    useTemporalStore: () => ({
      undo: vi.fn(),
      redo: vi.fn(),
      pastStates: [],
      futureStates: [],
    }),
  };
});

describe("ValueCanvas", () => {
  it("renders without crashing", () => {
    render(<ValueCanvas sessionId="test-session" />);
    expect(screen.getByText("Value Driver Canvas")).toBeInTheDocument();
  });
});
