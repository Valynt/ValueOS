/**
 * AgentThread — unit tests
 *
 * Verifies retrying state rendering, heartbeat sub-task display,
 * and tenant-scoped job polling.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { AgentThread } from "../AgentThread";

import type { AgentJobResult } from "@/hooks/useAgentJob";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/contexts/TenantContext", () => ({
  useTenant: () => ({ currentTenant: { id: "tenant-test" } }),
}));

vi.mock("@/api/client/unified-api-client", () => ({
  apiClient: {
    get: vi.fn().mockResolvedValue({ success: true, data: { data: null } }),
    post: vi.fn().mockResolvedValue({ success: true, data: { data: null } }),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeResult(overrides: Partial<AgentJobResult> = {}): AgentJobResult {
  return { jobId: "job-1", status: "processing", ...overrides };
}

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AgentThread", () => {
  it("renders idle state when no runId provided", () => {
    render(<AgentThread />, { wrapper });
    expect(screen.getByText(/click "run stage"/i)).toBeInTheDocument();
  });

  it("renders completed state with review required panel", () => {
    const direct = makeResult({ status: "completed", mode: "direct" });
    render(<AgentThread runId="job-1" directResult={direct} />, { wrapper });
    expect(screen.getByText(/review required/i)).toBeInTheDocument();
    expect(screen.getByText(/approve/i)).toBeInTheDocument();
  });

  it("renders retrying state with attempt count", () => {
    const direct = makeResult({
      status: "retrying",
      attemptsMade: 2,
      nextRetryAt: new Date(Date.now() + 30000).toISOString(),
    });
    render(<AgentThread runId="job-1" directResult={direct} />, { wrapper });
    // Multiple elements may contain "retrying" — check at least one is present
    expect(screen.getAllByText(/retrying/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/attempt 2/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/next attempt at/i).length).toBeGreaterThan(0);
  });

  it("renders error state with error message", () => {
    const direct = makeResult({ status: "error", error: "LLM timeout" });
    render(<AgentThread runId="job-1" directResult={direct} />, { wrapper });
    expect(screen.getByText(/LLM timeout/i)).toBeInTheDocument();
  });

  it("renders unavailable state with infrastructure message", () => {
    const direct = makeResult({ status: "unavailable" });
    render(<AgentThread runId="job-1" directResult={direct} />, { wrapper });
    expect(screen.getAllByText(/infrastructure/i).length).toBeGreaterThan(0);
  });

  it("renders currentSubTask from heartbeat in place of generic running label", () => {
    const direct = makeResult({ status: "processing", agentId: "opportunity" });
    render(
      <AgentThread
        runId="job-1"
        directResult={direct}
        currentSubTask="Analyzing SEC filings…"
      />,
      { wrapper },
    );
    expect(screen.getByText("Analyzing SEC filings…")).toBeInTheDocument();
  });



  it("renders degraded-state CTAs and last known good artifact", () => {
    const direct = makeResult({
      status: "error",
      error: "Timeout",
      lastKnownGoodOutput: { artifactId: "artifact-22" },
      lastKnownGoodAt: "2026-03-27T08:15:00.000Z",
    });

    render(<AgentThread runId="job-1" directResult={direct} />, { wrapper });

    expect(screen.getByRole("button", { name: /retry run/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /resume polling/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /view last successful artifact/i })).toBeInTheDocument();
    expect(screen.getByText(/last known good output/i)).toBeInTheDocument();
    expect(screen.getByText(/artifact-22/i)).toBeInTheDocument();
  });

  it("shows run ID in footer", () => {
    const direct = makeResult({ status: "processing" });
    render(<AgentThread runId="my-run-id" directResult={direct} />, { wrapper });
    expect(screen.getByText(/my-run-id/)).toBeInTheDocument();
  });
});
