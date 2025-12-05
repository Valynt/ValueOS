import '@testing-library/jest-dom';
import { vi } from 'vitest';

if (!global.fetch) {
  global.fetch = vi.fn();
}

process.env.VITE_SUPABASE_URL ||= 'http://localhost:54321';
process.env.VITE_SUPABASE_ANON_KEY ||= 'test-anon-key';
