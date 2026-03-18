/**
 * Regression tests for getDirectFactory() configuration.
 *
 * DEBT-001: LLMGateway must be constructed with provider "together".
 * DEBT-002: MemorySystem must have enable_persistence: true + SupabaseMemoryBackend.
 *
 * These tests read the source directly to assert the configuration values,
 * providing a stable regression guard that fails if the values are reverted.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

import { describe, expect, it } from 'vitest';

const agentsSource = readFileSync(
  resolve(import.meta.dirname, '../agents.ts'),
  'utf-8',
);

describe('getDirectFactory() — DEBT-001 + DEBT-002 regression', () => {
  it('DEBT-001: LLMGateway is not constructed with provider "openai"', () => {
    // The buggy value was provider: "openai". Assert it is gone.
    expect(agentsSource).not.toMatch(/new LLMGateway\(\s*\{[^}]*provider:\s*["']openai["']/);
  });

  it('DEBT-001: LLMGateway is constructed with provider "together"', () => {
    expect(agentsSource).toMatch(/new LLMGateway\(\s*\{[^}]*provider:\s*["']together["']/);
  });

  it('DEBT-002: MemorySystem is not constructed with enable_persistence: false', () => {
    // The buggy value was enable_persistence: false. Assert it is gone from getDirectFactory.
    // We check the block around getDirectFactory specifically.
    const factoryBlock = agentsSource.slice(
      agentsSource.indexOf('function getDirectFactory'),
      agentsSource.indexOf('const router = Router'),
    );
    expect(factoryBlock).not.toMatch(/enable_persistence:\s*false/);
  });

  it('DEBT-002: MemorySystem is constructed with enable_persistence: true', () => {
    const factoryBlock = agentsSource.slice(
      agentsSource.indexOf('function getDirectFactory'),
      agentsSource.indexOf('const router = Router'),
    );
    expect(factoryBlock).toMatch(/enable_persistence:\s*true/);
  });

  it('DEBT-002: SupabaseMemoryBackend is imported and used in getDirectFactory', () => {
    expect(agentsSource).toMatch(/import.*SupabaseMemoryBackend.*from/);
    const factoryBlock = agentsSource.slice(
      agentsSource.indexOf('function getDirectFactory'),
      agentsSource.indexOf('const router = Router'),
    );
    expect(factoryBlock).toMatch(/new SupabaseMemoryBackend/);
  });
});
