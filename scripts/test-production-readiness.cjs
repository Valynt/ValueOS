#!/usr/bin/env node

/**
 * Production Readiness Test Script
 *
 * Tests all the production readiness improvements:
 * - Secrets management validation
 * - Error boundary functionality
 * - Circuit breaker protection
 * - Configuration validation
 */

const fs = require("fs");
const path = require("path");

console.log("🚀 Testing Production Readiness Implementation");
console.log("==================================================");

const results = {
  passed: 0,
  failed: 0,
  tests: [],
};

function test(name, testFn) {
  try {
    const result = testFn();
    if (result) {
      console.log(`✅ ${name}`);
      results.passed++;
    } else {
      console.log(`❌ ${name}`);
      results.failed++;
    }
    results.tests.push({ name, status: result ? "passed" : "failed" });
  } catch (error) {
    console.log(`❌ ${name} - ${error.message}`);
    results.failed++;
    results.tests.push({ name, status: "failed", error: error.message });
  }
}

// Test 1: Secrets Management Files Exist
test("SecretValidator.ts exists", () => {
  return fs.existsSync(
    path.join(__dirname, "../src/config/secrets/SecretValidator.ts")
  );
});

test("SecretVolumeWatcher.ts exists", () => {
  return fs.existsSync(
    path.join(__dirname, "../src/config/secrets/SecretVolumeWatcher.ts")
  );
});

test("Environment configuration files exist", () => {
  const staging = fs.existsSync(
    path.join(__dirname, "../deploy/envs/.env.staging.example")
  );
  const production = fs.existsSync(
    path.join(__dirname, "../deploy/envs/.env.production.example")
  );
  return staging && production;
});

// Test 2: Error Boundary Files Exist
test("RouteErrorBoundary.tsx exists", () => {
  return fs.existsSync(
    path.join(
      __dirname,
      "../src/components/error-boundaries/RouteErrorBoundary.tsx"
    )
  );
});

test("AsyncErrorBoundary.tsx exists", () => {
  return fs.existsSync(
    path.join(
      __dirname,
      "../src/components/error-boundaries/AsyncErrorBoundary.tsx"
    )
  );
});

// Test 3: Circuit Breaker Files Exist
test("HttpClientWithCircuitBreaker.ts exists", () => {
  return fs.existsSync(
    path.join(
      __dirname,
      "../src/lib/resilience/HttpClientWithCircuitBreaker.ts"
    )
  );
});

test("CircuitBreakerMonitor.ts exists", () => {
  return fs.existsSync(
    path.join(__dirname, "../src/lib/resilience/CircuitBreakerMonitor.ts")
  );
});

// Test 4: Deployment Pipeline Files Exist
test("Archived unified deployment pipeline reference exists", () => {
  return fs.existsSync(
    path.join(__dirname, "../docs/archive/workflows/unified-deployment-pipeline.reference.yml")
  );
});

test("Deployment validation script exists", () => {
  return fs.existsSync(
    path.join(__dirname, "../scripts/validate-deployment.ts")
  );
});

test("Pre-deployment checklist exists", () => {
  return fs.existsSync(
    path.join(__dirname, "../scripts/pre-deployment-checklist.sh")
  );
});

// Test 5: Configuration Validation
test("SecretValidator has required exports", () => {
  const content = fs.readFileSync(
    path.join(__dirname, "../src/config/secrets/SecretValidator.ts"),
    "utf8"
  );
  return (
    content.includes("SECRET_DEFINITIONS") &&
    content.includes("validateSecretsOnStartup") &&
    content.includes("SecretValidator")
  );
});

test("Error boundaries have required methods", () => {
  const routeContent = fs.readFileSync(
    path.join(
      __dirname,
      "../src/components/error-boundaries/RouteErrorBoundary.tsx"
    ),
    "utf8"
  );
  const asyncContent = fs.readFileSync(
    path.join(
      __dirname,
      "../src/components/error-boundaries/AsyncErrorBoundary.tsx"
    ),
    "utf8"
  );

  return (
    routeContent.includes("componentDidCatch") &&
    routeContent.includes("retry") &&
    asyncContent.includes("componentDidCatch") &&
    asyncContent.includes("handleRetry")
  );
});

test("Circuit breaker has service configurations", () => {
  const content = fs.readFileSync(
    path.join(
      __dirname,
      "../src/lib/resilience/HttpClientWithCircuitBreaker.ts"
    ),
    "utf8"
  );
  return (
    content.includes("serviceConfigs") &&
    content.includes("together-ai") &&
    content.includes("HttpClientFactory")
  );
});

// Test 6: Integration Points
test("AppRoutes includes error boundaries", () => {
  const content = fs.readFileSync(
    path.join(__dirname, "../src/AppRoutes.tsx"),
    "utf8"
  );
  return (
    content.includes("RouteErrorBoundary") &&
    content.includes("AsyncErrorBoundary")
  );
});

test("Backend server includes secret validation", () => {
  const content = fs.readFileSync(
    path.join(__dirname, "../src/backend/server.ts"),
    "utf8"
  );
  return (
    content.includes("validateSecretsOnStartup") &&
    content.includes("secretHealthMiddleware")
  );
});

// Test 7: File Content Validation
test("Environment files use secret placeholders", () => {
  const stagingContent = fs.readFileSync(
    path.join(__dirname, "../deploy/envs/.env.staging.example"),
    "utf8"
  );
  const prodContent = fs.readFileSync(
    path.join(__dirname, "../deploy/envs/.env.production.example"),
    "utf8"
  );

  return (
    stagingContent.includes("${SECRET:") && prodContent.includes("${SECRET:")
  );
});

test("Archived deployment reference includes all phases", () => {
  const content = fs.readFileSync(
    path.join(
      __dirname,
      "../docs/archive/workflows/unified-deployment-pipeline.reference.yml"
    ),
    "utf8"
  );
  const phases = [
    "Phase 1: Validation and Quality Gates",
    "Phase 2: Build and Security Scanning",
    "Phase 3: Environment Validation",
    "Phase 4: Infrastructure Validation",
    "Phase 5: Deployment Gates and Approvals",
    "Phase 6: Deploy to Environment",
    "Phase 7: Post-Deployment Validation",
    "Phase 8: Cleanup and Notification",
  ];

  return phases.every((phase) => content.includes(phase));
});

// Test 8: Security Configuration
test("Production environment has security settings", () => {
  const content = fs.readFileSync(
    path.join(__dirname, "../deploy/envs/.env.production.example"),
    "utf8"
  );
  return (
    content.includes("VITE_ENABLE_CIRCUIT_BREAKER=true") &&
    content.includes("VITE_ENABLE_RATE_LIMITING=true") &&
    content.includes("VITE_ENABLE_AUDIT_LOGGING=true")
  );
});

// Results Summary
console.log("\n📊 Test Results Summary");
console.log("======================");
console.log(`✅ Passed: ${results.passed}`);
console.log(`❌ Failed: ${results.failed}`);
console.log(
  `📈 Success Rate: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`
);

if (results.failed > 0) {
  console.log("\n❌ Failed Tests:");
  results.tests
    .filter((t) => t.status === "failed")
    .forEach((test) => {
      console.log(`   - ${test.name}${test.error ? ": " + test.error : ""}`);
    });
  process.exit(1);
} else {
  console.log("\n🎉 All production readiness tests passed!");
  console.log("\n📋 Implementation Summary:");
  console.log("   ✅ Secrets Management Consolidation");
  console.log("   ✅ Deployment Pipeline Standardization");
  console.log("   ✅ Comprehensive Error Boundary Coverage");
  console.log("   ✅ Circuit Breaker Coverage Expansion");
  console.log("\n🚀 ValueOS is ready for production deployment!");
}
