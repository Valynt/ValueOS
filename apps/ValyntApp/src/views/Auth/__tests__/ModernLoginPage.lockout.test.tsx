import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthRateLimitError, authRateLimiter } from "@/lib/rateLimiter";

import { ModernLoginPage } from "../ModernLoginPage";

const mockLogin = vi.fn();

vi.mock("../../../contexts/AuthContext", () => ({
  useAuth: () => ({
    login: mockLogin,
    signup: vi.fn(),
    resendVerificationEmail: vi.fn(),
    signInWithProvider: vi.fn(),
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
    error: vi.fn(),
  },
}));

const submitLoginForm = async () => {
  fireEvent.change(screen.getByLabelText(/corporate email/i), {
    target: { value: "locked@example.com" },
  });
  fireEvent.change(screen.getByLabelText(/security key/i), {
    target: { value: "password123" },
  });
  fireEvent.click(screen.getByRole("button", { name: /resume value model/i }));
};

describe("ModernLoginPage lockout handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authRateLimiter.clearAllData();
    localStorage.clear();
  });

  it("does not unlock when localStorage is cleared if backend still reports locked", async () => {
    for (let index = 0; index < 5; index += 1) {
      authRateLimiter.recordFailedAttempt("locked@example.com");
    }
    localStorage.clear();

    mockLogin.mockRejectedValueOnce(
      new AuthRateLimitError("Too many login attempts", {
        locked: true,
        retryAfterSeconds: 300,
        remainingAttempts: 0,
      }, 429),
    );

    render(
      <MemoryRouter>
        <ModernLoginPage />
      </MemoryRouter>,
    );

    await submitLoginForm();

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledTimes(1);
      expect(
        screen.getByText("Too many login attempts. Try again in about 5 minutes."),
      ).toBeInTheDocument();
    });
  });

  it("uses server retry window in lockout message when backend provides metadata", async () => {
    for (let index = 0; index < 5; index += 1) {
      authRateLimiter.recordFailedAttempt("locked@example.com");
    }

    mockLogin.mockRejectedValueOnce(
      new AuthRateLimitError("Locked", { locked: true, retryAfterSeconds: 120 }, 429),
    );

    render(
      <MemoryRouter>
        <ModernLoginPage />
      </MemoryRouter>,
    );

    await submitLoginForm();

    await waitFor(() => {
      expect(
        screen.getByText("Too many login attempts. Try again in about 2 minutes."),
      ).toBeInTheDocument();
    });
  });

  it("falls back to local limiter only when server lockout metadata is absent", async () => {
    for (let index = 0; index < 4; index += 1) {
      authRateLimiter.recordFailedAttempt("locked@example.com");
    }

    mockLogin.mockRejectedValueOnce(new Error("Invalid credentials"));

    render(
      <MemoryRouter>
        <ModernLoginPage />
      </MemoryRouter>,
    );

    await submitLoginForm();

    await waitFor(() => {
      expect(
        screen.getByText("Too many login attempts. Please try again in about 15 minutes."),
      ).toBeInTheDocument();
    });
  });
});
