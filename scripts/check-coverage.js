#!/usr/bin/env node

console.warn("Deprecated script: running scripts/check-coverage.cjs instead.");
await import(new URL("./check-coverage.cjs", import.meta.url));
