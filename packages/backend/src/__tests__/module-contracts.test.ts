/**
 * Module Contract Tests
 * Verifies that all lib modules expose their expected interfaces
 */

import { describe, expect, it } from "vitest";

describe("Module Contracts", () => {
  describe("observability module", () => {
    it("should export createCounter with correct signature", async () => {
      const { createCounter } = await import("../lib/observability/index.js");
      const counter = createCounter("test_counter", "Test counter");

      expect(counter).toBeDefined();
      expect(typeof counter.inc).toBe("function");

      // Should not throw
      counter.inc();
      counter.inc(1);
      counter.inc({ label: "test" }, 1);
    });

    it("should export createHistogram with correct signature", async () => {
      const { createHistogram } = await import("../lib/observability/index.js");
      const histogram = createHistogram("test_histogram", "Test histogram");

      expect(histogram).toBeDefined();
      expect(typeof histogram.observe).toBe("function");

      // Should not throw
      histogram.observe(100);
      histogram.observe({ label: "test" }, 100);
    });

    it("should export createObservableGauge with correct signature", async () => {
      const { createObservableGauge } = await import("../lib/observability/index.js");
      const gauge = createObservableGauge("test_gauge", "Test gauge");

      expect(gauge).toBeDefined();
      expect(typeof gauge.set).toBe("function");

      // Should not throw
      gauge.set(42);
    });
  });

  describe("shutdown module", () => {
    it("should export registerShutdownHandler", async () => {
      const { registerShutdownHandler } = await import("../lib/shutdown/gracefulShutdown.js");

      expect(typeof registerShutdownHandler).toBe("function");

      // Should not throw when registering handler
      registerShutdownHandler(async () => {
        // Test handler
      });
    });
  });

  describe("monitoring module", () => {
    it("should export required metrics", async () => {
      const metrics = await import("../lib/monitoring/metrics.js");

      expect(metrics.kafkaProducerEventsTotal).toBeDefined();
      expect(metrics.kafkaProducerLatency).toBeDefined();
      expect(metrics.kafkaProducerErrors).toBeDefined();

      expect(typeof metrics.kafkaProducerEventsTotal.inc).toBe("function");
      expect(typeof metrics.kafkaProducerLatency.observe).toBe("function");
      expect(typeof metrics.kafkaProducerErrors.inc).toBe("function");
    });
  });
});
