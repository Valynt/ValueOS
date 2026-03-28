import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import ValueCaseCanvas from "../ValueCaseCanvas";

const mockUseCase = vi.fn();

vi.mock("@/hooks/useCases", () => ({
  useCase: (...args: unknown[]) => mockUseCase(...args),
}));

vi.mock("@/hooks/useDomainPacks", () => ({
  useMergedContext: () => ({ data: null }),
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

vi.mock("../canvas/HypothesisStage", () => ({
  HypothesisStage: () => <div>Hypothesis stage</div>,
}));
vi.mock("../canvas/ModelStage", () => ({
  ModelStage: () => <div>Model stage</div>,
}));
vi.mock("../canvas/IntegrityStage", () => ({
  IntegrityStage: () => <div>Integrity stage</div>,
}));
vi.mock("../canvas/NarrativeStage", () => ({
  NarrativeStage: () => <div>Narrative stage</div>,
}));
vi.mock("../canvas/RealizationStage", () => ({
  RealizationStage: () => <div>Realization stage</div>,
}));
vi.mock("../canvas/ExpansionStage", () => ({
  ExpansionStage: () => <div>Expansion stage</div>,
}));
vi.mock("../canvas/ValueGraphStage", () => ({
  ValueGraphStage: () => <div>Value graph stage</div>,
}));
vi.mock("../canvas/AgentThread", () => ({
  AgentThread: () => <div>Agent thread</div>,
}));
vi.mock("../canvas/EvidenceDrawer", () => ({
  EvidenceDrawer: () => null,
}));

function renderCanvas() {
  return render(
    <MemoryRouter initialEntries={["/opportunities/opp-1/cases/case-1"]}>
      <Routes>
        <Route path="/opportunities/:oppId/cases/:caseId" element={<ValueCaseCanvas />} />
      </Routes>
    </MemoryRouter>
  );
}

function buildCaseWithWorkflowMetadata(workflowExecution: Record<string, unknown>) {
  return {
    id: "case-1",
    name: "Value Case",
    company_profiles: { company_name: "Acme" },
    metadata: {
      workflow_execution: workflowExecution,
    },
  };
}

describe("ValueCaseCanvas guided next-step journey", () => {
  it("shows a pending-stage recommendation", () => {
    mockUseCase.mockReturnValue({
      data: buildCaseWithWorkflowMetadata({
        stages: {
          hypothesis: { status: "pending", completion_criteria: ["Document baseline assumptions"] },
        },
      }),
      isLoading: false,
    });

    renderCanvas();

    expect(screen.getByTestId("guided-next-action")).toHaveTextContent(
      "Recommended next action: Run Hypothesis next to progress Discover."
    );
  });

  it("shows an in-progress recommendation", () => {
    mockUseCase.mockReturnValue({
      data: buildCaseWithWorkflowMetadata({
        in_progress_stage: "model",
        stages: {
          hypothesis: { status: "complete" },
          model: { status: "in_progress" },
        },
      }),
      isLoading: false,
    });

    renderCanvas();

    expect(screen.getByTestId("guided-next-action")).toHaveTextContent(
      "Recommended next action: Continue Model to advance Analyze."
    );
  });

  it("shows guard details when entering a blocked stage", () => {
    mockUseCase.mockReturnValue({
      data: buildCaseWithWorkflowMetadata({
        stages: {
          model: {
            status: "blocked",
            blocked_reason: "Hypothesis evidence confidence is below threshold.",
            prerequisites: ["Complete hypothesis evidence review", "Confirm baseline metrics"],
          },
        },
      }),
      isLoading: false,
    });

    renderCanvas();

    fireEvent.click(screen.getByRole("button", { name: "Model" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Model is currently blocked.");
    expect(screen.getByRole("alert")).toHaveTextContent("Hypothesis evidence confidence is below threshold.");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Prerequisites: Complete hypothesis evidence review, Confirm baseline metrics."
    );
  });

  it("shows complete recommendation when all stages are complete", () => {
    mockUseCase.mockReturnValue({
      data: buildCaseWithWorkflowMetadata({
        stages: {
          hypothesis: { status: "complete" },
          model: { status: "complete" },
          integrity: { status: "complete" },
          narrative: { status: "complete" },
          realization: { status: "complete" },
          expansion: { status: "complete" },
          "value-graph": { status: "complete" },
        },
      }),
      isLoading: false,
    });

    renderCanvas();

    expect(screen.getByTestId("guided-next-action")).toHaveTextContent(
      "Recommended next action: All milestones are complete. Review evidence and prepare stakeholder export."
    );
  });
});
