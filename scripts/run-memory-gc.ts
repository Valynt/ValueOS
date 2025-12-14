#!/usr/bin/env ts-node
import { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../src/lib/supabase';
import { LLMGateway } from '../src/lib/agent-fabric/LLMGateway';
import { MemorySystem } from '../src/lib/agent-fabric/MemorySystem';
import { MemoryGarbageCollector } from '../src/lib/agent-fabric/MemoryGarbageCollector';

(async () => {
  const llmGateway = new LLMGateway(supabase as any);
  const memorySystem = new MemorySystem(supabase as any, llmGateway);
  const gc = new MemoryGarbageCollector(memorySystem, supabase as any);
  const deleted = await gc.runOnce(1000);
  console.log('Deleted', deleted, 'expired memories');
})();
