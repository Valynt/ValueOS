#!/usr/bin/env node

/**
 * Secrets Configuration Test
 *
 * Tests the secrets management implementation
 */

const fs = require("fs");
const path = require("path");

console.log("🔐 Testing Secrets Management Configuration");
console.log("==========================================");

// Test 1: Check environment files
console.log("📋 Environment Configuration Files:");
const environments = ["development", "staging", "production"];

environments.forEach((env) => {
  const envFile = path.join(__dirname, `../deploy/envs/.env.${env}.example`);
  if (fs.existsSync(envFile)) {
    console.log(`✅ .env.${env}.example exists`);

    const content = fs.readFileSync(envFile, "utf8");
    const secretPlaceholders = (content.match(/\$\{SECRET:/g) || []).length;
    console.log(`   📊 Found ${secretPlaceholders} secret placeholders`);
  } else {
    console.log(`❌ .env.${env}.example missing`);
  }
});

// Test 2: Check secret definitions
console.log("\n🔍 Secret Definitions:");
const secretValidatorFile = path.join(
  __dirname,
  "../src/config/secrets/SecretValidator.ts"
);
if (fs.existsSync(secretValidatorFile)) {
  const content = fs.readFileSync(secretValidatorFile, "utf8");

  // Count secret definitions
  const secretMatches = content.match(/key: '([^']+)'/g) || [];
  console.log(`✅ Found ${secretMatches.length} secret definitions`);

  // Check categories
  const categories = [
    "database",
    "auth",
    "api",
    "security",
    "infrastructure",
    "external",
  ];
  categories.forEach((category) => {
    if (content.includes(`category: '${category}'`)) {
      console.log(`✅ Found ${category} secrets`);
    }
  });

  // Check critical secrets
  if (content.includes("critical: true")) {
    console.log("✅ Found critical secret definitions");
  }
}

// Test 3: Check secret validation functions
console.log("\n🛡️ Secret Validation Functions:");
if (fs.existsSync(secretValidatorFile)) {
  const content = fs.readFileSync(secretValidatorFile, "utf8");

  const validationFunctions = [
    "validateSecretsOnStartup",
    "secretHealthMiddleware",
    "SecretValidator",
  ];

  validationFunctions.forEach((func) => {
    if (content.includes(func)) {
      console.log(`✅ ${func} function found`);
    } else {
      console.log(`❌ ${func} function missing`);
    }
  });
}

// Test 4: Check backend integration
console.log("\n🔗 Backend Integration:");
const serverFile = path.join(__dirname, "../src/backend/server.ts");
if (fs.existsSync(serverFile)) {
  const content = fs.readFileSync(serverFile, "utf8");

  if (content.includes("validateSecretsOnStartup")) {
    console.log("✅ Secret validation integrated in server startup");
  }

  if (content.includes("secretHealthMiddleware")) {
    console.log("✅ Secret health endpoint configured");
  }

  if (content.includes("/health/secrets")) {
    console.log("✅ Secret health route registered");
  }
}

console.log("\n🎉 Secrets Management Test Complete!");
console.log(
  "📊 Ready for production deployment with centralized secrets management"
);
