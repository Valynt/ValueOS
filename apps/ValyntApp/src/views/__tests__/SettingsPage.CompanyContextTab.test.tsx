/**
 * Regression test for CompanyContextTab auth fix.
 *
 * Before the fix, the tab used raw fetch() with no Authorization header,
 * causing every submission to return 401. After the fix it uses apiClient.post()
 * which attaches the auth token automatically.
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPost = vi.fn();

vi.mock("@/api/client/unified-api-client", () => ({
  apiClient: { post: (...args: unknown[]) => mockPost(...args) },
}));

vi.mock("@/lib/utils", () => ({
  cn: (...classes: string[]) => classes.filter(Boolean).join(" "),
}));

// ---------------------------------------------------------------------------
// Import component after mocks
// ---------------------------------------------------------------------------

// SettingsPage exports a default; we render it and navigate to the company-context tab.
import SettingsPage from "../SettingsPage";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderPage() {
  return render(<SettingsPage />);
}

function clickCompanyContextTab() {
  const tab = screen.getByRole("button", { name: /company context/i });
  return userEvent.click(tab);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CompanyContextTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls apiClient.post (not fetch) when submitting", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    mockPost.mockResolvedValueOnce({ success: true, data: {} });

    renderPage();
    await clickCompanyContextTab();

    const submitBtn = screen.getByRole("button", { name: /save changes/i });
    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        "/api/v1/tenant/context",
        expect.any(Object)
      );
    });

    // Raw fetch must NOT have been called for this endpoint
    const tenantContextFetchCalls = fetchSpy.mock.calls.filter(
      ([url]) => typeof url === "string" && url.includes("/api/v1/tenant/context")
    );
    expect(tenantContextFetchCalls).toHaveLength(0);

    fetchSpy.mockRestore();
  });

  it("sets status to saved on success", async () => {
    mockPost.mockResolvedValueOnce({ success: true, data: {} });

    renderPage();
    await clickCompanyContextTab();

    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(screen.getByText(/saved\./i)).toBeInTheDocument();
    });
  });

  it("sets status to error when apiClient returns success:false", async () => {
    mockPost.mockResolvedValueOnce({ success: false, error: { message: "Forbidden" } });

    renderPage();
    await clickCompanyContextTab();

    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(screen.getByText(/failed to save/i)).toBeInTheDocument();
    });
  });
});
