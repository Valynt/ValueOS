import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useIntegrityOutput } from "@/hooks/useIntegrityOutput";

import { EvidenceDrawer } from "../EvidenceDrawer";

vi.mock("@/hooks/useIntegrityOutput", () => ({
  useIntegrityOutput: vi.fn(),
}));

const mockedUseIntegrityOutput = vi.mocked(useIntegrityOutput);

function mockIntegrityHook(params: Partial<ReturnType<typeof useIntegrityOutput>>) {
  mockedUseIntegrityOutput.mockReturnValue({
    data: null,
    isLoading: false,
    error: null,
    isRunning: false,
    runAgent: vi.fn(),
    ...params,
  });
}

describe("EvidenceDrawer", () => {
  it("renders loading state", () => {
    mockIntegrityHook({ isLoading: true });

    render(<EvidenceDrawer open onClose={() => undefined} caseId="case-1" />);

    expect(screen.getByText("Loading evidence from Integrity output…")).toBeInTheDocument();
  });

  it("renders API error state", () => {
    mockIntegrityHook({ error: new Error("Integrity API unavailable") });

    render(<EvidenceDrawer open onClose={() => undefined} caseId="case-1" />);

    expect(screen.getByText("Evidence integration failure")).toBeInTheDocument();
    expect(screen.getByText(/Integrity API unavailable/)).toBeInTheDocument();
  });

  it("renders empty claims state", () => {
    mockIntegrityHook({
      data: {
        id: "out-1",
        case_id: "case-1",
        organization_id: "org-1",
        agent_run_id: null,
        claims: [],
        overall_confidence: null,
        veto_triggered: false,
        veto_reason: null,
        source_agent: "integrity",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    });

    render(<EvidenceDrawer open onClose={() => undefined} caseId="case-1" />);

    expect(screen.getByText("No evidence claims were returned by orchestration for this case.")).toBeInTheDocument();
  });

  it("renders populated claims with confidence, tier, and provenance links", () => {
    mockIntegrityHook({
      data: {
        id: "out-1",
        case_id: "case-1",
        organization_id: "org-1",
        agent_run_id: null,
        claims: [
          {
            claim_id: "claim-1",
            text: "ERP upgrade reduces reconciliation cycle by 35%",
            confidence_score: 0.81,
            evidence_tier: 2,
            flagged: false,
            provenance: {
              source_url: "https://example.com/source/erp-upgrade",
            },
          },
          {
            text: "Malformed payload without confidence, tier, and claim_id",
            flagged: false,
          },
        ],
        overall_confidence: 0.81,
        veto_triggered: false,
        veto_reason: null,
        source_agent: "integrity",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    });

    render(<EvidenceDrawer open onClose={() => undefined} caseId="case-1" />);

    expect(screen.getByText("ERP upgrade reduces reconciliation cycle by 35%")).toBeInTheDocument();
    expect(screen.getByText("Tier 2")).toBeInTheDocument();
    expect(screen.getByText("81%")).toBeInTheDocument();

    const sourceLink = screen.getByRole("link", { name: "Open provenance source for claim-1" });
    expect(sourceLink).toHaveAttribute("href", "https://example.com/source/erp-upgrade");

    expect(screen.getByText("Tier unavailable")).toBeInTheDocument();
    expect(screen.getByText("Unknown claim ID")).toBeInTheDocument();
    expect(screen.getByText("Confidence unavailable")).toBeInTheDocument();
    expect(screen.getByLabelText("No provenance source for Unknown claim ID")).toBeInTheDocument();
  });
});
