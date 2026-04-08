/**
 * TDD tests for OperationalStatePanel — Phase 2 Canvas Mode
 *
 * Tests the deep state disclosure panel showing saga_state,
 * agent status, blocking reasons, and confidence.
 * Written before implementation.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

// @ts-expect-error — TDD: module will be created during Phase 2 implementation
import { OperationalStatePanel } from "./OperationalStatePanel";

function buildOperationalState(overrides: Record<string, unknown> = {}) {
  return {
    sagaState: "VALIDATING",
    confidenceScore: 0.78,
    blockingReasons: ["1 assumption needs evidence"],
    lastAgentAction: "FinancialModelingAgent completed analysis",
    agentStatus: "idle" as const,
    ...overrides,
  };
}

describe("OperationalStatePanel", () => {
  it("renders saga_state label", () => {
    render(<OperationalStatePanel state={buildOperationalState()} />);

    expect(screen.getByText(/VALIDATING/)).toBeInTheDocument();
  });

  it("renders last agent action", () => {
    render(<OperationalStatePanel state={buildOperationalState()} />);

    expect(screen.getByText(/FinancialModelingAgent/)).toBeInTheDocument();
  });

  it("renders blocking reasons list", () => {
    render(
      <OperationalStatePanel
        state={buildOperationalState({
          blockingReasons: ["Missing Q3 data", "Weak assumption on training cost"],
        })}
      />,
    );

    expect(screen.getByText(/Missing Q3 data/)).toBeInTheDocument();
    expect(screen.getByText(/Weak assumption/)).toBeInTheDocument();
  });

  it("renders agent status: idle", () => {
    render(<OperationalStatePanel state={buildOperationalState({ agentStatus: "idle" })} />);

    expect(screen.getByText(/idle/i)).toBeInTheDocument();
  });

  it("renders agent status: working", () => {
    render(<OperationalStatePanel state={buildOperationalState({ agentStatus: "working" })} />);

    expect(screen.getByText(/working/i)).toBeInTheDocument();
  });

  it("renders agent status: needs_input", () => {
    render(<OperationalStatePanel state={buildOperationalState({ agentStatus: "needs_input" })} />);

    expect(screen.getByText(/needs.input/i)).toBeInTheDocument();
  });

  it("renders confidence score with precision", () => {
    render(<OperationalStatePanel state={buildOperationalState({ confidenceScore: 0.783 })} />);

    expect(screen.getByText(/78\.3%|0\.783/)).toBeInTheDocument();
  });

  it("shows empty blocking reasons message when none", () => {
    render(<OperationalStatePanel state={buildOperationalState({ blockingReasons: [] })} />);

    expect(screen.getByText(/no blocking/i)).toBeInTheDocument();
  });
});
