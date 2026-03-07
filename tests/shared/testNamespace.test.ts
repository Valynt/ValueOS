import { describe, expect, it } from "vitest";

import { testNamespace } from "./testNamespace";

describe("testNamespace", () => {
  it("sanitizes segments and uses a deterministic suffix", () => {
    const namespace = testNamespace(["WF-1", "Tenant Isolation"], {
      prefix: "Matrix",
      salt: "fixed",
    });

    expect(namespace).toMatch(/^matrix-wf-1-tenant-isolation-[a-f0-9]{8}$/);
    expect(namespace).toBe(
      testNamespace(["WF-1", "Tenant Isolation"], {
        prefix: "Matrix",
        salt: "fixed",
      }),
    );
  });

  it("enforces max length", () => {
    const namespace = testNamespace(["very-long-component-name".repeat(6)], {
      maxLength: 32,
      salt: "fixed",
    });

    expect(namespace.length).toBeLessThanOrEqual(32);
  });
});
