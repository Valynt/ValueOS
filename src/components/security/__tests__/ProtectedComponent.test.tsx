/**
 * Protected Component Unit Tests
 * Tests Zero Trust security wrapper with permission validation
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { ProtectedComponent } from "../ProtectedComponent";
import { UserClaims } from "@/types/security";
import * as useAuthModule from "@/hooks/useAuth";
import * as auditLogger from "@/services/security/auditLogger";

// Mock the useAuth hook
vi.mock("@/hooks/useAuth");
vi.mock("@/services/security/auditLogger");

describe("ProtectedComponent", () => {
  const mockLogSecurityEvent = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auditLogger.logSecurityEvent).mockImplementation(
      mockLogSecurityEvent
    );
  });

  const mockUser: UserClaims = {
    sub: "user-123",
    email: "test@example.com",
    roles: ["CFO"],
    permissions: ["VIEW_FINANCIALS", "APPROVE_RISK"],
    org_id: "org-456",
  };

  describe("Loading State", () => {
    it("shows loading skeleton when auth is loading", () => {
      vi.mocked(useAuthModule.useAuth).mockReturnValue({
        user: null,
        isLoading: true,
        isAuthenticated: false,
        signOut: vi.fn(),
      });

      const { container } = render(
        <ProtectedComponent
          requiredPermissions={["VIEW_FINANCIALS"]}
          resourceName="Test Resource"
        >
          <div>Protected Content</div>
        </ProtectedComponent>
      );

      expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
    });
  });

  describe("Access Granted", () => {
    it("renders children when user has required permissions", () => {
      vi.mocked(useAuthModule.useAuth).mockReturnValue({
        user: mockUser,
        isLoading: false,
        isAuthenticated: true,
        signOut: vi.fn(),
      });

      render(
        <ProtectedComponent
          requiredPermissions={["VIEW_FINANCIALS"]}
          resourceName="Financial Dashboard"
        >
          <div>Protected Content</div>
        </ProtectedComponent>
      );

      expect(screen.getByText("Protected Content")).toBeInTheDocument();
    });

    it("renders when user has multiple required permissions", () => {
      vi.mocked(useAuthModule.useAuth).mockReturnValue({
        user: mockUser,
        isLoading: false,
        isAuthenticated: true,
        signOut: vi.fn(),
      });

      render(
        <ProtectedComponent
          requiredPermissions={["VIEW_FINANCIALS", "APPROVE_RISK"]}
          resourceName="Risk Approval Panel"
        >
          <div>Risk Controls</div>
        </ProtectedComponent>
      );

      expect(screen.getByText("Risk Controls")).toBeInTheDocument();
    });
  });

  describe("Access Denied", () => {
    it("shows access denied UI when user lacks permissions", () => {
      const limitedUser: UserClaims = {
        ...mockUser,
        roles: ["ANALYST"],
        permissions: ["VIEW_TECHNICAL_DEBT"],
      };

      vi.mocked(useAuthModule.useAuth).mockReturnValue({
        user: limitedUser,
        isLoading: false,
        isAuthenticated: true,
        signOut: vi.fn(),
      });

      render(
        <ProtectedComponent
          requiredPermissions={["VIEW_FINANCIALS"]}
          resourceName="Financial Dashboard"
        >
          <div>Protected Content</div>
        </ProtectedComponent>
      );

      expect(screen.getByText("Access Restricted")).toBeInTheDocument();
      expect(screen.getByText(/Financial Dashboard/)).toBeInTheDocument();
      expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
    });

    it("shows missing permissions in error UI", () => {
      const limitedUser: UserClaims = {
        ...mockUser,
        roles: ["DEVELOPER"],
        permissions: ["VIEW_TECHNICAL_DEBT"],
      };

      vi.mocked(useAuthModule.useAuth).mockReturnValue({
        user: limitedUser,
        isLoading: false,
        isAuthenticated: true,
        signOut: vi.fn(),
      });

      render(
        <ProtectedComponent
          requiredPermissions={["VIEW_FINANCIALS", "ADMIN_SYSTEM"]}
          resourceName="Admin Panel"
        >
          <div>Admin Content</div>
        </ProtectedComponent>
      );

      expect(screen.getByText(/Missing:/)).toBeInTheDocument();
      expect(screen.getByText(/VIEW_FINANCIALS/)).toBeInTheDocument();
    });

    it("shows user roles in error UI", () => {
      const limitedUser: UserClaims = {
        ...mockUser,
        roles: ["ANALYST", "DEVELOPER"],
        permissions: ["VIEW_TECHNICAL_DEBT"],
      };

      vi.mocked(useAuthModule.useAuth).mockReturnValue({
        user: limitedUser,
        isLoading: false,
        isAuthenticated: true,
        signOut: vi.fn(),
      });

      render(
        <ProtectedComponent
          requiredPermissions={["VIEW_FINANCIALS"]}
          resourceName="Test"
        >
          <div>Content</div>
        </ProtectedComponent>
      );

      expect(
        screen.getByText(/Your roles: ANALYST, DEVELOPER/)
      ).toBeInTheDocument();
    });
  });

  describe("Audit Logging", () => {
    it("logs security event when access is denied", async () => {
      const limitedUser: UserClaims = {
        ...mockUser,
        roles: ["DEVELOPER"],
        permissions: ["VIEW_TECHNICAL_DEBT"],
      };

      vi.mocked(useAuthModule.useAuth).mockReturnValue({
        user: limitedUser,
        isLoading: false,
        isAuthenticated: true,
        signOut: vi.fn(),
      });

      render(
        <ProtectedComponent
          requiredPermissions={["VIEW_FINANCIALS"]}
          resourceName="Financial Dashboard"
        >
          <div>Protected Content</div>
        </ProtectedComponent>
      );

      await waitFor(() => {
        expect(mockLogSecurityEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            action: "ACCESS_DENIED",
            resource: "Financial Dashboard",
            userId: "user-123",
            requiredPermissions: ["VIEW_FINANCIALS"],
            userPermissions: ["VIEW_TECHNICAL_DEBT"],
          })
        );
      });
    });

    it("does not log when access is granted", async () => {
      vi.mocked(useAuthModule.useAuth).mockReturnValue({
        user: mockUser,
        isLoading: false,
        isAuthenticated: true,
        signOut: vi.fn(),
      });

      render(
        <ProtectedComponent
          requiredPermissions={["VIEW_FINANCIALS"]}
          resourceName="Financial Dashboard"
        >
          <div>Protected Content</div>
        </ProtectedComponent>
      );

      // Wait a bit to ensure no event was logged
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(mockLogSecurityEvent).not.toHaveBeenCalled();
    });

    it("logs anonymous user when not authenticated", async () => {
      vi.mocked(useAuthModule.useAuth).mockReturnValue({
        user: null,
        isLoading: false,
        isAuthenticated: false,
        signOut: vi.fn(),
      });

      render(
        <ProtectedComponent
          requiredPermissions={["VIEW_FINANCIALS"]}
          resourceName="Financial Dashboard"
        >
          <div>Protected Content</div>
        </ProtectedComponent>
      );

      await waitFor(() => {
        expect(mockLogSecurityEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: "anonymous",
            action: "ACCESS_DENIED",
          })
        );
      });
    });
  });

  describe("Custom Fallback", () => {
    it("renders custom fallback UI when provided", () => {
      vi.mocked(useAuthModule.useAuth).mockReturnValue({
        user: { ...mockUser, permissions: [] },
        isLoading: false,
        isAuthenticated: true,
        signOut: vi.fn(),
      });

      render(
        <ProtectedComponent
          requiredPermissions={["VIEW_FINANCIALS"]}
          resourceName="Test"
          fallback={<div>Custom Error Message</div>}
        >
          <div>Protected Content</div>
        </ProtectedComponent>
      );

      expect(screen.getByText("Custom Error Message")).toBeInTheDocument();
      expect(screen.queryByText("Access Restricted")).not.toBeInTheDocument();
    });
  });

  describe("Silent Mode", () => {
    it("renders nothing when silent and access denied", () => {
      vi.mocked(useAuthModule.useAuth).mockReturnValue({
        user: { ...mockUser, permissions: [] },
        isLoading: false,
        isAuthenticated: true,
        signOut: vi.fn(),
      });

      const { container } = render(
        <ProtectedComponent
          requiredPermissions={["VIEW_FINANCIALS"]}
          resourceName="Test"
          silent={true}
        >
          <div>Protected Content</div>
        </ProtectedComponent>
      );

      expect(container.firstChild).toBeNull();
    });
  });

  describe("Edge Cases", () => {
    it("handles unauthenticated user", () => {
      vi.mocked(useAuthModule.useAuth).mockReturnValue({
        user: null,
        isLoading: false,
        isAuthenticated: false,
        signOut: vi.fn(),
      });

      render(
        <ProtectedComponent
          requiredPermissions={["VIEW_FINANCIALS"]}
          resourceName="Dashboard"
        >
          <div>Protected Content</div>
        </ProtectedComponent>
      );

      expect(screen.getByText("Access Restricted")).toBeInTheDocument();
      expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
    });

    it("handles empty required permissions array", () => {
      vi.mocked(useAuthModule.useAuth).mockReturnValue({
        user: mockUser,
        isLoading: false,
        isAuthenticated: true,
        signOut: vi.fn(),
      });

      render(
        <ProtectedComponent
          requiredPermissions={[]}
          resourceName="Public Resource"
        >
          <div>Should Always Render</div>
        </ProtectedComponent>
      );

      // Empty permissions means no restrictions
      expect(screen.getByText("Should Always Render")).toBeInTheDocument();
    });
  });
});
