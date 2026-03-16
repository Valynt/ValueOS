#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const result = spawnSync(
  "pnpm",
  [
    "--dir",
    "packages/backend",
    "exec",
    "vitest",
    "run",
    "--config",
    "vitest.config.ts",
    "src/services/security/__tests__/ComplianceControlCheckService.test.ts",
    "--reporter=verbose",
  ],
  { stdio: "inherit", env: process.env },
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
