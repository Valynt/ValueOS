import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import CompanyOnboarding from "./CompanyOnboarding";

vi.mock("@/contexts/TenantContext", () => ({
  useTenant: () => ({ currentTenant: { id: "tenant-1", name: "Acme" } }),
}));

vi.mock("@/hooks/company-context", () => ({
  useCreateCompanyContext: () => ({ mutateAsync: vi.fn() }),
  useAddCompetitors: () => ({ mutateAsync: vi.fn() }),
  useAddPersonas: () => ({ mutateAsync: vi.fn() }),
  useAddClaimGovernance: () => ({ mutateAsync: vi.fn() }),
  useCompleteOnboarding: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("@/hooks/company-context/useResearchJob", () => ({
  useCreateResearchJob: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useResearchJobStatus: () => ({ data: null }),
  useResearchSuggestions: () => ({ data: [] }),
}));

vi.mock("@/lib/supabase", () => ({ supabase: null }));
vi.mock("@/lib/onboarding-bypass", () => ({
  clearOnboardingBypass: vi.fn(),
  markOnboardingBypassed: vi.fn(),
}));

vi.mock("./onboarding/Phase1Company", () => ({
  Phase1Company: () => <div>Phase 1</div>,
}));
vi.mock("./onboarding/Phase2Competitors", () => ({
  Phase2Competitors: () => <div>Phase 2</div>,
}));
vi.mock("./onboarding/Phase3Personas", () => ({
  Phase3Personas: () => <div>Phase 3</div>,
}));
vi.mock("./onboarding/Phase4Claims", () => ({
  Phase4Claims: () => <div>Phase 4</div>,
}));
vi.mock("./onboarding/Phase5Review", () => ({
  Phase5Review: () => <div>Phase 5</div>,
}));

describe("CompanyOnboarding", () => {
  it("shows ValueOS in the onboarding progress header", () => {
    const queryClient = new QueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <CompanyOnboarding />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByRole("heading", { name: "ValueOS" })).toBeInTheDocument();
    expect(screen.getByText("Value Intelligence Setup")).toBeInTheDocument();
    expect(screen.queryByText(/VALYNT/i)).not.toBeInTheDocument();
  });
});
