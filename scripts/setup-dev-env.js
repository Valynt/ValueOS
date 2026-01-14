#!/usr/bin/env node

/**
 * Development Environment Setup Script
 * Ensures all required files and configurations are in place
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const LOCAL_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

function ensureEnvFile() {
  const envLocalPath = path.join(projectRoot, ".env.local");
  const envTemplatePath = path.join(projectRoot, "deploy/envs/.env.local");

  // Copy from template if it exists and .env.local doesn't
  if (!fs.existsSync(envLocalPath) && fs.existsSync(envTemplatePath)) {
    fs.copyFileSync(envTemplatePath, envLocalPath);
    console.log("✅ Copied .env.local from template");
  }

  // Ensure .env.local exists
  if (!fs.existsSync(envLocalPath)) {
    console.log("❌ .env.local not found. Please create it manually.");
    return false;
  }

  // Update with real Supabase keys
  let content = fs.readFileSync(envLocalPath, "utf8");
  let updated = false;

  // Update VITE_SUPABASE_ANON_KEY
  if (
    content.includes("VITE_SUPABASE_ANON_KEY=your-") ||
    content.includes("VITE_SUPABASE_ANON_KEY=placeholder") ||
    content.includes("VITE_SUPABASE_ANON_KEY=")
  ) {
    content = content.replace(
      /VITE_SUPABASE_ANON_KEY=.*$/m,
      `VITE_SUPABASE_ANON_KEY=${LOCAL_SUPABASE_ANON_KEY}`
    );
    updated = true;
  }

  // Update SUPABASE_ANON_KEY
  if (
    content.includes("SUPABASE_ANON_KEY=your-") ||
    content.includes("SUPABASE_ANON_KEY=placeholder") ||
    content.includes("SUPABASE_ANON_KEY=")
  ) {
    content = content.replace(
      /SUPABASE_ANON_KEY=.*$/m,
      `SUPABASE_ANON_KEY=${LOCAL_SUPABASE_ANON_KEY}`
    );
    updated = true;
  }

  // Ensure URLs are correct for local dev
  if (!content.includes("VITE_SUPABASE_URL=http://localhost:54321")) {
    content = content.replace(
      /VITE_SUPABASE_URL=.*$/m,
      "VITE_SUPABASE_URL=http://localhost:54321"
    );
    updated = true;
  }

  if (!content.includes("SUPABASE_URL=http://localhost:54321")) {
    content = content.replace(
      /SUPABASE_URL=.*$/m,
      "SUPABASE_URL=http://localhost:54321"
    );
    updated = true;
  }

  if (updated) {
    fs.writeFileSync(envLocalPath, content);
    console.log("✅ Updated .env.local with real Supabase keys");
  }

  return true;
}

function ensurePortsEnv() {
  const envPortsPath = path.join(projectRoot, "deploy/envs/.env.ports");

  if (!fs.existsSync(envPortsPath)) {
    console.log(
      "❌ .env.ports not found. Please ensure deploy/envs/.env.ports exists."
    );
    return false;
  }

  let content = fs.readFileSync(envPortsPath, "utf8");
  let updated = false;

  // Add Supabase keys if missing
  if (!content.includes("VITE_SUPABASE_ANON_KEY=")) {
    content += `\n# Supabase keys for containers\nVITE_SUPABASE_ANON_KEY=${LOCAL_SUPABASE_ANON_KEY}\nSUPABASE_ANON_KEY=${LOCAL_SUPABASE_ANON_KEY}\n`;
    updated = true;
  } else if (
    content.includes("VITE_SUPABASE_ANON_KEY=your-") ||
    content.includes("VITE_SUPABASE_ANON_KEY=placeholder")
  ) {
    content = content.replace(
      /VITE_SUPABASE_ANON_KEY=.*$/m,
      `VITE_SUPABASE_ANON_KEY=${LOCAL_SUPABASE_ANON_KEY}`
    );
    content = content.replace(
      /SUPABASE_ANON_KEY=.*$/m,
      `SUPABASE_ANON_KEY=${LOCAL_SUPABASE_ANON_KEY}`
    );
    updated = true;
  }

  if (updated) {
    fs.writeFileSync(envPortsPath, content);
    console.log("✅ Updated .env.ports with real Supabase keys");
  }

  return true;
}

function main() {
  console.log("🔧 Setting up development environment...\n");

  let success = true;

  if (!ensureEnvFile()) {
    success = false;
  }

  if (!ensurePortsEnv()) {
    success = false;
  }

  if (success) {
    console.log("\n🎉 Development environment setup complete!");
    console.log("\nNext steps:");
    console.log("  npm run dx      # Start development stack");
    console.log("  npm run db:reset # Reset database");
    console.log("  npm run seed:demo # Create demo user");
    console.log("\nThen open http://localhost:5173");
  } else {
    console.log("\n❌ Setup failed. Please check the errors above.");
    process.exit(1);
  }
}

main();
