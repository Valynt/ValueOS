/**
 * API Endpoint Tests - Health Check
 *
 * Tests for the health check endpoint:
 * - GET /health
 * - GET /health/ready
 * - GET /health/live
 */

import { describe, expect, it } from "vitest";

import { testAdminClient } from "../../setup";

describe("Health Check API Endpoints", () => {
  describe("GET /health", () => {
    it("should return 200 OK with health status", async () => {
      // Note: This assumes a health endpoint exists
      // If using Supabase Functions, adjust the implementation

      const response = await fetch("http://localhost:3000/health", {
        method: "GET",
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty("status");
      expect(data.status).toBe("healthy");
    });

    it("should include timestamp in response", async () => {
      const response = await fetch("http://localhost:3000/health");
      const data = await response.json();

      expect(data).toHaveProperty("timestamp");
      expect(new Date(data.timestamp)).toBeInstanceOf(Date);
    });

    it("should respond within 500ms", async () => {
      const start = Date.now();
      await fetch("http://localhost:3000/health");
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(500);
    });
  });

  describe("GET /health/ready", () => {
    it("should check database connectivity", async () => {
      const response = await fetch("http://localhost:3000/health/ready");

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty("database");
      expect(data.database).toBe("connected");
    });
  });

  describe("GET /health/live", () => {
    it("should return 200 if server is running", async () => {
      const response = await fetch("http://localhost:3000/health/live");

      expect(response.status).toBe(200);
    });
  });
});
