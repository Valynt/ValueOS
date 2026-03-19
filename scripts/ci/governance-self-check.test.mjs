import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

const scriptPath = path.resolve("scripts/ci/check-governance-gate.mjs");

function writeFixture({ workflowRun, ciVerify }) {
  const root = mkdtempSync(path.join(tmpdir(), "governance-self-check-"));
  mkdirSync(path.join(root, ".github", "workflows"), { recursive: true });

  writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify(
      {
        name: "fixture",
        private: true,
        scripts: {
          "ci:verify": ciVerify,
        },
      },
      null,
      2
    )
  );

  writeFileSync(
    path.join(root, ".github", "workflows", "ci.yml"),
    `name: CI\njobs:\n  verify:\n    runs-on: ubuntu-latest\n    steps:\n      - run: ${workflowRun}\n`
  );

  return root;
}

describe("governance self check", () => {
  it("passes when ci.yml contains the canonical governance command via ci:verify", () => {
    const cwd = writeFixture({
      workflowRun: "pnpm run ci:verify",
      ciVerify: "pnpm lint && pnpm run typecheck:signal --verify",
    });

    const output = execFileSync(process.execPath, [scriptPath], {
      cwd,
      encoding: "utf8",
    });

    expect(output).toContain("Governance gate contract verified");
  });

  it("fails when ci.yml omits the canonical governance command", () => {
    const cwd = writeFixture({
      workflowRun: "pnpm lint && pnpm test",
      ciVerify: "pnpm lint && pnpm run typecheck:signal --verify",
    });

    expect(() =>
      execFileSync(process.execPath, [scriptPath], {
        cwd,
        encoding: "utf8",
        stdio: "pipe",
      })
    ).toThrow(/Governance gate missing in required workflows/);
  });
});
