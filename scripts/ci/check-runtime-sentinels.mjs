#!/usr/bin/env node
import { execSync } from "node:child_process";

const runtimeTargets = [
  "apps/ValyntApp/src/lib/llm/client.ts",
  "apps/ValyntApp/src/features/workflow/hooks/useWorkflow.ts",
  "packages/backend/src/lib/agent-fabric.ts",
];

const sentinelPhrases = ["placeholder response", "TODO: Implement actual"];
const escaped = sentinelPhrases.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
const pattern = escaped.join("|");

const cmd = `rg -n --no-heading -e "${pattern}" ${runtimeTargets.join(" ")}`;

try {
  const output = execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  if (output) {
    console.error("Release sentinel check failed: blocked placeholder/stub phrases found in release-targeted runtime modules.\n");
    console.error(output);
    process.exit(1);
  }
} catch (error) {
  if (error.status === 1) {
    console.log("Release sentinel check passed: no blocked phrases found.");
    process.exit(0);
  }

  console.error("Release sentinel check could not run.");
  console.error(error.stderr?.toString() || error.message);
  process.exit(2);
}
