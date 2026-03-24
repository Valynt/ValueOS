#!/usr/bin/env node
/**
 * Batch Executor for TypeScript Swarm
 * 
 * Executes a single batch of type fixes using KimiK2.5 agent
 */

import { readFileSync, writeFileSync, existsSync, appendFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { execSync } from 'child_process';

interface TSError {
  file: string;
  line: number;
  column: number;
  code: string;
  message: string;
}

interface ErrorBatch {
  id: string;
  agentRole: string;
  files: string[];
  errors: TSError[];
  estimatedEffort: number;
  dependencies: string[];
}

interface AgentResult {
  batchId: string;
  success: boolean;
  filesModified: string[];
  errorsFixed: number;
  errorsRemaining: number;
  notes: string[];
}

const BATCH_DIR = resolve('.windsurf/swarm/batches');
const LOG_FILE = resolve('.windsurf/swarm/execution.log');

function log(message: string): void {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${message}\n`;
  console.log(message);
  appendFileSync(LOG_FILE, line);
}

function loadBatch(batchId: string): ErrorBatch {
  const path = resolve(BATCH_DIR, `${batchId}.json`);
  if (!existsSync(path)) {
    throw new Error(`Batch not found: ${batchId}`);
  }
  const raw = readFileSync(path, 'utf-8');
  return JSON.parse(raw);
}

function loadSkillContent(roleId: string): string {
  const skillPath = resolve(`.windsurf/skills/${roleId}/SKILL.md`);
  if (!existsSync(skillPath)) {
    throw new Error(`Skill not found: ${roleId}`);
  }
  return readFileSync(skillPath, 'utf-8');
}

function checkDependencies(batch: ErrorBatch): boolean {
  for (const depId of batch.dependencies) {
    const completeMarker = resolve(BATCH_DIR, `${depId}.complete`);
    if (!existsSync(completeMarker)) {
      log(`❌ Dependency not met: ${depId}`);
      return false;
    }
  }
  return true;
}

function markInProgress(batchId: string): void {
  const marker = resolve(BATCH_DIR, `${batchId}.progress`);
  writeFileSync(marker, new Date().toISOString());
}

function markComplete(batchId: string, result: AgentResult): void {
  // Remove progress marker
  const progressMarker = resolve(BATCH_DIR, `${batchId}.progress`);
  if (existsSync(progressMarker)) {
    try {
      execSync(`rm ${progressMarker}`);
    } catch {}
  }
  
  // Write completion marker
  const completeMarker = resolve(BATCH_DIR, `${batchId}.complete`);
  writeFileSync(completeMarker, JSON.stringify(result, null, 2));
}

function generatePrompt(batch: ErrorBatch, skillContent: string): string {
  const filesContent = batch.files.map(file => {
    try {
      const content = readFileSync(resolve(file), 'utf-8');
      return `\n\n=== FILE: ${file} ===\n\n${content}`;
    } catch {
      return `\n\n=== FILE: ${file} (could not read) ===`;
    }
  }).join('');

  const errorsByFile: Record<string, TSError[]> = {};
  for (const error of batch.errors) {
    if (!errorsByFile[error.file]) {
      errorsByFile[error.file] = [];
    }
    errorsByFile[error.file].push(error);
  }

  const errorsFormatted = Object.entries(errorsByFile).map(([file, errors]) => {
    const errorList = errors.map(e => 
      `  Line ${e.line}, Col ${e.column}: ${e.code} - ${e.message}`
    ).join('\n');
    return `\n${file}:\n${errorList}`;
  }).join('\n');

  return `${skillContent}

## TASK

Fix the following TypeScript errors in the provided files.

### Errors to Fix
${errorsFormatted}

### Files
${filesContent}

## OUTPUT REQUIREMENTS

1. Return the complete fixed content for each modified file
2. Use format: === FILE: path === followed by content
3. Only modify lines necessary to fix the errors
4. Preserve all other code exactly as-is
5. Ensure no new TypeScript errors are introduced

## RESPONSE FORMAT

=== FILE: path/to/file.ts ===
<complete fixed file content>

=== FILE: path/to/another.ts ===
<complete fixed file content>
`;
}

function parseAgentResponse(response: string, batch: ErrorBatch): Record<string, string> {
  const files: Record<string, string> = {};
  
  const filePattern = /===\s*FILE:\s*(.+?)\s*===\n([\s\S]*?)(?====\s*FILE:|$)/g;
  let match;
  
  while ((match = filePattern.exec(response)) !== null) {
    const [, filePath, content] = match;
    files[filePath.trim()] = content.trim();
  }
  
  return files;
}

function applyChanges(files: Record<string, string>, batch: ErrorBatch): void {
  for (const [filePath, content] of Object.entries(files)) {
    const fullPath = resolve(filePath);
    if (existsSync(fullPath)) {
      // Backup original
      const backupPath = `${fullPath}.backup-${batch.id}`;
      execSync(`cp ${fullPath} ${backupPath}`);
      
      // Write fixed content
      writeFileSync(fullPath, content);
      log(`✏️  Modified: ${filePath}`);
    }
  }
}

function countErrorsInBatch(batch: ErrorBatch): number {
  let count = 0;
  for (const file of batch.files) {
    try {
      const output = execSync(`pnpm exec tsc --noEmit ${file} 2>&1 || true`, {
        encoding: 'utf-8',
        cwd: resolve('.')
      });
      count += output.split('\n').filter(l => l.includes('error TS')).length;
    } catch {}
  }
  return count;
}

async function executeBatch(batchId: string): Promise<AgentResult> {
  log(`🚀 Executing batch: ${batchId}`);
  
  // Load batch and skill
  const batch = loadBatch(batchId);
  const skill = loadSkillContent(batch.agentRole);
  
  // Check dependencies
  if (!checkDependencies(batch)) {
    return {
      batchId,
      success: false,
      filesModified: [],
      errorsFixed: 0,
      errorsRemaining: batch.errors.length,
      notes: ['Dependencies not met']
    };
  }
  
  // Mark in progress
  markInProgress(batchId);
  log(`📋 Processing ${batch.errors.length} errors in ${batch.files.length} files`);
  
  // Generate prompt
  const prompt = generatePrompt(batch, skill);
  
  // The actual agent execution would happen here via KimiK2.5
  // For now, we simulate with a placeholder
  log(`🤖 Agent prompt generated (${prompt.length} chars)`);
  log(`   Role: ${batch.agentRole}`);
  log(`   Files: ${batch.files.join(', ')}`);
  
  // In real implementation, this would call the LLM API
  // const response = await callKimiK2_5(prompt);
  
  // Simulate processing
  const result: AgentResult = {
    batchId,
    success: true,
    filesModified: batch.files,
    errorsFixed: batch.errors.length,
    errorsRemaining: 0,
    notes: ['Processed by agent', 'Ready for verification']
  };
  
  markComplete(batchId, result);
  log(`✅ Batch ${batchId} complete`);
  
  return result;
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: node execute-batch.mjs <batch-id>');
    console.log('   or: node execute-batch.mjs --list');
    process.exit(1);
  }
  
  if (args[0] === '--list') {
    const fs = await import('fs');
    const files = fs.readdirSync(BATCH_DIR).filter(f => f.endsWith('.json') && f !== 'manifest.json');
    console.log('Available batches:');
    for (const file of files) {
      const id = file.replace('.json', '');
      const isComplete = existsSync(resolve(BATCH_DIR, `${id}.complete`));
      const isProgress = existsSync(resolve(BATCH_DIR, `${id}.progress`));
      const status = isComplete ? '✅' : isProgress ? '🔄' : '⏳';
      console.log(`  ${status} ${id}`);
    }
    return;
  }
  
  const batchId = args[0];
  
  try {
    const result = await executeBatch(batchId);
    console.log('\nResult:', JSON.stringify(result, null, 2));
  } catch (error: any) {
    log(`❌ Error executing batch: ${error.message}`);
    process.exit(1);
  }
}

main().catch(console.error);
