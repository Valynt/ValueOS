import { createClient } from "@supabase/supabase-js";
import { describe, it, expect } from "vitest";
import dotenv from "dotenv";

// Load environment variables for the test
dotenv.config({ path: ".env.local" });

// Use the env vars from your setup
const supabaseUrl =
  process.env.VITE_SUPABASE_URL || "http://host.docker.internal:54321";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || "your-anon-key";

describe("Supabase Local Connection", () => {
  const supabase = createClient(supabaseUrl, supabaseKey);

  it("should connect to the database and return health check", async () => {
    // Attempt a simple query (even if table is empty, this verifies connection)
    const { data, error, status } = await supabase
      .from("users")
      .select("*")
      .limit(1);

    // 404/PGRST204 is fine (table might not exist), but 500 or Connection Refused is bad
    if (error && error.code !== "PGRST116" && error.code !== "42P01") {
      console.error("Connection failed:", error);
    }

    // We expect a valid HTTP response code from the local server
    expect(status).not.toBe(0);
    expect(status).toBeLessThan(500);
  });
});
