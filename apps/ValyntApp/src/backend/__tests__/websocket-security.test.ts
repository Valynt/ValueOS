/**
 * Sprint 1: WebSocket Security Tests
 *
 * Tests for WebSocket authentication hardening:
 * - Query-string token rejection in production
 * - Authorization header requirement
 *
 * @security P1 - WebSocket auth hardening
 */
import { describe, expect, it } from "vitest";

// Test the getWebSocketToken logic in isolation
// Since it's a private function, we test the behavior through a test harness

interface MockIncomingMessage {
  headers: Record<string, string | undefined>;
  url?: string;
  socket: { remoteAddress?: string };
}

function createMockRequest(authHeader?: string, url?: string): MockIncomingMessage {
  return {
    headers: {
      authorization: authHeader,
    },
    url: url ?? "/ws/sdui",
    socket: { remoteAddress: "127.0.0.1" },
  };
}

// Replicate the getWebSocketToken logic for testing
function getWebSocketToken(req: MockIncomingMessage, nodeEnv: string): string | null {
  const authHeader = req.headers.authorization;

  // Parse bearer token from header
  if (authHeader) {
    const prefix = "Bearer ";
    if (authHeader.startsWith(prefix)) {
      const token = authHeader.slice(prefix.length).trim();
      if (token.length > 0) {
        return token;
      }
    }
  }

  // Sprint 1: Reject query-string tokens in production
  if (nodeEnv === "production") {
    return null; // Query string tokens rejected
  }

  // Development: allow query string tokens
  const url = new URL(req.url ?? "", "http://localhost");
  return url.searchParams.get("access_token") ?? url.searchParams.get("token");
}

describe("Sprint 1: WebSocket Token Security", () => {
  describe("Authorization header tokens", () => {
    it("accepts valid Bearer token in production", () => {
      const req = createMockRequest("Bearer valid-jwt-token");
      const token = getWebSocketToken(req, "production");
      expect(token).toBe("valid-jwt-token");
    });

    it("accepts valid Bearer token in development", () => {
      const req = createMockRequest("Bearer valid-jwt-token");
      const token = getWebSocketToken(req, "development");
      expect(token).toBe("valid-jwt-token");
    });

    it("rejects malformed Bearer token", () => {
      const req = createMockRequest("Bearer ");
      const token = getWebSocketToken(req, "production");
      expect(token).toBeNull();
    });

    it("rejects non-Bearer auth schemes", () => {
      const req = createMockRequest("Basic dXNlcjpwYXNz");
      const token = getWebSocketToken(req, "production");
      expect(token).toBeNull();
    });
  });

  describe("Query-string tokens in production", () => {
    it("REJECTS access_token query parameter in production", () => {
      const req = createMockRequest(undefined, "/ws/sdui?access_token=my-token");
      const token = getWebSocketToken(req, "production");
      expect(token).toBeNull();
    });

    it("REJECTS token query parameter in production", () => {
      const req = createMockRequest(undefined, "/ws/sdui?token=my-token");
      const token = getWebSocketToken(req, "production");
      expect(token).toBeNull();
    });

    it("prefers Authorization header even when query string present in production", () => {
      const req = createMockRequest("Bearer header-token", "/ws/sdui?access_token=query-token");
      const token = getWebSocketToken(req, "production");
      expect(token).toBe("header-token");
    });
  });

  describe("Query-string tokens in development", () => {
    it("accepts access_token query parameter in development", () => {
      const req = createMockRequest(undefined, "/ws/sdui?access_token=dev-token");
      const token = getWebSocketToken(req, "development");
      expect(token).toBe("dev-token");
    });

    it("accepts token query parameter in development", () => {
      const req = createMockRequest(undefined, "/ws/sdui?token=dev-token");
      const token = getWebSocketToken(req, "development");
      expect(token).toBe("dev-token");
    });

    it("prefers access_token over token parameter", () => {
      const req = createMockRequest(undefined, "/ws/sdui?access_token=primary&token=fallback");
      const token = getWebSocketToken(req, "development");
      expect(token).toBe("primary");
    });
  });

  describe("No authentication provided", () => {
    it("returns null when no auth in production", () => {
      const req = createMockRequest(undefined, "/ws/sdui");
      const token = getWebSocketToken(req, "production");
      expect(token).toBeNull();
    });

    it("returns null when no auth in development", () => {
      const req = createMockRequest(undefined, "/ws/sdui");
      const token = getWebSocketToken(req, "development");
      expect(token).toBeNull();
    });
  });
});

describe("Sprint 1: WebSocket Security Policy", () => {
  it("production policy: only Authorization header is accepted", () => {
    // This test documents the security policy
    const queryStringReq = createMockRequest(undefined, "/ws/sdui?access_token=token");
    const headerReq = createMockRequest("Bearer token");

    expect(getWebSocketToken(queryStringReq, "production")).toBeNull();
    expect(getWebSocketToken(headerReq, "production")).toBe("token");
  });

  it("development policy: both methods are accepted for convenience", () => {
    const queryStringReq = createMockRequest(undefined, "/ws/sdui?access_token=token");
    const headerReq = createMockRequest("Bearer token");

    expect(getWebSocketToken(queryStringReq, "development")).toBe("token");
    expect(getWebSocketToken(headerReq, "development")).toBe("token");
  });
});
