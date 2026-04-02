/**
 * @jest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { ValueCaseCanvas } from "../ValueCaseCanvas";

import { WORKFLOW_STATUS_PRESENTATION, type WorkflowViewState } from "@/features/workflow/hooks/workflowExecutionPresentation";

const useWorkflowExecutionViewModelMock = vi.fn();

vi.mock("react-router-dom", () => ({
  Link: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  useParams: () => ({ oppId: "opp-1", caseId: "case-1" }),
}));

vi.mock("@/hooks/useDomainPacks", () => ({
  useMergedContext: () => ({ data: null }),
}));

vi.mock("@/hooks/useCases", () => ({
  useCase: () => ({
    data: { name: "Value Case", company_profiles: { company_name: "Acme" } },
    isLoading: false,
  }),
}));

vi.mock("@/hooks/useCaseExport", () => ({
  usePptxExport: () => ({
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
  }),
}));

vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/features/workflow/hooks/useWorkflowExecutionViewModel", () => ({
  useWorkflowExecutionViewModel: () => useWorkflowExecutionViewModelMock(),
}));

vi.mock("../canvas/AgentThread", () => ({ AgentThread: () => <div data-testid="agent-thread" /> }));
vi.mock("../canvas/EvidenceDrawer", () => ({ EvidenceDrawer: () => <div data-testid="evidence-drawer" /> }));
vi.mock("../canvas/ExpansionStage", () => ({ ExpansionStage: () => <div>Expansion</div> }));
vi.mock("../canvas/HypothesisStage", () => ({ HypothesisStage: () => <div>Hypothesis</div> }));
vi.mock("../canvas/IntegrityStage", () => ({ IntegrityStage: () => <div>Integrity</div> }));
vi.mock("../canvas/ModelStage", () => ({ ModelStage: () => <div>Model</div> }));
vi.mock("../canvas/NarrativeStage", () => ({ NarrativeStage: () => <div>Narrative</div> }));
vi.mock("../canvas/RealizationStage", () => ({ RealizationStage: () => <div>Realization</div> }));
vi.mock("../canvas/ValueGraphStage", () => ({ ValueGraphStage: () => <div>Value Graph</div> }));

describe("ValueCaseCanvas workflow state presentation", () => {
  const cases: WorkflowViewState[] = [
    "initiated",
    "running",
    "waiting_approval",
    "failed",
    "completed",
    "retrying",
    "unavailable",
    "never_run",
  ];

  it.each(cases)("renders user messaging and CTA for state %s", (state) => {
    const presentation = WORKFLOW_STATUS_PRESENTATION[state];

    useWorkflowExecutionViewModelMock.mockReturnValue({
      data: {
        statusLabel: presentation.label,
        statusMessage: presentation.userMessage,
        statusIconClassName: presentation.iconClassName,
        confidenceBarClassName: presentation.confidenceClassName,
        confidencePercent: 77,
        confidenceLabel: "77%",
        ctaText: presentation.ctaText,
        lastUpdatedLabel: "Updated just now",
        execution: { stages: {} },
      },
    });

    render(<ValueCaseCanvas />);

    expect(screen.getByText(presentation.userMessage)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: presentation.ctaText })).toBeInTheDocument();
  });
});
