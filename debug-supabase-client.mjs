// Test script to debug Supabase service role client access
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load env files
dotenv.config({ path: join(__dirname, "ops/env/.env.cloud-dev") });
dotenv.config({ path: join(__dirname, "ops/env/.env.backend.cloud-dev") });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

console.log("=== Supabase Service Role Client Test ===\n");
console.log("URL:", supabaseUrl);
console.log("Service Role Key (first 50 chars):", serviceRoleKey?.substring(0, 50) + "...");
console.log("Key length:", serviceRoleKey?.length);

// Test 1: Basic client (same as tests)
console.log("\n--- Test 1: Basic client (test pattern) ---");
const basicClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

try {
  const { data, error } = await basicClient.from("webhook_events").select("count").limit(1);
  console.log("Basic client result:", error ? `ERROR: ${error.message}` : `SUCCESS: ${JSON.stringify(data)}`);
} catch (e) {
  console.log("Basic client exception:", e.message);
}

// Test 2: Full options (backend pattern)
console.log("\n--- Test 2: Full options (backend pattern) ---");
const fullClient = createClient(supabaseUrl, serviceRoleKey, {
  db: { schema: "public" },
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

try {
  const { data, error } = await fullClient.from("webhook_events").select("count").limit(1);
  console.log("Full options result:", error ? `ERROR: ${error.message}` : `SUCCESS: ${JSON.stringify(data)}`);
} catch (e) {
  console.log("Full options exception:", e.message);
}

// Test 3: Try with explicit Authorization header
console.log("\n--- Test 3: Explicit Authorization header ---");
const headerClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  global: {
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  },
});

try {
  const { data, error } = await headerClient.from("webhook_events").select("count").limit(1);
  console.log("Header client result:", error ? `ERROR: ${error.message}` : `SUCCESS: ${JSON.stringify(data)}`);
} catch (e) {
  console.log("Header client exception:", e.message);
}

// Test 4: Try insert
console.log("\n--- Test 4: Insert test with full options ---");
try {
  const testId = crypto.randomUUID();
  const { data, error } = await fullClient.from("webhook_events").insert({
    id: testId,
    tenant_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12",
    stripe_event_id: "evt_test_debug_" + testId,
    event_type: "invoice.payment_succeeded",
    payload: { test: "data" },
    processed: false,
  }).select();
  console.log("Insert result:", error ? `ERROR: ${error.message}` : `SUCCESS: ${JSON.stringify(data)}`);
} catch (e) {
  console.log("Insert exception:", e.message);
}

console.log("\n=== Test Complete ===");
