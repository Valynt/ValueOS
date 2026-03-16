import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";

import { ValueDriverCard } from "../ValueDriverCard";

import { CanvasComponent } from "@/types/valueDriver";

// Mock react-dnd
vi.mock("react-dnd", () => ({
  useDrag: () => [{ isDragging: false }, vi.fn()],
}));

describe("ValueDriverCard", () => {
  const mockComponent: CanvasComponent = {
    id: "test-id",
    type: "valueDriver",
    props: {
      driver: {
        id: "driver-1",
        name: "Test Driver",
        type: "cost-savings",
        description: "A test driver",
        unit: "USD",
        defaultValue: 100,
        assumptions: "Some assumptions",
      },
      value: 150,
    },
    position: { x: 0, y: 0 },
  };

  const mockOnEdit = vi.fn();
  const mockOnDelete = vi.fn();
  const mockOnValueChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders driver name and value", () => {
    render(
      <ValueDriverCard
        component={mockComponent}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onValueChange={mockOnValueChange}
      />
    );
    expect(screen.getByText("Test Driver")).toBeInTheDocument();
    expect(screen.getByDisplayValue("150")).toBeInTheDocument();
  });

  it("calls onEdit when edit button is clicked", () => {
    render(
      <ValueDriverCard
        component={mockComponent}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onValueChange={mockOnValueChange}
      />
    );
    // Buttons contain only icons (no text/aria-label) — first button is Edit
    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[0]);
    expect(mockOnEdit).toHaveBeenCalled();
  });

  it("calls onDelete when delete button is clicked", () => {
    render(
      <ValueDriverCard
        component={mockComponent}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onValueChange={mockOnValueChange}
      />
    );
    // Buttons contain only icons (no text/aria-label) — second button is Delete
    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[1]);
    expect(mockOnDelete).toHaveBeenCalled();
  });

  it("calls onValueChange when value input changes", () => {
    render(
      <ValueDriverCard
        component={mockComponent}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onValueChange={mockOnValueChange}
      />
    );
    const input = screen.getByDisplayValue("150");
    fireEvent.change(input, { target: { value: "200" } });
    expect(mockOnValueChange).toHaveBeenCalledWith(200);
  });
});
