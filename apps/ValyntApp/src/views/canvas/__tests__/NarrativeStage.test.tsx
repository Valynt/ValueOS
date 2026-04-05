import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NarrativeStage } from "../NarrativeStage";

const pdfMutate = vi.fn();
const pptxMutate = vi.fn();
const publishCheckpointEvent = vi.fn();

let checkpointEventHandler: ((event: {
  payload: {
    userId: string;
    emittedAt: string;
    actionData: Record<string, unknown>;
  };
}) => void) | null = null;

vi.mock("@/hooks/useNarrative", () => ({
  useNarrativeDraft: vi.fn(() => ({
    data: {
      id: "draft-1",
      content: "Narrative content",
      format: "executive_summary",
      defense_readiness_score: 0.92,
    },
    isLoading: false,
    error: null,
  })),
  useRunNarrativeAgent: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
    error: null,
  })),
}));

vi.mock("@/hooks/useCaseExport", () => ({
  usePdfExport: vi.fn(() => ({ mutate: pdfMutate, isPending: false })),
  usePptxExport: vi.fn(() => ({ mutate: pptxMutate, isPending: false })),
}));

vi.mock("@/hooks/useValueGraph", () => ({
  useValueGraph: vi.fn(() => ({ data: { paths: [] } })),
}));

vi.mock("@valueos/sdui", () => ({
  ValuePathCard: () => null,
  useHumanCheckpointDependencies: () => ({
    auth: { userId: "approver-1" },
    broker: {
      publishCheckpointEvent,
      subscribe: (handler: (event: {
        payload: {
          userId: string;
          emittedAt: string;
          actionData: Record<string, unknown>;
        };
      }) => void) => {
        checkpointEventHandler = handler;
        return () => {
          checkpointEventHandler = null;
        };
      },
    },
  }),
}));

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe("NarrativeStage export approval gate", () => {
  beforeEach(() => {
    window.localStorage.clear();
    checkpointEventHandler = null;
    pdfMutate.mockReset();
    pptxMutate.mockReset();
    publishCheckpointEvent.mockReset();
  });

  it("keeps export actions disabled until approval event is received", async () => {
    render(<NarrativeStage caseId="case-1" opportunityId="opp-1" />, { wrapper });

    const pdfButton = screen.getByRole("button", { name: /pdf report/i });
    const deckButton = screen.getByRole("button", { name: /slide deck/i });

    expect(screen.getByText(/awaiting approval/i)).toBeInTheDocument();
    expect(pdfButton).toBeDisabled();
    expect(deckButton).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /request approval/i }));

    await waitFor(() => {
      expect(publishCheckpointEvent).toHaveBeenCalledTimes(1);
    });

    act(() => {
      checkpointEventHandler?.({
        payload: {
          userId: "reviewer-42",
          emittedAt: "2026-04-05T12:34:00.000Z",
          actionData: {
            caseId: "case-1",
            outputId: "draft-1",
            approvalStatus: "approved",
            approvedBy: "reviewer-42",
            approvedAt: "2026-04-05T12:34:00.000Z",
          },
        },
      });
    });

    await waitFor(() => {
      expect(pdfButton).not.toBeDisabled();
      expect(deckButton).not.toBeDisabled();
    });

    expect(screen.getByText(/approved by reviewer-42/i)).toBeInTheDocument();
  });

  it("restores approved state from persisted case/output metadata after remount", async () => {
    const firstRender = render(<NarrativeStage caseId="case-1" opportunityId="opp-1" />, { wrapper });

    act(() => {
      checkpointEventHandler?.({
        payload: {
          userId: "reviewer-7",
          emittedAt: "2026-04-05T13:00:00.000Z",
          actionData: {
            caseId: "case-1",
            outputId: "draft-1",
            approvalStatus: "approved",
            approvedBy: "reviewer-7",
            approvedAt: "2026-04-05T13:00:00.000Z",
          },
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByText(/approved by reviewer-7/i)).toBeInTheDocument();
    });

    const persisted = window.localStorage.getItem("valynt_narrative_export_approval:case-1:draft-1");
    expect(persisted).toContain("\"status\":\"approved\"");

    firstRender.unmount();
    render(<NarrativeStage caseId="case-1" opportunityId="opp-1" />, { wrapper });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /pdf report/i })).not.toBeDisabled();
    });
    expect(screen.getByText(/approved by reviewer-7/i)).toBeInTheDocument();
  });
});
