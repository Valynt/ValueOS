#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../..');
const terraformFile = resolve(ROOT, 'infra/environments/dev/terraform/main.tf');
const content = readFileSync(terraformFile, 'utf8');

const failures = [];

const permissiveDbIngressPattern =
  /resource\s+"aws_security_group"\s+"dev_db"[\s\S]*?ingress\s*{[^}]*from_port\s*=\s*5432[^}]*to_port\s*=\s*5432[^}]*cidr_blocks\s*=\s*\[[^\]]*"0\.0\.0\.0\/0"[^\]]*\][^}]*}/gm;

if (permissiveDbIngressPattern.test(content)) {
  failures.push(
    'Found `0.0.0.0/0` ingress on port 5432 in aws_security_group.dev_db. Restrict DB ingress to private CIDRs or approved security groups.'
  );
}

const hasExplicitUnencryptedStorage =
  /resource\s+"aws_db_instance"\s+"dev"[\s\S]*?storage_encrypted\s*=\s*false/m.test(content);

if (hasExplicitUnencryptedStorage) {
  failures.push('Found `storage_encrypted = false` in aws_db_instance.dev. Development RDS must have encryption enabled.');
}

const hasStorageEncryptedTrue =
  /resource\s+"aws_db_instance"\s+"dev"[\s\S]*?storage_encrypted\s*=\s*true/m.test(content);
if (!hasStorageEncryptedTrue) {
  failures.push('Missing `storage_encrypted = true` in aws_db_instance.dev.');
}

if (failures.length > 0) {
  console.error('❌ Dev Terraform DB guardrails failed:\n');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('✅ Dev Terraform DB guardrails passed');
