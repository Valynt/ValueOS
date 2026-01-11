/**
 * Minimal Test Setup
 * 
 * Lightweight setup for unit tests that don't need database.
 * No Supabase, no Docker, just basic test utilities.
 */

import { beforeAll, afterAll } from "vitest";
import { vi } from "vitest";
import '@testing-library/jest-dom';

// Mock Supabase client for tests that import it
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      signIn: vi.fn().mockResolvedValue({ data: null, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  })),
}));

// Mock environment variables
process.env.NODE_ENV = "test";
process.env.VITE_APP_ENV = "test";

beforeAll(() => {
  console.log("🧪 Minimal test setup loaded");
});

afterAll(() => {
  console.log("✅ Tests complete");
});
