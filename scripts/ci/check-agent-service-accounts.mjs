#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const deploymentFiles = execSync("rg --files infra/k8s/base/agents -g '**/deployment.yaml'", { encoding: 'utf8' })
  .trim()
  .split(/\r?\n/)
  .filter(Boolean)
  .sort();

const serviceAccountsManifest = readFileSync('infra/k8s/base/agents/serviceaccounts.yaml', 'utf8');

const failures = [];
const seenServiceAccounts = new Map();

for (const file of deploymentFiles) {
  const raw = readFileSync(file, 'utf8');
  const deploymentName = raw.match(/metadata:\n(?:[ \t].*\n)*?[ \t]+name:\s*([^\n]+)/)?.[1]?.trim() ?? file;
  const serviceAccountName = raw.match(/serviceAccountName:\s*([^\s]+)/)?.[1]?.trim();

  if (!serviceAccountName) {
    failures.push(`${file} (${deploymentName}) is missing spec.template.spec.serviceAccountName.`);
    continue;
  }

  if (serviceAccountName === 'valynt-agent') {
    failures.push(`${file} (${deploymentName}) still uses shared service account 'valynt-agent'.`);
  }

  if (seenServiceAccounts.has(serviceAccountName)) {
    failures.push(
      `${file} (${deploymentName}) reuses service account '${serviceAccountName}' already used by ${seenServiceAccounts.get(serviceAccountName)}.`
    );
  } else {
    seenServiceAccounts.set(serviceAccountName, `${file} (${deploymentName})`);
  }

  const saRegex = new RegExp(`kind:\\s*ServiceAccount[\\s\\S]*?name:\\s*${serviceAccountName}\\b`, 'm');
  if (!saRegex.test(serviceAccountsManifest)) {
    failures.push(`${file} (${deploymentName}) references '${serviceAccountName}' but it is not defined in infra/k8s/base/agents/serviceaccounts.yaml.`);
  }
}

if (failures.length > 0) {
  console.error('❌ Agent service account validation failed:');
  for (const failure of failures) {
    console.error(`  - ${failure}`);
  }
  process.exit(1);
}

console.log(`✅ Agent service account validation passed (${deploymentFiles.length} deployments checked).`);
