#!/usr/bin/env node

import { readFile } from "node:fs/promises";

const configPath = "config/kong.yml";
const mode = process.argv.includes("--mode=dev") ? "dev" : "production";

const content = await readFile(configPath, "utf8");
const lines = content.split(/\r?\n/);
const errors = [];

for (let index = 0; index < lines.length; index += 1) {
  const line = lines[index];
  if (!line.includes("origins:")) continue;

  const inlineWildcard = /origins:\s*\[[^\]]*"\*"[^\]]*\]/.test(line) || /origins:\s*\[[^\]]*'\*'[^\]]*\]/.test(line);
  if (inlineWildcard) {
    errors.push(`${configPath}:${index + 1} wildcard CORS origin is forbidden in ${mode} mode`);
    continue;
  }

  for (let offset = index + 1; offset < lines.length; offset += 1) {
    const candidate = lines[offset].trim();

    if (candidate.length === 0 || candidate.startsWith("#")) {
      continue;
    }

    if (!candidate.startsWith("-")) {
      break;
    }

    const value = candidate.replace(/^-\s*/, "").replace(/^"|"$/g, "").replace(/^'|'$/g, "");

    if (value === "*") {
      const lineNumber = offset + 1;
      errors.push(`${configPath}:${lineNumber} wildcard CORS origin is forbidden in ${mode} mode`);
    }
  }
}

if (mode === "production" && errors.length > 0) {
  console.error("Kong CORS origin guard failed:\n" + errors.join("\n"));
  process.exit(1);
}

if (errors.length > 0) {
  console.warn("Kong CORS origin guard warning:\n" + errors.join("\n"));
} else {
  console.log(`Kong CORS origin guard passed (${mode} mode).`);
}
