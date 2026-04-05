#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = process.cwd();
const WORKFLOWS_DIR = path.join(REPO_ROOT, '.github', 'workflows');

function countIndent(line) {
  let index = 0;
  while (index < line.length && line[index] === ' ') {
    index += 1;
  }
  return index;
}

export function analyzeWorkflowStepContract({ workflowPath, content }) {
  const lines = content.split(/\r?\n/);
  const violations = [];

  let stepsIndent = null;
  let currentStep = null;

  function finalizeCurrentStep() {
    if (!currentStep) {
      return;
    }

    if (!currentStep.hasUses && !currentStep.hasRun) {
      const stepName = currentStep.name ? ` (${currentStep.name})` : '';
      violations.push(
        `${workflowPath}:${currentStep.lineNumber} step${stepName} must define either \`uses\` or \`run\`.`
      );
    }

    currentStep = null;
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();
    const indent = countIndent(line);

    if (trimmed === '' || trimmed.startsWith('#')) {
      continue;
    }

    const isStepsKey = /^steps:\s*(#.*)?$/u.test(trimmed);

    if (stepsIndent === null) {
      if (isStepsKey) {
        stepsIndent = indent;
      }
      continue;
    }

    if (indent <= stepsIndent && !isStepsKey) {
      finalizeCurrentStep();
      stepsIndent = null;
      if (isStepsKey) {
        stepsIndent = indent;
      }
      continue;
    }

    if (isStepsKey && indent === stepsIndent) {
      finalizeCurrentStep();
      continue;
    }

    const stepStartMatch = line.match(/^\s*-\s*(.*)$/u);
    if (stepStartMatch && indent === stepsIndent + 2) {
      finalizeCurrentStep();

      const declaration = stepStartMatch[1].trim();
      const nameMatch = declaration.match(/^name:\s*(.+)$/u);
      const hasUses = /^uses:\s*.+$/u.test(declaration);
      const hasRun = /^run:\s*.+$/u.test(declaration);

      currentStep = {
        lineNumber: index + 1,
        name: nameMatch ? nameMatch[1].trim() : '',
        indent,
        hasUses,
        hasRun,
      };
      continue;
    }

    if (currentStep && indent > currentStep.indent) {
      if (/^\s*uses:\s*.+$/u.test(line)) {
        currentStep.hasUses = true;
      }
      if (/^\s*run:\s*.+$/u.test(line)) {
        currentStep.hasRun = true;
      }
      if (/^\s*name:\s*.+$/u.test(line) && !currentStep.name) {
        currentStep.name = line.replace(/^\s*name:\s*/u, '').trim();
      }
    }
  }

  finalizeCurrentStep();

  return violations;
}

export function runWorkflowStepContractCheck({ repoRoot = REPO_ROOT } = {}) {
  const workflowsDir = path.join(repoRoot, '.github', 'workflows');
  const workflowFiles = fs
    .readdirSync(workflowsDir)
    .filter((file) => file.endsWith('.yml') || file.endsWith('.yaml'))
    .map((file) => path.join(workflowsDir, file));

  const violations = [];

  for (const workflowFile of workflowFiles) {
    const relativePath = path.relative(repoRoot, workflowFile);
    const content = fs.readFileSync(workflowFile, 'utf8');
    violations.push(...analyzeWorkflowStepContract({ workflowPath: relativePath, content }));
  }

  return { workflowCount: workflowFiles.length, violations };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { workflowCount, violations } = runWorkflowStepContractCheck();

  if (violations.length > 0) {
    console.error('❌ Workflow step contract violations detected:');
    for (const violation of violations) {
      console.error(`- ${violation}`);
    }
    process.exit(1);
  }

  console.log(`✅ Workflow step contract verified across ${workflowCount} workflow files.`);
}
