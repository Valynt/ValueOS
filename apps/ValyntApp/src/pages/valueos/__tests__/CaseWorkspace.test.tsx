import * as matchers from "@testing-library/jest-dom/matchers";
import { expect as vitestExpect } from "vitest";
vitestExpect.extend(matchers);
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — declared before component import so vi.mock hoisting works
// ---------------------------------------------------------------------------

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockMutateAsync = vi.fn();
const mockCreateCaseState = {
  mutateAsync: mockMutateAsync,
  isPending: false,
  isError: false,
};

const mockUseCaseFn = vi.fn();

vi.mock("@/hooks/useCases", () => ({
  useCase: (...args: unknown[]) => mockUseCaseFn(...args),
  useCreateCase: () => mockCreateCaseState,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { email: "test@example.com", user_metadata: {} } }),
}));

import { CaseWorkspace } from "../CaseWorkspace";

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------

function renderAtPath(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/app/cases/new" element={<CaseWorkspace />} />
        <Route path="/app/cases/:caseId" element={<CaseWorkspace />} />
      </Routes>
    </MemoryRouter>,
  );
}

// ---------------------------------------------------------------------------
// New-case wizard
// ---------------------------------------------------------------------------

describe("NewCaseWizard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateCaseState.isPending = false;
    mockCreateCaseState.isError = false;
  });

  it("renders Step 1 on /app/cases/new", () => {
    renderAtPath("/app/cases/new");
    expect(screen.getByText("New Value Case")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/e\.g\. Acme Corp/i)).toBeInTheDocument();
  });

  it("Continue is disabled on Step 1 when company name is empty", () => {
    renderAtPath("/app/cases/new");
    expect(screen.getByRole("button", { name: /continue/i })).toBeDisabled();
  });

  it("Continue is enabled on Step 1 once company name is entered", async () => {
    const user = userEvent.setup();
    renderAtPath("/app/cases/new");

    await user.type(screen.getByPlaceholderText(/e\.g\. Acme Corp/i), "Acme");
    expect(screen.getByRole("button", { name: /continue/i })).toBeEnabled();
  });

  it("advances to Step 2 after entering company name and clicking Continue", async () => {
    const user = userEvent.setup();
    renderAtPath("/app/cases/new");

    await user.type(screen.getByPlaceholderText(/e\.g\. Acme Corp/i), "Acme");
    await user.click(screen.getByRole("button", { name: /continue/i }));

    // Step indicator text is split across elements — match by regex on the paragraph
    expect(screen.getByText(/step 2 of 3/i)).toBeInTheDocument();
    expect(screen.getByText("SaaS ROI Calculator")).toBeInTheDocument();
  });

  it("Continue is enabled on Step 2 because vm_1 is pre-selected", async () => {
    const user = userEvent.setup();
    renderAtPath("/app/cases/new");

    await user.type(screen.getByPlaceholderText(/e\.g\. Acme Corp/i), "Acme");
    await user.click(screen.getByRole("button", { name: /continue/i }));

    expect(screen.getByRole("button", { name: /continue/i })).toBeEnabled();
  });

  it("Continue is disabled on Step 2 when all models are deselected", async () => {
    const user = userEvent.setup();
    renderAtPath("/app/cases/new");

    await user.type(screen.getByPlaceholderText(/e\.g\. Acme Corp/i), "Acme");
    await user.click(screen.getByRole("button", { name: /continue/i }));

    // Deselect the pre-selected vm_1
    await user.click(screen.getByRole("button", { name: /saas roi calculator/i }));
    expect(screen.getByRole("button", { name: /continue/i })).toBeDisabled();
  });

  it("advances to Step 3 (Review) from Step 2", async () => {
    const user = userEvent.setup();
    renderAtPath("/app/cases/new");

    await user.type(screen.getByPlaceholderText(/e\.g\. Acme Corp/i), "Acme");
    await user.click(screen.getByRole("button", { name: /continue/i }));
    await user.click(screen.getByRole("button", { name: /continue/i }));

    expect(screen.getByText(/step 3 of 3/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create case/i })).toBeInTheDocument();
  });

  it("Back button returns to previous step", async () => {
    const user = userEvent.setup();
    renderAtPath("/app/cases/new");

    await user.type(screen.getByPlaceholderText(/e\.g\. Acme Corp/i), "Acme");
    await user.click(screen.getByRole("button", { name: /continue/i }));

    // On Step 2 the navigation Back button is the last button matching /back/i
    const backButtons = screen.getAllByRole("button", { name: /back/i });
    await user.click(backButtons[backButtons.length - 1]);

    // Back on Step 1 — company name input is visible again
    expect(screen.getByPlaceholderText(/e\.g\. Acme Corp/i)).toBeInTheDocument();
  });

  it("calls mutateAsync with correct payload and navigates on success", async () => {
    const user = userEvent.setup();
    mockMutateAsync.mockResolvedValueOnce({ id: "case-123" });
    renderAtPath("/app/cases/new");

    await user.type(screen.getByPlaceholderText(/e\.g\. Acme Corp/i), "Acme");
    await user.click(screen.getByRole("button", { name: /continue/i }));
    await user.click(screen.getByRole("button", { name: /continue/i }));
    await user.click(screen.getByRole("button", { name: /create case/i }));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Acme — Value Case",
          status: "draft",
          metadata: expect.objectContaining({
            company_name: "Acme",
            model_ids: ["vm_1"],
          }),
        }),
      );
      expect(mockNavigate).toHaveBeenCalledWith("/app/cases/case-123");
    });
  });

  it("shows error message and does not navigate when mutateAsync throws", async () => {
    const user = userEvent.setup();
    mockMutateAsync.mockRejectedValueOnce(new Error("Server error"));
    mockCreateCaseState.isError = true;
    renderAtPath("/app/cases/new");

    await user.type(screen.getByPlaceholderText(/e\.g\. Acme Corp/i), "Acme");
    await user.click(screen.getByRole("button", { name: /continue/i }));
    await user.click(screen.getByRole("button", { name: /continue/i }));
    await user.click(screen.getByRole("button", { name: /create case/i }));

    await waitFor(() => {
      expect(screen.getByText(/failed to create case/i)).toBeInTheDocument();
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// ExistingCaseView
// ---------------------------------------------------------------------------

describe("ExistingCaseView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state while fetching", () => {
    mockUseCaseFn.mockReturnValue({ data: undefined, isLoading: true, error: null, refetch: vi.fn() });

    renderAtPath("/app/cases/abc-123");
    expect(screen.getByText(/loading case/i)).toBeInTheDocument();
  });

  it("shows 404 state when fetch succeeds but case is not found", () => {
    mockUseCaseFn.mockReturnValue({ data: undefined, isLoading: false, error: null, refetch: vi.fn() });

    renderAtPath("/app/cases/bad-id");
    expect(screen.getByText("Case not found")).toBeInTheDocument();
    expect(screen.getByText(/bad-id/)).toBeInTheDocument();
    expect(screen.queryByText(/failed to load case/i)).not.toBeInTheDocument();
  });

  it("shows retryable error state on fetch failure, not 404 message", () => {
    const mockRefetch = vi.fn();
    mockUseCaseFn.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("Network timeout"),
      refetch: mockRefetch,
    });

    renderAtPath("/app/cases/abc-123");
    expect(screen.getByText("Failed to load case")).toBeInTheDocument();
    expect(screen.getByText("Network timeout")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
    expect(screen.queryByText("Case not found")).not.toBeInTheDocument();
  });

  it("Retry button calls refetch, not a page reload", async () => {
    const user = userEvent.setup();
    const mockRefetch = vi.fn();
    mockUseCaseFn.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("Network timeout"),
      refetch: mockRefetch,
    });

    renderAtPath("/app/cases/abc-123");
    await user.click(screen.getByRole("button", { name: /retry/i }));

    expect(mockRefetch).toHaveBeenCalledOnce();
  });

  it("renders case name and status when fetch succeeds", () => {
    mockUseCaseFn.mockReturnValue({
      data: {
        id: "abc-123",
        name: "Acme — Value Case",
        status: "draft",
        description: "Test description",
        company_profiles: null,
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    renderAtPath("/app/cases/abc-123");
    expect(screen.getByText("Acme — Value Case")).toBeInTheDocument();
    expect(screen.getByText("draft")).toBeInTheDocument();
  });
});
