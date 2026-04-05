import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("HIPAA/GDPR overlap workflow artifacts", () => {
  it("defines breach and DSR overlap workflows with required evidence", () => {
    const filePath = resolve(
      process.cwd(),
      "docs/security-compliance/evidence/hipaa/hipaa-gdpr-incident-workflows.json"
    );

    const payload = JSON.parse(readFileSync(filePath, "utf8")) as {
      workflows: Array<{ workflow_id: string; steps: string[]; evidence: string[] }>;
    };

    const byId = new Map(payload.workflows.map((workflow) => [workflow.workflow_id, workflow]));

    for (const required of [
      "hipaa-breach-gdpr-overlap",
      "data-subject-rights-and-accounting-overlap",
    ]) {
      const workflow = byId.get(required);
      expect(workflow, `missing workflow: ${required}`).toBeDefined();
      expect(workflow?.steps.length ?? 0).toBeGreaterThanOrEqual(4);
      expect(workflow?.evidence.length ?? 0).toBeGreaterThanOrEqual(2);
    }
  });
});
