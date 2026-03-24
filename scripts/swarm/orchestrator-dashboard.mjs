#!/usr/bin/env node
/**
 * Swarm Orchestrator Dashboard
 * 
 * Tracks TypeScript error reduction progress across agent batches
 * Provides real-time visibility into swarm execution
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';

interface ProgressEntry {
  timestamp: string;
  totalErrors: number;
  errorsByPackage: Record<string, number>;
  errorsByCode: Record<string, number>;
  completedBatches: string[];
  inProgressBatches: string[];
  remainingBatches: string[];
}

interface DashboardState {
  startTime: string;
  currentPhase: string;
  baselineErrors: number;
  targetErrors: number;
  history: ProgressEntry[];
  velocity: number; // errors fixed per hour
  estimatedCompletion: string | null;
}

const PROGRESS_FILE = resolve('.windsurf/swarm/progress.json');
const BATCH_DIR = resolve('.windsurf/swarm/batches');
const BASELINE_FILE = resolve('.quality/baselines.json');

function ensureState(): DashboardState {
  if (!existsSync(PROGRESS_FILE)) {
    const baseline = loadBaseline();
    const initial: DashboardState = {
      startTime: new Date().toISOString(),
      currentPhase: 'phase-1-isolated-errors',
      baselineErrors: baseline.tsErrors || 7597,
      targetErrors: 100,
      history: [],
      velocity: 0,
      estimatedCompletion: null,
    };
    saveState(initial);
    return initial;
  }
  
  const raw = readFileSync(PROGRESS_FILE, 'utf-8');
  return JSON.parse(raw);
}

function saveState(state: DashboardState): void {
  const dir = resolve('.windsurf/swarm');
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(PROGRESS_FILE, JSON.stringify(state, null, 2));
}

function loadBaseline(): { tsErrors: number } {
  try {
    const raw = readFileSync(BASELINE_FILE, 'utf-8');
    const data = JSON.parse(raw);
    return { tsErrors: data.tsErrors || 7597 };
  } catch {
    return { tsErrors: 7597 };
  }
}

function countCurrentErrors(): number {
  try {
    const output = execSync('pnpm run typecheck:full 2>&1', {
      encoding: 'utf-8',
      maxBuffer: 50 * 1024 * 1024,
    });
    return output.split('\n').filter(l => l.includes('error TS')).length;
  } catch (error: any) {
    return error.stdout?.split('\n').filter((l: string) => l.includes('error TS')).length || 0;
  }
}

function countErrorsByPackage(): Record<string, number> {
  const configPath = resolve('.windsurf/swarm/agent-swarm-config.json');
  const config = JSON.parse(readFileSync(configPath, 'utf-8'));
  
  const counts: Record<string, number> = {};
  
  for (const pkg of config.packages) {
    try {
      const output = execSync(
        `pnpm --filter ${pkg.name} exec tsc --noEmit 2>&1 || true`,
        { encoding: 'utf-8', maxBuffer: 20 * 1024 * 1024 }
      );
      counts[pkg.name] = output.split('\n').filter(l => l.includes('error TS')).length;
    } catch {
      counts[pkg.name] = 0;
    }
  }
  
  return counts;
}

function countErrorsByCode(): Record<string, number> {
  try {
    const output = execSync('pnpm run typecheck:full 2>&1', {
      encoding: 'utf-8',
      maxBuffer: 50 * 1024 * 1024,
    });
    
    const codeCounts: Record<string, number> = {};
    const lines = output.split('\n');
    
    for (const line of lines) {
      const match = line.match(/error (TS\d+):/);
      if (match) {
        const code = match[1];
        codeCounts[code] = (codeCounts[code] || 0) + 1;
      }
    }
    
    return codeCounts;
  } catch {
    return {};
  }
}

function getBatchStatuses(): { completed: string[]; inProgress: string[]; remaining: string[] } {
  if (!existsSync(BATCH_DIR)) {
    return { completed: [], inProgress: [], remaining: [] };
  }
  
  const completed: string[] = [];
  const inProgress: string[] = [];
  const remaining: string[] = [];
  
  // Check for completion markers
  const fs = await import('fs');
  const files = fs.readdirSync(BATCH_DIR).filter(f => f.endsWith('.json') && f !== 'manifest.json');
  
  for (const file of files) {
    const batchId = file.replace('.json', '');
    const batchPath = resolve(BATCH_DIR, file);
    const completePath = resolve(BATCH_DIR, `${batchId}.complete`);
    const progressPath = resolve(BATCH_DIR, `${batchId}.progress`);
    
    if (existsSync(completePath)) {
      completed.push(batchId);
    } else if (existsSync(progressPath)) {
      inProgress.push(batchId);
    } else {
      remaining.push(batchId);
    }
  }
  
  return { completed, inProgress, remaining };
}

function calculateVelocity(state: DashboardState): number {
  if (state.history.length < 2) return 0;
  
  const first = state.history[0];
  const last = state.history[state.history.length - 1];
  
  const timeDiff = new Date(last.timestamp).getTime() - new Date(first.timestamp).getTime();
  const hoursDiff = timeDiff / (1000 * 60 * 60);
  
  if (hoursDiff === 0) return 0;
  
  const errorDiff = first.totalErrors - last.totalErrors;
  return errorDiff / hoursDiff;
}

function estimateCompletion(state: DashboardState, currentErrors: number): string | null {
  const velocity = calculateVelocity(state);
  if (velocity <= 0) return null;
  
  const remaining = currentErrors - state.targetErrors;
  const hoursRemaining = remaining / velocity;
  
  const completionDate = new Date();
  completionDate.setHours(completionDate.getHours() + hoursRemaining);
  
  return completionDate.toISOString();
}

function formatDuration(ms: number): string {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
}

function printDashboard(state: DashboardState, current: ProgressEntry): void {
  console.clear();
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║     TypeScript Zero Swarm - Orchestrator Dashboard             ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log();
  
  const elapsed = new Date().getTime() - new Date(state.startTime).getTime();
  const remaining = current.totalErrors - state.targetErrors;
  const percentComplete = ((state.baselineErrors - current.totalErrors) / state.baselineErrors * 100).toFixed(1);
  
  console.log('📊 PROGRESS OVERVIEW');
  console.log('─────────────────────────────────────────────────────────────────');
  console.log(`  Start Time:        ${new Date(state.startTime).toLocaleString()}`);
  console.log(`  Elapsed:           ${formatDuration(elapsed)}`);
  console.log(`  Current Phase:     ${state.currentPhase}`);
  console.log();
  console.log(`  Baseline Errors:   ${state.baselineErrors.toLocaleString()}`);
  console.log(`  Current Errors:    ${current.totalErrors.toLocaleString()}`);
  console.log(`  Target Errors:     ${state.targetErrors.toLocaleString()}`);
  console.log(`  Remaining:         ${remaining.toLocaleString()}`);
  console.log(`  Progress:          ${percentComplete}%`);
  console.log();
  
  if (state.velocity > 0) {
    console.log(`  Velocity:          ${state.velocity.toFixed(1)} errors/hour`);
    if (state.estimatedCompletion) {
      const eta = new Date(state.estimatedCompletion);
      console.log(`  Estimated Done:    ${eta.toLocaleString()}`);
    }
  }
  console.log();
  
  console.log('📦 ERRORS BY PACKAGE');
  console.log('─────────────────────────────────────────────────────────────────');
  const sortedPackages = Object.entries(current.errorsByPackage)
    .sort((a, b) => b[1] - a[1]);
  
  for (const [pkg, count] of sortedPackages) {
    const bar = '█'.repeat(Math.min(count / 100, 50));
    console.log(`  ${pkg.padEnd(25)} ${count.toString().padStart(5)} ${bar}`);
  }
  console.log();
  
  console.log('🔤 TOP ERROR CODES');
  console.log('─────────────────────────────────────────────────────────────────');
  const sortedCodes = Object.entries(current.errorsByCode)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  
  for (const [code, count] of sortedCodes) {
    console.log(`  ${code}: ${count.toString().padStart(5)} errors`);
  }
  console.log();
  
  console.log('🐝 BATCH STATUS');
  console.log('─────────────────────────────────────────────────────────────────');
  console.log(`  ✅ Completed:   ${current.completedBatches.length}`);
  console.log(`  🔄 In Progress: ${current.inProgressBatches.length}`);
  console.log(`  ⏳ Remaining:   ${current.remainingBatches.length}`);
  console.log();
  
  console.log('─────────────────────────────────────────────────────────────────');
  console.log('Last updated:', new Date().toLocaleTimeString());
  console.log();
}

async function update(): Promise<void> {
  const state = ensureState();
  
  console.log('Collecting metrics...');
  const currentErrors = countCurrentErrors();
  const byPackage = countErrorsByPackage();
  const byCode = countErrorsByCode();
  const batches = getBatchStatuses();
  
  const entry: ProgressEntry = {
    timestamp: new Date().toISOString(),
    totalErrors: currentErrors,
    errorsByPackage: byPackage,
    errorsByCode: byCode,
    completedBatches: batches.completed,
    inProgressBatches: batches.inProgress,
    remainingBatches: batches.remaining,
  };
  
  state.history.push(entry);
  state.velocity = calculateVelocity(state);
  state.estimatedCompletion = estimateCompletion(state, currentErrors);
  
  saveState(state);
  printDashboard(state, entry);
}

async function watch(intervalSeconds: number = 60): Promise<void> {
  console.log(`Starting watch mode (updating every ${intervalSeconds}s)...`);
  console.log('Press Ctrl+C to exit\n');
  
  // Initial update
  await update();
  
  // Periodic updates
  const interval = setInterval(() => {
    update().catch(console.error);
  }, intervalSeconds * 1000);
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    clearInterval(interval);
    console.log('\nDashboard stopped.');
    process.exit(0);
  });
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'update';
  
  switch (command) {
    case 'update':
      await update();
      break;
    case 'watch':
      const interval = parseInt(args[1]) || 60;
      await watch(interval);
      break;
    case 'reset':
      if (existsSync(PROGRESS_FILE)) {
        // Keep as backup
        const backup = PROGRESS_FILE.replace('.json', `-${Date.now()}.json`);
        writeFileSync(backup, readFileSync(PROGRESS_FILE));
      }
      ensureState();
      console.log('Dashboard state reset.');
      break;
    default:
      console.log('Usage: node orchestrator-dashboard.mjs [update|watch|reset]');
      console.log('  update - Single snapshot update');
      console.log('  watch [seconds] - Continuous monitoring');
      console.log('  reset - Reset state (keeps backup)');
  }
}

main().catch(console.error);
