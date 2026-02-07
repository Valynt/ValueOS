#!/usr/bin/env tsx

/**
 * Headless Login Verification
 *
 * Verifies that the demo user can log in successfully.
 * This is a smoke test for the auth system.
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

dotenv.config({ path: path.join(projectRoot, ".env.local") });

// Demo user credentials (INVARIANT - see docs/SYSTEM_INVARIANTS.md)
const DEMO_EMAIL = "demouser@valynt.com";
const DEMO_PASSWORD = "passord";
const DEMO_UUID = "00000000-0000-0000-0000-000000000001";

async function verifyLogin() {
  console.log("🔐 Verifying demo user login...");

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("❌ Missing required environment variables");
    console.error("   VITE_SUPABASE_URL:", supabaseUrl ? "✓" : "✗");
    console.error("   VITE_SUPABASE_ANON_KEY:", supabaseAnonKey ? "✓" : "✗");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  try {
    // Attempt login
    const { data, error } = await supabase.auth.signInWithPassword({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
    });

    if (error) {
      console.error("❌ Login failed:", error.message);
      console.error("\nPossible causes:");
      console.error("  - Demo user not seeded (run: pnpm run seed)");
      console.error("  - Incorrect credentials");
      console.error("  - Supabase not running");
      process.exit(1);
    }

    if (!data.user) {
      console.error("❌ Login succeeded but no user returned");
      process.exit(1);
    }

    // Verify user properties
    if (data.user.email !== DEMO_EMAIL) {
      console.error(`❌ Email mismatch: expected ${DEMO_EMAIL}, got ${data.user.email}`);
      process.exit(1);
    }

    // Verify token exists
    if (!data.session?.access_token) {
      console.error("❌ No access token returned");
      process.exit(1);
    }

    console.log("✅ Login successful");
    console.log(`   User ID: ${data.user.id}`);
    console.log(`   Email: ${data.user.email}`);
    console.log(`   Token: ${data.session.access_token.substring(0, 20)}...`);

    // Test protected endpoint (if backend is running)
    try {
      const response = await fetch(
        `${process.env.VITE_API_BASE_URL || "http://localhost:3001"}/api/health`,
        {
          headers: {
            Authorization: `Bearer ${data.session.access_token}`,
          },
        }
      );

      if (response.ok) {
        console.log("✅ Protected endpoint accessible");
      } else {
        console.log("⚠️  Protected endpoint returned:", response.status);
      }
    } catch (e) {
      console.log("⚠️  Backend not running (skipping protected endpoint test)");
    }

    console.log("\n🎉 Login verification passed!");
    process.exit(0);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("❌ Verification failed:", errorMessage);
    process.exit(1);
  }
}

verifyLogin().catch((error) => {
  console.error("❌ Unexpected error:", error);
  process.exit(1);
});
