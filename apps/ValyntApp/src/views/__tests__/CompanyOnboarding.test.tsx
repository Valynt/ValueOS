import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CompanyOnboarding from "../CompanyOnboarding";

const mockNavigate = vi.fn();
const mockLocation = {
  key: "initial",
  pathname: "/onboarding",
  search: "",
  state: null as unknown,
};

const phase1Payload = {
  company_name: "Acme",
  website_url: "https://acme.test",
  industry: "Technology",
  company_size: "enterprise" as const,
  sales_motion: "new_logo" as const,
  products: [],
};

const phase2Payload = { competitors: [] };
const phase3Payload = { personas: [] };

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => mockLocation,
  };
});

vi.mock("@/contexts/TenantContext", () => ({
  useTenant: () => ({
    currentTenant: { id: "tenant-1", name: "Tenant One" },
  }),
}));

vi.mock("@/hooks/company-context", () => ({
  useCreateCompanyContext: () => ({ mutateAsync: vi.fn(async () => ({ id: "ctx-1" })) }),
  useAddCompetitors: () => ({ mutateAsync: vi.fn(async () => ({})) }),
  useAddPersonas: () => ({ mutateAsync: vi.fn(async () => ({})) }),
  useAddClaimGovernance: () => ({ mutateAsync: vi.fn(async () => ({})) }),
  useCompleteOnboarding: () => ({ mutateAsync: vi.fn(async () => ({})) }),
}));

vi.mock("@/hooks/company-context/useResearchJob", () => ({
  useCreateResearchJob: () => ({ mutateAsync: vi.fn(async () => ({ id: "job-1" })), isPending: false }),
  useResearchJobStatus: () => ({ data: null }),
  useResearchSuggestions: () => ({ data: [] }),
}));

vi.mock("@/lib/onboarding-bypass", () => ({
  clearOnboardingBypass: vi.fn(),
  markOnboardingBypassed: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({ supabase: null }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));

vi.mock("../onboarding/Phase1Company", () => ({
  Phase1Company: ({ onNext }: { onNext: (data: typeof phase1Payload) => void }) => (
    <button onClick={() => onNext(phase1Payload)}>Phase1 Next</button>
  ),
}));

vi.mock("../onboarding/Phase2Competitors", () => ({
  Phase2Competitors: ({ onBack }: { onBack: () => void }) => (
    <button onClick={() => onBack()}>Phase2 Back</button>
  ),
}));

vi.mock("../onboarding/Phase3Personas", () => ({
  Phase3Personas: ({ onBack }: { onBack: () => void }) => (
    <button onClick={() => onBack()}>Phase3 Back</button>
  ),
}));

vi.mock("../onboarding/Phase4Claims", () => ({
  Phase4Claims: () => <div>Phase4</div>,
}));

vi.mock("../onboarding/Phase5Review", () => ({
  Phase5Review: () => <div>Phase5</div>,
}));

const renderView = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <CompanyOnboarding />
    </QueryClientProvider>
  );
};

describe("CompanyOnboarding phase navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocation.key = "initial";
    mockLocation.pathname = "/onboarding";
    mockLocation.search = "";
    mockLocation.state = null;
  });

  it("falls back to phase 1 when URL phase lacks prerequisites", () => {
    mockLocation.search = "?phase=4";
    renderView();

    expect(screen.getByText("Phase1 Next")).toBeInTheDocument();
  });

  it("keeps in-form back actions and syncs URL/state through navigate", () => {
    mockLocation.search = "?phase=2";
    mockLocation.state = {
      companyOnboarding: {
        phase: 2,
        contextId: "ctx-1",
        researchJobId: null,
        phase1Data: phase1Payload,
        phase2Data: phase2Payload,
        phase3Data: null,
        phase4Data: null,
      },
    };
    renderView();

    fireEvent.click(screen.getByText("Phase2 Back"));

    expect(mockNavigate).toHaveBeenCalledWith(
      "/onboarding?phase=1",
      expect.objectContaining({
        state: expect.objectContaining({
          companyOnboarding: expect.objectContaining({ phase: 1 }),
        }),
      })
    );
  });

  it("responds to browser back/forward location changes by updating rendered phase", () => {
    mockLocation.key = "phase3";
    mockLocation.search = "?phase=3";
    mockLocation.state = {
      companyOnboarding: {
        phase: 3,
        contextId: "ctx-1",
        researchJobId: null,
        phase1Data: phase1Payload,
        phase2Data: phase2Payload,
        phase3Data: phase3Payload,
        phase4Data: null,
      },
    };
    const view = renderView();
    expect(screen.getByText("Phase3 Back")).toBeInTheDocument();

    mockLocation.key = "phase2";
    mockLocation.search = "?phase=2";
    mockLocation.state = {
      companyOnboarding: {
        phase: 2,
        contextId: "ctx-1",
        researchJobId: null,
        phase1Data: phase1Payload,
        phase2Data: phase2Payload,
        phase3Data: null,
        phase4Data: null,
      },
    };
    view.rerender(
      <QueryClientProvider client={new QueryClient()}>
        <CompanyOnboarding />
      </QueryClientProvider>
    );
    expect(screen.getByText("Phase2 Back")).toBeInTheDocument();
  });
});
