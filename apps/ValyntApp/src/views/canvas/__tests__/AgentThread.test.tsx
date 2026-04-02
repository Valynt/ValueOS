/**
 * AgentThread — unit tests
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import type { AgentJobResult } from "@/hooks/useAgentJob";
import { useCheckpointReview } from "@/hooks/useCheckpointReview";
import { AgentThread } from "../AgentThread";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mutateSpy = vi.fn();

vi.mock("react-router-dom", () => ({
  useParams: () => ({ caseId: "550e8400-e29b-41d4-a716-446655440000" }),
}));

vi.mock("@/contexts/TenantContext", () => ({
  useTenant: () => ({ currentTenant: { id: "tenant-test" } }),
}));

vi.mock("@/hooks/useCheckpointReview", () => ({
  useCheckpointReview: vi.fn(() => ({
    data: {
      checkpointId: "cp-1",
      caseId: "550e8400-e29b-41d4-a716-446655440000",
      runId: "job-1",
      stageId: "hypothesis",
      status: "pending",
      rationale: null,
      actorId: null,
      decidedAt: null,
      riskLevel: "medium",
    },
  })),
  useCheckpointReviewDecision: vi.fn(() => ({
    mutate: mutateSpy,
    isPending: false,
  })),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeResult(overrides: Partial<AgentJobResult> = {}): AgentJobResult {
  return { jobId: "job-1", status: "processing", ...overrides };
}

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
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

    render(<AgentThread runId="job-1" directResult={direct} />, {
      wrapper,
    });

    expect(screen.getByText(/review required/i)).toBeInTheDocument();
    expect(screen.getByText(/pending review/i)).toBeInTheDocument();
  });

  it("requires rationale for request changes", async () => {
    const direct = makeResult({ status: "completed", mode: "direct" });

    render(<AgentThread runId="job-1" directResult={direct} />, {
      wrapper,
    });

    fireEvent.click(
      screen.getByRole("button", { name: /request changes/i })
    );

    expect(
      screen.getByText(/rationale is required when requesting changes/i)
    ).toBeInTheDocument();

    expect(mutateSpy).not.toHaveBeenCalled();

    fireEvent.change(screen.getByPlaceholderText(/add rationale/i), {
      target: { value: "Need stronger support for cost assumptions" },
    });

    fireEvent.click(
      screen.getByRole("button", { name: /request changes/i })
    );

    await waitFor(() => {
      expect(mutateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          decision: "changes_requested",
          rationale: "Need stronger support for cost assumptions",
        })
      );
    });
  });

  it("requires rationale for approve when stage is high-risk", () => {
    const direct = makeResult({ status: "completed", mode: "direct" });

    render(
      <AgentThread
        runId="job-1"
        directResult={direct}
        riskLevel="high"
      />,
      { wrapper }
    );

    fireEvent.click(screen.getByRole("button", { name: /approve/i }));

    expect(
      screen.getByText(
        /rationale is required for approvals in high-risk stages/i
      )
    ).toBeInTheDocument();
  });

  it("renders degraded-state CTAs and last known good artifact", () => {
    const direct = makeResult({
      status: "error",
      error: "Timeout",
      lastKnownGoodOutput: { artifactId: "artifact-22" },
      lastKnownGoodAt: "2026-03-27T08:15:00.000Z",
    });

    render(<AgentThread runId="job-1" directResult={direct} />, {
      wrapper,
    });

    expect(
      screen.getByRole("button", { name: /retry run/i })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: /resume polling/i })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: /view last successful artifact/i,
      })
    ).toBeInTheDocument();

    expect(
      screen.getByText(/last known good output/i)
    ).toBeInTheDocument();

    expect(screen.getByText(/artifact-22/i)).toBeInTheDocument();
  });

  it("surfaces retry attempt + backoff timing in degraded status card", () => {
    const direct = makeResult({
      status: "failed",
      attemptsMade: 3,
      nextRetryAt: "2099-01-01T00:00:00.000Z",
    });

    render(<AgentThread runId="job-1" directResult={direct} />, {
      wrapper,
    });

    expect(screen.getByText(/attempt 3/i)).toBeInTheDocument();
    expect(screen.getAllByText(/next automatic attempt/i).length).toBeGreaterThan(0);
  });

  it("shows run ID in footer", () => {
    const direct = makeResult({ status: "processing" });

    render(
      <AgentThread runId="my-run-id" directResult={direct} />,
      { wrapper }
    );

    expect(screen.getByText(/my-run-id/)).toBeInTheDocument();
  });

  it("disables contradictory actions when persisted status is approved across remount", () => {
    vi.mocked(useCheckpointReview).mockReturnValue({
      data: {
        checkpointId: "cp-1",
        caseId: "550e8400-e29b-41d4-a716-446655440000",
        runId: "job-1",
        stageId: "hypothesis",
        status: "approved",
        rationale: "Approved on prior session",
        actorId: "user-1",
        decidedAt: "2026-03-28T12:00:00.000Z",
        riskLevel: "medium",
      },
      isLoading: false,
      isError: false,
      isSuccess: true,
      isPending: false,
      isFetching: false,
      isRefetching: false,
      isPlaceholderData: false,
      isRefetchError: false,
      isPaused: false,
      fetchStatus: "idle" as const,
      status: "success" as const,
      error: null,
      refetch: vi.fn(),
    } as any);

    const direct = makeResult({ status: "completed", mode: "direct" });

    const { unmount } = render(
      <AgentThread runId="job-1" directResult={direct} />,
      { wrapper }
    );

    unmount();

    render(
      <AgentThread runId="job-1" directResult={direct} />,
      { wrapper }
    );

    expect(
      screen.getByRole("button", { name: /request changes/i })
    ).toBeDisabled();

    expect(screen.getByText(/approved/i)).toBeInTheDocument();
  });
});
