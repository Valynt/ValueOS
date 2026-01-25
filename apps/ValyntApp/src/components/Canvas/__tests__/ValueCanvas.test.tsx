import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { ValueCanvas } from "../ValueCanvas";
import { ValueDriver, MOCK_VALUE_DRIVERS } from "@/types/valueDriver";

// Mock react-dnd
vi.mock("react-dnd", () => ({
  useDrop: () => [{ isOver: false }, vi.fn()],
  useDrag: () => [{ isDragging: false }, vi.fn()],
}));
vi.mock("react-dnd-html5-backend", () => ({
  HTML5Backend: {},
}));
vi.mock("react-dnd", () => ({
  DndProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useDrop: vi.fn(() => [{ isOver: false }, vi.fn()]),
  useDrag: vi.fn(() => [{ isDragging: false }, vi.fn()]),
}));

// Mock services
vi.mock("@/services/CalculationEngine", () => ({
  calculationEngine: {
    calculateCascade: vi.fn(() => []),
  },
}));
vi.mock("@/services/PlaygroundSessionService", () => ({
  PlaygroundSessionService: vi.fn().mockImplementation(() => ({
    loadSession: vi.fn().mockResolvedValue({ data: { drivers: [], canvasComponents: [] } }),
    updateSession: vi.fn().mockResolvedValue(undefined),
    commitSession: vi.fn().mockResolvedValue(undefined),
  })),
}));
vi.mock("@/hooks/useOrganization", () => ({
  useOrganization: () => ({ organizationId: "test-org" }),
}));
vi.mock("@/components/valueDrivers/ValueDriverEditor", () => ({
  ValueDriverEditor: ({ onClose }: { onClose: () => void }) => <div>Editor Mock <button onClick={onClose}>Close</button></div>,
}));
vi.mock("./ValueDriverCard", () => ({
  ValueDriverCard: ({ component, onEdit, onDelete, onValueChange }: any) => (
    <div>
      Card for {component.props.driver.name}
      <button onClick={onEdit}>Edit</button>
      <button onClick={onDelete}>Delete</button>
      <input onChange={(e) => onValueChange(e.target.value)} />
    </div>
  ),
}));

describe("ValueCanvas", () => {
  const mockOnSave = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders empty canvas", () => {
    render(<ValueCanvas sessionId="test-session" onSave={mockOnSave} />);
    expect(
      screen.getByText("Drag value drivers here to start building your model")
    ).toBeInTheDocument();
  });

  it("renders save button", () => {
    render(<ValueCanvas sessionId="test-session" onSave={mockOnSave} />);
    expect(screen.getByText("Save to Backend")).toBeInTheDocument();
  });

  it("renders library drivers", () => {
    render(<ValueCanvas sessionId="test-session" onSave={mockOnSave} />);
    MOCK_VALUE_DRIVERS.forEach(driver => {
      expect(screen.getByText(driver.name)).toBeInTheDocument();
    });
  });

  it("calls onSave when save button is clicked", async () => {
    render(<ValueCanvas sessionId="test-session" onSave={mockOnSave} />);
    const saveButton = screen.getByText("Save to Backend");
    fireEvent.click(saveButton);
    await waitFor(() => expect(mockOnSave).toHaveBeenCalled());
  });

  // Add more tests for drag, edit, etc.
});
    render(<ValueCanvas sessionId="test-session" onSave={mockOnSave} />);
    const saveButton = screen.getByText("Save to Backend");
    fireEvent.click(saveButton);
    // Since it's async, we might need to wait, but for simplicity
    expect(mockOnSave).toHaveBeenCalled();
  });
});
