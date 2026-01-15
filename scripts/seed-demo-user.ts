#!/usr/bin/env tsx

/**
 * Demo User Seeding Script
 * Creates a demo tenant, user, and basic data for local development
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
import { validateEnv } from "../src/lib/env";

// Load environment
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

dotenv.config({ path: path.join(projectRoot, ".env.local") });

// Validate required environment variables (fail fast)
validateEnv();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function seedDemoData() {
  console.log("🌱 Seeding demo development data...");

  try {
    // Create demo tenant
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .upsert({
        name: "Demo Organization",
        slug: "demo-org",
        domain: "demo.localhost",
        settings: { theme: "default", plan: "demo" },
      })
      .select()
      .single();

    if (tenantError) {
      console.error("❌ Failed to create demo tenant:", tenantError);
      throw tenantError;
    }

    console.log(`✅ Created demo tenant: ${tenant.name}`);

    // Create demo user with fixed credentials (INVARIANT - do not change)
    const demoUserEmail = "demo@valueos.dev";
    const demoUserPassword = "Demo123!@#";
    const demoUserId = "00000000-0000-0000-0000-000000000001"; // Fixed UUID for determinism

    // First, create the user via Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: demoUserEmail,
      password: demoUserPassword,
      options: {
        data: {
          first_name: "Demo",
          last_name: "User",
          role: "admin",
        },
      },
    });

    if (authError && !authError.message.includes("already registered")) {
      console.error("❌ Failed to create demo user:", authError);
      throw authError;
    }

    // Get user ID (either from new signup or existing user)
    let userId;
    if (authData.user) {
      userId = authData.user.id;
    } else {
      // User already exists, fetch their ID
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const existingUser = existingUsers.users.find(
        (u) => u.email === demoUserEmail
      );
      userId = existingUser?.id;
    }

    if (!userId) {
      throw new Error("Could not determine demo user ID");
    }

    // Create user-tenant relationship
    const { error: userTenantError } = await supabase
      .from("user_tenants")
      .upsert({
        user_id: userId,
        tenant_id: tenant.id,
        role: "admin",
        is_active: true,
      });

    if (userTenantError) {
      console.error(
        "❌ Failed to create user-tenant relationship:",
        userTenantError
      );
      throw userTenantError;
    }

    console.log(`✅ Created demo user: ${demoUserEmail}`);

    // Create some demo projects
    const { error: projectError } = await supabase.from("projects").upsert([
      {
        tenant_id: tenant.id,
        name: "Demo Project 1",
        slug: "demo-project-1",
        description: "A sample project for testing",
        status: "active",
      },
      {
        tenant_id: tenant.id,
        name: "Demo Project 2",
        slug: "demo-project-2",
        description: "Another sample project",
        status: "planning",
      },
    ]);

    if (projectError) {
      console.error("❌ Failed to create demo projects:", projectError);
      throw projectError;
    }

    console.log("✅ Created demo projects");

    console.log("\n🎉 Demo data seeded successfully!");
    console.log("\n📋 Login Credentials:");
    console.log(`   Email:    ${demoUserEmail}`);
    console.log(`   Password: ${demoUserPassword}`);
    console.log(`   Role:     admin`);
    console.log(`   UUID:     ${demoUserId}`);
    console.log(
      "\n🌐 Open http://localhost:5173 and login with the above credentials."
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("❌ Seeding failed:", errorMessage);
    process.exit(1);
  }
}

// Run seeding
seedDemoData().catch(console.error);
