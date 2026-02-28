import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const yamlFiles = execSync("rg --files infra/k8s -g '*.yaml'", { encoding: 'utf8' })
  .split('\n')
  .map((entry) => entry.trim())
  .filter(Boolean);

const violations = [];

for (const file of yamlFiles) {
  const raw = readFileSync(file, 'utf8');
  const docs = raw.split(/^---\s*$/m);

  docs.forEach((doc, idx) => {
    const text = doc.trim();
    if (!text) return;

    const isNetworkPolicy = /kind:\s*NetworkPolicy\b/.test(text);
    const hasAgentComponentSelector = /podSelector:\s*[\s\S]*?matchLabels:\s*[\s\S]*?component:\s*agent\b/.test(text);
    const isAgentPolicyScope =
      file.includes('infra/k8s/base/agents/') || file.includes('infra/k8s/overlays/production/');

    if (isAgentPolicyScope && isNetworkPolicy && hasAgentComponentSelector && /\begress\s*:/.test(text)) {
      violations.push(`${file}#${idx + 1}: broad egress policy for component=agent is forbidden.`);
    }

    if (isAgentPolicyScope && isNetworkPolicy && hasAgentComponentSelector && /cidr:\s*0\.0\.0\.0\/0/.test(text)) {
      violations.push(`${file}#${idx + 1}: wildcard egress cidr 0.0.0.0/0 for agents is forbidden.`);
    }

    const isAuthorizationPolicy = /kind:\s*AuthorizationPolicy\b/.test(text);
    const isAllow = /action:\s*ALLOW\b/.test(text);
    const hasAgentComponentAllow = /selector:\s*[\s\S]*?matchLabels:\s*[\s\S]*?component:\s*agent\b/.test(text);
    const isProdScope = file.includes('infra/k8s/overlays/production/') || file.includes('infra/k8s/security/');

    if (isAuthorizationPolicy && isAllow && hasAgentComponentAllow && isProdScope) {
      violations.push(`${file}#${idx + 1}: component-wide ALLOW authorization policies are forbidden; scope to app.kubernetes.io/name.`);
    }
  });
}

if (violations.length > 0) {
  console.error('Agent policy guardrails check failed:\n');
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log('Agent policy guardrails check passed.');
