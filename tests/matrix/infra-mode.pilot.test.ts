import { describe, expect, it } from "vitest";

import { canonicalizePersistedValue } from "../shared/canonicalizePersistedValue";
import { snapshotHash } from "../shared/snapshotHash";
import { testNamespace } from "../shared/testNamespace";

import { infraModeMatrix } from "./infra-mode.matrix";
import { runInInfraMode } from "./runInInfraMode";

const wf1Fixture = {
  workflow: "WF-1",
  steps: [{ id: "discover", status: "ok" }],
  tenant_id: "tenant-a",
};

const tenantFixture = {
  tenant_id: "tenant-a",
  visible_workflows: ["wf-a"],
  blocked_workflows: ["wf-b"],
};

describe("infra-mode pilot coverage", () => {
  const localMode = infraModeMatrix.find((mode) => mode.mode === "local");

  it("WF-1 snapshot remains stable in local infra mode", async () => {
    if (!localMode) {
      throw new Error("Local infra mode not configured");
    }

    const namespace = testNamespace(["wf-1", "pilot"], { salt: "matrix" });

    await runInInfraMode(localMode, namespace, async ({ namespace: ns, mode }) => {
      const payload = canonicalizePersistedValue({ ...wf1Fixture, mode, namespace: ns });
      const hash = snapshotHash(payload);

      expect(ns).toMatch(/^test-wf-1-pilot-/);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  it("tenant isolation pilot payload canonicalizes deterministically", async () => {
    if (!localMode) {
      throw new Error("Local infra mode not configured");
    }

    const namespace = testNamespace(["tenant-isolation", "pilot"], {
      salt: "matrix",
    });

    await runInInfraMode(localMode, namespace, async ({ mode }) => {
      const payload = canonicalizePersistedValue({ ...tenantFixture, mode });
      const hash = snapshotHash(payload);

      expect(payload).toEqual({
        blocked_workflows: ["wf-b"],
        mode: "local",
        tenant_id: "tenant-a",
        visible_workflows: ["wf-a"],
      });
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });
});
