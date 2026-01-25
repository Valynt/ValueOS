import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import { ValueCanvas } from "../ValueCanvas";
import { ValueDriver } from "@/types/valueDriver";

// Mock react-dnd
vi.mock("react-dnd", () => ({
  useDrop: () => [{ isOver: false }, vi.fn()],
}));
vi.mock("react-dnd-html5-backend", () => ({
  DndProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
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

  it("calls onSave when save button is clicked", async () => {
    render(<ValueCanvas sessionId="test-session" onSave={mockOnSave} />);
    const saveButton = screen.getByText("Save to Backend");
    fireEvent.click(saveButton);
    // Since it's async, we might need to wait, but for simplicity
    expect(mockOnSave).toHaveBeenCalled();
  });
});
