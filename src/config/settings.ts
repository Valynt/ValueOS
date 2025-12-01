/**
 * Centralized, environment-aware, and schema-validated configuration.
 */
import { z } from 'zod';

// Define the schema for all environment variables
const SettingsSchema = z.object({
  // Vite/Frontend variables (must be prefixed with VITE_)
  VITE_SUPABASE_URL: z.string().url("A valid Supabase URL is required."),
  VITE_SUPABASE_ANON_KEY: z.string().min(1, "A Supabase anon key is required."),
  VITE_APP_URL: z.string().url().optional(),
  
  // Backend/Server-side variables
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_PORT: z.string().optional().default('3001'),
  SUPABASE_SERVICE_KEY: z.string().optional(), // Only available on the server
  REDIS_URL: z.string().url().optional(),
  
  // Shared variables
  // Add any env vars that might be used in both frontend and backend here.
  // Make sure they are also prefixed with VITE_ if the frontend needs them.
});

// Determine if we are in a server-side (Node.js) or client-side (browser) environment
const isServer = typeof window === 'undefined';

// Use import.meta.env for client-side, process.env for server-side
const envSource = isServer ? process.env : import.meta.env;

// We need to handle the case where the server might not have the VITE_ prefix.
// This function helps merge the two possibilities.
const getMergedEnv = () => {
    if (isServer) {
        return {
            ...process.env,
            VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
            VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY,
        };
    }
    return import.meta.env;
};

let parsedSettings;

try {
  parsedSettings = SettingsSchema.parse(getMergedEnv());
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error("❌ Invalid environment variables:", error.format());
    throw new Error("Invalid environment variables. Please check your .env file.");
  }
  throw error;
}

export const settings = parsedSettings;
