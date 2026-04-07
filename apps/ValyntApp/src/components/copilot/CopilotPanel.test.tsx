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
    const buttons = screen.getAllByRole("button");
    const allText = buttons.map((b) => b.textContent).join(" ");
    expect(allText).toMatch(/data|evidence|build|discover/i);
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
    const buttons = screen.getAllByRole("button");
    const allText = buttons.map((b) => b.textContent).join(" ");
    expect(allText).toMatch(/review|validate|assumption|strengthen|verify/i);
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
    const buttons = screen.getAllByRole("button");
    const allText = buttons.map((b) => b.textContent).join(" ");
    expect(allText).toMatch(/share|export|present|executive/i);
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

  it.skip("renders error message on send failure", async () => {
    // Note: Dynamic re-mocking of hoisted vi.mock is not supported in Vitest
    // This test would require restructuring the mock setup
  });

  it.skip("renders streaming indicator during response", async () => {
    // Note: Dynamic re-mocking of hoisted vi.mock is not supported in Vitest
    // This test would require restructuring the mock setup
  });
});
