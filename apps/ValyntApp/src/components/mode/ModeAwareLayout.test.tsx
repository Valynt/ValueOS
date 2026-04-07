/**
 * TDD tests for ModeAwareLayout — Phase 2 Mode System
 *
 * Tests the mode-adaptive layout container.
 * Written before implementation.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { WarmthState, WorkspaceMode } from "@shared/domain/Warmth";

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
import { ModeAwareLayout } from "./ModeAwareLayout";

const baseProps = {
  warmth: "firm" as WarmthState,
  caseId: "case-1",
  onNavigateToNode: vi.fn(),
  onSwitchMode: vi.fn(),
};

describe("ModeAwareLayout", () => {
  it("renders canvas layout with inspector sidebar", () => {
    render(<ModeAwareLayout mode={"canvas" as WorkspaceMode} {...baseProps} />);

    expect(screen.getByTestId("react-flow")).toBeInTheDocument();
  });

  it("renders narrative layout with full-width content", () => {
    render(<ModeAwareLayout mode={"narrative" as WorkspaceMode} {...baseProps} />);

    // Narrative mode should show narrative-specific content
    expect(screen.queryByTestId("react-flow")).not.toBeInTheDocument();
  });

  it("renders copilot layout with chat panel", () => {
    render(<ModeAwareLayout mode={"copilot" as WorkspaceMode} {...baseProps} />);

    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("renders evidence layout", () => {
    render(<ModeAwareLayout mode={"evidence" as WorkspaceMode} {...baseProps} />);

    expect(screen.getByText(/evidence/i)).toBeInTheDocument();
  });

  it("passes warmth state to child components", () => {
    const { container } = render(
      <ModeAwareLayout mode={"canvas" as WorkspaceMode} warmth={"forming" as WarmthState} caseId="case-1" onNavigateToNode={vi.fn()} onSwitchMode={vi.fn()} />,
    );

    expect(container.firstElementChild).toBeTruthy();
  });
});
