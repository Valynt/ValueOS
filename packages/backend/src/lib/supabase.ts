import { createClient } from '@supabase/supabase-js';

// Use environment variables or defaults
const supabaseUrl = process.env.SUPABASE_URL || 'https://example.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'example-key';

export const createServerSupabaseClient = () => {
  return createClient(supabaseUrl, supabaseKey);
};
