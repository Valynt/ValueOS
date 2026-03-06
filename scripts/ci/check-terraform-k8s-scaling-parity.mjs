#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const hpaPath = resolve(root, 'infra/k8s/base/hpa.yaml');
const tfVariablesPath = resolve(root, 'infra/terraform/variables.tf');

const hpa = readFileSync(hpaPath, 'utf8');
const tfVariables = readFileSync(tfVariablesPath, 'utf8');

const parseHpaSection = (name) => {
  const re = new RegExp(`name:\\s*${name}[\\s\\S]*?minReplicas:\\s*(\\d+)[\\s\\S]*?maxReplicas:\\s*(\\d+)[\\s\\S]*?averageUtilization:\\s*(\\d+)`, 'm');
  const match = hpa.match(re);
  if (!match) {
    throw new Error(`Unable to parse min/max/cpu utilization for ${name} in ${hpaPath}`);
  }
  return {
    min: Number(match[1]),
    max: Number(match[2]),
    cpuTarget: Number(match[3]),
  };
};

const parseTfDefault = (name) => {
  const re = new RegExp(`variable\\s+"${name}"[\\s\\S]*?default\\s*=\\s*(\\d+)`, 'm');
  const match = tfVariables.match(re);
  if (!match) {
    throw new Error(`Unable to parse default for variable ${name} in ${tfVariablesPath}`);
  }
  return Number(match[1]);
};

const checks = [
  {
    label: 'backend min capacity',
    actual: parseTfDefault('backend_autoscaling_min_capacity'),
    expected: parseHpaSection('backend-hpa').min,
  },
  {
    label: 'backend max capacity',
    actual: parseTfDefault('backend_autoscaling_max_capacity'),
    expected: parseHpaSection('backend-hpa').max,
  },
  {
    label: 'backend cpu target',
    actual: parseTfDefault('backend_autoscaling_cpu_target'),
    expected: parseHpaSection('backend-hpa').cpuTarget,
  },
  {
    label: 'frontend min capacity',
    actual: parseTfDefault('frontend_autoscaling_min_capacity'),
    expected: parseHpaSection('frontend-hpa').min,
  },
  {
    label: 'frontend max capacity',
    actual: parseTfDefault('frontend_autoscaling_max_capacity'),
    expected: parseHpaSection('frontend-hpa').max,
  },
  {
    label: 'frontend cpu target',
    actual: parseTfDefault('frontend_autoscaling_cpu_target'),
    expected: parseHpaSection('frontend-hpa').cpuTarget,
  },
];

const mismatches = checks.filter((check) => check.actual !== check.expected);

if (mismatches.length > 0) {
  console.error('Terraform/K8s scaling parity check failed:');
  for (const mismatch of mismatches) {
    console.error(`- ${mismatch.label}: terraform=${mismatch.actual}, k8s=${mismatch.expected}`);
  }
  process.exit(1);
}

console.log('Terraform/K8s scaling parity check passed.');
