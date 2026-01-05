/**
 * Sprint 1 Fixes - Patch File for settingsRegistry.ts
 * 
 * This file contains the code snippets to apply to settingsRegistry.ts
 * 
 * INSTRUCTIONS:
 * 1. Add the stripScopePrefix method after getColumnForScope
 * 2. Update loadFromDatabase to use stripScopePrefix
 * 3. Update saveSetting to use stripScopePrefix
 * 4. Update deleteSetting to use stripScopePrefix
 * 5. Update useSettings hook's update function to use functional state update
 */

// ============================================================================
// PATCH 1: Add stripScopePrefix method
// ============================================================================
// Location: After getColumnForScope method (around line 510)

/**
 * Strip scope prefix from key (e.g., 'user.theme' -> 'theme')
 * Prevents redundant nesting in JSONB columns
 * 
 * Example:
 * - Input: 'user.theme', scope: 'user'
 * - Output: 'theme'
 * - Stored in DB: { "theme": "dark" } (not { "user": { "theme": "dark" } })
 */
private stripScopePrefix(key: string, scope: 'user' | 'team' | 'organization'): string {
  const prefixes = {
    user: 'user.',
    team: 'team.',
    organization: 'organization.',
  };
  
  const prefix = prefixes[scope];
  if (key.startsWith(prefix)) {
    return key.substring(prefix.length);
  }
  
  return key;
}

// ============================================================================
// PATCH 2: Update loadFromDatabase method
// ============================================================================
// Location: Around line 480
// REPLACE the existing loadFromDatabase method with this:

private async loadFromDatabase(
  key: string,
  scope: 'user' | 'team' | 'organization',
  scopeId: string
): Promise<any> {
  const table = this.getTableForScope(scope);
  const column = this.getColumnForScope(scope);

  const { data, error } = await supabase
    .from(table)
    .select(column)
    .eq('id', scopeId)
    .single();

  if (error || !data) {
    return null;
  }

  const settings = data[column] || {};
  // FIX: Strip scope prefix before looking up in JSONB
  const strippedKey = this.stripScopePrefix(key, scope);
  return this.getNestedValue(settings, strippedKey);
}

// ============================================================================
// PATCH 3: Update saveSetting method
// ============================================================================
// Location: Around line 200
// ADD this line after getting table and column:

async saveSetting(
  key: string,
  value: any,
  scope: 'user' | 'team' | 'organization',
  scopeId: string
): Promise<void> {
  const table = this.getTableForScope(scope);
  const column = this.getColumnForScope(scope);
  
  // FIX: Strip scope prefix to prevent redundant nesting
  const strippedKey = this.stripScopePrefix(key, scope);
  
  const { data: existing } = await supabase
    .from(table)
    .select(column)
    .eq('id', scopeId)
    .single();

  const settings = existing?.[column] || {};
  const updatedSettings = this.setNestedValue(settings, strippedKey, value);

  await supabase
    .from(table)
    .update({
      [column]: updatedSettings,
      updated_at: new Date().toISOString(),
    })
    .eq('id', scopeId);

  // ... rest of method (cache invalidation)
}

// ============================================================================
// PATCH 4: Update deleteSetting method
// ============================================================================
// Location: Around line 250
// ADD this line after getting table and column:

async deleteSetting(
  key: string,
  scope: 'user' | 'team' | 'organization',
  scopeId: string
): Promise<void> {
  const table = this.getTableForScope(scope);
  const column = this.getColumnForScope(scope);
  
  // FIX: Strip scope prefix
  const strippedKey = this.stripScopePrefix(key, scope);

  const { data: existing } = await supabase
    .from(table)
    .select(column)
    .eq('id', scopeId)
    .single();

  const settings = existing?.[column] || {};
  const updatedSettings = this.deleteNestedValue(settings, strippedKey);

  await supabase
    .from(table)
    .update({
      [column]: updatedSettings,
      updated_at: new Date().toISOString(),
    })
    .eq('id', scopeId);

  // ... rest of method (cache invalidation)
}

// ============================================================================
// PATCH 5: Update useSettings hook - update function
// ============================================================================
// Location: Around line 890
// REPLACE the setValue line in the update function:

// BEFORE:
await settingsRegistry.saveSetting(key, newValue, scope, scopeId);
setValue(newValue);  // ❌ STALE CLOSURE RISK

// AFTER:
await settingsRegistry.saveSetting(key, newValue, scope, scopeId);
// FIX: Use functional update to prevent stale closure
setValue(prev => newValue);  // ✅ SAFE

// ============================================================================
// PATCH 6: Add import for useMemo at the top of the file
// ============================================================================
// Location: Line 3
// CHANGE:
import { useEffect, useState } from 'react';

// TO:
import { useEffect, useState, useMemo } from 'react';

// ============================================================================
// VERIFICATION
// ============================================================================

/**
 * After applying patches, verify:
 * 
 * 1. stripScopePrefix method exists and is private
 * 2. loadFromDatabase uses stripScopePrefix
 * 3. saveSetting uses stripScopePrefix
 * 4. deleteSetting uses stripScopePrefix
 * 5. useSettings update function uses setValue(prev => newValue)
 * 6. useMemo is imported from 'react'
 * 
 * Run tests:
 * npm test src/lib/__tests__/settingsRegistry.test.ts
 */

export {};
