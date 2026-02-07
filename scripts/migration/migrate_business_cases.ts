import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, "../../.env.local");
console.log(`Loading env from: ${envPath}`);
const result = dotenv.config({ path: envPath });
if (result.error) {
  console.error("Error loading .env file:", result.error);
}

console.log(
  "Supabase related env vars found:",
  Object.keys(process.env).filter((k) => k.includes("SUPABASE"))
);

// Verify environment variables
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Error: Supabase URL and Key are required.");
  console.error("Checked: VITE_SUPABASE_URL, SUPABASE_URL");
  console.error(
    "Checked: SUPABASE_SERVICE_ROLE_KEY, VITE_SUPABASE_SERVICE_ROLE_KEY, VITE_SUPABASE_ANON_KEY, SUPABASE_ANON_KEY"
  );
  console.error("Please ensure .env.local exists in the root directory.");
  process.exit(1);
}

// Initialize Supabase client
// Using Service Role Key if available for bypass RLS, otherwise fallback to Anon Key (which might fail if RLS prevents listing all users data)
// Ideally for migration we need admin access.
const supabase = createClient(supabaseUrl, supabaseKey);

async function migrateBusinessCases() {
  console.log("Checking database tables...");

  // List tables to debug
  const { data: tables, error: tableError } = await supabase
    .from("information_schema.tables")
    .select("table_name")
    .eq("table_schema", "public");

  if (tableError) {
    // Accessing information_schema might fail via PostgREST if not exposed
    console.log(
      "Could not list tables via PostgREST (expected if not exposed)."
    );
  } else {
    console.log(
      "Tables in public schema:",
      tables?.map((t) => t.table_name).join(", ")
    );
  }

  console.log("Starting migration from business_cases to value_cases...");

  // 1. Fetch all legacy business cases
  const { data: legacyCases, error: fetchError } = await supabase
    .from("business_cases")
    .select("*");

  if (fetchError) {
    console.error("Error fetching business_cases:", fetchError);
    return;
  }

  if (!legacyCases || legacyCases.length === 0) {
    console.log("No legacy business cases found to migrate.");
    return;
  }

  console.log(`Found ${legacyCases.length} legacy cases. Processing...`);

  let successCount = 0;
  let failCount = 0;

  for (const bCase of legacyCases) {
    try {
      console.log(`Migrating case: ${bCase.name} (${bCase.id})`);

      // Check if already migrated (by ID)
      const { data: existing } = await supabase
        .from("value_cases")
        .select("id")
        .eq("id", bCase.id)
        .single();

      if (existing) {
        console.log(`Skipping ${bCase.id} - already exists in value_cases.`);
        continue;
      }

      // Map status
      // Database constraint: status = ANY (ARRAY['draft', 'review', 'published'])
      let newStatus = "draft";
      if (bCase.status === "presented") {
        newStatus = "published";
      } else if (bCase.status === "in-review") {
        newStatus = "review";
      }

      // Map lifecycle stage from metadata or default
      const metadata = (bCase.metadata as any) || {};
      const lifecycleStage = metadata.stage || "discovery"; // Default to discovery

      // Prepare new record
      const newValCase = {
        id: bCase.id, // Preserve ID
        name: bCase.name,
        // company_name removed - stored in company_profiles
        description: metadata.description || null,
        status: newStatus,
        created_at: bCase.created_at,
        updated_at: bCase.updated_at,
        metadata: metadata,
        // Default values for required fields in value_cases if they exist
        // tenant_id: metadata.tenant_id || null, // Best effort tenant mapping - schema might not have it yet or it is nullable
      };

      // Insert into value_cases
      const { error: insertError } = await supabase
        .from("value_cases")
        .insert(newValCase);

      if (insertError) {
        console.error(`Failed to insert value_cases ${bCase.id}:`, insertError);
        failCount++;
        continue;
      }

      // Create company profile
      const { data: profileData, error: profileError } = await supabase
        .from("company_profiles")
        .insert({
          value_case_id: bCase.id,
          company_name: bCase.client,
          // default other fields
        })
        .select()
        .single();

      if (profileError) {
        console.error(
          `Failed to insert company_profiles for ${bCase.id}:`,
          profileError
        );
        // Try to cleanup? Or just log
      } else {
        // Update value_cases with company_profile_id if it exists
        const { error: updateError } = await supabase
          .from("value_cases")
          .update({ company_profile_id: profileData.id })
          .eq("id", bCase.id);

        if (updateError) {
          console.warn(
            `Failed to link company_profile_id for ${bCase.id}:`,
            updateError
          );
        }
      }

      console.log(`Successfully migrated ${bCase.id}`);
      successCount++;
    } catch (err) {
      console.error(`Unexpected error processing ${bCase.id}:`, err);
      failCount++;
    }
  }

  console.log("Migration completed.");
  console.log(`Success: ${successCount}`);
  console.log(`Failed: ${failCount}`);
  console.log(`Skipped: ${legacyCases.length - successCount - failCount}`);
}

migrateBusinessCases().catch(console.error);
