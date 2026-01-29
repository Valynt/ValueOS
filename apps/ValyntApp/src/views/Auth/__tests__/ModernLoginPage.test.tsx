/**
 * ModernLoginPage Component Tests
 * Tests UI interactions, form validation, and OAuth button interactions
 */

import { describe, expect, it, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { ModernLoginPage } from "../ModernLoginPage";
import { AuthContext } from "../../../contexts/AuthContext";
import { RateLimitError } from "../../../services/errors";

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ state: null }),
  };
});

describe("ModernLoginPage Component", () => {
  const mockLogin = vi.fn();
  const mockSignInWithProvider = vi.fn();

  const createAuthContext = () => ({
    user: null,
    userClaims: null,
    session: null,
    loading: false,
    isAuthenticated: false,
    login: mockLogin,
    signup: vi.fn(),
    logout: vi.fn(),
    resetPassword: vi.fn(),
    updatePassword: vi.fn(),
    resendVerificationEmail: vi.fn(),
    signInWithProvider: mockSignInWithProvider,
  });

  const renderLoginPage = () => {
    const authContext = createAuthContext();
    return render(
      <BrowserRouter>
        <AuthContext.Provider value={authContext}>
          <ModernLoginPage />
        </AuthContext.Provider>
      </BrowserRouter>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Form Rendering", () => {
    it("should render login form with email and password fields", () => {
      renderLoginPage();

      expect(screen.getByLabelText("Email")).toBeInTheDocument();
      expect(screen.getByLabelText("Password")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
    });

    it("should render OAuth provider buttons", () => {
      renderLoginPage();

      const googleButton = screen.getByRole("button", { name: /google/i });
      expect(googleButton).toBeInTheDocument();
    });

    it("should render signup link", () => {
      renderLoginPage();

      const signupLink = screen.getByText(/sign up/i);
      expect(signupLink).toBeInTheDocument();
      expect(signupLink.closest("a")).toHaveAttribute("href", "/signup");
    });
  });

  describe("Form Validation", () => {
    it("should require email and password fields", async () => {
      renderLoginPage();

      const submitButton = screen.getByRole("button", { name: "Sign in" });
      fireEvent.click(submitButton);

      // HTML5 validation should prevent submission
      expect(mockLogin).not.toHaveBeenCalled();
    });

    it("should accept valid email and password", async () => {
      renderLoginPage();
      mockLogin.mockResolvedValue({});

      const emailInput = screen.getByLabelText("Email");
      const passwordInput = screen.getByLabelText("Password");
      const submitButton = screen.getByRole("button", { name: "Sign in" });

      fireEvent.change(emailInput, { target: { value: "test@example.com" } });
      fireEvent.change(passwordInput, { target: { value: "SecurePass123!" } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith({
          email: "test@example.com",
          password: "SecurePass123!",
        });
      });
    });
  });

  describe("User Interactions", () => {
    it("should show/hide password when toggle button is clicked", () => {
      renderLoginPage();

      const passwordInput = screen.getByLabelText("Password") as HTMLInputElement;

      // The toggle button is inside PasswordInput, likely with aria-label "Show password"
      const toggleButton = screen.getByLabelText(/show password/i);

      expect(passwordInput.type).toBe("password");

      fireEvent.click(toggleButton);
      expect(passwordInput.type).toBe("text");

      // Button label changes to "Hide password"
      const hideButton = screen.getByLabelText(/hide password/i);
      fireEvent.click(hideButton);
      expect(passwordInput.type).toBe("password");
    });

    it("should show loading state during login", async () => {
      renderLoginPage();
      mockLogin.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 100)));

      const emailInput = screen.getByLabelText("Email");
      const passwordInput = screen.getByLabelText("Password");
      const submitButton = screen.getByRole("button", { name: "Sign in" });

      fireEvent.change(emailInput, { target: { value: "test@example.com" } });
      fireEvent.change(passwordInput, { target: { value: "SecurePass123!" } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/signing in/i)).toBeInTheDocument();
      });
    });
  });

  describe("Error Handling", () => {
    it("should display error message on invalid credentials", async () => {
      renderLoginPage();
      mockLogin.mockRejectedValue(new Error("Invalid email or password"));

      const emailInput = screen.getByLabelText("Email");
      const passwordInput = screen.getByLabelText("Password");
      const submitButton = screen.getByRole("button", { name: "Sign in" });

      fireEvent.change(emailInput, { target: { value: "test@example.com" } });
      fireEvent.change(passwordInput, { target: { value: "wrongpassword" } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/invalid email or password/i)).toBeInTheDocument();
      });
    });
  });

  describe("OAuth Interactions", () => {
    it("should call signInWithProvider when Google button is clicked", async () => {
      renderLoginPage();
      mockSignInWithProvider.mockResolvedValue({});

      const googleButton = screen.getByRole("button", { name: /google/i });

      fireEvent.click(googleButton);

      await waitFor(() => {
        expect(mockSignInWithProvider).toHaveBeenCalledWith("google");
      });
    });
  });
});
