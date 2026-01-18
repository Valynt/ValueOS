import { supabase } from "./supabase";
import { logger } from "./logger";

/**
 * Check connectivity to the database
 */
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    const { data, error } = await supabase.from("_health").select("count").limit(1).maybeSingle();

    if (error && error.code !== "PGRST116") {
      // Ignore missing table for pure connectivity check if needed
      // Fallback to a simple select if _health doesn't exist
      const { error: fallbackError } = await supabase.from("organizations").select("id").limit(1);
      if (fallbackError) throw fallbackError;
    }

    return true;
  } catch (err) {
    logger.error("Database connection check failed", { error: err });
    return false;
  }
}
