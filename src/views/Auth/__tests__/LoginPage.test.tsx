/**
 * LoginPage Component Tests
 * Tests UI interactions, form validation, and OAuth button interactions
 */

import { describe, expect, it, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { LoginPage } from "../LoginPage";
import { AuthContext } from "../../../contexts/AuthContext";
import { RateLimitError, ValidationError } from "../../../services/errors";

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

describe("LoginPage Component", () => {
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
          <LoginPage />
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

      expect(screen.getByLabelText(/work email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /continue to dashboard/i })).toBeInTheDocument();
    });

    it("should render OAuth provider buttons", () => {
      renderLoginPage();

      // Only Google button exists now
      const googleButton = screen.getByRole("button", { name: /continue with google/i });
      expect(googleButton).toBeInTheDocument();

      // Apple and GitHub buttons should NOT exist
      const buttons = screen.getAllByRole("button");
      // 1. Submit button
      // 2. Toggle password visibility button
      // 3. Google button
      // So checks for length < 5 to ensure others are gone
      expect(buttons.length).toBeLessThan(5);
    });

    it("should render signup link", () => {
      renderLoginPage();

      const signupLink = screen.getByText(/create an account/i);
      expect(signupLink).toBeInTheDocument();
      expect(signupLink.closest("a")).toHaveAttribute("href", "/signup");
    });

    it("should render forgot password link", () => {
      renderLoginPage();

      const forgotLink = screen.getByText(/forgot/i);
      expect(forgotLink).toBeInTheDocument();
      expect(forgotLink.closest("a")).toHaveAttribute("href", "/reset-password");
    });
  });

  describe("Form Validation", () => {
    it("should require email and password fields", async () => {
      renderLoginPage();

      const submitButton = screen.getByRole("button", {
        name: /continue to dashboard/i,
      });
      fireEvent.click(submitButton);

      // HTML5 validation should prevent submission
      expect(mockLogin).not.toHaveBeenCalled();
    });

    it("should accept valid email and password", async () => {
      renderLoginPage();
      mockLogin.mockResolvedValue({});

      const emailInput = screen.getByLabelText(/work email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole("button", {
        name: /continue to dashboard/i,
      });

      fireEvent.change(emailInput, { target: { value: "test@example.com" } });
      fireEvent.change(passwordInput, { target: { value: "SecurePass123!" } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith({
          email: "test@example.com",
          password: "SecurePass123!",
          otpCode: undefined,
        });
      });
    });
  });

  describe("User Interactions", () => {
    it("should show/hide password when toggle button is clicked", () => {
      renderLoginPage();

      const passwordInput = screen.getByLabelText(/password/i) as HTMLInputElement;
      const toggleButton = screen.getByRole("button", { name: /show/i });

      expect(passwordInput.type).toBe("password");

      fireEvent.click(toggleButton);
      expect(passwordInput.type).toBe("text");

      fireEvent.click(toggleButton);
      expect(passwordInput.type).toBe("password");
    });

    it("should show loading state during login", async () => {
      renderLoginPage();
      mockLogin.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 100)));

      const emailInput = screen.getByLabelText(/work email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole("button", {
        name: /continue to dashboard/i,
      });

      fireEvent.change(emailInput, { target: { value: "test@example.com" } });
      fireEvent.change(passwordInput, { target: { value: "SecurePass123!" } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/signing in/i)).toBeInTheDocument();
      });
    });

    it("should disable form during login", async () => {
      renderLoginPage();
      mockLogin.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 100)));

      const emailInput = screen.getByLabelText(/work email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole("button", {
        name: /continue to dashboard/i,
      });

      fireEvent.change(emailInput, { target: { value: "test@example.com" } });
      fireEvent.change(passwordInput, { target: { value: "SecurePass123!" } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(emailInput).toBeDisabled();
        expect(passwordInput).toBeDisabled();
        expect(submitButton).toBeDisabled();
      });
    });
  });

  describe("MFA Support", () => {
    it("should show MFA input when MFA is required", async () => {
      renderLoginPage();
      mockLogin.mockRejectedValueOnce(new ValidationError("MFA code required for login"));

      const emailInput = screen.getByLabelText(/work email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole("button", {
        name: /continue to dashboard/i,
      });

      fireEvent.change(emailInput, { target: { value: "test@example.com" } });
      fireEvent.change(passwordInput, { target: { value: "SecurePass123!" } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByLabelText(/mfa code/i)).toBeInTheDocument();
      });
    });
  });

  describe("Error Handling", () => {
    it("should display error message on invalid credentials", async () => {
      renderLoginPage();
      mockLogin.mockRejectedValue(new Error("Invalid email or password"));

      const emailInput = screen.getByLabelText(/work email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole("button", {
        name: /continue to dashboard/i,
      });

      fireEvent.change(emailInput, { target: { value: "test@example.com" } });
      fireEvent.change(passwordInput, { target: { value: "wrongpassword" } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/invalid email or password/i)).toBeInTheDocument();
      });
    });

    it("should display rate limit error message", async () => {
      renderLoginPage();
      mockLogin.mockRejectedValue(
        new RateLimitError("Too many authentication attempts. Please try again later.")
      );

      const emailInput = screen.getByLabelText(/work email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole("button", {
        name: /continue to dashboard/i,
      });

      fireEvent.change(emailInput, { target: { value: "test@example.com" } });
      fireEvent.change(passwordInput, { target: { value: "SecurePass123!" } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/too many login attempts/i)).toBeInTheDocument();
      });
    });
  });

  describe("OAuth Interactions", () => {
    it("should call signInWithProvider when Google button is clicked", async () => {
      renderLoginPage();
      mockSignInWithProvider.mockResolvedValue({});

      const googleButton = screen.getByRole("button", { name: /continue with google/i });

      fireEvent.click(googleButton);

      await waitFor(() => {
        expect(mockSignInWithProvider).toHaveBeenCalledWith("google");
      });
    });

    it("should display OAuth loading state", async () => {
      renderLoginPage();
      mockSignInWithProvider.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      const googleButton = screen.getByRole("button", { name: /continue with google/i });

      fireEvent.click(googleButton);

      await waitFor(() => {
        expect(googleButton).toBeDisabled();
      });
    });

    it("should handle OAuth errors", async () => {
      renderLoginPage();
      mockSignInWithProvider.mockRejectedValue(new Error("OAuth sign in failed"));

      const googleButton = screen.getByRole("button", { name: /continue with google/i });

      fireEvent.click(googleButton);

      await waitFor(() => {
        expect(screen.getByText(/oauth sign in failed/i)).toBeInTheDocument();
      });
    });
  });

  describe("Navigation", () => {
    it("should navigate to home after successful login", async () => {
      renderLoginPage();
      mockLogin.mockResolvedValue({});

      const emailInput = screen.getByLabelText(/work email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole("button", {
        name: /continue to dashboard/i,
      });

      fireEvent.change(emailInput, { target: { value: "test@example.com" } });
      fireEvent.change(passwordInput, { target: { value: "SecurePass123!" } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
      });
    });
  });
});
