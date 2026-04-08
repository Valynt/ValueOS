/**
 * TDD tests for SDUI Renderer warmth extensions — Phase 2
 *
 * Tests that the SDUI renderer handles new warmth and mode component types.
 * Written before implementation.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { SDUIComponent } from "./types";

import { SDUIRenderer } from "./renderer";

describe("SDUIRenderer warmth extensions", () => {
  it("renders warmth_card type with warmth styling", () => {
    const component: SDUIComponent = {
      id: "wc-1",
      type: "warmth_card" as SDUIComponent["type"],
      props: { warmth: "forming", title: "Case Status" },
    };

    render(<SDUIRenderer component={component} />);

    expect(screen.getByText("Case Status")).toBeInTheDocument();
  });

  it("renders warmth_badge type with correct state", () => {
    const component: SDUIComponent = {
      id: "wb-1",
      type: "warmth_badge" as SDUIComponent["type"],
      props: { warmth: "firm" },
    };

    render(<SDUIRenderer component={component} />);

    expect(screen.getByText(/firm/i)).toBeInTheDocument();
  });

  it("renders mode_selector type", () => {
    const component: SDUIComponent = {
      id: "ms-1",
      type: "mode_selector" as SDUIComponent["type"],
      props: {
        activeMode: "canvas",
        availableModes: ["canvas", "narrative", "copilot", "evidence"],
        warmthState: "firm",
      },
    };

    render(<SDUIRenderer component={component} onAction={vi.fn()} />);

    expect(screen.getByText(/canvas/i)).toBeInTheDocument();
  });

  it("renders narrative_stream type", () => {
    const component: SDUIComponent = {
      id: "ns-1",
      type: "narrative_stream" as SDUIComponent["type"],
      props: { caseId: "case-1", warmth: "firm" },
    };

    render(<SDUIRenderer component={component} />);

    // Should render without error (empty narrative state)
    expect(screen.getByText(/no narrative|narrative/i)).toBeInTheDocument();
  });

  it("renders inspector_panel type", () => {
    const component: SDUIComponent = {
      id: "ip-1",
      type: "inspector_panel" as SDUIComponent["type"],
      props: { warmth: "firm" },
    };

    render(<SDUIRenderer component={component} />);

    // Should render empty inspector state
    expect(screen.getByText(/select a node/i)).toBeInTheDocument();
  });

  it("renders copilot_panel type", () => {
    // Mock useChat for copilot rendering
    vi.mock("@/features/chat/hooks/useChat", () => ({
      useChat: () => ({
        messages: [],
        isStreaming: false,
        error: null,
        sendMessage: vi.fn(),
        clearMessages: vi.fn(),
      }),
    }));

    const component: SDUIComponent = {
      id: "cp-1",
      type: "copilot_panel" as SDUIComponent["type"],
      props: { caseId: "case-1", warmth: "forming" },
    };

    render(<SDUIRenderer component={component} />);

    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("falls back to unknown component for unrecognized types", () => {
    const component: SDUIComponent = {
      id: "unk-1",
      type: "nonexistent_widget" as SDUIComponent["type"],
      props: {},
    };

    render(<SDUIRenderer component={component} />);

    expect(screen.getByText(/unknown component/i)).toBeInTheDocument();
  });
});
