"use strict";
/**
 * MCP Supabase Client - Re-export from backend
 * TODO: Consider if MCP should have its own client configuration
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSupabaseClient = exports.supabase = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const supabaseUrl = process.env.SUPABASE_URL || "https://example.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || "example-key";
exports.supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey);
const getSupabaseClient = () => exports.supabase;
exports.getSupabaseClient = getSupabaseClient;
exports.default = exports.supabase;
//# sourceMappingURL=supabase.js.map