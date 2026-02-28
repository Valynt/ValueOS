import { render, screen } from "@testing-library/react";
import { vi } from "vitest";

import { ValueCanvas } from "../ValueCanvas";

// Mock React Flow
vi.mock("@xyflow/react", () => ({
  ReactFlow: ({ children }: any) => <div data-testid="react-flow">{children}</div>,
  Background: () => <div>Background</div>,
  Controls: () => <div>Controls</div>,
  MiniMap: () => <div>MiniMap</div>,
  Panel: ({ children }: any) => <div>{children}</div>,
  ReactFlowProvider: ({ children }: any) => <div>{children}</div>,
  useNodesState: () => [[], vi.fn(), vi.fn()],
  useEdgesState: () => [[], vi.fn(), vi.fn()],
  addEdge: vi.fn(),
}));

// Mock store
vi.mock("@/stores/valueCanvasStore", () => ({
  default: () => ({
    nodes: [],
    edges: [],
    driverValues: {},
    driverDefinitions: {},
    pastStates: [],
    futureStates: [],
    addDriverNode: vi.fn(),
    updateDriverFormula: vi.fn(),
    loadCanvas: vi.fn(),
    onConnect: vi.fn(),
    setSelectedNodeId: vi.fn(),
  }),
  useTemporalStore: () => ({
    undo: vi.fn(),
    redo: vi.fn(),
    pastStates: [],
    futureStates: [],
  }),
}));

// Mock other components/services
vi.mock("@/services/PlaygroundSessionService", () => ({
  PlaygroundSessionService: class {
    loadSession = vi.fn().mockResolvedValue({ data: {} });
    updateSession = vi.fn().mockResolvedValue({});
  },
}));

vi.mock("@/hooks/useOrganization", () => ({
  useOrganization: () => ({ organizationId: "test-org" }),
}));

vi.mock("@/services/CalculationEngine", () => ({
  calculationEngine: {
    registerNode: vi.fn(),
    serialize: vi.fn(),
  },
}));

// Mock sub-components
vi.mock("./ValueCanvasNodes", () => ({
  nodeTypes: {},
}));

vi.mock("./ValueDriverLibrary", () => ({
  ValueDriverLibrary: () => <div>Library</div>,
}));

vi.mock("./ValueDriverEditor", () => ({
  ValueDriverEditor: () => <div>Editor</div>,
}));

describe("ValueCanvas", () => {
  it("renders without crashing", () => {
    render(<ValueCanvas sessionId="test-session" />);
    expect(screen.getByText("Value Driver Canvas")).toBeInTheDocument();
  });
});
