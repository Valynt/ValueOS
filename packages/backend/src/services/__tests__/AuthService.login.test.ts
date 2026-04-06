/**
 * AuthService Login Unit Tests
 * Tests user authentication functionality including credentials validation, MFA, and rate limiting
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createAuthErrorResponse,
  createLoginCredentials,
  createSuccessfulLoginResponse,
  TEST_EMAILS,
  TEST_PASSWORDS,
} from "../../test-utils/auth.fixtures";
import { resetAuthMocks, setupAuthMocks } from "../../test-utils/auth.helpers";
import { AuthService } from "../AuthService.js"
import { AuthenticationError, RateLimitError, ValidationError } from "../errors.js"

// Setup mocks
const mocks = setupAuthMocks();

vi.mock("../../lib/supabase", () => ({
  assertNotTestEnv: vi.fn(),
  supabase: { auth: mocks.mockSupabaseAuth },
}));

vi.mock("../../security", async () => {
  const actual = await vi.importActual<typeof import("../../security")>("../../security");
  return {
    ...actual,
    consumeAuthRateLimit: mocks.mockConsumeAuthRateLimit,
    resetRateLimit: mocks.mockResetRateLimit,
    checkPasswordBreach: mocks.mockCheckPasswordBreach,
  };
});

vi.mock("../../config/environment", async () => {
  const actual = await vi.importActual<typeof import("../../config/environment")>(
    "../../config/environment"
  );
  return {
    ...actual,
    getConfig: mocks.mockGetConfig,
  };
});

vi.mock("../ClientRateLimit", () => ({
  clientRateLimit: mocks.mockClientRateLimit,
}));

describe("AuthService - Login", () => {
  let service: AuthService;

  beforeEach(() => {
    service = new AuthService();
    resetAuthMocks(mocks);
    mocks.mockGetConfig.mockReturnValue({ auth: { mfaEnabled: false } });
    mocks.mockClientRateLimit.checkLimit.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Successful Login", () => {
    it("should successfully login with valid credentials", async () => {
      // Arrange
      const credentials = createLoginCredentials();
      const mockResponse = createSuccessfulLoginResponse();
      mocks.mockSupabaseAuth.signInWithPassword.mockResolvedValue(mockResponse);

      // Act
      const result = await service.login(credentials);

      // Assert
      expect(result).toBeDefined();
      expect(result.user).toEqual(mockResponse.data.user);
      expect(result.session).toEqual(mockResponse.data.session);
      expect(mocks.mockSupabaseAuth.signInWithPassword).toHaveBeenCalledWith({
        email: credentials.email,
        password: credentials.password,
        options: {
          captchaToken: undefined,
        },
      });
    });

    it("should reset rate limit after successful login", async () => {
      // Arrange
      const credentials = createLoginCredentials();
      const mockResponse = createSuccessfulLoginResponse();
      mocks.mockSupabaseAuth.signInWithPassword.mockResolvedValue(mockResponse);

      // Act
      await service.login(credentials);

      // Assert
      expect(mocks.mockResetRateLimit).toHaveBeenCalledWith("auth", credentials.email);
    });

    it("should create session with valid credentials", async () => {
      // Arrange
      const credentials = createLoginCredentials();
      const mockResponse = createSuccessfulLoginResponse();
      mocks.mockSupabaseAuth.signInWithPassword.mockResolvedValue(mockResponse);

      // Act
      const result = await service.login(credentials);

      // Assert
      expect(result.session).toBeDefined();
      expect(result.session.access_token).toBeDefined();
      expect(result.session.refresh_token).toBeDefined();
    });
  });

  describe("Invalid Credentials", () => {
    it("should throw AuthenticationError for invalid email", async () => {
      // Arrange
      const credentials = createLoginCredentials({ email: TEST_EMAILS.invalid });
      mocks.mockSupabaseAuth.signInWithPassword.mockResolvedValue(
        createAuthErrorResponse("Invalid login credentials")
      );

      // Act & Assert
      await expect(service.login(credentials)).rejects.toThrow(AuthenticationError);
      await expect(service.login(credentials)).rejects.toThrow("Invalid credentials");
    });

    it("should throw AuthenticationError for invalid password", async () => {
      // Arrange
      const credentials = createLoginCredentials();
      mocks.mockSupabaseAuth.signInWithPassword.mockResolvedValue(
        createAuthErrorResponse("Invalid login credentials")
      );

      // Act & Assert
      await expect(service.login(credentials)).rejects.toThrow(AuthenticationError);
      await expect(service.login(credentials)).rejects.toThrow("Invalid credentials");
    });

    it("should throw AuthenticationError when user is null in response", async () => {
      // Arrange
      const credentials = createLoginCredentials();
      mocks.mockSupabaseAuth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: null,
      });

      // Act & Assert
      await expect(service.login(credentials)).rejects.toThrow(AuthenticationError);
      await expect(service.login(credentials)).rejects.toThrow("Invalid credentials");
    });

    it("should throw AuthenticationError when session is null in response", async () => {
      // Arrange
      const credentials = createLoginCredentials();
      const mockResponse = createSuccessfulLoginResponse();
      mocks.mockSupabaseAuth.signInWithPassword.mockResolvedValue({
        ...mockResponse,
        data: { ...mockResponse.data, session: null },
      });

      // Act & Assert
      await expect(service.login(credentials)).rejects.toThrow(AuthenticationError);
      await expect(service.login(credentials)).rejects.toThrow("Invalid credentials");
    });
  });

  describe("MFA Support", () => {
    it("should require MFA code when MFA is enabled", async () => {
      // Arrange
      mocks.mockGetConfig.mockReturnValue({ auth: { mfaEnabled: true } });
      const credentials = createLoginCredentials();

      // Act & Assert
      await expect(service.login(credentials)).rejects.toThrow(ValidationError);
      await expect(service.login(credentials)).rejects.toThrow("MFA code required");
    });

    it("should successfully login with MFA code when MFA is enabled", async () => {
      // Arrange
      mocks.mockGetConfig.mockReturnValue({ auth: { mfaEnabled: true } });
      const credentials = createLoginCredentials({ otpCode: "123456" });
      const mockResponse = createSuccessfulLoginResponse();
      mocks.mockSupabaseAuth.signInWithPassword.mockResolvedValue(mockResponse);

      // Act
      const result = await service.login(credentials);

      // Assert
      expect(result).toBeDefined();
      expect(mocks.mockSupabaseAuth.signInWithPassword).toHaveBeenCalledWith({
        email: credentials.email,
        password: credentials.password,
        options: {
          captchaToken: "123456",
        },
      });
    });

    it("should allow login without MFA code when MFA is disabled", async () => {
      // Arrange
      mocks.mockGetConfig.mockReturnValue({ auth: { mfaEnabled: false } });
      const credentials = createLoginCredentials();
      const mockResponse = createSuccessfulLoginResponse();
      mocks.mockSupabaseAuth.signInWithPassword.mockResolvedValue(mockResponse);

      // Act
      const result = await service.login(credentials);

      // Assert
      expect(result).toBeDefined();
    });
  });

  describe("Rate Limiting", () => {
    it("should enforce client-side rate limiting", async () => {
      // Arrange
      const credentials = createLoginCredentials();

      // Act
      await expect(service.login(credentials)).rejects.toThrow();

      // Assert
      expect(mocks.mockClientRateLimit.checkLimit).toHaveBeenCalledWith("auth-attempts");
    });

    it("should throw RateLimitError when client rate limit exceeded", async () => {
      // Arrange
      const credentials = createLoginCredentials();
      mocks.mockClientRateLimit.checkLimit.mockResolvedValue(false);

      // Act & Assert
      await expect(service.login(credentials)).rejects.toThrow(RateLimitError);
      await expect(service.login(credentials)).rejects.toThrow(/Too many authentication attempts/);
      expect(mocks.mockSupabaseAuth.signInWithPassword).not.toHaveBeenCalled();
    });

    it("should enforce server-side rate limiting", async () => {
      // Arrange
      const credentials = createLoginCredentials();
      const mockResponse = createSuccessfulLoginResponse();
      mocks.mockSupabaseAuth.signInWithPassword.mockResolvedValue(mockResponse);

      // Act
      await service.login(credentials);

      // Assert
      expect(mocks.mockConsumeAuthRateLimit).toHaveBeenCalledWith(credentials.email);
    });

    it("should throw RateLimitError when server rate limit exceeded", async () => {
      // Arrange
      const credentials = createLoginCredentials();
      const { RateLimitExceededError } = await import("../../security");
      mocks.mockConsumeAuthRateLimit.mockImplementation(() => {
        throw new RateLimitExceededError(1000, 5, 300000);
      });

      // Act & Assert
      await expect(service.login(credentials)).rejects.toThrow(RateLimitError);
      await expect(service.login(credentials)).rejects.toThrow(/Too many authentication attempts/);
      expect(mocks.mockSupabaseAuth.signInWithPassword).not.toHaveBeenCalled();
    });
  });

  describe("Field Validation", () => {
    it("should throw ValidationError when email is missing", async () => {
      // Arrange
      const credentials = { password: "SecurePass123!" } as any;

      // Act & Assert
      await expect(service.login(credentials)).rejects.toThrow("Missing required fields: email");
      expect(mocks.mockSupabaseAuth.signInWithPassword).not.toHaveBeenCalled();
    });

    it("should throw ValidationError when password is missing", async () => {
      // Arrange
      const credentials = { email: "test@example.com" } as any;

      // Act & Assert
      await expect(service.login(credentials)).rejects.toThrow("Missing required fields: password");
      expect(mocks.mockSupabaseAuth.signInWithPassword).not.toHaveBeenCalled();
    });

    it("should throw ValidationError when both email and password are missing", async () => {
      // Arrange
      const credentials = {} as any;

      // Act & Assert
      await expect(service.login(credentials)).rejects.toThrow("Missing required fields");
      expect(mocks.mockSupabaseAuth.signInWithPassword).not.toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    it("should handle Supabase errors gracefully", async () => {
      // Arrange
      const credentials = createLoginCredentials();
      mocks.mockSupabaseAuth.signInWithPassword.mockResolvedValue(
        createAuthErrorResponse("Service unavailable")
      );

      // Act & Assert
      await expect(service.login(credentials)).rejects.toThrow(AuthenticationError);
    });

    it("should sanitize error messages from Supabase", async () => {
      // Arrange
      const credentials = createLoginCredentials();
      mocks.mockSupabaseAuth.signInWithPassword.mockResolvedValue(
        createAuthErrorResponse("Detailed Supabase error message")
      );

      // Act & Assert
      await expect(service.login(credentials)).rejects.toThrow(AuthenticationError);
      await expect(service.login(credentials)).rejects.toThrow("Invalid credentials");
    });
  });
});
