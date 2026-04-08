#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const workflowsDir = path.join(repoRoot, '.github', 'workflows');
const packageJsonPath = path.join(repoRoot, 'package.json');

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const scripts = packageJson.scripts ?? {};
const packageScripts = new Set(Object.keys(scripts));
const canonicalScriptPlatformGuards = [
  {
    scriptName: 'db:migrate',
    canonicalCommand: 'bash scripts/db/apply-migrations.sh',
    disallowPattern: /(\\|\.cmd\b|\.bat\b|powershell|pwsh|\.ps1\b)/i,
  },
];
const knownPnpmCommands = new Set([
  'add',
  'approve-builds',
  'audit',
  'bin',
  'cache',
  'changeset',
  'config',
  'create',
  'dedupe',
  'deploy',
  'dlx',
  'doctor',
  'env',
  'exec',
  'fetch',
  'help',
  'import',
  'info',
  'init',
  'install',
  'licenses',
  'link',
  'list',
  'login',
  'logout',
  'outdated',
  'pack',
  'patch',
  'patch-commit',
  'publish',
  'rebuild',
  'recursive',
  'remove',
  'root',
  'server',
  'setup',
  'store',
  'test',
  'unlink',
  'update',
  'up',
  'why',
]);
const optionCommands = new Set(['-C', '--dir', '--filter', '-F', '--workspace-root']);

function extractScriptReference(commandLine) {
  const trimmed = commandLine.trim();
  if (!trimmed.startsWith('pnpm ')) {
    return null;
  }
  if (trimmed.includes('|') || trimmed.includes('&&') || trimmed.includes('||')) {
    return null;
  }

  const tokens = trimmed.split(/\s+/);
  let index = 1;
  while (index < tokens.length) {
    const token = tokens[index];
    if (optionCommands.has(token)) {
      index += 2;
      continue;
    }
    if (token.startsWith('-')) {
      index += 1;
      continue;
    }
    if (token === 'run') {
      return tokens[index + 1] ?? null;
    }
    if (knownPnpmCommands.has(token)) {
      return null;
    }
    return token.includes(':') ? token : null;
  }

  return null;
}

const workflowFiles = fs.readdirSync(workflowsDir)
  .filter((file) => file.endsWith('.yml') || file.endsWith('.yaml'))
  .sort();

const missing = [];
function isGuardedOptionalScript(lines, lineIndex, scriptName) {
  const windowStart = Math.max(0, lineIndex - 3);
  const escapedScriptName = scriptName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const guardPattern = new RegExp(`pnpm\\s+-s\\s+run\\s+\\|.*${escapedScriptName}`);
  for (let cursor = windowStart; cursor < lineIndex; cursor += 1) {
    if (guardPattern.test(lines[cursor])) {
      return true;
    }
  }
  return false;
}
for (const workflowFile of workflowFiles) {
  const workflowPath = path.join(workflowsDir, workflowFile);
  const lines = fs.readFileSync(workflowPath, 'utf8').split(/\r?\n/);
  for (const [lineIndex, line] of lines.entries()) {
    const scriptName = extractScriptReference(line);
    if (!scriptName) {
      continue;
    }
    if (!packageScripts.has(scriptName)) {
      if (isGuardedOptionalScript(lines, lineIndex, scriptName)) {
        continue;
      }
      missing.push(`${path.relative(repoRoot, workflowPath)}:${lineIndex + 1} -> ${scriptName}`);
    }
  }
}

if (missing.length > 0) {
  console.error('❌ Workflow pnpm script references missing from package.json:');
  for (const item of missing) {
    console.error(` - ${item}`);
  }
  process.exit(1);
}

const scriptCommandViolations = [];
for (const guard of canonicalScriptPlatformGuards) {
  const actualCommand = scripts[guard.scriptName];
  if (!actualCommand) {
    scriptCommandViolations.push(
      `${guard.scriptName} is missing (expected: "${guard.canonicalCommand}")`,
    );
    continue;
  }
  if (guard.disallowPattern.test(actualCommand)) {
    scriptCommandViolations.push(
      `${guard.scriptName} must not point to an OS-specific command ("${actualCommand}")`,
    );
    continue;
  }
  if (actualCommand !== guard.canonicalCommand) {
    scriptCommandViolations.push(
      `${guard.scriptName} drifted from canonical command. expected "${guard.canonicalCommand}" but found "${actualCommand}"`,
    );
  }
}

if (scriptCommandViolations.length > 0) {
  console.error('❌ Canonical package script drift detected:');
  for (const item of scriptCommandViolations) {
    console.error(` - ${item}`);
  }
  process.exit(1);
}

console.log(`✅ Verified workflow pnpm script references against package.json across ${workflowFiles.length} workflow files.`);
