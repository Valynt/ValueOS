import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inventoryMigrationVersions } from '../check-migration-versions.mjs';
const fixture = files => {
  const path = mkdtempSync(join(tmpdir(), 'valueos-versions-'));
  for (const name of files) writeFileSync(join(path, name), 'SELECT 1;\n');
  return path;
};
test('same numeric version with distinct names is a collision', () => {
  const report = inventoryMigrationVersions(fixture(['20261106000000_first.sql','20261106000000_second.sql']));
  assert.equal(report.collisions.length, 1);
  assert.equal(report.collisions[0].names.length, 2);
  assert.match(report.migrations[0].sha256, /^[a-f0-9]{64}$/);
});
test('paired rollback and archives do not create false collisions', () => {
  const directory = fixture(['20261106000000_first.sql','20261106000000_first.rollback.sql','20261106000001_second.sql']);
  mkdirSync(join(directory, 'archive'));
  writeFileSync(join(directory, 'archive', '20261106000000_archived.sql'), 'SELECT 2;');
  const report = inventoryMigrationVersions(directory);
  assert.equal(report.forward_count, 2);
  assert.deepEqual(report.collisions, []);
});
test('missing, empty and malformed migration sets fail closed', () => {
  const directory = fixture([]);
  assert.throws(() => inventoryMigrationVersions(join(directory, 'missing')), /missing/);
  assert.throws(() => inventoryMigrationVersions(directory), /No active/);
  writeFileSync(join(directory, 'bad.sql'), 'SELECT 1;');
  assert.deepEqual(inventoryMigrationVersions(directory).invalid, ['bad.sql']);
});
test('changing SQL changes the evidence digest', () => {
  const directory = fixture(['20261106000000_first.sql']);
  const before = inventoryMigrationVersions(directory).migrations[0].sha256;
  writeFileSync(join(directory, '20261106000000_first.sql'), 'SELECT 2;\n');
  assert.notEqual(inventoryMigrationVersions(directory).migrations[0].sha256, before);
});
