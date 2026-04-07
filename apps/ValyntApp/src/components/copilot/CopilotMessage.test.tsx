/**
 * TDD tests for CopilotMessage — Phase 2 Copilot Mode
 *
 * Tests the enhanced message bubble with inline action buttons.
 * Written before implementation.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

// @ts-expect-error — TDD: module will be created during Phase 2 implementation
import { CopilotMessage } from "./CopilotMessage";

function buildMessage(overrides: Record<string, unknown> = {}) {
  return {
    id: "msg-1",
    role: "assistant" as const,
    content: "I found $2.4M potential from Automated Reconciliation.",
    timestamp: "2026-04-07T10:00:00Z",
    metadata: { model: "mistralai/Mixtral-8x7B-Instruct-v0.1" },
    ...overrides,
  };
}

function buildActions() {
  return [
    { label: "Show on Canvas", icon: "map", action: "navigate_to_node", params: { nodeId: "node-1" } },
    { label: "Add to Narrative", icon: "file-text", action: "add_to_narrative" },
  ];
}

describe("CopilotMessage", () => {
  it("renders user message with dark bubble", () => {
    const { container } = render(
      <CopilotMessage message={buildMessage({ role: "user", content: "Hello" })} warmth="forming" />,
    );

    const bubble = container.querySelector("[class*='bg-zinc-950'], [class*='bg-slate-900']");
    expect(bubble).toBeTruthy();
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it("renders assistant message with light bubble", () => {
    const { container } = render(
      <CopilotMessage message={buildMessage()} warmth="firm" />,
    );

    const bubble = container.querySelector("[class*='bg-white'], [class*='border']");
    expect(bubble).toBeTruthy();
    expect(screen.getByText(/\$2\.4M potential/)).toBeInTheDocument();
  });

  it("renders inline action buttons when actions provided", () => {
    render(
      <CopilotMessage message={buildMessage()} actions={buildActions()} warmth="firm" />,
    );

    expect(screen.getByText("Show on Canvas")).toBeInTheDocument();
    expect(screen.getByText("Add to Narrative")).toBeInTheDocument();
  });

  it("calls onAction when action button clicked", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();

    render(
      <CopilotMessage
        message={buildMessage()}
        actions={buildActions()}
        onAction={onAction}
        warmth="firm"
      />,
    );

    await user.click(screen.getByText("Show on Canvas"));
    expect(onAction).toHaveBeenCalledWith("navigate_to_node", { nodeId: "node-1" });
  });

  it("shows model name in assistant messages", () => {
    render(<CopilotMessage message={buildMessage()} warmth="firm" />);

    expect(screen.getByText(/Mixtral/i)).toBeInTheDocument();
  });

  it("does not render action buttons when none provided", () => {
    render(<CopilotMessage message={buildMessage()} warmth="firm" />);

    expect(screen.queryByText("Show on Canvas")).not.toBeInTheDocument();
  });
});
