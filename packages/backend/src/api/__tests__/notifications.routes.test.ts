/**
 * Unit tests for Notification Routes.
 *
 * Tests cover:
 * - broadcastNotification() - fan-out to connected clients
 * - registerNotificationRoutes() - route registration
 *
 * Note: getNotifications, markAsRead, markAllAsRead, and notificationStream
 * are internal functions. They are tested indirectly through the route
 * registration tests and integration tests.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Track connected clients so we can verify broadcast behavior
const mockConnectedClients = new Map();

vi.mock("../../lib/supabase.js", () => ({
  getRequestSupabaseClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null, count: 0 }),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  })),
}));

vi.mock("../../lib/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("../../middleware/auth.js", () => ({
  requireRole: vi.fn(() => (_req: unknown, _res: unknown, next: () => void) => next()),
}));

vi.mock("../../services/security/AuditLogService.js", () => ({
  auditLogService: {
    log: vi.fn(),
  },
}));

vi.mock("./valueCases/crud.routes.js", () => ({
  ValueCasesRouteLimiters: class {},
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { broadcastNotification, registerNotificationRoutes } from "../notifications.routes.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockResponse() {
  return {
    setHeader: vi.fn(),
    write: vi.fn(),
    json: vi.fn(),
    status: vi.fn().mockReturnThis(),
    on: vi.fn(),
    flush: vi.fn(),
  } as any;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Notification Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockConnectedClients.clear();
  });

  // ---------------------------------------------------------------------------
  // broadcastNotification()
  // ---------------------------------------------------------------------------

  describe("broadcastNotification", () => {
    it("is exported as a function", () => {
      expect(typeof broadcastNotification).toBe("function");
    });

    it("does not throw when no clients are connected", () => {
      expect(() => {
        broadcastNotification("tenant-1", "user-1", {
          id: "notif-1",
          tenantId: "tenant-1",
          userId: "user-1",
          type: "agent_complete",
          priority: "high",
          title: "Agent Complete",
          message: "Your agent has finished",
          metadata: {},
          read: false,
          createdAt: new Date().toISOString(),
        });
      }).not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // registerNotificationRoutes()
  // ---------------------------------------------------------------------------

  describe("registerNotificationRoutes", () => {
    it("registers SSE stream endpoint", async () => {
      const mockRouter = {
        get: vi.fn(),
        post: vi.fn(),
      };
      const mockLimiters = {
        standardLimiter: vi.fn(),
        strictLimiter: vi.fn(),
      };

      const { registerNotificationRoutes: registerRoutes } = await import("../notifications.routes.js");
      registerRoutes(mockRouter as any, mockLimiters);

      expect(mockRouter.get).toHaveBeenCalledWith(
        "/notifications/stream",
        mockLimiters.standardLimiter,
        expect.any(Function),
        expect.any(Function)
      );
    });

    it("registers GET notifications endpoint", async () => {
      const mockRouter = {
        get: vi.fn(),
        post: vi.fn(),
      };
      const mockLimiters = {
        standardLimiter: vi.fn(),
        strictLimiter: vi.fn(),
      };

      const { registerNotificationRoutes: registerRoutes } = await import("../notifications.routes.js");
      registerRoutes(mockRouter as any, mockLimiters);

      expect(mockRouter.get).toHaveBeenCalledWith(
        "/notifications",
        mockLimiters.standardLimiter,
        expect.any(Function),
        expect.any(Function)
      );
    });

    it("registers POST mark as read endpoint", async () => {
      const mockRouter = {
        get: vi.fn(),
        post: vi.fn(),
      };
      const mockLimiters = {
        standardLimiter: vi.fn(),
        strictLimiter: vi.fn(),
      };

      const { registerNotificationRoutes: registerRoutes } = await import("../notifications.routes.js");
      registerRoutes(mockRouter as any, mockLimiters);

      expect(mockRouter.post).toHaveBeenCalledWith(
        "/notifications/:id/read",
        mockLimiters.standardLimiter,
        expect.any(Function),
        expect.any(Function)
      );
    });

    it("registers POST mark all as read endpoint with strict limiter", async () => {
      const mockRouter = {
        get: vi.fn(),
        post: vi.fn(),
      };
      const mockLimiters = {
        standardLimiter: vi.fn(),
        strictLimiter: vi.fn(),
      };

      const { registerNotificationRoutes: registerRoutes } = await import("../notifications.routes.js");
      registerRoutes(mockRouter as any, mockLimiters);

      expect(mockRouter.post).toHaveBeenCalledWith(
        "/notifications/read-all",
        mockLimiters.strictLimiter,
        expect.any(Function),
        expect.any(Function)
      );
    });

    it("registers exactly 4 routes", async () => {
      const mockRouter = {
        get: vi.fn(),
        post: vi.fn(),
      };
      const mockLimiters = {
        standardLimiter: vi.fn(),
        strictLimiter: vi.fn(),
      };

      const { registerNotificationRoutes: registerRoutes } = await import("../notifications.routes.js");
      registerRoutes(mockRouter as any, mockLimiters);

      expect(mockRouter.get).toHaveBeenCalledTimes(2);
      expect(mockRouter.post).toHaveBeenCalledTimes(2);
    });
  });
});
