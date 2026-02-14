#!/usr/bin/env node
import { readFile } from "node:fs/promises";

const targets = [
  "apps/ValyntApp/src/lib/llm/client.ts",
  "apps/ValyntApp/src/features/workflow/hooks/useWorkflow.ts",
  "packages/backend/src/lib/agent-fabric.ts",
];

const blockedPhrases = [
  "This is a placeholder response",
  "TODO: Implement actual",
  "placeholder that should be replaced",
];

const violations = [];

for (const file of targets) {
  const content = await readFile(file, "utf8");
  for (const phrase of blockedPhrases) {
    if (content.includes(phrase)) {
      violations.push(`${file}: contains sentinel phrase \"${phrase}\"`);
    }
  }
}

if (violations.length > 0) {
  console.error("Runtime sentinel check failed:\n" + violations.join("\n"));
  process.exit(1);
}

console.log(`Runtime sentinel check passed for ${targets.length} runtime modules.`);
