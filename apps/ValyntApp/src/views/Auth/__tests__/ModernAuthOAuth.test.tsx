import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ModernLoginPage } from "../ModernLoginPage";
import { ModernSignupPage } from "../ModernSignupPage";

const mockSignInWithProvider = vi.fn();
const mockLogin = vi.fn();
const mockSignup = vi.fn();
const mockResendVerificationEmail = vi.fn();

vi.mock("../../../contexts/AuthContext", () => ({
  useAuth: () => ({
    login: mockLogin,
    signup: mockSignup,
    resendVerificationEmail: mockResendVerificationEmail,
    signInWithProvider: mockSignInWithProvider,
  }),
}));

vi.mock("../../../i18n", () => ({
  getSupportedLocales: () => [{ code: "en", label: "English" }],
}));

vi.mock("../../../i18n/I18nProvider", () => ({
  useI18n: () => ({
    locale: "en",
    setLocale: vi.fn(),
    t: (_key: string, fallback: string) => fallback,
  }),
}));

vi.mock("../../../lib/logger", () => ({
  logger: {
    info: vi.fn(),
  },
}));

describe("Modern auth OAuth options", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Google OAuth and starts Google login from ModernLoginPage", async () => {
    render(
      <MemoryRouter>
        <ModernLoginPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /google/i }));

    await waitFor(() => {
      expect(mockSignInWithProvider).toHaveBeenCalledWith("google");
    });
  });

  it("renders Google OAuth and starts Google signup from ModernSignupPage", async () => {
    render(
      <MemoryRouter>
        <ModernSignupPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /google/i }));

    await waitFor(() => {
      expect(mockSignInWithProvider).toHaveBeenCalledWith("google");
    });
  });
});
