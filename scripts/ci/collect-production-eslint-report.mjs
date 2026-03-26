#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

const inputs = [
  path.resolve(ROOT, "artifacts/eslint/valynt-app.json"),
  path.resolve(ROOT, "artifacts/eslint/backend.json"),
];
const output = path.resolve(ROOT, "artifacts/eslint/production-profile.json");

const merged = [];
for (const filePath of inputs) {
  const parsed = JSON.parse(readFileSync(filePath, "utf8"));
  if (Array.isArray(parsed)) {
    merged.push(...parsed);
  }
}

mkdirSync(path.dirname(output), { recursive: true });
writeFileSync(output, JSON.stringify(merged, null, 2) + "\n");
console.log(`Wrote merged production profile report: ${path.relative(ROOT, output)}`);
