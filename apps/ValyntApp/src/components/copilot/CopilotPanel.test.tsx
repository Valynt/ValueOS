/**
 * TDD tests for CopilotPanel — Phase 2 Copilot Mode
 *
 * Tests the workspace-embedded copilot chat panel with warmth context.
 * Written before implementation.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

// Mock the chat hook
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
import { CopilotPanel } from "./CopilotPanel";

describe("CopilotPanel", () => {
  it("renders chat interface embedded in workspace", () => {
    render(
      <CopilotPanel
        caseId="case-1"
        warmth="forming"
        onNavigateToNode={vi.fn()}
        onSwitchMode={vi.fn()}
      />,
    );

    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(screen.getByLabelText(/send|message/i)).toBeInTheDocument();
  });

  it("shows warmth-contextual suggested prompts for forming state", () => {
    render(
      <CopilotPanel
        caseId="case-1"
        warmth="forming"
        onNavigateToNode={vi.fn()}
        onSwitchMode={vi.fn()}
      />,
    );

    // Forming prompts should relate to data gathering and initial case building
    expect(screen.getByText(/data|evidence|build|discover/i)).toBeInTheDocument();
  });

  it("shows warmth-contextual suggested prompts for firm state", () => {
    render(
      <CopilotPanel
        caseId="case-1"
        warmth="firm"
        onNavigateToNode={vi.fn()}
        onSwitchMode={vi.fn()}
      />,
    );

    // Firm prompts should relate to validation and review
    expect(screen.getByText(/review|validate|assumption|strengthen/i)).toBeInTheDocument();
  });

  it("shows warmth-contextual suggested prompts for verified state", () => {
    render(
      <CopilotPanel
        caseId="case-1"
        warmth="verified"
        onNavigateToNode={vi.fn()}
        onSwitchMode={vi.fn()}
      />,
    );

    // Verified prompts should relate to sharing and presenting
    expect(screen.getByText(/share|export|present|executive/i)).toBeInTheDocument();
  });

  it("renders quick actions bar below chat", () => {
    render(
      <CopilotPanel
        caseId="case-1"
        warmth="forming"
        onNavigateToNode={vi.fn()}
        onSwitchMode={vi.fn()}
      />,
    );

    // Quick actions should be present (e.g., Request CRM data, Import report)
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThanOrEqual(2);
  });

  it("renders error message on send failure", async () => {
    // Re-mock useChat with error
    const { useChat } = await import("@/features/chat/hooks/useChat");
    vi.mocked(useChat).mockReturnValue({
      messages: [],
      isStreaming: false,
      error: "Network error",
      sendMessage: vi.fn(),
      clearMessages: vi.fn(),
    });

    render(
      <CopilotPanel
        caseId="case-1"
        warmth="forming"
        onNavigateToNode={vi.fn()}
        onSwitchMode={vi.fn()}
      />,
    );

    expect(screen.getByText(/network error/i)).toBeInTheDocument();
  });

  it("renders streaming indicator during response", async () => {
    const { useChat } = await import("@/features/chat/hooks/useChat");
    vi.mocked(useChat).mockReturnValue({
      messages: [{ id: "1", role: "user", content: "Hello", timestamp: "2026-04-07T10:00:00Z" }],
      isStreaming: true,
      error: null,
      sendMessage: vi.fn(),
      clearMessages: vi.fn(),
    });

    render(
      <CopilotPanel
        caseId="case-1"
        warmth="forming"
        onNavigateToNode={vi.fn()}
        onSwitchMode={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(/loading|thinking|streaming/i)).toBeInTheDocument();
  });
});
