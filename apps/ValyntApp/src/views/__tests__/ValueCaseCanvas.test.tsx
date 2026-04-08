import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { ValueCaseCanvas } from "../ValueCaseCanvas";

const mockUseCase = vi.fn();
const useWorkflowExecutionViewModelMock = vi.fn();

vi.mock("@/hooks/useCases", () => ({ useCase: (...args: unknown[]) => mockUseCase(...args) }));
vi.mock("@/hooks/useDomainPacks", () => ({ useMergedContext: () => ({ data: null }) }));
vi.mock("@/hooks/useCaseExport", () => ({ usePptxExport: () => ({ mutate: vi.fn(), isPending: false, isError: false, error: null }) }));
vi.mock("@/hooks/company-context", () => ({
  useTargetAlignment: () => ({ data: null, isLoading: false, error: null }),
}));
vi.mock("@/contexts/CompanyContextProvider", () => ({
  useCompanyValueContext: () => ({ companyContext: null, isReady: false }),
}));
vi.mock("@/components/ui/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/features/workflow/hooks/useWorkflowExecutionViewModel", () => ({ useWorkflowExecutionViewModel: () => useWorkflowExecutionViewModelMock() }));

vi.mock("../canvas/HypothesisStage", () => ({ HypothesisStage: () => <div>Hypothesis stage</div> }));
vi.mock("../canvas/ModelStage", () => ({ ModelStage: () => <div>Model stage</div> }));
vi.mock("../canvas/IntegrityStage", () => ({ IntegrityStage: () => <div>Integrity stage</div> }));
vi.mock("../canvas/NarrativeStage", () => ({ NarrativeStage: () => <div>Narrative stage</div> }));
vi.mock("../canvas/RealizationStage", () => ({ RealizationStage: () => <div>Realization stage</div> }));
vi.mock("../canvas/ExpansionStage", () => ({ ExpansionStage: () => <div>Expansion stage</div> }));
vi.mock("../canvas/ValueGraphStage", () => ({ ValueGraphStage: () => <div>Value graph stage</div> }));
vi.mock("../canvas/AgentThread", () => ({ AgentThread: () => <div>Agent thread</div> }));
vi.mock("../canvas/EvidenceDrawer", () => ({ EvidenceDrawer: () => null }));
vi.mock("@/features/workflow/components/HandoffTimelineCards", () => ({
  HandoffTimelineCards: () => <div data-testid="handoff-timeline-cards" />,
}));

function renderCanvas(initialPath = "/opportunities/opp-1/cases/case-1") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/opportunities/:oppId/cases/:caseId/:stage" element={<ValueCaseCanvas />} />
        <Route path="/opportunities/:oppId/cases/:caseId" element={<ValueCaseCanvas />} />
      </Routes>
    </MemoryRouter>
  );
}

function buildCase() {
  return { id: "case-1", name: "Value Case", company_profiles: { company_name: "Acme" } };
}

describe("ValueCaseCanvas stage URL behavior", () => {
  it("shows a pending-stage recommendation", () => {
    mockUseCase.mockReturnValue({ data: buildCase(), isLoading: false });
    useWorkflowExecutionViewModelMock.mockReturnValue({ data: { execution: { stages: { hypothesis: { status: "pending" } } } } });

    renderCanvas();

    expect(screen.getByTestId("guided-next-action")).toHaveTextContent("Run Hypothesis next to progress Discover.");
  });

  it("supports direct navigation to a stage via URL query", () => {
    mockUseCase.mockReturnValue({ data: buildCase(), isLoading: false });
    useWorkflowExecutionViewModelMock.mockReturnValue({ data: { execution: { stages: {} } } });

    renderCanvas("/opportunities/opp-1/cases/case-1?stage=narrative");

    expect(screen.getByText("Narrative stage")).toBeInTheDocument();
  });

  it("normalizes unknown stage query values to hypothesis", () => {
    mockUseCase.mockReturnValue({ data: buildCase(), isLoading: false });
    useWorkflowExecutionViewModelMock.mockReturnValue({ data: { execution: { stages: {} } } });

    renderCanvas("/opportunities/opp-1/cases/case-1?stage=bad-stage");

    expect(screen.getByText("Hypothesis stage")).toBeInTheDocument();
  });

  it("supports copy/paste sharing via stage URL", () => {
    mockUseCase.mockReturnValue({ data: buildCase(), isLoading: false });
    useWorkflowExecutionViewModelMock.mockReturnValue({ data: { execution: { stages: {} } } });

    const shareableUrl = "/opportunities/opp-1/cases/case-1?stage=narrative";
    renderCanvas(shareableUrl);

    expect(screen.getByText("Narrative stage")).toBeInTheDocument();
  });
});
