/**
 * Database Test Helpers
 * 
 * Utilities for setting up and tearing down test databases
 */

import { createClient } from '@supabase/supabase-js';
import { createBoltClientMock } from '../mocks/mockSupabaseClient';

const runIntegration = process.env.RUN_INTEGRATION_TESTS === 'true';

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
const SUPABASE_URL = process.env.TEST_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.TEST_SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || '';

// Default to an in-memory supabase mock unless explicitly running integration tests
export const supabase = runIntegration
  ? createClient(SUPABASE_URL, SUPABASE_KEY)
  : (createBoltClientMock() as any);

/**
 * Set up test database
 */
export async function setupTestDatabase(): Promise<void> {
  if (!runIntegration) return;
  // Run migrations if needed
  // This assumes migrations are idempotent
  
  // Clear existing test data
  await cleanupTestDatabase();
}

/**
 * Clean up test database
 */
export async function cleanupTestDatabase(): Promise<void> {
  if (!runIntegration) return;
  // Delete test data in reverse order of dependencies
  const tables = [
    'llm_usage',
    'canvas_versions',
    'canvases',
    'user_sessions',
    'users'
  ];

  for (const table of tables) {
    try {
      // Only delete test data (emails ending with @example.com)
      if (table === 'users') {
        await supabase
          .from(table)
          .delete()
          .like('email', '%@example.com');
      } else {
        // For other tables, delete all data in test environment
        if (process.env.NODE_ENV === 'test') {
          await supabase
            .from(table)
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
        }
      }
    } catch (error) {
      console.warn(`Failed to clean table ${table}:`, error);
    }
  }
}

/**
 * Create test canvas
 */
export async function createTestCanvas(data: {
  userId: string;
  businessDescription: string;
  canvas?: any;
}): Promise<any> {
  if (!runIntegration) {
    // In mock mode, just echo back a canvas-like object
    return {
      id: `mock-canvas-${Date.now()}`,
      user_id: data.userId,
      business_description: data.businessDescription,
      canvas_data: data.canvas,
      status: 'active'
    };
  }
  const { data: canvas, error } = await supabase
    .from('canvases')
    .insert({
      user_id: data.userId,
      business_description: data.businessDescription,
      canvas_data: data.canvas || {
        keyPartners: [],
        keyActivities: [],
        valuePropositions: [],
        customerRelationships: [],
        customerSegments: [],
        keyResources: [],
        channels: [],
        costStructure: [],
        revenueStreams: []
      },
      status: 'active'
    })
    .select()
    .single();

  if (error) throw error;
  return canvas;
}

/**
 * Get canvas by ID
 */
export async function getCanvas(canvasId: string): Promise<any> {
  if (!runIntegration) {
    return { id: canvasId };
  }
  const { data, error } = await supabase
    .from('canvases')
    .select('*')
    .eq('id', canvasId)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update canvas
 */
export async function updateCanvas(canvasId: string, updates: any): Promise<any> {
  if (!runIntegration) {
    return { id: canvasId, ...updates };
  }
  const { data, error } = await supabase
    .from('canvases')
    .update(updates)
    .eq('id', canvasId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete canvas
 */
export async function deleteCanvas(canvasId: string): Promise<void> {
  if (!runIntegration) return;
  const { error } = await supabase
    .from('canvases')
    .delete()
    .eq('id', canvasId);

  if (error) throw error;
}

/**
 * Create test LLM usage record
 */
export async function createTestLLMUsage(data: {
  userId: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  cost: number;
}): Promise<any> {
  if (!runIntegration) {
    return {
      id: `mock-usage-${Date.now()}`,
      user_id: data.userId,
      model: data.model,
      prompt_tokens: data.promptTokens,
      completion_tokens: data.completionTokens,
      cost_usd: data.cost
    };
  }
  const { data: usage, error } = await supabase
    .from('llm_usage')
    .insert({
      user_id: data.userId,
      model: data.model,
      prompt_tokens: data.promptTokens,
      completion_tokens: data.completionTokens,
      cost_usd: data.cost,
      endpoint: '/api/test'
    })
    .select()
    .single();

  if (error) throw error;
  return usage;
}

/**
 * Get LLM usage for user
 */
export async function getLLMUsage(userId: string): Promise<any[]> {
  if (!runIntegration) return [];
  const { data, error } = await supabase
    .from('llm_usage')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Wait for condition to be true
 */
export async function waitFor(
  condition: () => Promise<boolean>,
  options: { timeout?: number; interval?: number } = {}
): Promise<void> {
  const timeout = options.timeout || 5000;
  const interval = options.interval || 100;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error('Timeout waiting for condition');
}

/**
 * Seed test data
 */
export async function seedTestData(): Promise<{
  users: any[];
  canvases: any[];
}> {
  if (!runIntegration) {
    return { users: [], canvases: [] };
  }
  const users = [];
  const canvases = [];

  // Create test users
  for (let i = 0; i < 3; i++) {
    const { data: user } = await supabase.auth.signUp({
      email: `test${i}@example.com`,
      password: 'testpassword123'
    });

    if (user.user) {
      users.push(user.user);

      // Create canvases for each user
      for (let j = 0; j < 2; j++) {
        const canvas = await createTestCanvas({
          userId: user.user.id,
          businessDescription: `Test business ${i}-${j}`
        });
        canvases.push(canvas);
      }
    }
  }

  return { users, canvases };
}
