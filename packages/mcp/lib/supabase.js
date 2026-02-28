/**
 * MCP Supabase Client - Re-export from backend
 * TODO: Consider if MCP should have its own client configuration
 */
import { createClient } from "@supabase/supabase-js";
const supabaseUrl = process.env.SUPABASE_URL || "https://example.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || "example-key";
export const supabase = createClient(supabaseUrl, supabaseKey);
export const getSupabaseClient = () => supabase;
export default supabase;
//# sourceMappingURL=supabase.js.map