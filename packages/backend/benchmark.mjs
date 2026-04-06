import { performance } from 'node:perf_hooks';
import { ValueFabricService } from './dist/services/value/ValueFabricService.js';

const mockCapabilities = Array.from({ length: 50 }, (_, i) => ({ id: `cap-${i}` }));

const mockSupabase = {
  from: (table) => ({
    select: () => ({
      eq: () => ({
        single: async () => {
          if (table === 'use_cases') return { data: { id: 'new-use-case' }, error: null };
          return { data: { is_template: true, name: 'T', description: 'D', persona: 'P', industry: 'I' }, error: null };
        }
      })
    }),
    insert: () => {
      if (table === 'use_cases') {
        return {
          select: () => ({
            single: async () => {
              await new Promise(resolve => setTimeout(resolve, 10)); // 10ms delay
              return { data: { id: 'new-use-case' }, error: null };
            }
          })
        };
      }
      // use_case_capabilities insert
      return new Promise(resolve => {
        setTimeout(() => resolve({ error: null }), 10); // 10ms delay
      });
    }
  })
};

// We need to mock ReadThroughCacheService and others inside the ValueFabricService?
// Let's see if we can just mock the parts we need, but maybe it's easier to mock at module level,
// or just modify the class for the test or inject a better mock.
