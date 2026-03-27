#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function run(command, args) {
  const printable = [command, ...args].join(' ');
  console.log(`\n▶ ${printable}`);
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    env: process.env,
    shell: false,
  });

  if (result.status !== 0) {
    throw new Error(`Command failed (${result.status ?? 'unknown'}): ${printable}`);
  }
}

function main() {
  const baseSha = requiredEnv('CI_BASE_SHA');
  const headSha = requiredEnv('CI_HEAD_SHA');

  const sharedChecks = [
    ['pnpm', ['run', 'typecheck:signal', '--verify']],
    ['pnpm', ['run', 'ci:governance:self-check']],
    ['pnpm', ['check:runtime-sentinels']],
    ['pnpm', ['check:kong-cors-origins']],
    ['npx', ['turbo', 'run', 'typecheck']],
    ['pnpm', ['--filter', '@valueos/backend', 'exec', 'vitest', 'run', 'src/__tests__/req-as-any-guard.test.ts']],
    ['node', ['scripts/ci/check-generated-src-artifacts.mjs', `--base-sha=${baseSha}`, `--head-sha=${headSha}`]],
    [
      'node',
      [
        'scripts/ci/check-k8s-manifest-maturity.mjs',
        '--mode=transition-check',
        '--ledger-path=infra/k8s/manifest-maturity-ledger.json',
        `--base-sha=${baseSha}`,
        `--head-sha=${headSha}`,
      ],
    ],
    ['node', ['scripts/ci/check-vitest-workspace-packages.mjs']],
  ];

  for (const [command, args] of sharedChecks) {
    run(command, args);
  }

  console.log('\n✅ Shared governance assertions passed.');
}

main();
