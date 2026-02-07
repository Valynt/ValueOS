#!/usr/bin/env node

const requiredExports = ["onCLS", "onFID", "onFCP", "onLCP", "onTTFB", "onINP"];

try {
  const module = await import("web-vitals");
  const missing = requiredExports.filter((key) => typeof module[key] !== "function");

  if (missing.length > 0) {
    console.error(`❌ web-vitals missing exports: ${missing.join(", ")}`);
    process.exit(1);
  }

  console.log("✅ web-vitals exports validated.");
} catch (error) {
  console.error(`❌ Failed to import web-vitals: ${error.message}`);
  process.exit(1);
}
