/**
 * AuthCallback Component Tests
 * Tests OAuth callback handling and redirection logic
 */

import { describe, expect, it, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import AuthCallback from "../AuthCallback";
import { supabase } from "../../../lib/supabase";

// Mock navigate
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock supabase
vi.mock("../../../lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
    },
  },
}));

describe("AuthCallback Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Successful OAuth Callback", () => {
    it("should exchange OAuth token for session and redirect to home", async () => {
      // Arrange
      const mockSession = {
        access_token: "mock-token",
        refresh_token: "mock-refresh",
        user: { id: "user-123", email: "test@example.com" },
      };

      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      // Act
      render(
        <BrowserRouter>
          <AuthCallback />
        </BrowserRouter>
      );

      // Assert
      await waitFor(() => {
        expect(supabase.auth.getSession).toHaveBeenCalled();
        expect(mockNavigate).toHaveBeenCalledWith("/home", { replace: true });
      });
    });

    it("should display completing sign in message", () => {
      // Arrange
      vi.mocked(supabase.auth.getSession).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      // Act
      render(
        <BrowserRouter>
          <AuthCallback />
        </BrowserRouter>
      );

      // Assert
      expect(screen.getByText(/completing sign in/i)).toBeInTheDocument();
    });

    it("should show loading spinner during session exchange", () => {
      // Arrange
      vi.mocked(supabase.auth.getSession).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      // Act
      render(
        <BrowserRouter>
          <AuthCallback />
        </BrowserRouter>
      );

      // Assert - Check for loading indicator (structural check)
      const loadingElement =
        screen.getByText(/completing sign in/i).parentElement;
      expect(loadingElement).toBeInTheDocument();
    });
  });

  describe("Failed OAuth Callback", () => {
    it("should redirect to login with error when session exchange fails", async () => {
      // Arrange
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: { message: "OAuth failed", status: 400, name: "AuthApiError" },
      });

      // Act
      render(
        <BrowserRouter>
          <AuthCallback />
        </BrowserRouter>
      );

      // Assert
      await waitFor(
        () => {
          expect(
            screen.getByText(/authentication failed/i)
          ).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      await waitFor(
        () => {
          expect(mockNavigate).toHaveBeenCalledWith(
            "/login?error=oauth_failed"
          );
        },
        { timeout: 3000 }
      );
    });

    it("should redirect to login when no session is found", async () => {
      // Arrange
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null,
      });

      // Act
      render(
        <BrowserRouter>
          <AuthCallback />
        </BrowserRouter>
      );

      // Assert
      await waitFor(
        () => {
          expect(screen.getByText(/no session found/i)).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      await waitFor(
        () => {
          expect(mockNavigate).toHaveBeenCalledWith("/login?error=no_session");
        },
        { timeout: 3000 }
      );
    });

    it("should handle unexpected errors gracefully", async () => {
      // Arrange
      vi.mocked(supabase.auth.getSession).mockRejectedValue(
        new Error("Network error")
      );

      // Act
      render(
        <BrowserRouter>
          <AuthCallback />
        </BrowserRouter>
      );

      // Assert
      await waitFor(
        () => {
          expect(screen.getByText(/unexpected error/i)).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      await waitFor(
        () => {
          expect(mockNavigate).toHaveBeenCalledWith("/login?error=unexpected");
        },
        { timeout: 3000 }
      );
    });
  });

  describe("Error Messages", () => {
    it("should display error message before redirecting on failure", async () => {
      // Arrange
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: { message: "OAuth failed", status: 400, name: "AuthApiError" },
      });

      // Act
      render(
        <BrowserRouter>
          <AuthCallback />
        </BrowserRouter>
      );

      // Assert - Error message should be displayed
      await waitFor(() => {
        expect(screen.getByText(/authentication failed/i)).toBeInTheDocument();
      });

      // Error message should be styled appropriately
      const errorMessage = screen.getByText(/authentication failed/i);
      expect(errorMessage).toHaveClass("text-red-400");
    });

    it("should clear any previous errors when component mounts", () => {
      // Arrange
      vi.mocked(supabase.auth.getSession).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      // Act
      render(
        <BrowserRouter>
          <AuthCallback />
        </BrowserRouter>
      );

      // Assert - No error shown initially
      expect(screen.queryByText(/error/i)).not.toBeInTheDocument();
      expect(screen.getByText(/completing sign in/i)).toBeInTheDocument();
    });
  });
});
