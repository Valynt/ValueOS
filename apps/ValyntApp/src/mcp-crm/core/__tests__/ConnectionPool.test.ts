/**
 * Connection Pool Tests
 *
 * Comprehensive tests for the connection pool implementation
 * including resource management, health checking, and cleanup.
 */

import { ConnectionPool, ConnectionConfig, HTTPConnectionPool } from "../../../lib/connection-pool";

describe("ConnectionPool", () => {
  let pool: ConnectionPool<MockConnection>;

  interface MockConnection {
    id: string;
    createdAt: number;
    isHealthy: boolean;
    closeCount: number;
  }

  const createMockConnection = (id: string): MockConnection => ({
    id,
    createdAt: Date.now(),
    isHealthy: true,
    closeCount: 0,
  });

  const mockHealthCheck = async (connection: MockConnection): Promise<boolean> => {
    return connection.isHealthy;
  };

  beforeEach(() => {
    pool = new ConnectionPool<MockConnection>({
      maxConnections: 5,
      timeout: 5000,
      healthCheckInterval: 1000,
      maxIdleTime: 2000,
    });
  });

  afterEach(async () => {
    await pool.destroy();
  });

  describe("Basic Operations", () => {
    it("should acquire and release connections", async () => {
      const connection = await pool.acquire("test1", () =>
        Promise.resolve(createMockConnection("conn1"))
      );

      expect(connection.id).toBe("conn1");
      expect(connection.createdAt).toBeDefined();

      pool.release("test1");

      // Should be able to acquire again
      const connection2 = await pool.acquire("test1", () =>
        Promise.resolve(createMockConnection("conn2"))
      );
      expect(connection2.id).toBe("conn1"); // Same connection reused
    });

    it("should create new connections when none exist", async () => {
      const connection = await pool.acquire("new1", () =>
        Promise.resolve(createMockConnection("new1"))
      );

      expect(connection.id).toBe("new1");
      expect(pool.getStats().total).toBe(1);
    });

    it("should reuse existing healthy connections", async () => {
      await pool.acquire("reuse1", () => Promise.resolve(createMockConnection("reuse1")));
      pool.release("reuse1");

      const connection = await pool.acquire("reuse1", () =>
        Promise.resolve(createMockConnection("reuse2"))
      );

      expect(connection.id).toBe("reuse1");
      expect(pool.getStats().total).toBe(1);
    });

    it("should remove connections explicitly", async () => {
      await pool.acquire("remove1", () => Promise.resolve(createMockConnection("remove1")));

      pool.remove("remove1");
      expect(pool.getStats().total).toBe(0);

      // Should create new connection on next acquire
      const connection = await pool.acquire("remove1", () =>
        Promise.resolve(createMockConnection("remove2"))
      );
      expect(connection.id).toBe("remove2");
    });
  });

  describe("Connection Limits", () => {
    it("should enforce maximum connection limit", async () => {
      // Fill up the pool
      for (let i = 0; i < 5; i++) {
        await pool.acquire(`conn${i}`, () => Promise.resolve(createMockConnection(`conn${i}`)));
      }

      expect(pool.getStats().total).toBe(5);

      // Next acquire should remove oldest connection
      const connection = await pool.acquire("conn6", () =>
        Promise.resolve(createMockConnection("conn6"))
      );

      expect(connection.id).toBe("conn6");
      expect(pool.getStats().total).toBe(5); // Still at max
    });

    it("should cleanup oldest connections when at limit", async () => {
      // Fill pool
      for (let i = 0; i < 5; i++) {
        await pool.acquire(`old${i}`, () => Promise.resolve(createMockConnection(`old${i}`)));
        pool.release(`old${i}`);
      }

      // Wait a bit to make some connections old
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Add one more to trigger cleanup
      await pool.acquire("new1", () => Promise.resolve(createMockConnection("new1")));

      expect(pool.getStats().total).toBe(5);
    });
  });

  describe("Health Checking", () => {
    it("should check connection health", async () => {
      const connection = await pool.acquire("health1", () =>
        Promise.resolve(createMockConnection("health1"))
      );

      connection.isHealthy = false;

      await pool.checkHealth("health1", mockHealthCheck);
      expect(pool.getStats().total).toBe(0); // Unhealthy connection removed
    });

    it("should keep healthy connections", async () => {
      await pool.acquire("healthy1", () => Promise.resolve(createMockConnection("healthy1")));

      await pool.checkHealth("healthy1", mockHealthCheck);
      expect(pool.getStats().total).toBe(1); // Healthy connection kept
    });

    it("should handle health check failures gracefully", async () => {
      await pool.acquire("fail1", () => Promise.resolve(createMockConnection("fail1")));

      const failingHealthCheck = async (): Promise<boolean> => {
        throw new Error("Health check failed");
      };

      await pool.checkHealth("fail1", failingHealthCheck);
      expect(pool.getStats().total).toBe(0); // Failed health check removes connection
    });
  });

  describe("Idle Connection Cleanup", () => {
    it("should cleanup idle connections automatically", async () => {
      // Create connections and release them
      for (let i = 0; i < 3; i++) {
        await pool.acquire(`idle${i}`, () => Promise.resolve(createMockConnection(`idle${i}`)));
        pool.release(`idle${i}`);
      }

      expect(pool.getStats().total).toBe(3);

      // Wait for cleanup interval
      await new Promise((resolve) => setTimeout(resolve, 2500));

      // Connections should be cleaned up
      expect(pool.getStats().total).toBe(0);
    });

    it("should not cleanup active connections", async () => {
      await pool.acquire("active1", () => Promise.resolve(createMockConnection("active1")));
      // Don't release - keep it active

      // Wait for cleanup interval
      await new Promise((resolve) => setTimeout(resolve, 2500));

      expect(pool.getStats().total).toBe(1); // Active connection not cleaned up
    });
  });

  describe("Statistics", () => {
    it("should provide accurate statistics", async () => {
      // Create some connections
      await pool.acquire("stat1", () => Promise.resolve(createMockConnection("stat1")));
      await pool.acquire("stat2", () => Promise.resolve(createMockConnection("stat2")));
      pool.release("stat2");

      const stats = pool.getStats();
      expect(stats.total).toBe(2);
      expect(stats.active).toBe(1); // stat1 is still in use
      expect(stats.idle).toBe(1); // stat2 is idle
      expect(stats.unhealthy).toBe(0);
    });

    it("should track unhealthy connections", async () => {
      const connection = await pool.acquire("unhealthy1", () =>
        Promise.resolve(createMockConnection("unhealthy1"))
      );
      connection.isHealthy = false;

      await pool.checkHealth("unhealthy1", mockHealthCheck);

      const stats = pool.getStats();
      expect(stats.unhealthy).toBe(0); // Removed after health check
    });
  });

  describe("Resource Cleanup", () => {
    it("should destroy all connections", async () => {
      // Create multiple connections
      for (let i = 0; i < 3; i++) {
        await pool.acquire(`destroy${i}`, () =>
          Promise.resolve(createMockConnection(`destroy${i}`))
        );
      }

      expect(pool.getStats().total).toBe(3);

      await pool.destroy();
      expect(pool.getStats().total).toBe(0);
    });

    it("should handle cleanup of non-existent connections", () => {
      expect(() => pool.remove("nonexistent")).not.toThrow();
    });
  });

  describe("Error Handling", () => {
    it("should handle connection creation failures", async () => {
      const failingFactory = async (): Promise<MockConnection> => {
        throw new Error("Connection failed");
      };

      await expect(pool.acquire("fail", failingFactory)).rejects.toThrow("Connection failed");
      expect(pool.getStats().total).toBe(0);
    });

    it("should handle factory returning null/undefined", async () => {
      const nullFactory = async (): Promise<MockConnection | null> => {
        return null;
      };

      await expect(pool.acquire("null", nullFactory)).rejects.toThrow();
    });
  });
});

describe("HTTPConnectionPool", () => {
  let httpPool: HTTPConnectionPool;
  const mockBaseUrl = "https://api.example.com";
  const mockHeaders = { Authorization: "Bearer token123" };

  beforeEach(() => {
    httpPool = new HTTPConnectionPool(mockBaseUrl, mockHeaders, {
      maxConnections: 3,
      timeout: 5000,
    });
  });

  afterEach(async () => {
    await httpPool.destroy();
  });

  describe("HTTP Operations", () => {
    it("should make HTTP requests with correct headers", async () => {
      // Mock fetch
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: "test" }),
      });

      await httpPool.makeRequest("/test", {
        method: "GET",
        body: JSON.stringify({ test: true }),
      });

      expect(fetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/test`,
        expect.objectContaining({
          method: "GET",
          headers: {
            ...mockHeaders,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ test: true }),
        })
      );
    });

    it("should handle HTTP errors gracefully", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
      });

      const response = await httpPool.makeRequest("/notfound");
      expect(response.ok).toBe(false);
      expect(response.status).toBe(404);
    });

    it("should handle network errors", async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error("Network error"));

      await expect(httpPool.makeRequest("/error")).rejects.toThrow("Network error");
    });
  });
});
