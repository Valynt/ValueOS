import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@/api/client';
import { deriveWarmth } from '@shared/domain/Warmth';
import type { WarmthResult } from '@shared/domain/Warmth';
import type { SagaStateEnum } from '@shared/domain/ExperienceModel';

/**
 * Value Case type matching backend schema
 */
interface ValueCase {
  id: string;
  name: string;
  saga_state: SagaStateEnum;
  confidence_score: number;
  warmth_overrides?: {
    firmMinimum?: number;
    verifiedMinimum?: number;
  };
  [key: string]: unknown;
}

interface CaseWithWarmth extends ValueCase {
  warmth: WarmthResult;
}

/**
 * Fetch a value case with derived warmth state
 *
 * @param caseId - The case ID to fetch
 * @returns Query result with case data and derived warmth
 */
export function useValueCase(caseId: string | undefined) {
  return useQuery<CaseWithWarmth>({
    queryKey: ['case', caseId],
    queryFn: async () => {
      if (!caseId) throw new Error('Case ID is required');

      const response = await apiClient.get<ValueCase>(`/cases/${caseId}`);
      const caseData = response.data;

      // Derive warmth from saga state and confidence
      const warmth = deriveWarmth(
        caseData.saga_state,
        caseData.confidence_score ?? 0,
        caseData.warmth_overrides
      );

      return {
        ...caseData,
        warmth,
      };
    },
    staleTime: 30_000, // 30 seconds
    enabled: !!caseId,
  });
}

/**
 * Fetch warmth history for a case
 *
 * @param caseId - The case ID
 * @returns Query result with warmth transition history
 */
export function useWarmthHistory(caseId: string | undefined) {
  return useQuery({
    queryKey: ['warmth-history', caseId],
    queryFn: async () => {
      if (!caseId) throw new Error('Case ID is required');

      const response = await apiClient.get(`/cases/${caseId}/warmth-history`);
      return response.data;
    },
    staleTime: 300_000, // 5 minutes - warmth history rarely changes
    enabled: !!caseId,
  });
}
