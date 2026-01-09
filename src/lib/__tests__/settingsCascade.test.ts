/**
 * Settings Cascade Logic Tests
 * Phase 5: Testing & QA
 * 
 * Tests that settings correctly cascade:
 * User → Team → Organization → System Default
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsRegistry } from '../settingsRegistry';
import { supabase } from '../supabase';

// Mock Supabase
vi.mock('../supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('Settings Cascade Logic', () => {
  let settingsRegistry: SettingsRegistry;
  const mockUserId = 'user-123';
  const mockTeamId = 'team-456';
  const mockOrgId = 'org-789';

  beforeEach(() => {
    settingsRegistry = new SettingsRegistry([]);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Cascade Priority: User → Team → Org → Default', () => {
    it('should use user setting when available', async () => {
      // Mock user setting exists
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { user_preferences: { theme: 'dark' } },
              error: null,
            }),
          }),
        }),
      });
      (supabase.from as any) = mockFrom;

      const result = await settingsRegistry.loadSetting('user.theme', {
        userId: mockUserId,
        teamId: mockTeamId,
        organizationId: mockOrgId,
      });

      expect(result).toBe('dark');
      expect(mockFrom).toHaveBeenCalledWith('users');
    });

    it('should fall back to team setting when user setting is null', async () => {
      let callCount = 0;
      const mockFrom = vi.fn().mockImplementation((table: string) => {
        callCount++;
        
        if (table === 'users') {
          // User setting is null
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { user_preferences: {} },
                  error: null,
                }),
              }),
            }),
          };
        }
        
        if (table === 'teams') {
          // Team setting exists
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { team_settings: { theme: 'light' } },
                  error: null,
                }),
              }),
            }),
          };
        }

        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: null,
              }),
            }),
          }),
        };
      });
      (supabase.from as any) = mockFrom;

      const result = await settingsRegistry.loadSetting('user.theme', {
        userId: mockUserId,
        teamId: mockTeamId,
        organizationId: mockOrgId,
      });

      expect(result).toBe('light');
      expect(mockFrom).toHaveBeenCalledWith('users');
      expect(mockFrom).toHaveBeenCalledWith('teams');
    });

    it('should fall back to org setting when user and team settings are null', async () => {
      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { user_preferences: {} },
                  error: null,
                }),
              }),
            }),
          };
        }
        
        if (table === 'teams') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { team_settings: {} },
                  error: null,
                }),
              }),
            }),
          };
        }

        if (table === 'organizations') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { organization_settings: { theme: 'system' } },
                  error: null,
                }),
              }),
            }),
          };
        }

        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: null,
              }),
            }),
          }),
        };
      });
      (supabase.from as any) = mockFrom;

      const result = await settingsRegistry.loadSetting('user.theme', {
        userId: mockUserId,
        teamId: mockTeamId,
        organizationId: mockOrgId,
      });

      expect(result).toBe('system');
      expect(mockFrom).toHaveBeenCalledWith('users');
      expect(mockFrom).toHaveBeenCalledWith('teams');
      expect(mockFrom).toHaveBeenCalledWith('organizations');
    });

    it('should use system default when all settings are null', async () => {
      const mockFrom = vi.fn().mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { user_preferences: {}, team_settings: {}, organization_settings: {} },
              error: null,
            }),
          }),
        }),
      }));
      (supabase.from as any) = mockFrom;

      // Set a default value
      settingsRegistry.setDefaultValue('user.theme', 'light');

      const result = await settingsRegistry.loadSetting('user.theme', {
        userId: mockUserId,
        teamId: mockTeamId,
        organizationId: mockOrgId,
      });

      expect(result).toBe('light');
    });
  });

  describe('Cascade with Missing Context', () => {
    it('should skip user level when userId is not provided', async () => {
      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === 'teams') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { team_settings: { theme: 'team-theme' } },
                  error: null,
                }),
              }),
            }),
          };
        }

        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: null,
              }),
            }),
          }),
        };
      });
      (supabase.from as any) = mockFrom;

      const result = await settingsRegistry.loadSetting('user.theme', {
        teamId: mockTeamId,
        organizationId: mockOrgId,
      });

      expect(result).toBe('team-theme');
      expect(mockFrom).not.toHaveBeenCalledWith('users');
      expect(mockFrom).toHaveBeenCalledWith('teams');
    });

    it('should skip team level when teamId is not provided', async () => {
      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { user_preferences: {} },
                  error: null,
                }),
              }),
            }),
          };
        }

        if (table === 'organizations') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { organization_settings: { theme: 'org-theme' } },
                  error: null,
                }),
              }),
            }),
          };
        }

        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: null,
              }),
            }),
          }),
        };
      });
      (supabase.from as any) = mockFrom;

      const result = await settingsRegistry.loadSetting('user.theme', {
        userId: mockUserId,
        organizationId: mockOrgId,
      });

      expect(result).toBe('org-theme');
      expect(mockFrom).toHaveBeenCalledWith('users');
      expect(mockFrom).not.toHaveBeenCalledWith('teams');
      expect(mockFrom).toHaveBeenCalledWith('organizations');
    });
  });

  describe('Cascade with Nested Settings', () => {
    it('should cascade nested settings correctly', async () => {
      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === 'users') {
          // User has no notification settings
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { user_preferences: {} },
                  error: null,
                }),
              }),
            }),
          };
        }

        if (table === 'teams') {
          // Team has notification settings
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    team_settings: {
                      notifications: {
                        email: true,
                        slack: false,
                      },
                    },
                  },
                  error: null,
                }),
              }),
            }),
          };
        }

        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: null,
              }),
            }),
          }),
        };
      });
      (supabase.from as any) = mockFrom;

      const result = await settingsRegistry.loadSetting('user.notifications.email', {
        userId: mockUserId,
        teamId: mockTeamId,
        organizationId: mockOrgId,
      });

      expect(result).toBe(true);
    });
  });

  describe('Cascade Performance', () => {
    it('should stop cascade as soon as a value is found', async () => {
      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { user_preferences: { theme: 'user-theme' } },
                  error: null,
                }),
              }),
            }),
          };
        }

        // These should never be called
        throw new Error(`Unexpected call to ${table}`);
      });
      (supabase.from as any) = mockFrom;

      const result = await settingsRegistry.loadSetting('user.theme', {
        userId: mockUserId,
        teamId: mockTeamId,
        organizationId: mockOrgId,
      });

      expect(result).toBe('user-theme');
      expect(mockFrom).toHaveBeenCalledTimes(1);
      expect(mockFrom).toHaveBeenCalledWith('users');
    });
  });

  describe('Cascade with Errors', () => {
    it('should continue cascade if user query fails', async () => {
      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: { message: 'Database error' },
                }),
              }),
            }),
          };
        }

        if (table === 'teams') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { team_settings: { theme: 'team-theme' } },
                  error: null,
                }),
              }),
            }),
          };
        }

        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: null,
              }),
            }),
          }),
        };
      });
      (supabase.from as any) = mockFrom;

      const result = await settingsRegistry.loadSetting('user.theme', {
        userId: mockUserId,
        teamId: mockTeamId,
        organizationId: mockOrgId,
      });

      expect(result).toBe('team-theme');
    });
  });
});
