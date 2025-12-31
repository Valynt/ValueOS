#!/usr/bin/env node
/**
 * Forensic trace reconstruction helper
 * Given a sessionId, collect relevant artifacts to enable trace reconstruction
 */
import { createClient } from '@supabase/supabase-js';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function getRows(table: string, sessionId: string) {
  const { data, error } = await supabase.from(table).select('*').eq('session_id', sessionId).order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

async function main() {
  const sessionId = process.argv[2] || process.env.SESSION_ID;
  if (!sessionId) {
    console.error('Usage: scripts/verify/trace_reconstruction.ts <sessionId>');
    process.exit(1);
  }

  const artifacts = {} as Record<string, any>;
  try {
    artifacts.agent_memory = await getRows('agent_memory', sessionId);
    artifacts.agent_predictions = await getRows('agent_predictions', sessionId);
    artifacts.provenance_audit_log = await getRows('provenance_audit_log', sessionId);
    artifacts.llm_usage = await supabase.from('llm_usage').select('*').eq('session_id', sessionId).order('timestamp', { ascending: true });
    const traces = {
      agent_memory: artifacts.agent_memory,
      agent_predictions: artifacts.agent_predictions,
      provenance_audit_log: artifacts.provenance_audit_log,
      llm_usage: artifacts.llm_usage.data || []
    };

    console.log(JSON.stringify(traces, null, 2));
  } catch (error) {
    console.error('Failed to reconstruct trace', error instanceof Error ? error.message : error);
    process.exit(2);
  }
}

main();
