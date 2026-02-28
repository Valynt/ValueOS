import { describe, expect, it } from 'vitest';

import { resolveSupabaseAnonKey } from './setup';

describe('test setup supabase anon key fallback', () => {
  it('throws if fallback is requested outside NODE_ENV=test', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

    try {
      delete process.env.VITE_SUPABASE_ANON_KEY;
      process.env.NODE_ENV = 'development';

      expect(() => resolveSupabaseAnonKey()).toThrow(
        'VITE_SUPABASE_ANON_KEY fallback can only be used when NODE_ENV is \"test\".',
      );
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
      if (originalAnonKey === undefined) {
        delete process.env.VITE_SUPABASE_ANON_KEY;
      } else {
        process.env.VITE_SUPABASE_ANON_KEY = originalAnonKey;
      }
    }
  });
});
