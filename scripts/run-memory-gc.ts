#!/usr/bin/env ts-node
/**
 * Memory Garbage Collection Runner
 * 
 * Scheduled job to clean up old agent memories and maintain database health
 */

import { supabase } from '../src/lib/supabase';
import { LLMGateway } from '../src/lib/agent-fabric/LLMGateway';
import { MemorySystem } from '../src/lib/agent-fabric/MemorySystem';
import { MemoryGarbageCollector } from '../src/lib/agent-fabric/MemoryGarbageCollector';
import { logger } from '../src/lib/logger';

async function main() {
  const startTime = Date.now();
  const batchSize = parseInt(process.env.GC_BATCH_SIZE || '1000', 10);
  const retentionDays = parseInt(process.env.RETENTION_DAYS || '30', 10);
  
  console.log('🗑️  Memory Garbage Collection');
  console.log('================================\n');
  console.log(`Batch size: ${batchSize}`);
  console.log(`Retention: ${retentionDays} days\n`);
  
  try {
    // Initialize components
    const llmGateway = new LLMGateway(supabase as any);
    const memorySystem = new MemorySystem(supabase as any, llmGateway);
    const gc = new MemoryGarbageCollector(memorySystem, supabase as any);
    
    // Run garbage collection
    logger.info('Starting memory GC', { batchSize, retentionDays });
    const deleted = await gc.runOnce(batchSize);
    
    const duration = Date.now() - startTime;
    
    logger.info('Memory GC completed', {
      deleted,
      duration,
      batchSize
    });
    
    console.log(`\n✅ Garbage Collection Complete`);
    console.log(`  Memories deleted: ${deleted.toLocaleString()}`);
    console.log(`  Duration: ${(duration / 1000).toFixed(2)}s\n`);
    
    // Log to audit table
    await supabase
      .from('security_audit_log')
      .insert({
        event_type: 'memory_gc_completed',
        severity: 'info',
        details: {
          deleted,
          duration,
          batchSize,
          retentionDays
        }
      });
    
    process.exit(0);
  } catch (error) {
    logger.error('Memory GC failed', { error });
    
    console.error('\n❌ Garbage Collection Failed');
    console.error(error);
    
    // Log failure
    await supabase
      .from('security_audit_log')
      .insert({
        event_type: 'memory_gc_failed',
        severity: 'error',
        details: {
          error: error instanceof Error ? error.message : String(error)
        }
      });
    
    process.exit(1);
  }
}

main();
