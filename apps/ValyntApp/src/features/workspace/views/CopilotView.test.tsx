/**
 * TDD tests for CopilotView — Phase 2 Copilot Mode
 *
 * Tests the copilot mode view layout with panel + canvas preview.
 * Written before implementation.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Mock useChat to prevent network calls
vi.mock("@/features/chat/hooks/useChat", () => ({
  useChat: () => ({
    messages: [],
    isStreaming: false,
    error: null,
    sendMessage: vi.fn(),
    clearMessages: vi.fn(),
  }),
}));

// Mock React Flow
vi.mock("@xyflow/react", () => ({
  ReactFlow: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="react-flow-preview">{children}</div>
  ),
  Background: () => null,
  Controls: () => null,
  MiniMap: () => null,
  useNodesState: () => [[], vi.fn(), vi.fn()],
  useEdgesState: () => [[], vi.fn(), vi.fn()],
  Handle: () => null,
  Position: { Top: "top", Bottom: "bottom", Left: "left", Right: "right" },
}));

// @ts-expect-error — TDD: module will be created during Phase 2 implementation
import { CopilotView } from "./CopilotView";

describe("CopilotView", () => {
  it("renders CopilotPanel on left", () => {
    render(
      <CopilotView
        caseId="case-1"
        warmth="forming"
        onNavigateToNode={vi.fn()}
        onSwitchMode={vi.fn()}
      />,
    );

    // CopilotPanel should have a text input
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("renders mini canvas preview on right", () => {
    render(
      <CopilotView
        caseId="case-1"
        warmth="forming"
        onNavigateToNode={vi.fn()}
        onSwitchMode={vi.fn()}
      />,
    );

    expect(screen.getByTestId("react-flow-preview")).toBeInTheDocument();
  });

  it("renders quick actions bar at bottom", () => {
    render(
      <CopilotView
        caseId="case-1"
        warmth="forming"
        onNavigateToNode={vi.fn()}
        onSwitchMode={vi.fn()}
      />,
    );

    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThanOrEqual(2);
  });
});
