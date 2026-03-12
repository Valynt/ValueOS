// Simulates an ad hoc migration script that bypasses the canonical pipeline.
// This file should be detected and flagged by the ad-hoc SQL path test.
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
  await supabase.rpc("exec_sql", { sql: "ALTER TABLE accounts ADD COLUMN legacy_id TEXT;" });
}

run();
