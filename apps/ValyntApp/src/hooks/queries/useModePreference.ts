import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiClient } from '@/api/client';
import type { WorkspaceMode } from '@shared/domain/Warmth';

/**
 * User preferences interface
 */
interface UserPreferences {
  mode: WorkspaceMode;
  density: 'compact' | 'comfortable' | 'spacious';
  inspectorOpen: boolean;
  sidebarCollapsed: boolean;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  mode: 'canvas',
  density: 'comfortable',
  inspectorOpen: true,
  sidebarCollapsed: false,
};

/**
 * Fetch user mode and UI preferences
 * 
 * @returns Query result with user preferences
 */
export function useModePreference() {
  return useQuery({
    queryKey: ['user-preferences'],
    queryFn: async () => {
      const response = await apiClient.get<UserPreferences>('/users/me/preferences');
      return response.data ?? DEFAULT_PREFERENCES;
    },
    staleTime: Infinity, // Only change on explicit edit
    initialData: DEFAULT_PREFERENCES,
  });
}

/**
 * Update user mode preference
 * 
 * @returns Mutation result with update function
 */
export function useUpdateModePreference() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (preferences: Partial<UserPreferences>) => {
      const response = await apiClient.put<UserPreferences>(
        '/users/me/preferences',
        preferences
      );
      return response.data;
    },

    // Optimistic update
    onMutate: async (newPreferences) => {
      await queryClient.cancelQueries({ queryKey: ['user-preferences'] });
      
      const previousPreferences = queryClient.getQueryData<UserPreferences>(
        ['user-preferences']
      );

      queryClient.setQueryData(['user-preferences'], (old: UserPreferences | undefined) => ({
        ...(old ?? DEFAULT_PREFERENCES),
        ...newPreferences,
      }));

      return { previousPreferences };
    },

    // Rollback on error
    onError: (error, newPreferences, context) => {
      if (context?.previousPreferences) {
        queryClient.setQueryData(['user-preferences'], context.previousPreferences);
      }
    },

    // Refetch after settled
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['user-preferences'] });
    },
  });
}
