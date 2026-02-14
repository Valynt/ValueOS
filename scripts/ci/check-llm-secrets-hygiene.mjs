#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = resolve(import.meta.dirname, '../..');

function listFiles(glob) {
  try {
    const output = execSync(`rg --files -g '${glob}'`, { cwd: ROOT, encoding: 'utf8' }).trim();
    return output ? output.split('\n') : [];
  } catch {
    return [];
  }
}

function unique(items) {
  return [...new Set(items)];
}

const evidenceFiles = unique([
  ...listFiles('artifacts/**'),
  ...listFiles('reports/**'),
  ...listFiles('tests/**'),
  ...listFiles('**/*.log'),
  ...listFiles('**/*.out'),
]).filter((file) => !file.includes('node_modules/'));

const promptConstructionFiles = unique([
  ...listFiles('apps/**/*.{js,jsx,ts,tsx,mjs,cjs}'),
  ...listFiles('packages/**/*.{js,jsx,ts,tsx,mjs,cjs}'),
]).filter((file) => /(?:llm|prompt|agent)/i.test(file) && !file.includes('node_modules/') && !file.endsWith('.d.ts'));

const secretRules = [
  { id: 'openai-key', regex: /\bsk-[A-Za-z0-9]{20,}\b/g, message: 'Potential OpenAI-style secret key found.' },
  { id: 'anthropic-key', regex: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g, message: 'Potential Anthropic-style secret key found.' },
  { id: 'aws-access-key', regex: /\bAKIA[0-9A-Z]{16}\b/g, message: 'Potential AWS access key found.' },
  { id: 'github-pat', regex: /\bghp_[A-Za-z0-9]{36}\b/g, message: 'Potential GitHub personal access token found.' },
  {
    id: 'bearer-token-literal',
    regex: /\bBearer\s+[A-Za-z0-9._-]{20,}\b/g,
    message: 'Potential bearer token literal found.',
  },
];

const promptInterpolationRules = [
  {
    id: 'env-in-prompt-assignment',
    regex: /\b(?:prompt|systemPrompt|userPrompt|assistantPrompt|messages?)\b[^\n=]{0,80}[=:]\s*[^\n;]*process\.env\.[A-Z0-9_]+/gi,
    message: 'Raw process.env usage detected in prompt/message construction.',
  },
  {
    id: 'env-in-prompt-template',
    regex: /(?:prompt|systemPrompt|userPrompt|assistantPrompt|messages?)[^\n]{0,120}\$\{\s*process\.env\.[A-Z0-9_]+\s*\}/gi,
    message: 'Raw process.env interpolation detected in prompt/message template.',
  },
];

function scanFiles(files, rules, findings) {
  for (const file of files) {
    const content = readFileSync(resolve(ROOT, file), 'utf8');
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i += 1) {
      for (const rule of rules) {
        rule.regex.lastIndex = 0;
        if (rule.regex.test(lines[i])) {
          findings.push({ file, line: i + 1, rule: rule.id, message: rule.message });
        }
      }
    }
  }
}

const findings = [];
scanFiles(evidenceFiles, secretRules, findings);
scanFiles(promptConstructionFiles, promptInterpolationRules, findings);

if (findings.length > 0) {
  console.error('❌ LLM secrets hygiene checks failed:\n');
  for (const finding of findings) {
    console.error(`- ${finding.file}:${finding.line} [${finding.rule}] ${finding.message}`);
  }
  process.exit(1);
}

console.log('✅ LLM secrets hygiene checks passed');
console.log(`Scanned ${evidenceFiles.length} evidence file(s) and ${promptConstructionFiles.length} prompt-construction file(s).`);
