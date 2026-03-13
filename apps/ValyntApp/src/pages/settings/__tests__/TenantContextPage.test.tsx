import * as matchers from "@testing-library/jest-dom/matchers";
import { expect as vitestExpect } from "vitest";
vitestExpect.extend(matchers);

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

const mockToast = vi.fn();
vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (_k: string, fb?: string) => fb ?? _k }),
}));

import { TenantContextPage } from "../TenantContextPage";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderPage() {
  return render(<TenantContextPage />);
}

const SUCCESS_RESPONSE = {
  success: true,
  data: { memoryEntries: 4, status: "ok" },
};

const ERROR_RESPONSE = {
  success: false,
  error: { code: "FORBIDDEN", message: "Permission denied: settings:edit" },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("TenantContextPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows success toast with memoryEntries count on successful save", async () => {
    mockPost.mockResolvedValueOnce(SUCCESS_RESPONSE);
    renderPage();

    await userEvent.type(screen.getByLabelText(/products/i), "CRM, Analytics");
    await userEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Company context saved",
          description: "4 memory entries updated.",
        })
      );
    });
  });

  it("shows error toast when success is false", async () => {
    mockPost.mockResolvedValueOnce(ERROR_RESPONSE);
    renderPage();

    await userEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Failed to save context",
          description: "Permission denied: settings:edit",
          variant: "destructive",
        })
      );
    });
  });

  it("shows error toast when data is missing despite success:true", async () => {
    // Guards against a server returning { success: true } with no data
    mockPost.mockResolvedValueOnce({ success: true, data: null });
    renderPage();

    await userEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "destructive" })
      );
    });
  });

  it("does not show success toast on failure", async () => {
    mockPost.mockResolvedValueOnce(ERROR_RESPONSE);
    renderPage();

    await userEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(mockToast).not.toHaveBeenCalledWith(
        expect.objectContaining({ title: "Company context saved" })
      );
    });
  });

  it("disables the submit button while saving", async () => {
    let resolve!: (v: unknown) => void;
    mockPost.mockReturnValueOnce(new Promise((r) => { resolve = r; }));
    renderPage();

    await userEvent.click(screen.getByRole("button", { name: /save/i }));

    expect(screen.getByRole("button", { name: /saving/i })).toBeDisabled();

    resolve(SUCCESS_RESPONSE);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /save/i })).not.toBeDisabled();
    });
  });
});
