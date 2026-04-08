/**
 * TDD tests for CopilotSuggestions — Phase 2 Copilot Mode
 *
 * Tests warmth-contextual suggestion buttons.
 * Written before implementation.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { WarmthState } from "@shared/domain/Warmth";

// @ts-expect-error — TDD: module will be created during Phase 2 implementation
import { CopilotSuggestions } from "./CopilotSuggestions";

describe("CopilotSuggestions", () => {
  it("renders forming-specific suggestions", () => {
    render(<CopilotSuggestions warmth={"forming" as WarmthState} onSelect={vi.fn()} />);

    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThanOrEqual(2);
    // Forming suggestions should be about discovery/data gathering
    const allText = buttons.map((b) => b.textContent).join(" ");
    expect(allText).toMatch(/data|evidence|discover|build|map/i);
  });

  it("renders firm-specific suggestions", () => {
    render(<CopilotSuggestions warmth={"firm" as WarmthState} onSelect={vi.fn()} />);

    const buttons = screen.getAllByRole("button");
    const allText = buttons.map((b) => b.textContent).join(" ");
    expect(allText).toMatch(/review|validate|assumption|strengthen|verify/i);
  });

  it("renders verified-specific suggestions", () => {
    render(<CopilotSuggestions warmth={"verified" as WarmthState} onSelect={vi.fn()} />);

    const buttons = screen.getAllByRole("button");
    const allText = buttons.map((b) => b.textContent).join(" ");
    expect(allText).toMatch(/share|export|present|executive|summary/i);
  });

  it("calls onSelect when a suggestion is clicked", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(<CopilotSuggestions warmth={"forming" as WarmthState} onSelect={onSelect} />);

    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(0);
    await user.click(buttons[0] as HTMLElement);

    expect(onSelect).toHaveBeenCalledTimes(1);
    const firstCall = onSelect.mock.calls[0] as [string];
    expect(typeof firstCall[0]).toBe("string");
  });
});
