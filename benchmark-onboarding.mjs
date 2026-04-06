import { performance } from 'perf_hooks';
// we can mock supabase to simulate latency
const mockIds = Array.from({ length: 50 }, (_, i) => `id-${i}`);
const mockTenantId = 'tenant-1';

const mockSupabase = {
  from: (table) => ({
    select: () => ({
      eq: () => ({
        eq: () => ({
          single: async () => {
            // simulate network latency
            await new Promise(r => setTimeout(r, 10));
            return { data: { id: 'some-id', status: 'suggested', entity_type: 'product', payload: {}, context_id: 'ctx-1' }, error: null };
          }
        })
      }),
      in: () => ({
        eq: async () => {
           await new Promise(r => setTimeout(r, 10));
           return { data: mockIds.map(id => ({ id, status: 'suggested', entity_type: 'product', payload: {}, context_id: 'ctx-1' })), error: null };
        }
      })
    })
  })
};

async function originalFetch(ids) {
  const results = [];
  for (const id of ids) {
    const { data: suggestion, error: fetchErr } = await mockSupabase
      .from('company_research_suggestions')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', mockTenantId)
      .single();
    results.push(suggestion);
  }
  return results;
}

async function optimizedFetch(ids) {
  const { data: suggestions, error: fetchErr } = await mockSupabase
    .from('company_research_suggestions')
    .select('*')
    .in('id', ids)
    .eq('tenant_id', mockTenantId);
  return suggestions;
}

async function run() {
  const startOriginal = performance.now();
  await originalFetch(mockIds);
  const endOriginal = performance.now();
  console.log(`Original: ${endOriginal - startOriginal}ms`);

  const startOptimized = performance.now();
  await optimizedFetch(mockIds);
  const endOptimized = performance.now();
  console.log(`Optimized: ${endOptimized - startOptimized}ms`);
}

run();
