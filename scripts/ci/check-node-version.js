#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");

const nvmrcPath = path.join(projectRoot, ".nvmrc");
if (!fs.existsSync(nvmrcPath)) {
  console.log("⚠️  .nvmrc not found. Skipping Node version check.");
  process.exit(0);
}

const expected = fs.readFileSync(nvmrcPath, "utf8").trim().replace(/^v/, "");
const expectedMajor = expected.split(".")[0];
const actual = process.version.replace(/^v/, "");
const actualMajor = actual.split(".")[0];

if (expectedMajor !== actualMajor) {
  console.error(
    `❌ Node major mismatch: expected ${expectedMajor}.x from .nvmrc, got ${actual}.`
  );
  process.exit(1);
}

console.log(`✅ Node version matches .nvmrc (expected ${expectedMajor}.x, got ${actual}).`);
