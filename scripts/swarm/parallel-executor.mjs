#!/usr/bin/env node
/**
 * Parallel Batch Executor for TypeScript Swarm
 * 
 * Manages multiple concurrent agent executions with dependency resolution
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';

interface Batch {
  id: string;
  agentRole: string;
  errorCount: number;
  fileCount: number;
  effortMinutes: number;
  dependencies: string[];
}

interface BatchManifest {
  generatedAt: string;
  totalBatches: number;
  totalErrors: number;
  totalEstimatedMinutes: number;
  batches: Batch[];
}

interface ExecutionState {
  startTime: string;
  concurrency: number;
  completed: string[];
  inProgress: string[];
  failed: string[];
  remaining: string[];
}

const BATCH_DIR = resolve('.windsurf/swarm/batches');
const MANIFEST_PATH = resolve(BATCH_DIR, 'manifest.json');
const STATE_PATH = resolve('.windsurf/swarm/execution-state.json');
const LOG_DIR = resolve('.windsurf/swarm/logs');

function ensureDirectories(): void {
  [BATCH_DIR, LOG_DIR].forEach(dir => {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  });
}

function loadManifest(): BatchManifest {
  if (!existsSync(MANIFEST_PATH)) {
    throw new Error('Batch manifest not found. Run partition-ts-errors.mjs first.');
  }
  const raw = readFileSync(MANIFEST_PATH, 'utf-8');
  return JSON.parse(raw);
}

function loadState(): ExecutionState {
  if (!existsSync(STATE_PATH)) {
    return {
      startTime: new Date().toISOString(),
      concurrency: 4,
      completed: [],
      inProgress: [],
      failed: [],
      remaining: []
    };
  }
  const raw = readFileSync(STATE_PATH, 'utf-8');
  return JSON.parse(raw);
}

function saveState(state: ExecutionState): void {
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

function isBatchComplete(batchId: string): boolean {
  return existsSync(resolve(BATCH_DIR, `${batchId}.complete`));
}

function isBatchInProgress(batchId: string): boolean {
  return existsSync(resolve(BATCH_DIR, `${batchId}.progress`));
}

function canExecuteBatch(batch: Batch, completedIds: string[]): boolean {
  for (const dep of batch.dependencies) {
    if (!completedIds.includes(dep) && !isBatchComplete(dep)) {
      return false;
    }
  }
  return true;
}

function getNextRunnableBatches(manifest: BatchManifest, state: ExecutionState): Batch[] {
  const allCompleted = [
    ...state.completed,
    ...manifest.batches.filter(b => isBatchComplete(b.id)).map(b => b.id)
  ];
  
  const available = manifest.batches.filter(b => {
    if (isBatchComplete(b.id) || isBatchInProgress(b.id)) return false;
    return canExecuteBatch(b, allCompleted);
  });
  
  // Sort by priority (fewer dependencies first, then by effort)
  return available.sort((a, b) => {
    if (a.dependencies.length !== b.dependencies.length) {
      return a.dependencies.length - b.dependencies.length;
    }
    return a.effortMinutes - b.effortMinutes;
  });
}

function executeBatch(batch: Batch): { success: boolean; error?: string } {
  const logFile = resolve(LOG_DIR, `${batch.id}.log`);
  
  try {
    console.log(`  🚀 Starting ${batch.id} (${batch.errorCount} errors, ${batch.fileCount} files)`);
    
    execSync(
      `node scripts/swarm/execute-batch.mjs ${batch.id} 2>&1 | tee ${logFile}`,
      {
        encoding: 'utf-8',
        cwd: resolve('.'),
        timeout: 10 * 60 * 1000 // 10 minute timeout per batch
      }
    );
    
    return { success: true };
  } catch (error: any) {
    return { 
      success: false, 
      error: error.message 
    };
  }
}

function printStatus(manifest: BatchManifest, state: ExecutionState): void {
  const total = manifest.totalBatches;
  const completed = manifest.batches.filter(b => isBatchComplete(b.id)).length;
  const inProgress = manifest.batches.filter(b => isBatchInProgress(b.id)).length;
  const remaining = total - completed - inProgress;
  const percent = ((completed / total) * 100).toFixed(1);
  
  console.log('\n┌────────────────────────────────────────────────────────────┐');
  console.log('│              Swarm Execution Status                        │');
  console.log('├────────────────────────────────────────────────────────────┤');
  console.log(`│  Total Batches:    ${total.toString().padEnd(6)} │  Completed: ${completed.toString().padEnd(5)} (${percent}%) │`);
  console.log(`│  In Progress:     ${inProgress.toString().padEnd(6)} │  Remaining: ${remaining.toString().padEnd(5)}         │`);
  console.log('└────────────────────────────────────────────────────────────┘');
  
  if (state.failed.length > 0) {
    console.log(`\n⚠️  Failed batches: ${state.failed.join(', ')}`);
  }
}

async function runSequential(limit?: number): Promise<void> {
  ensureDirectories();
  const manifest = loadManifest();
  const state = loadState();
  
  console.log(`\n🐝 Starting sequential execution (limit: ${limit || 'none'})`);
  console.log(`   Manifest: ${manifest.totalBatches} batches, ${manifest.totalErrors} errors\n`);
  
  let processed = 0;
  
  while (true) {
    const runnable = getNextRunnableBatches(manifest, state);
    
    if (runnable.length === 0) break;
    if (limit && processed >= limit) {
      console.log(`\n⏹️  Reached limit of ${limit} batches`);
      break;
    }
    
    const batch = runnable[0];
    
    printStatus(manifest, state);
    console.log(`\n▶️  Executing batch ${processed + 1}${limit ? `/${limit}` : ''}`);
    
    const result = executeBatch(batch);
    
    if (result.success) {
      state.completed.push(batch.id);
      console.log(`  ✅ Completed ${batch.id}`);
    } else {
      state.failed.push(batch.id);
      console.log(`  ❌ Failed ${batch.id}: ${result.error}`);
    }
    
    saveState(state);
    processed++;
    
    // Brief pause between batches
    await new Promise(r => setTimeout(r, 1000));
  }
  
  printStatus(manifest, state);
  
  if (state.failed.length === 0) {
    console.log('\n🎉 All batches processed successfully!');
  } else {
    console.log(`\n⚠️  ${state.failed.length} batch(es) failed. Check logs in ${LOG_DIR}`);
  }
}

async function runParallel(maxConcurrency: number): Promise<void> {
  ensureDirectories();
  const manifest = loadManifest();
  const state = loadState();
  
  console.log(`\n🐝 Starting parallel execution (concurrency: ${maxConcurrency})`);
  console.log(`   Manifest: ${manifest.totalBatches} batches, ${manifest.totalErrors} errors\n`);
  
  let running = 0;
  const queue: Batch[] = [];
  
  async function processBatch(batch: Batch): Promise<void> {
    running++;
    state.inProgress.push(batch.id);
    saveState(state);
    
    const result = executeBatch(batch);
    
    state.inProgress = state.inProgress.filter(id => id !== batch.id);
    
    if (result.success) {
      state.completed.push(batch.id);
      console.log(`  ✅ Completed ${batch.id}`);
    } else {
      state.failed.push(batch.id);
      console.log(`  ❌ Failed ${batch.id}: ${result.error}`);
    }
    
    running--;
    saveState(state);
  }
  
  function fillQueue(): void {
    const runnable = getNextRunnableBatches(manifest, state);
    for (const batch of runnable) {
      if (running + queue.length < maxConcurrency && !queue.find(b => b.id === batch.id)) {
        queue.push(batch);
      }
    }
  }
  
  while (true) {
    fillQueue();
    
    if (queue.length === 0 && running === 0) break;
    
    while (queue.length > 0 && running < maxConcurrency) {
      const batch = queue.shift()!;
      processBatch(batch).catch(err => {
        console.error(`Error in batch ${batch.id}:`, err);
        state.failed.push(batch.id);
        running--;
      });
    }
    
    printStatus(manifest, state);
    
    // Wait a bit before checking for more work
    await new Promise(r => setTimeout(r, 2000));
  }
  
  printStatus(manifest, state);
  
  if (state.failed.length === 0) {
    console.log('\n🎉 All batches processed successfully!');
  } else {
    console.log(`\n⚠️  ${state.failed.length} batch(es) failed. Check logs in ${LOG_DIR}`);
  }
}

function resetState(): void {
  if (existsSync(STATE_PATH)) {
    const backup = STATE_PATH.replace('.json', `-${Date.now()}.json`);
    writeFileSync(backup, readFileSync(STATE_PATH));
  }
  
  saveState({
    startTime: new Date().toISOString(),
    concurrency: 4,
    completed: [],
    inProgress: [],
    failed: [],
    remaining: []
  });
  
  console.log('Execution state reset.');
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'sequential';
  
  switch (command) {
    case 'sequential':
      const limit = args[1] ? parseInt(args[1]) : undefined;
      await runSequential(limit);
      break;
    case 'parallel':
      const concurrency = args[1] ? parseInt(args[1]) : 4;
      await runParallel(concurrency);
      break;
    case 'reset':
      resetState();
      break;
    case 'status':
      const manifest = loadManifest();
      const state = loadState();
      printStatus(manifest, state);
      break;
    default:
      console.log('Usage: node parallel-executor.mjs [command] [options]');
      console.log('  sequential [limit]  - Run batches one at a time');
      console.log('  parallel [n]        - Run up to n batches concurrently (default: 4)');
      console.log('  status              - Show current execution status');
      console.log('  reset               - Reset execution state');
  }
}

main().catch(console.error);
