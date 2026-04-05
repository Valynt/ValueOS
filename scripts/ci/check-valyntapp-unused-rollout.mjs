#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const phase = process.env.VALYNTAPP_UNUSED_ROLLOUT_PHASE ?? "phase1";
const validPhases = new Set(["phase1", "phase2"]);

if (!validPhases.has(phase)) {
  console.error(`Invalid VALYNTAPP_UNUSED_ROLLOUT_PHASE: ${phase}`);
  process.exit(1);
}

if (phase === "phase1") {
  console.log(
    "ValyntApp unused checks rollout in phase1: lint rule is warn-only (@typescript-eslint/no-unused-vars).",
  );
  process.exit(0);
}

const command = "pnpm --filter valynt-app exec tsc -p tsconfig.unused-ci.json --noEmit --pretty false";
console.log(`ValyntApp unused checks rollout in phase2: enforcing CI gate via: ${command}`);
const result = spawnSync("bash", ["-lc", command], { stdio: "inherit", encoding: "utf8" });
process.exit(result.status ?? 1);
