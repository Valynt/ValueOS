/**
 * Authentication Test Helpers
 * 
 * Utilities for creating test users and generating auth tokens
 */

import { createClient } from '@supabase/supabase-js';
import { sign } from 'jsonwebtoken';

const SUPABASE_URL = process.env.TEST_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.TEST_SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || '';
const JWT_SECRET = process.env.TEST_JWT_SECRET || process.env.JWT_SECRET || 'test-secret';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

interface CreateTestUserOptions {
  email: string;
  password?: string;
  tier?: 'free' | 'basic' | 'pro' | 'enterprise';
  metadata?: Record<string, any>;
}

/**
 * Create a test user
 */
export async function createTestUser(options: CreateTestUserOptions): Promise<any> {
  const {
    email,
    password = 'testpassword123',
    tier = 'free',
    metadata = {}
  } = options;

  // Sign up user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        tier,
        ...metadata
      }
    }
  });

  if (authError) throw authError;
  if (!authData.user) throw new Error('Failed to create user');

  // Update user tier in database
  const { error: updateError } = await supabase
    .from('users')
    .update({ tier })
    .eq('id', authData.user.id);

  if (updateError) throw updateError;

  return {
    id: authData.user.id,
    email: authData.user.email,
    tier,
    ...authData.user
  };
}

/**
 * Get auth token for user
 */
export async function getAuthToken(userId: string): Promise<string> {
  // Generate JWT token
  const token = sign(
    {
      sub: userId,
      aud: 'authenticated',
      role: 'authenticated',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600 // 1 hour
    },
    JWT_SECRET
  );

  return token;
}

/**
 * Sign in test user
 */
export async function signInTestUser(email: string, password: string = 'testpassword123'): Promise<{
  user: any;
  token: string;
}> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) throw error;
  if (!data.user) throw new Error('Failed to sign in');

  return {
    user: data.user,
    token: data.session?.access_token || ''
  };
}

/**
 * Sign out test user
 */
export async function signOutTestUser(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * Delete test user
 */
export async function deleteTestUser(userId: string): Promise<void> {
  // Delete user data
  await supabase
    .from('llm_usage')
    .delete()
    .eq('user_id', userId);

  await supabase
    .from('canvases')
    .delete()
    .eq('user_id', userId);

  // Delete auth user (requires admin privileges)
  // In test environment, this should be handled by cleanup
}

/**
 * Create admin user
 */
export async function createAdminUser(email: string = 'admin@example.com'): Promise<{
  user: any;
  token: string;
}> {
  const user = await createTestUser({
    email,
    tier: 'enterprise',
    metadata: { role: 'admin' }
  });

  const token = await getAuthToken(user.id);

  return { user, token };
}

/**
 * Update user tier
 */
export async function updateUserTier(
  userId: string,
  tier: 'free' | 'basic' | 'pro' | 'enterprise'
): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({ tier })
    .eq('id', userId);

  if (error) throw error;
}

/**
 * Get user by ID
 */
export async function getUser(userId: string): Promise<any> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Create multiple test users
 */
export async function createTestUsers(count: number): Promise<Array<{
  user: any;
  token: string;
}>> {
  const users = [];

  for (let i = 0; i < count; i++) {
    const user = await createTestUser({
      email: `test${i}@example.com`,
      tier: i % 4 === 0 ? 'enterprise' : i % 3 === 0 ? 'pro' : i % 2 === 0 ? 'basic' : 'free'
    });

    const token = await getAuthToken(user.id);

    users.push({ user, token });
  }

  return users;
}

/**
 * Verify token is valid
 */
export function verifyToken(token: string): any {
  try {
    const decoded = sign(token, JWT_SECRET);
    return decoded;
  } catch (error) {
    throw new Error('Invalid token');
  }
}
