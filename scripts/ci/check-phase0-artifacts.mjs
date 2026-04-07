#!/usr/bin/env node
/**
 * check-phase0-artifacts.mjs
 *
 * CI gate validating all Phase 0 pre-implementation artifacts for the
 * frontend redesign. Checks existence, parseability, required sections,
 * structural consistency, and cross-artifact references.
 *
 * Exit 1 if any artifact is missing, malformed, or structurally incomplete.
 *
 * Usage:
 *   node scripts/ci/check-phase0-artifacts.mjs
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");
const failures = [];
const passes = [];

function read(rel) {
  const p = join(ROOT, rel);
  if (!existsSync(p)) return null;
  return readFileSync(p, "utf8");
}

function pass(msg) {
  passes.push(msg);
  console.log("  ✓ " + msg);
}

function fail(msg) {
  failures.push(msg);
  console.error("  ✗ " + msg);
}

function fileExists(rel) {
  return existsSync(join(ROOT, rel));
}

function requireFile(rel, label) {
  if (!fileExists(rel)) {
    fail(`${label}: file missing at ${rel}`);
    return null;
  }
  pass(`${label}: file exists`);
  return read(rel);
}

function requireJsonFile(rel, label) {
  const content = requireFile(rel, label);
  if (!content) return null;
  try {
    const parsed = JSON.parse(content);
    pass(`${label}: valid JSON`);
    return parsed;
  } catch (e) {
    fail(`${label}: invalid JSON — ${e.message}`);
    return null;
  }
}

function requireSections(content, sections, label) {
  for (const section of sections) {
    // Case-insensitive section heading search
    const pattern = new RegExp(
      `(^#+\\s+.*${section}|\\*\\*${section}\\*\\*|## ${section})`,
      "im"
    );
    if (pattern.test(content)) {
      pass(`${label}: contains section "${section}"`);
    } else {
      fail(`${label}: missing required section "${section}"`);
    }
  }
}

function requireTerms(content, terms, label) {
  for (const term of terms) {
    if (content.includes(term)) {
      pass(`${label}: contains term "${term}"`);
    } else {
      fail(`${label}: missing required term "${term}"`);
    }
  }
}

// ============================================================================
// A. Warmth domain types
// ============================================================================

console.log("\n─── A. Warmth Domain Types ───");
const warmthTs = requireFile(
  "packages/shared/src/domain/Warmth.ts",
  "Warmth types"
);
if (warmthTs) {
  requireTerms(warmthTs, [
    "WarmthStateSchema",
    "WarmthModifierSchema",
    "WorkspaceModeSchema",
    "WarmthResultSchema",
    "SAGA_TO_WARMTH",
    "CONFIDENCE_MODIFIERS",
    "deriveWarmth",
    '"forming"',
    '"firm"',
    '"verified"',
  ], "Warmth types");

  // Verify it's exported from the barrel
  const barrel = read("packages/shared/src/domain/index.ts");
  if (barrel && barrel.includes("Warmth")) {
    pass("Warmth types: exported from domain barrel");
  } else {
    fail("Warmth types: not exported from packages/shared/src/domain/index.ts");
  }
}

// ============================================================================
// B. Warmth Derivation Spec
// ============================================================================

console.log("\n─── B. Warmth Derivation Spec ───");
const warmthSpec = requireFile(
  "docs/specs/warmth-derivation-spec.md",
  "Warmth spec"
);
if (warmthSpec) {
  requireSections(warmthSpec, [
    "Overview",
    "Derivation Rules",
    "Conflict Resolution",
    "Edge Cases",
    "Backend Requirements",
    "Frontend Contract",
  ], "Warmth spec");

  requireTerms(warmthSpec, [
    "saga_state",
    "confidence_score",
    "forming",
    "firm",
    "verified",
    "INITIATED",
    "FINALIZED",
    "deriveWarmth",
  ], "Warmth spec");

  // Must not be a stub
  if (warmthSpec.length < 500) {
    fail("Warmth spec: document appears to be a stub (< 500 chars)");
  } else {
    pass("Warmth spec: document has substantive content");
  }
}

// ============================================================================
// C. SDUI Architecture Decision ADR
// ============================================================================

console.log("\n─── C. SDUI ADR ───");
const adr = requireFile(
  "docs/decisions/adr-sdui-warmth-integration.md",
  "SDUI ADR"
);
if (adr) {
  requireSections(adr, [
    "Context",
    "Decision",
    "Consequences",
  ], "SDUI ADR");

  requireTerms(adr, [
    "SDUI",
    "warmth",
    "registry",
    "Extend",
  ], "SDUI ADR");

  // Check status
  if (/Status.*Accepted/i.test(adr)) {
    pass("SDUI ADR: status is Accepted");
  } else if (/Status.*Draft/i.test(adr)) {
    fail("SDUI ADR: status is still Draft — expected Accepted");
  }
}

// ============================================================================
// D. API Migration Map
// ============================================================================

console.log("\n─── D. API Migration Map ───");
const apiMap = requireFile(
  "docs/specs/api-migration-map.md",
  "API migration map"
);
if (apiMap) {
  requireSections(apiMap, [
    "Current State",
    "Endpoint Inventory",
    "Decision",
    "New Endpoints Required",
  ], "API migration map");

  requireTerms(apiMap, [
    "tRPC",
    "REST",
    "unified-api-client",
    "confidence_score",
  ], "API migration map");
}

// ============================================================================
// E. tsconfig.strict-zone.json
// ============================================================================

console.log("\n─── E. tsconfig.strict-zone.json ───");
const strictZone = requireJsonFile(
  "apps/ValyntApp/tsconfig.strict-zone.json",
  "Strict zone tsconfig"
);
if (strictZone) {
  // Must extend base
  if (strictZone.extends) {
    pass(`Strict zone tsconfig: extends "${strictZone.extends}"`);
  } else {
    fail("Strict zone tsconfig: missing 'extends' — must extend base tsconfig");
  }

  // Must have strict compiler options
  const opts = strictZone.compilerOptions || {};
  const requiredStrict = ["strict", "noImplicitAny", "strictNullChecks", "strictFunctionTypes"];
  for (const opt of requiredStrict) {
    if (opts[opt] === true) {
      pass(`Strict zone tsconfig: ${opt} = true`);
    } else {
      fail(`Strict zone tsconfig: ${opt} must be true`);
    }
  }

  // Must have include paths
  if (Array.isArray(strictZone.include) && strictZone.include.length > 0) {
    pass(`Strict zone tsconfig: has ${strictZone.include.length} include paths`);
  } else {
    fail("Strict zone tsconfig: missing include paths");
  }

  // Must have noEmit for type-check-only usage
  if (opts.noEmit === true) {
    pass("Strict zone tsconfig: noEmit = true");
  } else {
    fail("Strict zone tsconfig: noEmit should be true for type-check-only config");
  }
}

// ============================================================================
// F. ts-error-ratchet-budgets.json strict-zone entry
// ============================================================================

console.log("\n─── F. Ratchet Budget Strict Zone Entry ───");
const ratchet = requireJsonFile(
  ".github/ts-error-ratchet-budgets.json",
  "Ratchet budgets"
);
if (ratchet) {
  const budgets = ratchet.packageBudgets || {};
  const strictEntry = budgets["apps/ValyntApp/strict-zone"];

  if (strictEntry) {
    pass("Ratchet budgets: apps/ValyntApp/strict-zone entry exists");

    if (strictEntry.budget === 0) {
      pass("Ratchet budgets: strict-zone budget is 0 (zero tolerance)");
    } else {
      fail(`Ratchet budgets: strict-zone budget is ${strictEntry.budget}, expected 0`);
    }

    if (strictEntry.nextTarget === 0) {
      pass("Ratchet budgets: strict-zone nextTarget is 0");
    } else {
      fail(`Ratchet budgets: strict-zone nextTarget is ${strictEntry.nextTarget}, expected 0`);
    }
  } else {
    fail("Ratchet budgets: missing apps/ValyntApp/strict-zone entry");
  }

  // Verify failOnRegression policy
  if (ratchet.policy?.failOnRegression === true) {
    pass("Ratchet budgets: failOnRegression = true");
  } else {
    fail("Ratchet budgets: failOnRegression should be true");
  }
}

// ============================================================================
// G. Bundle Budget Configs
// ============================================================================

console.log("\n─── G. Bundle Budget Configs ───");
const uxBudgets = requireJsonFile(
  ".github/metrics/ux-performance-budgets.json",
  "UX performance budgets"
);
if (uxBudgets) {
  const { bundle } = uxBudgets;
  if (bundle?.maxTotalJsKb <= 500) {
    pass(`UX budgets: maxTotalJsKb = ${bundle.maxTotalJsKb} (≤500)`);
  } else {
    fail(`UX budgets: maxTotalJsKb = ${bundle?.maxTotalJsKb}, expected ≤500`);
  }

  // Check route chunks for new pages
  const chunks = uxBudgets.routeChunks || {};
  const requiredChunks = ["WorkspacePage", "ReviewPage", "CaseListPage"];
  for (const chunk of requiredChunks) {
    if (chunks[chunk]?.maxKb > 0) {
      pass(`UX budgets: route chunk "${chunk}" defined (${chunks[chunk].maxKb}KB)`);
    } else {
      fail(`UX budgets: missing route chunk budget for "${chunk}"`);
    }
  }
}

// Check vite.config.ts budget default
const viteConfig = read("apps/ValyntApp/vite.config.ts");
if (viteConfig) {
  if (viteConfig.includes("VITE_BUDGET_MAX_INITIAL_JS_KB || 500")) {
    pass("Vite config: initial JS budget default is 500KB");
  } else if (viteConfig.includes("VITE_BUDGET_MAX_INITIAL_JS_KB || 1200")) {
    fail("Vite config: initial JS budget is still 1200KB — should be 500KB");
  } else {
    fail("Vite config: could not verify VITE_BUDGET_MAX_INITIAL_JS_KB default");
  }
}

// ============================================================================
// H. i18n Warmth Keys — Parity Test
// ============================================================================

console.log("\n─── H. i18n Warmth Key Parity ───");
const enJson = requireJsonFile(
  "apps/ValyntApp/src/i18n/locales/en/common.json",
  "English locale"
);
const esJson = requireJsonFile(
  "apps/ValyntApp/src/i18n/locales/es/common.json",
  "Spanish locale"
);

if (enJson && esJson) {
  const WARMTH_PREFIXES = ["warmth.", "mode.", "review.", "copilot.", "navigation.work", "navigation.newCase", "navigation.graph", "navigation.library", "navigation.team", "navigation.company"];

  const getWarmthKeys = (obj) =>
    Object.keys(obj).filter((k) =>
      WARMTH_PREFIXES.some((prefix) => k.startsWith(prefix))
    );

  const enWarmthKeys = getWarmthKeys(enJson).sort();
  const esWarmthKeys = getWarmthKeys(esJson).sort();

  if (enWarmthKeys.length === 0) {
    fail("i18n: no warmth keys found in English locale");
  } else {
    pass(`i18n: ${enWarmthKeys.length} warmth/mode/review/copilot keys in English`);
  }

  // Parity check
  const missingInEs = enWarmthKeys.filter((k) => !esWarmthKeys.includes(k));
  const missingInEn = esWarmthKeys.filter((k) => !enWarmthKeys.includes(k));

  if (missingInEs.length === 0 && missingInEn.length === 0) {
    pass("i18n: warmth key parity between en and es");
  } else {
    if (missingInEs.length > 0) {
      fail(`i18n: ${missingInEs.length} warmth keys missing in es: ${missingInEs.join(", ")}`);
    }
    if (missingInEn.length > 0) {
      fail(`i18n: ${missingInEn.length} warmth keys missing in en: ${missingInEn.join(", ")}`);
    }
  }

  // Non-empty value check
  let hasEmptyValues = false;
  for (const key of enWarmthKeys) {
    if (typeof enJson[key] !== "string" || enJson[key].trim() === "") {
      fail(`i18n: en key "${key}" is empty or not a string`);
      hasEmptyValues = true;
    }
    if (typeof esJson[key] !== "string" || esJson[key].trim() === "") {
      fail(`i18n: es key "${key}" is empty or not a string`);
      hasEmptyValues = true;
    }
  }
  if (!hasEmptyValues) {
    pass("i18n: all warmth keys have non-empty values in both locales");
  }

  // Canonical warmth state alignment
  const requiredWarmthKeys = [
    "warmth.forming",
    "warmth.firm",
    "warmth.verified",
    "warmth.modifier.firming",
    "warmth.modifier.needsReview",
  ];
  for (const key of requiredWarmthKeys) {
    if (enJson[key]) {
      pass(`i18n: canonical key "${key}" present`);
    } else {
      fail(`i18n: canonical warmth key "${key}" missing from English locale`);
    }
  }
}

// ============================================================================
// I. Legacy-migrated deprecation plan
// (Covered in warmth spec and SDUI ADR; check for explicit reference)
// ============================================================================

console.log("\n─── I. Legacy-migrated Deprecation ───");
if (fileExists("apps/ValyntApp/src/legacy-migrated/types.ts")) {
  pass("Legacy-migrated: directory still exists (expected during Phase 0)");
} else {
  pass("Legacy-migrated: directory already removed");
}
// The deprecation plan is documented in the P0 expansion of the blueprint
// and the SDUI ADR. Check that the ADR references it.
if (adr && /legacy/i.test(adr)) {
  pass("Legacy-migrated: referenced in SDUI ADR");
} else if (warmthSpec && /legacy/i.test(warmthSpec)) {
  pass("Legacy-migrated: referenced in warmth spec");
} else {
  // Check the release readiness doc
  const readiness = read("docs/specs/p0-release-readiness.md");
  if (readiness && /legacy/i.test(readiness)) {
    pass("Legacy-migrated: referenced in P0 release readiness doc");
  } else {
    fail("Legacy-migrated: deprecation plan not referenced in any spec document");
  }
}

// ============================================================================
// J. SDUI case inconsistency fix plan
// ============================================================================

console.log("\n─── J. SDUI Case Inconsistency ───");
if (adr && /case inconsistency/i.test(adr)) {
  pass("SDUI case fix: documented in SDUI ADR");

  if (adr.includes("SDUI/") && adr.includes("sdui/")) {
    pass("SDUI case fix: both casing variants referenced");
  } else {
    fail("SDUI case fix: ADR should reference both SDUI/ and sdui/ variants");
  }

  if (/lowercase/i.test(adr) || /rename/i.test(adr)) {
    pass("SDUI case fix: normalization strategy described");
  } else {
    fail("SDUI case fix: normalization strategy not described");
  }
} else {
  fail("SDUI case fix: not documented in SDUI ADR");
}

// ============================================================================
// Summary
// ============================================================================

console.log("\n═══════════════════════════════════════════");
console.log(`  Phase 0 Artifact Verification`);
console.log(`  ✓ ${passes.length} passed`);
console.log(`  ✗ ${failures.length} failed`);
console.log("═══════════════════════════════════════════\n");

if (failures.length > 0) {
  console.error("FAILURES:");
  for (const f of failures) {
    console.error("  ✗ " + f);
  }
  process.exit(1);
}
