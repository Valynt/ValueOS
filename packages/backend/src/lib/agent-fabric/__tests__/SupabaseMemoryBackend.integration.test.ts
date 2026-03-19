/**
 * SupabaseMemoryBackend — integration tests
 *
 * Runs against deterministic test doubles by default.
 * Set VALUEOS_TEST_REAL_INTEGRATION=true to exercise the real Supabase-backed
 * semantic store explicitly.
 */

import type { SemanticFact, SemanticStore } from '@valueos/memory';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { Memory } from '../MemorySystem.js';
import { resetCrossWorkspaceAllowlistCache, SupabaseMemoryBackend } from '../SupabaseMemoryBackend.js';
import { createServerSupabaseClient } from '../../supabase.js';
import { isRealIntegrationTestMode } from '../../../test/runtimeGuards';

const SUPABASE_URL =
  process.env['SUPABASE_URL'] ?? process.env['VITE_SUPABASE_URL'];
const SUPABASE_KEY =
  process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? process.env['SUPABASE_SERVICE_KEY'];

const useRealSupabase = isRealIntegrationTestMode() && Boolean(SUPABASE_URL && SUPABASE_KEY);

class InMemorySemanticStore implements Pick<SemanticStore, 'insert'> {
  private readonly facts: SemanticFact[] = [];

  async insert(fact: SemanticFact): Promise<void> {
    this.facts.push(structuredClone(fact));
  }

  async findFiltered(filters: {
    organizationId: string;
    type: SemanticFact['type'];
    agentType?: string;
    sessionId?: string;
    memoryType?: string;
    minImportance?: number;
    limit: number;
  }): Promise<SemanticFact[]> {
    return this.facts
      .filter((fact) => fact.organizationId === filters.organizationId)
      .filter((fact) => fact.type === filters.type)
      .filter((fact) => (!filters.agentType ? true : fact.metadata['agentType'] === filters.agentType))
      .filter((fact) => (!filters.sessionId ? true : fact.metadata['session_id'] === filters.sessionId))
      .filter((fact) => (!filters.memoryType ? true : fact.metadata['agent_memory_type'] === filters.memoryType))
      .filter((fact) => {
        if (filters.minImportance === undefined) return true;
        const importance = typeof fact.metadata['importance'] === 'number' ? fact.metadata['importance'] : 0;
        return importance >= filters.minImportance;
      })
      .sort((a, b) => {
        const left = typeof a.metadata['importance'] === 'number' ? a.metadata['importance'] : 0;
        const right = typeof b.metadata['importance'] === 'number' ? b.metadata['importance'] : 0;
        return right - left;
      })
      .slice(0, filters.limit)
      .map((fact) => structuredClone(fact));
  }
}

const ORG_A = `integ-test-org-a-${Date.now()}`;
const ORG_B = `integ-test-org-b-${Date.now()}`;
const SESSION_1 = `integ-session-1-${Date.now()}`;
const SESSION_2 = `integ-session-2-${Date.now()}`;

function makeMemory(overrides: Partial<Memory> = {}): Memory {
  return {
    id: `mem-${Math.random().toString(36).slice(2)}`,
    agent_id: 'OpportunityAgent',
    organization_id: ORG_A,
    workspace_id: SESSION_1,
    content: 'Integration test: discovered fintech opportunity in payments vertical',
    memory_type: 'episodic',
    importance: 0.75,
    created_at: new Date().toISOString(),
    accessed_at: new Date().toISOString(),
    access_count: 0,
    metadata: { organization_id: ORG_A, confidence: 0.85 },
    ...overrides,
  };
}

const storedIds: string[] = [];

afterAll(async () => {
  if (!useRealSupabase || storedIds.length === 0) return;

  const client = createServerSupabaseClient();
  await client.from('semantic_memory').delete().in('id', storedIds);
});

describe(`SupabaseMemoryBackend (${useRealSupabase ? 'real-supabase' : 'deterministic-double'})`, () => {
  let backendA: SupabaseMemoryBackend;
  let backendB: SupabaseMemoryBackend;

  beforeAll(() => {
    const semanticStore = useRealSupabase ? undefined : new InMemorySemanticStore();
    backendA = new SupabaseMemoryBackend(semanticStore);
    backendB = new SupabaseMemoryBackend(semanticStore);
  });


  beforeEach(() => {
    process.env.CROSS_WORKSPACE_MEMORY_ALLOWLIST = '';
    resetCrossWorkspaceAllowlistCache();
  });

  it('does not return session 1 memory when session 2 queries by default', async () => {
    const memory = makeMemory({ workspace_id: SESSION_1 });

    const storedId = await backendA.store(memory);
    storedIds.push(storedId);

    const results = await backendB.retrieve({
      agent_id: 'OpportunityAgent',
      organization_id: ORG_A,
      workspace_id: SESSION_2,
      limit: 10,
    });

    const found = results.find((m) => m.content === memory.content);
    expect(found).toBeUndefined();
  }, 15_000);

  it('returns session 1 memory to session 2 only when include_cross_workspace is set', async () => {
    process.env.CROSS_WORKSPACE_MEMORY_ALLOWLIST = ORG_A;

    const memory = makeMemory({ workspace_id: SESSION_1 });
    const storedId = await backendA.store(memory);
    storedIds.push(storedId);

    const results = await backendB.retrieve({
      agent_id: 'OpportunityAgent',
      organization_id: ORG_A,
      workspace_id: SESSION_2,
      include_cross_workspace: true,
      cross_workspace_reason: 'Historical recall for tenant-wide continuity',
      limit: 10,
    });

    const found = results.find((m) => m.content === memory.content);
    expect(found).toBeDefined();
    expect(found?.workspace_id).toBe(SESSION_1);
  }, 15_000);

  it('returns empty results when retrieving with a different organization_id', async () => {
    const memory = makeMemory({ organization_id: ORG_A, workspace_id: SESSION_1 });

    const storedId = await backendA.store(memory);
    storedIds.push(storedId);

    const results = await backendB.retrieve({
      agent_id: 'OpportunityAgent',
      organization_id: ORG_B,
      limit: 50,
    });

    const leaked = results.filter((m) => m.content === memory.content);
    expect(leaked).toHaveLength(0);
  }, 15_000);

  it('throws when organization_id is missing', async () => {
    const memory = makeMemory({ organization_id: '' });
    await expect(backendA.store(memory)).rejects.toThrow('organization_id required');
  });

  it('throws when retrieve() is called without organization_id', async () => {
    await expect(
      backendA.retrieve({ agent_id: 'OpportunityAgent', organization_id: '' }),
    ).rejects.toThrow('organization_id is required');
  });

  it('throws when include_cross_workspace is set without cross_workspace_reason', async () => {
    await expect(
      backendA.retrieve({
        agent_id: 'OpportunityAgent',
        organization_id: ORG_A,
        workspace_id: SESSION_2,
        include_cross_workspace: true,
      }),
    ).rejects.toThrow('cross_workspace_reason is required');
  });

  it('returns memories ordered by importance descending', async () => {
    const low = makeMemory({ importance: 0.3, content: 'low importance signal' });
    const high = makeMemory({ importance: 0.95, content: 'high importance signal' });

    const [idLow, idHigh] = await Promise.all([backendA.store(low), backendA.store(high)]);
    storedIds.push(idLow, idHigh);

    const results = await backendB.retrieve({
      agent_id: 'OpportunityAgent',
      organization_id: ORG_A,
      limit: 20,
    });

    const testResults = results.filter((m) => m.content === low.content || m.content === high.content);
    expect(testResults.length).toBeGreaterThanOrEqual(2);

    const highIdx = testResults.findIndex((m) => m.content === high.content);
    const lowIdx = testResults.findIndex((m) => m.content === low.content);
    expect(highIdx).toBeLessThan(lowIdx);
  }, 15_000);
});
